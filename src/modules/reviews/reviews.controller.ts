import { Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';
import { Request } from 'express';
import { z } from 'zod';

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const getReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = req.query['productId'] as string;
    if (!productId) { next(createError('Product ID required', 400)); return; }

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length : 0;

    res.json({ success: true, data: { reviews, avgRating, total: reviews.length } });
  } catch (err) {
    next(err);
  }
};

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) { next(createError(parsed.error.issues[0].message, 400)); return; }

    const { productId, rating, comment } = parsed.data;

    const hasPurchased = await prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: 'DELIVERED' } },
    });
    if (!hasPurchased) {
      next(createError('You can only review products you have purchased and received', 403));
      return;
    }

    const review = await prisma.review.create({
      data: { userId, productId, rating, comment: comment ?? null },
      include: { user: { select: { id: true, name: true, profileImage: true } } },
    });

    res.status(201).json({ success: true, message: 'Review submitted', data: review });
  } catch (err) {
    next(err);
  }
};

export const updateReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const userId = req.user!.userId;
    const { rating, comment } = req.body;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review || review.userId !== userId) {
      next(createError('Review not found or unauthorized', 404));
      return;
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(rating !== undefined && { rating }),
        ...(comment !== undefined && { comment })
      }
    });

    res.json({ success: true, message: 'Review updated', data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review || review.userId !== userId) {
      next(createError('Review not found or unauthorized', 404));
      return;
    }

    await prisma.review.delete({ where: { id } });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
};
