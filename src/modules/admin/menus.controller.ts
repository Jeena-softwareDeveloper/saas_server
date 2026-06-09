import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getAllMenuItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Super-admin can pass ?tenantId= to fetch a specific client's menus
    const queryTenantId = req.query['tenantId'] as string | undefined;
    const userTenantId = (req as any).user?.tenantId || null;
    const tenantId = queryTenantId || userTenantId;

    const items = await prisma.menuItem.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { sortOrder: 'asc' },
      include: {
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    const mapped = items.map(i => ({
      id: i.id,
      label: i.label,
      link: i.link,
      isActive: i.isActive,
      sortOrder: i.sortOrder,
      categoryId: i.categoryId,
      categoryName: (i as any).category?.name || null,
      categorySlug: (i as any).category?.slug || null,
      createdAt: i.createdAt
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

export const createMenuItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { label, link, categoryId, isActive, sortOrder, tenantId: bodyTenantId } = req.body;
    // Super-admin can pass tenantId in body to create for a specific client
    const userTenantId = (req as any).user?.tenantId || null;
    const tenantId = bodyTenantId || userTenantId;

    if (!label) {
      next(createError('Label is required', 400));
      return;
    }

    const item = await prisma.menuItem.create({
      data: {
        tenantId,
        label,
        link: link || null,
        categoryId: categoryId || null,
        isActive: isActive === false || isActive === 'false' ? false : true,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0
      }
    });

    res.status(201).json({ success: true, message: 'Menu item created', data: item });
  } catch (err) {
    next(err);
  }
};

export const updateMenuItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { label, link, categoryId, isActive, sortOrder } = req.body;

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Menu item not found', 404));
      return;
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(link !== undefined && { link: link || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(isActive !== undefined && { isActive: isActive === true || isActive === 'true' }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) })
      }
    });

    res.json({ success: true, message: 'Menu item updated', data: item });
  } catch (err) {
    next(err);
  }
};

export const deleteMenuItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Menu item not found', 404));
      return;
    }
    await prisma.menuItem.delete({ where: { id } });
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    next(err);
  }
};

export const toggleMenuItemStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Menu item not found', 404));
      return;
    }
    const item = await prisma.menuItem.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });
    res.json({ success: true, data: { isActive: item.isActive } });
  } catch (err) {
    next(err);
  }
};
