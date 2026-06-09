import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { uploadToS3, deleteFromS3 } from '../../config/s3';
import { createError } from '../../middleware/errorHandler';

export const getCertifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = ((req as any).user?.tenantId || null) || null;
    const certifications = await prisma.certification.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: certifications });
  } catch (err) {
    next(err);
  }
};

export const createCertification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, link, sortOrder, isActive } = req.body;

    if (!name) {
      next(createError('Name is required', 400));
      return;
    }

    const file = req.file;
    if (!file) {
      next(createError('Logo image is required', 400));
      return;
    }

    const imageUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));

    const certification = await prisma.certification.create({
      data: {
        tenantId: ((req as any).user?.tenantId || null) || null,
        name,
        imageUrl,
        link: link || null,
        isActive: isActive === 'false' ? false : true,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Certification created successfully',
      data: certification,
    });
  } catch (err) {
    next(err);
  }
};

export const updateCertification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { name, link, sortOrder, isActive } = req.body;

    const existing = await prisma.certification.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Certification not found', 404));
      return;
    }

    let imageUrl = existing.imageUrl;
    const file = req.file;
    if (file) {
      imageUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', ((req as any).user?.tenantId || null));
      // Clean up old image
      if (existing.imageUrl) {
        await deleteFromS3(existing.imageUrl).catch(() => {});
      }
    }

    const updateData: any = { imageUrl };
    if (name !== undefined) updateData.name = name;
    if (link !== undefined) updateData.link = link || null;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);

    const certification = await prisma.certification.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Certification updated successfully',
      data: certification,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteCertification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const existing = await prisma.certification.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Certification not found', 404));
      return;
    }

    if (existing.imageUrl) {
      await deleteFromS3(existing.imageUrl).catch(() => {});
    }

    await prisma.certification.delete({ where: { id } });

    res.json({ success: true, message: 'Certification deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const toggleCertificationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const existing = await prisma.certification.findUnique({ where: { id } });
    if (!existing) {
      next(createError('Certification not found', 404));
      return;
    }

    const certification = await prisma.certification.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json({ success: true, data: { isActive: certification.isActive } });
  } catch (err) {
    next(err);
  }
};
