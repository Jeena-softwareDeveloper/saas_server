import { Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

export const getAddresses = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' }
    });
    res.json({ success: true, data: addresses });
  } catch (err) {
    next(err);
  }
};

export const createAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, label, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      next(createError('Required address fields are missing', 400));
      return;
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const count = await prisma.address.count({ where: { userId } });



    const address = await prisma.address.create({
      data: {
        userId,
        fullName,
        phone,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        state,
        pincode,
        country: country || 'India',
        label: label || null,
        isDefault: isDefault || count === 0
      }
    });

    res.status(201).json({ success: true, message: 'Address created', data: address });
  } catch (err) {
    next(err);
  }
};

export const updateAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;
    const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country, label, isDefault } = req.body;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      next(createError('Address not found', 404));
      return;
    }

    if (isDefault && !existing.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (addressLine1) updateData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (pincode) updateData.pincode = pincode;
    if (country) updateData.country = country;
    if (label !== undefined) updateData.label = label;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const address = await prisma.address.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, message: 'Address updated', data: address });
  } catch (err) {
    next(err);
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      next(createError('Address not found', 404));
      return;
    }

    await prisma.address.delete({ where: { id } });
    res.json({ success: true, message: 'Address deleted' });
  } catch (err) {
    next(err);
  }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      next(createError('Address not found', 404));
      return;
    }

    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    await prisma.address.update({
      where: { id },
      data: { isDefault: true }
    });

    res.json({ success: true, data: { is_default: true } });
  } catch (err) {
    next(err);
  }
};
