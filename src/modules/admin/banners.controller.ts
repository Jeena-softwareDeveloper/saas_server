import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { uploadToS3, deleteFromS3 } from '../../config/s3';
import { createError } from '../../middleware/errorHandler';

export const getAllBanners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = ((req as any).user?.tenantId || null) || null;
    const banners = await prisma.banner.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { sortOrder: 'asc' },
      include: {
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    const mapped = banners.map(b => ({
      id: b.id,
      title: b.title,
      imageUrl: b.imageUrl,
      link: b.link,
      isActive: b.isActive,
      sortOrder: b.sortOrder,
      categoryId: b.categoryId,
      categoryName: b.category?.name || null,
      categorySlug: b.category?.slug || null,
      createdAt: b.createdAt
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, link, categoryId, isActive, sortOrder } = req.body;

    if (!title) {
      next(createError('Title is required', 400));
      return;
    }

    const file = req.file;
    if (!file) {
      next(createError('Banner image is required', 400));
      return;
    }

    const imageUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));

    const banner = await prisma.banner.create({
      data: {
        tenantId: ((req as any).user?.tenantId || null) || null,
        title,
        imageUrl,
        link: link || null,
        categoryId: categoryId || null,
        isActive: isActive === 'false' ? false : true,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0
      }
    });

    res.status(201).json({
      success: true,
      message: 'Banner created',
      data: banner
    });
  } catch (err) {
    next(err);
  }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { title, link, categoryId, isActive, sortOrder } = req.body;

    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Banner not found', 404));
      return;
    }

    let imageUrl = existing.imageUrl;
    const file = req.file;
    if (file) {
      imageUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
      // Delete old image from S3
      if (existing.imageUrl) {
        await deleteFromS3(existing.imageUrl).catch(() => {});
      }
    }

    const updateData: any = { imageUrl };
    if (title !== undefined) updateData.title = title;
    if (link !== undefined) updateData.link = link || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);

    const banner = await prisma.banner.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, message: 'Banner updated', data: banner });
  } catch (err) {
    next(err);
  }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      next(createError('Banner not found', 404));
      return;
    }

    if (banner.imageUrl) {
      await deleteFromS3(banner.imageUrl).catch(() => {});
    }

    await prisma.banner.delete({ where: { id } });

    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    next(err);
  }
};

export const toggleBannerStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Banner not found', 404));
      return;
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    res.json({ success: true, data: { isActive: banner.isActive } });
  } catch (err) {
    next(err);
  }
};

export const getActiveBanners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId2 = ((req as any).user?.tenantId || null) || null;
    const banners = await prisma.banner.findMany({
      where: tenantId2 ? { isActive: true, tenantId: tenantId2 } : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    const mapped = banners.map(b => ({
      id: b.id,
      title: b.title,
      imageUrl: b.imageUrl,
      link: b.link || (b.category ? `/products?category=${b.category.slug}` : '/products'),
      categoryId: b.categoryId,
      categoryName: b.category?.name || null,
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};
