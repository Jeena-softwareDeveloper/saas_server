import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', role, search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (role) where['role'] = role as string;
    if (search) {
      where['OR'] = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        skip,
        take: limitNum,
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, avatar: true, phone: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: where as any }),
    ]);

    res.json({ success: true, data: { users, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } } });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, role: true, avatar: true, phone: true, createdAt: true },
    });
    if (!user) { next(createError('User not found', 404)); return; }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, phone, avatar } = req.body as { name?: string; phone?: string; avatar?: string };
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(avatar && { avatar }),
      },
      select: { id: true, name: true, email: true, role: true, avatar: true, phone: true },
    });
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { role } = req.body as { role: string };
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER'];
    if (!validRoles.includes(role)) { next(createError('Invalid role', 400)); return; }

    const user = await prisma.user.update({
      where: { id },
      data: { role: role as any },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ success: true, message: 'User role updated', data: user });
  } catch (err) {
    next(err);
  }
};

export const toggleUserActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) { next(createError('User not found', 404)); return; }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });
    res.json({ success: true, message: `User ${updated.isActive ? 'activated' : 'deactivated'}`, data: updated });
  } catch (err) {
    next(err);
  }
};
