import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';
import { uploadToS3, deleteFromS3 } from '../../config/s3';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().positive(),
  comparePrice: z.coerce.number().positive().optional(),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  sku: z.string().optional(),
  categoryId: z.string(),
  isPublished: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  tags: z.string().optional(), // comma separated
  weight: z.coerce.number().optional(),
});

export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '12',
      category,
      search,
      minPrice,
      maxPrice,
      featured,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const tenantId = (req as any).tenant?.id || null;
    const where: Record<string, unknown> = { isPublished: true, tenantId };

    if (category) where['category'] = { slug: category as string };
    if (search) where['name'] = { contains: search as string, mode: 'insensitive' };
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) priceFilter['gte'] = parseFloat(minPrice as string);
      if (maxPrice) priceFilter['lte'] = parseFloat(maxPrice as string);
      where['price'] = priceFilter;
    }
    if (featured === 'true') where['isFeatured'] = true;

    const allowedSorts = ['name', 'price', 'createdAt'];
    const sortField = allowedSorts.includes(sort as string) ? (sort as string) : 'createdAt';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: where as any,
        skip,
        take: limitNum,
        orderBy: { [sortField]: order === 'asc' ? 'asc' : 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          reviews: { select: { rating: true } },
          images: { select: { imageUrl: true, isPrimary: true } },
          variants: { select: { price: true, compareAtPrice: true, images: { select: { imageUrl: true, isPrimary: true } } } }
        },
      }),
      prisma.product.count({ where: where as any }),
    ]);

    const productsWithRating = products.map((p) => {
      let displayPrice = Number(p.price);
      let displayComparePrice = p.comparePrice ? Number(p.comparePrice) : null;
      if (displayPrice === 0 && p.variants && p.variants.length > 0) {
        const lowestVariant = p.variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min), p.variants[0]);
        displayPrice = Number(lowestVariant.price);
        displayComparePrice = lowestVariant.compareAtPrice ? Number(lowestVariant.compareAtPrice) : null;
      }
      let displayImages = p.images;
      if (!displayImages || displayImages.length === 0) {
        if (p.variants && p.variants.length > 0) {
          for (const variant of p.variants) {
            const vImage = (variant as any).images?.find((i: any) => i.isPrimary) || (variant as any).images?.[0];
            if (vImage) {
              displayImages = [vImage];
              break;
            }
          }
        }
      }
      
      return {
        ...p,
        price: displayPrice,
        comparePrice: displayComparePrice,
        images: displayImages,
        avgRating:
          p.reviews.length > 0
            ? p.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / p.reviews.length
            : 0,
        reviewCount: p.reviews.length,
        reviews: undefined,
        variants: undefined,
      };
    });

    res.json({
      success: true,
      data: {
        products: productsWithRating,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const tenantId = (req as any).tenant?.id || null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let product = await prisma.product.findFirst({
      where: isUuid ? { OR: [{ id }, { slug: id }], isPublished: true, tenantId } : { slug: id, isPublished: true, tenantId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: true,
        variants: { include: { images: true } },
        reviews: {
          include: { user: { select: { id: true, name: true, profileImage: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      const cleanedSlug = id.replace(/-?\d+(?:g|kg|ml|l|oz|lb)s?$/i, '');
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { slug: cleanedSlug },
            { slug: { startsWith: id } },
            { slug: { startsWith: cleanedSlug } }
          ],
          isPublished: true,
          tenantId
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: true,
          variants: { include: { images: true } },
          reviews: {
            include: { user: { select: { id: true, name: true, profileImage: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    if (!product) {
      next(createError('Product not found', 404));
      return;
    }

    const reviews = (product as any).reviews as Array<{ rating: number }>;
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
        : 0;

    let displayImages = product.images;
    if (!displayImages || displayImages.length === 0) {
      if ((product as any).variants && (product as any).variants.length > 0) {
        for (const variant of (product as any).variants) {
          const vImage = variant.images?.find((i: any) => i.isPrimary) || variant.images?.[0];
          if (vImage) {
            displayImages = [vImage];
            break;
          }
        }
      }
    }

    res.json({ success: true, data: { ...product, images: displayImages, avgRating } });
  } catch (err) {
    next(err);
  }
};

export const searchProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q, page = '1', limit = '12' } = req.query;
    if (!q) {
      res.json({ success: true, data: { data: [], total: 0 } });
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const query = q as string;

    const tenantId = (req as any).tenant?.id || null;
    const where: any = {
      isPublished: true,
      tenantId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } }
      ]
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          images: { select: { imageUrl: true, isPrimary: true } },
          variants: { select: { price: true, compareAtPrice: true, images: { select: { imageUrl: true, isPrimary: true } } } }
        }
      }),
      prisma.product.count({ where })
    ]);

    const mappedProducts = products.map((p) => {
      let displayPrice = Number(p.price);
      let displayComparePrice = p.comparePrice ? Number(p.comparePrice) : null;
      if (displayPrice === 0 && p.variants && p.variants.length > 0) {
        const lowestVariant = p.variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min), p.variants[0]);
        displayPrice = Number(lowestVariant.price);
        displayComparePrice = lowestVariant.compareAtPrice ? Number(lowestVariant.compareAtPrice) : null;
      }
      let displayImages = p.images;
      if (!displayImages || displayImages.length === 0) {
        if (p.variants && p.variants.length > 0) {
          for (const variant of p.variants) {
            const vImage = (variant as any).images?.find((i: any) => i.isPrimary) || (variant as any).images?.[0];
            if (vImage) {
              displayImages = [vImage];
              break;
            }
          }
        }
      }
      return {
        ...p,
        price: displayPrice,
        comparePrice: displayComparePrice,
        images: displayImages,
        variants: undefined
      };
    });

    res.json({ success: true, data: { data: mappedProducts, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};

export const getRelatedProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const tenantId = (req as any).tenant?.id || null;
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const product = await prisma.product.findFirst({
      where: isUuid ? { OR: [{ id }, { slug: id }], tenantId } : { slug: id, tenantId }
    });

    if (!product || !product.categoryId) {
      res.json({ success: true, data: [] });
      return;
    }

    const related = await prisma.product.findMany({
      where: {
        isPublished: true,
        categoryId: product.categoryId,
        id: { not: product.id },
        tenantId
      },
      take: 4,
      include: { images: { select: { imageUrl: true, isPrimary: true } } }
    });

    res.json({ success: true, data: related });
  } catch (err) {
    next(err);
  }
};

