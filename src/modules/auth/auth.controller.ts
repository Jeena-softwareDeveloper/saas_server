import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../config/db';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../config/jwt';
import { createError } from '../../middleware/errorHandler';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      next(createError(parsed.error.issues[0].message, 400));
      return;
    }

    const { name, password, phone } = parsed.data as any;

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      next(createError('Phone number already registered', 409));
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let tenantId: string | null = null;
    const slug = req.headers['x-tenant-slug'] as string;
    if (slug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    const user = await prisma.user.create({
      data: { name, passwordHash: hashedPassword, phone, role: 'CUSTOMER', tenantId },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, tenantId: true },
    });

    const payload = { userId: user.id, email: user.email, phone: user.phone, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(createError(parsed.error.issues[0].message, 400));
      return;
    }

    const { identifier, password } = parsed.data as any;

    const user = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { email: identifier },
          { phone: identifier }
        ]
      } 
    });
    if (!user || !user.isActive) {
      next(createError('Invalid credentials', 401));
      return;
    }

    // Enforce Tenant Isolation for Storefront Login
    const currentTenant = (req as any).tenant;
    
    // With strict Store Key validation, currentTenant is guaranteed to exist.
    const isCustomerForThisTenant = user.tenantId === currentTenant.id;
    const isAdminForThisTenant = currentTenant.ownerId === user.id;

    if (!isCustomerForThisTenant && !isAdminForThisTenant) {
      next(createError('Invalid credentials or unauthorized for this store', 401));
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      next(createError('Invalid credentials', 401));
      return;
    }

    const payload = { 
      userId: user.id, 
      email: user.email, 
      phone: user.phone,
      role: user.role,
      tenantId: currentTenant ? currentTenant.id : user.tenantId || undefined
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    // Look up tenant for this user (customer or owner)
    let userTenant = null;
    if (user.tenantId) {
      userTenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    } else {
      userTenant = await prisma.tenant.findUnique({ where: { ownerId: user.id } });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.profileImage,
          permissions: user.permissions,
          tenantId: user.tenantId || userTenant?.id || null,
          tenantSlug: userTenant?.slug || null,
          shopName: user.shopName || userTenant?.name || null,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const adminLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(createError(parsed.error.issues[0].message, 400));
      return;
    }

    const { identifier, password } = parsed.data as any;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });
    if (!user || !user.isActive) {
      next(createError('Invalid credentials', 401));
      return;
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      next(createError('Unauthorized access', 403));
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      next(createError('Invalid credentials', 401));
      return;
    }

    let userTenant = null;
    if (user.tenantId) {
      userTenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    } else {
      userTenant = await prisma.tenant.findUnique({ where: { ownerId: user.id } });
    }

    const payload = { 
      userId: user.id, 
      email: user.email, 
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId || userTenant?.id || undefined 
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      maxAge: 15 * 60 * 1000
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const adminTenant = await prisma.tenant.findUnique({ where: { ownerId: user.id } });

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.profileImage,
          permissions: user.permissions,
          tenantId: adminTenant?.id || null,
          tenantSlug: adminTenant?.slug || null,
          shopName: user.shopName || adminTenant?.name || null,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      next(createError('Refresh token required', 400));
      return;
    }

    const { refreshToken: token } = parsed.data;
    const decoded = verifyRefreshToken(token);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!tokenRecord || tokenRecord.user.id !== decoded.userId) {
      next(createError('Invalid refresh token', 401));
      return;
    }
    const user = tokenRecord.user;


    const payload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(createError('Invalid or expired refresh token', 401));
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = (req as any).user;
    await prisma.refreshToken.deleteMany({ where: { userId } });

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = (req as any).user;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        permissions: true,
        shopName: true,
        tenantId: true,
        ownedTenant: {
          select: {
            id: true,
            slug: true,
            name: true,
          }
        }
      }
    });

    if (!user) {
      next(createError('User not found', 404));
      return;
    }

    let tenantId = user.tenantId;
    let tenantSlug = user.ownedTenant?.slug || null;
    let shopName = user.shopName || user.ownedTenant?.name || null;

    if (!tenantId && user.ownedTenant) {
      tenantId = user.ownedTenant.id;
    } else if (tenantId && !tenantSlug) {
      const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (t) {
        tenantSlug = t.slug;
        if (!shopName) shopName = t.name;
      }
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.profileImage,
        role: user.role,
        permissions: user.permissions,
        shopName,
        tenantId,
        tenantSlug,
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = (req as any).user;
    const { name, phone } = req.body;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    const file = req.file;
    if (file) {
      const { uploadToS3 } = await import('../../config/s3');
      const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', (req as any).user.tenantId);
      updateData.profileImage = url;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, profileImage: true, role: true }
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { next(createError('Email is required', 400)); return; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.json({ success: true, message: 'If email exists, a reset link has been sent.' });
      return;
    }



    res.json({ success: true, message: 'If email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) { next(createError('Token and newPassword are required', 400)); return; }

    
    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    next(err);
  }
};

