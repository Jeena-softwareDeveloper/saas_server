import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';
import { uploadToS3 } from '../../config/s3';

const getTenantId = (req: Request) => ((req as any).user?.tenantId || null) || null;

export const getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const configs = await prisma.siteConfig.findMany({
      where: { tenantId }
    });
    
    const grouped = configs.reduce((acc: any, curr) => {
      const group = curr.group || 'general';
      if (!acc[group]) acc[group] = {};
      acc[group][curr.key] = curr.value;
      return acc;
    }, {});

    const flat = configs.reduce((acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    res.json({ success: true, data: { ...flat, ...grouped, _flat: flat, _grouped: grouped } });
  } catch (err) {
    next(err);
  }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const payload = req.body;

    if (typeof payload !== 'object' || Array.isArray(payload)) {
      next(createError('Expected an object of key-value pairs', 400));
      return;
    }

    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: tenantId as string, key } },
          update: { value: String(value) },
          create: { tenantId, key, value: String(value), group: 'theme' }
        });
      }
    }

    const configs = await prisma.siteConfig.findMany({
      where: { tenantId }
    });
    
    const grouped = configs.reduce((acc: any, curr) => {
      const group = curr.group || 'general';
      if (!acc[group]) acc[group] = {};
      acc[group][curr.key] = curr.value;
      return acc;
    }, {});

    const flat = configs.reduce((acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    res.json({ success: true, message: 'Config updated', data: { ...flat, ...grouped, _flat: flat, _grouped: grouped } });
  } catch (err) {
    next(err);
  }
};

export const uploadLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const file = req.file;
    if (!file) {
      next(createError('Logo file required', 400));
      return;
    }

    const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));

    await prisma.siteConfig.upsert({
      where: { tenantId_key: { tenantId: tenantId as string, key: 'logo_url' } },
      update: { value: url, group: 'general' },
      create: { tenantId, key: 'logo_url', value: url, group: 'general' }
    });

    res.json({ success: true, data: { logo_url: url } });
  } catch (err) {
    next(err);
  }
};

export const getAdminReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const reviews = await prisma.review.findMany({
      where: tenantId ? { product: { tenantId } } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true } },
        user: { select: { name: true, email: true } }
      }
    });

    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
};

export const toggleReviewApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { isApproved } = req.body;

    if (isApproved === undefined) {
      next(createError('isApproved is required', 400));
      return;
    }

    const review = await prisma.review.update({
      where: { id },
      data: { isApproved }
    });

    res.json({ success: true, data: { is_approved: review.isApproved } });
  } catch (err) {
    next(err);
  }
};
