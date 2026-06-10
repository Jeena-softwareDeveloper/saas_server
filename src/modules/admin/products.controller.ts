import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';
import { uploadToS3, deleteFromS3 } from '../../config/s3';

export const getAdminProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '10', category, search, isPublished } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (category) where.categoryId = category;
    if (search) where.name = { contains: search as string, mode: 'insensitive' };
    if (isPublished !== undefined) where.isPublished = isPublished === 'true';
    const tenantId = ((req as any).user?.tenantId || null);
    if (tenantId) where.tenantId = tenantId;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          images: { select: { imageUrl: true, isPrimary: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({ success: true, data: { data: products, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};

export const getAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        category: true
      }
    });

    if (!product) {
      next(createError('Product not found', 404));
      return;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

export const generateIdentifiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let shopPrefix = 'GEN';
    
    const userId = (req as any).user?.userId;
    const userTenantId = (req as any).user?.tenantId;
    
    let tenant = null;
    if (userTenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: userTenantId } });
    } else if (userId) {
      tenant = await prisma.tenant.findUnique({ where: { ownerId: userId } });
    }

    if (tenant && tenant.name) {
      shopPrefix = tenant.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
      if (shopPrefix.length === 0) shopPrefix = 'GEN';
    }

    const date = new Date();
    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    
    const count = await prisma.product.count({
      where: tenant ? { tenantId: tenant.id } : {}
    });
    
    const prodNumber = String(count + 1).padStart(4, '0');

    const sku = `${shopPrefix}-${dateString}-${prodNumber}`;
    const barcode = `890${dateString.substring(2)}${prodNumber}`;
    
    res.json({ success: true, data: { sku, barcode } });
  } catch (err) {
    next(err);
  }
};

export const createAdminProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, price, comparePrice, costPrice, stockQuantity, sku, categoryId, isPublished, isFeatured, weight, tags, gstPercentage, isCodEnabled, codCharge, shippingCharge } = req.body;
    
    if (!name || !price || !categoryId) {
      next(createError('Name, price and category are required', 400));
      return;
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const files = req.files as Express.Multer.File[] | undefined;
    const uploadedImages: string[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
        uploadedImages.push(url);
      }
    }

    const tagsArray = tags ? tags.split(',').map((t: string) => t.trim()) : [];

    let finalSku = sku;
    if (!finalSku) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      const catPrefix = category?.name ? category.name.substring(0, 4).toUpperCase() : 'PROD';
      
      const words = name.split(/[^a-zA-Z0-9]/).filter((w: string) => w.length > 2);
      const namePrefix = words.length > 0 ? words[0].substring(0, 4).toUpperCase() : name.substring(0, 4).toUpperCase();
      
      const count = await prisma.product.count({ where: { categoryId } });
      finalSku = `${catPrefix}-${namePrefix}-${String(count + 1).padStart(3, '0')}`;
    }

    const product = await prisma.product.create({
      data: {
        tenantId: ((req as any).user?.tenantId || null) || null,
        name,
        slug: `${slug}-${Date.now()}`,
        description,
        price,
        comparePrice: comparePrice || null,
        costPrice: costPrice || null,
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : 0,
        sku: finalSku,
        categoryId,
        isPublished: isPublished === 'true' || isPublished === true,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        weight: weight ? parseFloat(weight) : null,
        tags: tagsArray,
        gstPercentage: gstPercentage ? parseInt(gstPercentage) : 0,
        isCodEnabled: isCodEnabled !== undefined ? (isCodEnabled === 'true' || isCodEnabled === true) : true,
        codCharge: codCharge ? parseFloat(codCharge) : 0,
        shippingCharge: shippingCharge ? parseFloat(shippingCharge) : 0,
        createdBy: req.user?.userId,
        images: {
          create: uploadedImages.map((url, i) => ({
            imageUrl: url,
            isPrimary: i === 0,
            sortOrder: i
          }))
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Product created',
      data: product
    });
  } catch (err) {
    next(err);
  }
};

