import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = ((req as any).user?.tenantId || null) || null;
    const coupons = await prisma.coupon.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { expiresAt: 'asc' }
    });
    res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, expiresAt, isActive } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      next(createError('Code, discountType, and discountValue are required', 400));
      return;
    }

    const tenantId = ((req as any).user?.tenantId || null) || null;
    const existing = await prisma.coupon.findFirst({ where: { code, tenantId } });
    if (existing) {
      next(createError('Coupon code already exists', 409));
      return;
    }

    const coupon = await prisma.coupon.create({
      data: {
        tenantId: ((req as any).user?.tenantId || null) || null,
        code,
        discountType,
        discountValue,
        minOrderAmount: minOrderAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
  } catch (err) {
    next(err);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, expiresAt, isActive } = req.body;

    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount;
    if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount;
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const coupon = await prisma.coupon.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, message: 'Coupon updated', data: coupon });
  } catch (err) {
    next(err);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    await prisma.coupon.delete({ where: { id } });
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
};
