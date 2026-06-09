import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getClientPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Verify user and tenant exist
    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }

    const tenantId = (user as any).ownedTenant.id;

    const payments = await prisma.clientPayment.findMany({
      where: { tenantId },
      orderBy: { paymentDate: 'desc' },
    });

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
};

export const addClientPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { amount, paymentDate, notes } = req.body;

    if (!amount || !paymentDate) {
      next(createError('Amount and paymentDate are required', 400));
      return;
    }

    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }

    const tenantId = (user as any).ownedTenant.id;

    const payment = await prisma.clientPayment.create({
      data: {
        tenantId,
        amount: parseFloat(amount),
        paymentDate: new Date(paymentDate),
        notes,
      },
    });

    // Automatically update the totalPaid on the Tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        totalPaid: { increment: parseFloat(amount) }
      }
    });

    res.json({ success: true, data: payment, message: 'Payment added successfully' });
  } catch (err) {
    next(err);
  }
};

export const deleteClientPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const paymentId = req.params.paymentId as string;

    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }

    const tenantId = (user as any).ownedTenant.id;

    const payment = await prisma.clientPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.tenantId !== tenantId) {
      next(createError('Payment not found', 404));
      return;
    }

    await prisma.clientPayment.delete({ where: { id: paymentId } });

    // Decrement the totalPaid
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        totalPaid: { decrement: payment.amount }
      }
    });

    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (err) {
    next(err);
  }
};
