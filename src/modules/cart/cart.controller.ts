import { Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

export const getCart = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: { id: true, name: true, price: true, images: { select: { imageUrl: true }, take: 1 }, stockQuantity: true, slug: true },
        },
      },
    });
    const subtotal = items.reduce(
      (sum: number, item: typeof items[0]) => sum + Number(item.product.price) * item.quantity,
      0
    );
    res.json({ success: true, data: { items, subtotal, itemCount: items.length } });
  } catch (err) {
    next(err);
  }
};

export const addToCart = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { productId, quantity = 1 } = req.body as { productId: string; quantity?: number };

    if (!productId) { next(createError('Product ID required', 400)); return; }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isPublished) { next(createError('Product not found', 404)); return; }
    if (product.stockQuantity < quantity) { next(createError('Insufficient stock', 400)); return; }

    const existing = await prisma.cartItem.findFirst({
      where: { userId, productId },
    });

    let item;
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (product.stockQuantity < newQty) { next(createError('Insufficient stock', 400)); return; }
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
        include: { product: { select: { id: true, name: true, price: true } } },
      });
    } else {
      item = await prisma.cartItem.create({
        data: { userId, productId, quantity },
        include: { product: { select: { id: true, name: true, price: true } } },
      });
    }

    res.json({ success: true, message: 'Added to cart', data: item });
  } catch (err) {
    next(err);
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const productId = req.params['productId'] as string;
    const { quantity } = req.body as { quantity: number };

    const existing = await prisma.cartItem.findFirst({ where: { userId, productId } });
    if (!existing) { next(createError('Item not found in cart', 404)); return; }

    if (!quantity || quantity < 1) {
      await prisma.cartItem.delete({ where: { id: existing.id } });
      res.json({ success: true, message: 'Item removed from cart' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.stockQuantity < quantity) { next(createError('Insufficient stock', 400)); return; }

    const item = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
      include: { product: { select: { id: true, name: true, price: true } } },
    });

    res.json({ success: true, message: 'Cart updated', data: item });
  } catch (err) {
    next(err);
  }
};

export const removeFromCart = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const productId = req.params['productId'] as string;
    const existing = await prisma.cartItem.findFirst({ where: { userId, productId } });
    if (existing) {
      await prisma.cartItem.delete({ where: { id: existing.id } });
    }
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    next(err);
  }
};

export const clearCart = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    await prisma.cartItem.deleteMany({ where: { userId } });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    next(err);
  }
};
