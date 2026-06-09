import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const tenantId = ((req as any).user?.tenantId || null) || null;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: tenantId ? { tenantId } : {},
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } }
        }
      }),
      prisma.notification.count({ where: tenantId ? { tenantId } : {} })
    ]);

    res.json({ success: true, data: { data: notifications, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};

export const sendNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, title, message } = req.body;

    if (!title || !message) {
      next(createError('Title and message are required', 400));
      return;
    }

    const tenantId = ((req as any).user?.tenantId || null) || null;
    if (userId && userId !== 'all') {
      const notification = await prisma.notification.create({
        data: {
          tenantId,
          userId,
          title,
          message
        }
      });
      res.status(201).json({ success: true, data: notification });
    } else {
      // Send to all users in this tenant
      const users = await prisma.user.findMany({
        where: tenantId ? { role: 'CUSTOMER', tenantId } : { role: 'CUSTOMER' },
        select: { id: true }
      });
      const notificationsData = users.map(u => ({
        tenantId,
        userId: u.id,
        title,
        message
      }));
      
      await prisma.notification.createMany({
        data: notificationsData
      });
      
      res.status(201).json({ success: true, message: `Sent to ${users.length} users` });
    }
  } catch (err) {
    next(err);
  }
};
