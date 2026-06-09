import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createReview = async (req: Request, res: Response) => {
  try {
    const { productId, userId, rating, title, body, isApproved } = req.body;
    
    // Check if review already exists to provide a clear error message due to unique constraint
    const existing = await prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "This user has already reviewed this product." });
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        rating: Number(rating),
        title,
        body,
        isApproved: isApproved !== undefined ? isApproved : true,
      },
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      }
    });

    res.status(201).json({ success: true, data: review, message: "Review added successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReviewStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isApproved } = req.body;
    const review = await prisma.review.update({
      where: { id },
      data: { isApproved },
    });
    res.json({ success: true, data: review });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.review.delete({ where: { id } });
    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