export const updateAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Trigger restart for Prisma client update 2
  try {
    const id = req.params['id'] as string;
    const { name, description, price, comparePrice, costPrice, stockQuantity, sku, categoryId, weight, tags, gstPercentage, isCodEnabled, codCharge, shippingCharge } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Product not found', 404));
      return;
    }

    const updateData: any = {};
    if (name) {
      updateData.name = name;
      updateData.slug = `${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;
    }
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (comparePrice !== undefined) updateData.comparePrice = comparePrice;
    if (costPrice !== undefined) updateData.costPrice = costPrice;
    if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity);
    if (sku !== undefined) updateData.sku = sku;
    if (categoryId !== undefined) updateData.category = { connect: { id: categoryId } };
    if (weight !== undefined) updateData.weight = parseFloat(weight);
    if (tags !== undefined) updateData.tags = tags.split(',').map((t: string) => t.trim());
    if (gstPercentage !== undefined) updateData.gstPercentage = parseInt(gstPercentage);
    if (isCodEnabled !== undefined) updateData.isCodEnabled = isCodEnabled === 'true' || isCodEnabled === true;
    if (codCharge !== undefined) updateData.codCharge = parseFloat(codCharge);
    if (shippingCharge !== undefined) updateData.shippingCharge = parseFloat(shippingCharge);

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });

    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      const uploadedImages: string[] = [];
      for (const file of files) {
        const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
        uploadedImages.push(url);
      }
      
      const existingImages = await prisma.productImage.count({ where: { productId: id } });
      
      await prisma.productImage.createMany({
        data: uploadedImages.map((url, i) => ({
          productId: id,
          imageUrl: url,
          isPrimary: existingImages === 0 && i === 0,
          sortOrder: existingImages + i
        }))
      });
    }

    res.json({ success: true, message: 'Product updated', data: product });
  } catch (err) {
    next(err);
  }
};

export const deleteAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    
    await prisma.product.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const toggleProductPublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) { next(createError('Not found', 404)); return; }

    const product = await prisma.product.update({
      where: { id },
      data: { isPublished: !existing.isPublished }
    });

    res.json({ success: true, data: { is_published: product.isPublished } });
  } catch (err) {
    next(err);
  }
};

export const addProductImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const files = req.files as Express.Multer.File[] | undefined;
    
    if (!files || files.length === 0) {
      next(createError('No images provided', 400));
      return;
    }

    const existingImages = await prisma.productImage.count({ where: { productId: id } });

    const newImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
      
      const img = await prisma.productImage.create({
        data: {
          productId: id,
          imageUrl: url,
          isPrimary: existingImages === 0 && i === 0,
          sortOrder: existingImages + i
        }
      });
      newImages.push({ id: img.id, image_url: img.imageUrl, is_primary: img.isPrimary });
    }

    res.status(201).json({ success: true, message: 'Images added', data: newImages });
  } catch (err) {
    next(err);
  }
};

export const removeProductImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const imgId = req.params['imgId'] as string;
    
    const img = await prisma.productImage.findUnique({ where: { id: imgId } });
    if (img) {
      await deleteFromS3(img.imageUrl).catch(() => {});
      await prisma.productImage.delete({ where: { id: imgId } });
    }

    res.json({ success: true, message: 'Image removed' });
  } catch (err) {
    next(err);
  }
};

export const addProductVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const {
      variantName, sku, price, compareAtPrice, stockQuantity, attributes,
      description, tags, weight,
      gstPercentage, shippingCharge, codCharge, isCodEnabled, isPublished, isFeatured
    } = req.body;

    if (!variantName) { next(createError('Variant name is required', 400)); return; }

    // Upload variant images
    const files = req.files as Express.Multer.File[] | undefined;
    const uploadedImages: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
        uploadedImages.push(url);
      }
    }

    const tagsArray = tags ? tags.split(',').map((t: string) => t.trim()) : [];

    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        variantName,
        sku: sku || null,
        price: price ? parseFloat(price) : null,
        compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : 0,
        attributes: attributes ? JSON.parse(attributes) : null,
        description: description || null,
        tags: tagsArray,
        weight: weight ? parseFloat(weight) : null,
        gstPercentage: gstPercentage ? parseInt(gstPercentage) : 0,
        shippingCharge: shippingCharge ? parseFloat(shippingCharge) : 0,
        codCharge: codCharge ? parseFloat(codCharge) : 0,
        isCodEnabled: isCodEnabled !== undefined ? (isCodEnabled === 'true' || isCodEnabled === true) : true,
        isPublished: isPublished !== undefined ? (isPublished === 'true' || isPublished === true) : true,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        images: {
          create: uploadedImages.map((url, i) => ({
            imageUrl: url,
            isPrimary: i === 0,
            sortOrder: i
          }))
        }
      },
      include: { images: true }
    });

    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    next(err);
  }
};

export const deleteProductVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vid = req.params['vid'] as string;
    await prisma.productVariant.delete({ where: { id: vid } });
    res.json({ success: true, message: 'Variant deleted' });
  } catch (err) {
    next(err);
  }
};

export const updateProductVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vid = req.params['vid'] as string;
    const { price, stockQuantity } = req.body;

    const updateData: any = {};
    if (price !== undefined) updateData.price = price;
    if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity);

    const variant = await prisma.productVariant.update({
      where: { id: vid },
      data: updateData
    });

    res.json({ success: true, data: variant });
  } catch (err) {
    next(err);
  }
};

export const bulkImportProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = req.file;
    if (!file) { next(createError('CSV file required', 400)); return; }

    const csvContent = file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    let imported = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const [name, price, stock, categoryId] = lines[i].split(',').map(v => v.trim());
      
      if (!name || !price || !categoryId) {
        errors.push(`Row ${i + 1}: Missing required fields (name, price, categoryId)`);
        continue;
      }

      try {
        await prisma.product.create({
          data: {
            name,
            slug: `${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}-${i}`,
            price: parseFloat(price),
            stockQuantity: parseInt(stock) || 0,
            categoryId
          }
        });
        imported++;
      } catch (rowErr: any) {
        errors.push(`Row ${i + 1}: Failed to import - ${rowErr.message}`);
      }
    }

    res.status(201).json({ success: true, data: { imported, failed: errors.length, errors } });
  } catch (err) {
    next(err);
  }
};
