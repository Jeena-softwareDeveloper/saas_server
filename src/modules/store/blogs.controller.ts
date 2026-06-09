import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getAllBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenant?.id || null;
    const blogs = await prisma.blog.findMany({
      where: { isPublished: true, tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: blogs });
  } catch (err) {
    next(err);
  }
};

export const getBlogBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slug = req.params['slug'] as string;
    const tenantId = (req as any).tenant?.id || null;
    const blog = await prisma.blog.findFirst({
      where: { slug, isPublished: true, tenantId }
    });
    if (!blog) {
      next(createError('Blog article not found', 404));
      return;
    }
    res.json({ success: true, data: blog });
  } catch (err) {
    next(err);
  }
};
