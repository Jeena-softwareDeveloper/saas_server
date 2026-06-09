import { Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

export const getWishlist = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, price: true, images: { select: { imageUrl: true }, take: 1 } } }
      }
    });

    const mapped = wishlist.map(item => ({
      product_id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      image: item.product.images[0]?.imageUrl || null
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

export const addToWishlist = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { productId } = req.body;

    if (!productId) { next(createError('productId is required', 400)); return; }

    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } }
    });

    if (existing) {
      res.json({ success: true, message: 'Already in wishlist', data: existing });
      return;
    }

    const item = await prisma.wishlistItem.create({
      data: { userId, productId }
    });

    res.status(201).json({ success: true, message: 'Added to wishlist', data: item });
  } catch (err) {
    next(err);
  }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const productId = req.params['productId'] as string;

    await prisma.wishlistItem.deleteMany({
      where: { userId, productId }
    });

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err) {
    next(err);
  }
};
