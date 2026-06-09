import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

export const getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const tenantId = (req as any).tenant?.id || null;
    const orders = await prisma.order.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        totalAmount: true,
        status: true
      }
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

export const getOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const userId = req.user!.userId;
    const tenantId = (req as any).tenant?.id || null;

    const order = await prisma.order.findFirst({
      where: { id, userId, tenantId },
      include: {
        items: { include: { product: { select: { id: true, name: true, images: { select: { imageUrl: true }, take: 1 }, slug: true } } } },
        shippingAddress: true,
      },
    });

    if (!order) { next(createError('Order not found', 404)); return; }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const userId = req.user!.userId;

    const order = await prisma.order.findFirst({ where: { id, userId } });
    if (!order) { next(createError('Order not found', 404)); return; }

    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      next(createError(`Order cannot be cancelled in ${order.status} state`, 400));
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ 
      success: true, 
      message: 'Order cancelled successfully', 
      data: { refund_status: order.paymentStatus === 'PAID' ? 'PENDING_REFUND' : 'NO_REFUND_NEEDED' } 
    });
  } catch (err) {
    next(err);
  }
};
