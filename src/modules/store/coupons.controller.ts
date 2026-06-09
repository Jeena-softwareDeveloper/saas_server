import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';

export const getActiveCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenant?.id || null;
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        tenantId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });
    res.json({ success: true, data: coupons });
  } catch (error) {
    next(error);
  }
};
