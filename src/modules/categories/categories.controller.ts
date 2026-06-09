import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  image: z.string().url().optional(),
  parentId: z.string().optional(),
});

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenant?.id || null;
    const categories = await prisma.category.findMany({
      where: { parentId: null, ...(tenantId ? { tenantId } : {}) },
      include: {
        children: {
          where: tenantId ? { tenantId } : {},
          include: { _count: { select: { products: true } } }
        },
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

export const getCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slug = req.params['id'] as string;
    const { page = '1', limit = '12' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const tenantId = (req as any).tenant?.id || null;
    const category = await prisma.category.findFirst({
      where: { OR: [{ id: slug }, { slug: slug }], isActive: true, ...(tenantId ? { tenantId } : {}) },
      include: { children: { where: tenantId ? { tenantId } : {} }, parent: true },
    });
    
    if (!category) { next(createError('Category not found', 404)); return; }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { categoryId: category.id, isPublished: true, ...(tenantId ? { tenantId } : {}) },
        skip,
        take: limitNum,
        include: { images: { select: { imageUrl: true, isPrimary: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where: { categoryId: category.id, isPublished: true, ...(tenantId ? { tenantId } : {}) } })
    ]);

    res.json({ success: true, data: { category, products, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};
