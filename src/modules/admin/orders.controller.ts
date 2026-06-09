import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getAdminOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, date, customer } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (customer) {
      where.user = { name: { contains: customer as string, mode: 'insensitive' } };
    }
    if (date) {
      const d = new Date(date as string);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      where.createdAt = { gte: d, lt: nextDay };
    }
    const tenantId = ((req as any).user?.tenantId || null);
    if (tenantId) where.tenantId = tenantId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        }
      }),
      prisma.order.count({ where })
    ]);

    res.json({ success: true, data: { data: orders, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};

export const getAdminOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: { select: { name: true, email: true, phone: true } },
        shippingAddress: true,
        coupon: true
      }
    });

    if (!order) {
      next(createError('Order not found', 404));
      return;
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

export const updateAdminOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { status } = req.body;

    if (!status) { next(createError('Status required', 400)); return; }

    const existingOrder = await prisma.order.findUnique({ 
      where: { id },
      include: { items: true }
    });

    if (!existingOrder) { next(createError('Order not found', 404)); return; }

    if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
      for (const item of existingOrder.items) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } }
          }).catch(() => {}); // ignore errors if product was deleted
        }
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, data: { order_id: order.id, status: order.status } });
  } catch (err) {
    next(err);
  }
};

export const initiateOrderRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) { next(createError('Order not found', 404)); return; }

    if (order.paymentStatus !== 'PAID') {
      next(createError('Order is not paid, cannot refund', 400));
      return;
    }

    const refundId = `re_${Date.now()}`;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status: 'REFUNDED', 
        paymentStatus: 'REFUNDED' 
      }
    });

    res.json({ success: true, data: { refund_id: refundId, status: updatedOrder.status } });
  } catch (err) {
    next(err);
  }
};
