import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { uploadToS3, deleteFromS3 } from '../../config/s3';
import { createError } from '../../middleware/errorHandler';

export const getAllCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Super-admin can pass ?tenantId= to fetch categories for a specific client
    const queryTenantId = req.query['tenantId'] as string | undefined;
    const userTenantId = (req as any).user?.tenantId || null;
    const tenantId = queryTenantId || userTenantId;

    const categories = await prisma.category.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { sortOrder: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true } }
      }
    });

    const mapped = categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      parent: c.parent?.name || null,
      image_url: c.imageUrl,
      banner_url: c.bannerUrl,
      is_active: c.isActive,
      sort_order: c.sortOrder,
      products_count: c._count.products
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, parentId, isActive, sortOrder } = req.body;
    
    if (!name) {
      next(createError('Name is required', 400));
      return;
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.image?.[0];
    const bannerFile = files?.banner?.[0];

    let imageUrl = null;
    if (imageFile) {
      imageUrl = await uploadToS3(imageFile.buffer, imageFile.originalname, imageFile.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
    }

    let bannerUrl = null;
    if (bannerFile) {
      bannerUrl = await uploadToS3(bannerFile.buffer, bannerFile.originalname, bannerFile.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
    }

    const category = await prisma.category.create({
      data: {
        tenantId: ((req as any).user?.tenantId || null) || null,
        name,
        slug: `${slug}-${Date.now()}`,
        description,
        imageUrl,
        bannerUrl,
        parentId: parentId || null,
        isActive: isActive === 'true' || isActive === true,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0
      }
    });

    res.status(201).json({
      success: true,
      message: 'Category created',
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        image_url: category.imageUrl,
        banner_url: category.bannerUrl
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { name, description, parentId, isActive, sortOrder } = req.body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Category not found', 404));
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.image?.[0];
    const bannerFile = files?.banner?.[0];

    let imageUrl = existing.imageUrl;
    if (imageFile) {
      imageUrl = await uploadToS3(imageFile.buffer, imageFile.originalname, imageFile.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
      if (existing.imageUrl) {
        await deleteFromS3(existing.imageUrl).catch(() => {});
      }
    }

    let bannerUrl = existing.bannerUrl;
    if (bannerFile) {
      bannerUrl = await uploadToS3(bannerFile.buffer, bannerFile.originalname, bannerFile.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
      if (existing.bannerUrl) {
        await deleteFromS3(existing.bannerUrl).catch(() => {});
      }
    }

    const updateData: any = {};
    if (name) {
      updateData.name = name;
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      updateData.slug = `${slug}-${Date.now()}`;
    }
    if (description !== undefined) updateData.description = description;
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (imageFile) updateData.imageUrl = imageUrl;
    if (bannerFile) updateData.bannerUrl = bannerUrl;

    const category = await prisma.category.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, message: 'Category updated', data: category });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: { select: { id: true } } }
    });

    if (!category) {
      next(createError('Category not found', 404));
      return;
    }

    if (category.products.length > 0) {
      next(createError('Cannot delete category with products. Reassign products first.', 400));
      return;
    }

    if (category.imageUrl) {
      await deleteFromS3(category.imageUrl).catch(() => {});
    }
    if (category.bannerUrl) {
      await deleteFromS3(category.bannerUrl).catch(() => {});
    }

    await prisma.category.delete({ where: { id } });

    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

export const toggleCategoryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Category not found', 404));
      return;
    }

    const category = await prisma.category.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    res.json({ success: true, data: { is_active: category.isActive } });
  } catch (err) {
    next(err);
  }
};
