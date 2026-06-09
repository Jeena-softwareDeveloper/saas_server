import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';

export const getStoreMenus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenant?.id || null;

    const items = await prisma.menuItem.findMany({
      where: { isActive: true, ...(tenantId ? { tenantId } : {}) },
      orderBy: { sortOrder: 'asc' },
      include: { category: { select: { id: true, name: true, slug: true } } }
    });

    const mapped = items.map(i => ({
      id: i.id,
      label: i.label,
      link: (i as any).category
        ? `/products?category=${(i as any).category.slug}`
        : (i.link || '/products'),
      categoryId: i.categoryId,
      categoryName: (i as any).category?.name || null,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};
