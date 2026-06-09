import { Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

export const validateCoupon = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, cartTotal } = req.body;
    if (!code || cartTotal === undefined) {
      next(createError('code and cartTotal are required', 400));
      return;
    }

    const tenantId = (req as any).tenant?.id || null;
    const coupon = await prisma.coupon.findFirst({ where: { code, tenantId } });
    if (!coupon || !coupon.isActive) {
      next(createError('Invalid or inactive coupon', 400));
      return;
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      next(createError('Coupon expired', 400));
      return;
    }

    if (coupon.minOrderAmount && cartTotal < Number(coupon.minOrderAmount)) {
      next(createError(`Minimum order amount of ${coupon.minOrderAmount} required`, 400));
      return;
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      next(createError('Coupon usage limit reached', 400));
      return;
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (cartTotal * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
        discountAmount = Number(coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    res.json({
      success: true,
      data: {
        valid: true,
        discount_amount: discountAmount,
        coupon_id: coupon.id
      }
    });
  } catch (err) {
    next(err);
  }
};

export const createPaymentIntent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { amount } = req.body;
    if (!amount) { next(createError('amount is required', 400)); return; }

    const paymentIntentId = `pi_${Date.now()}`;
    const clientSecret = `${paymentIntentId}_secret_${Math.random().toString(36).substring(7)}`;

    res.json({
      success: true,
      data: {
        client_secret: clientSecret,
        payment_intent_id: paymentIntentId
      }
    });
  } catch (err) {
    next(err);
  }
};

export const placeOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { addressId, couponId, paymentIntentId } = req.body;

    if (!addressId || !paymentIntentId) {
      next(createError('addressId and paymentIntentId are required', 400));
      return;
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true }
    });

    if (cartItems.length === 0) {
      next(createError('Cart is empty', 400));
      return;
    }

    let subtotal = cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    let total = subtotal;

    let discountAmount = 0;
    if (couponId) {
      const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
      if (coupon && coupon.isActive) {
        if (coupon.discountType === 'PERCENTAGE') {
          discountAmount = (total * Number(coupon.discountValue)) / 100;
          if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
            discountAmount = Number(coupon.maxDiscountAmount);
          }
        } else {
          discountAmount = Number(coupon.discountValue);
        }
        await prisma.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } }
        });
      }
    }

    total = Math.max(0, total - discountAmount);

    const tenantId = (req as any).tenant?.id || null;
    const orderNumber = `ORD-${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        tenantId,
        subtotal,
        totalAmount: total,
        status: 'PENDING',
        paymentStatus: 'PAID', // Assume paid if placing order with PI
        stripePaymentId: paymentIntentId,
        shippingAddressId: addressId,
        couponId: couponId || null,
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice: Number(item.product.price) * item.quantity
          }))
        }
      }
    });

    await prisma.cartItem.deleteMany({ where: { userId } });

    res.status(201).json({
      success: true,
      data: { order_id: order.id, order_number: order.orderNumber }
    });
  } catch (err) {
    next(err);
  }
};
