import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';

export const getAdminCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '20', role } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (role) {
      whereClause.role = role;
    }

    // Tenant Isolation for Customers
    const currentUser = (req as any).user;
    const currentTenant = (req as any).tenant;
    if (currentUser?.role === 'STORE_OWNER' && currentTenant) {
      whereClause.tenantId = currentTenant.id;
      // Also ensure they only see CUSTOMER roles, not other STORE_OWNERs
      if (!role) {
        whereClause.role = 'CUSTOMER';
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { orders: true } },
          ownedTenant: {
            include: {
              siteConfigs: {
                where: {
                  key: { in: ['logo_url', 'PRIMARY_COLOR', 'FOOTER_COLOR', 'STORE_EMAIL', 'STORE_ADDRESS'] }
                }
              }
            }
          },
          orders: {
            where: { paymentStatus: 'PENDING' },
            select: { totalAmount: true }
          }
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const mapped = users.map(c => {
      const tenantConfigs = c.ownedTenant?.siteConfigs || [];
      const logo_url = tenantConfigs.find(tc => tc.key === 'logo_url')?.value || null;
      const primary_color = tenantConfigs.find(tc => tc.key === 'PRIMARY_COLOR')?.value || '#e11955';
      const footer_color = tenantConfigs.find(tc => tc.key === 'FOOTER_COLOR')?.value || '#0f172a';
      const store_font = tenantConfigs.find(tc => tc.key === 'STORE_FONT')?.value || 'Inter';
      const store_email = tenantConfigs.find(tc => tc.key === 'STORE_EMAIL')?.value || '';
      const store_address = tenantConfigs.find(tc => tc.key === 'STORE_ADDRESS')?.value || '';

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        shop_name: c.shopName,
        shopName: c.shopName,
        role: c.role,
        is_active: c.isActive,
        isActive: c.isActive,
        permissions: c.permissions,
        created_at: c.createdAt,
        createdAt: c.createdAt,
        tenant: c.ownedTenant ? {
          ...c.ownedTenant,
          logoUrl: logo_url,
          primaryColor: primary_color,
          footerColor: footer_color,
          fontFamily: store_font,
          storeEmail: store_email,
          storeAddress: store_address
        } : null,
        order_count: c._count.orders,
        current_bill: c.ownedTenant ? Number(c.ownedTenant.monthlyFee || 0) : 0
      };
    });

    res.json({ success: true, data: { data: mapped, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};

export const getAdminCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    
    const customer = await prisma.user.findUnique({
      where: { id },
      include: {
        orders: { take: 5, orderBy: { createdAt: 'desc' } },
        addresses: true,
        ownedTenant: {
          include: {
            siteConfigs: {
              where: {
                key: { in: ['logo_url', 'PRIMARY_COLOR', 'FOOTER_COLOR', 'STORE_FONT'] }
              }
            }
          }
        }
      }
    });

    const currentUser = (req as any).user;
    const currentTenant = (req as any).tenant;
    if (currentUser?.role === 'STORE_OWNER' && currentTenant && customer) {
      if (customer.tenantId !== currentTenant.id) {
        next(createError('Customer not found', 404));
        return;
      }
    }

    if (!customer) {
      next(createError('Customer not found', 404));
      return;
    }

    const tenantConfigs = customer.ownedTenant?.siteConfigs || [];
    const logo_url = tenantConfigs.find(tc => tc.key === 'logo_url')?.value || null;
    const primary_color = tenantConfigs.find(tc => tc.key === 'PRIMARY_COLOR')?.value || '#e11955';
    const footer_color = tenantConfigs.find(tc => tc.key === 'FOOTER_COLOR')?.value || '#0f172a';
    const store_font = tenantConfigs.find(tc => tc.key === 'STORE_FONT')?.value || 'Inter';

    const mappedCustomer = {
      ...customer,
      tenant: customer.ownedTenant ? {
        ...customer.ownedTenant,
        logoUrl: logo_url,
        primaryColor: primary_color,
        footerColor: footer_color,
        fontFamily: store_font
      } : null
    };

    res.json({ success: true, data: mappedCustomer });
  } catch (err) {
    next(err);
  }
};

export const updateCustomerStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    let { isActive, role, permissions, password, shopName, name, email, supportEmail, storeAddress, phone, domain, totalPaid, monthlyFee, serverFee, logoUrl, primaryColor, footerColor, fontFamily } = req.body;
    
    if (Array.isArray(primaryColor)) primaryColor = primaryColor[0];
    if (Array.isArray(footerColor)) footerColor = footerColor[0];

    if (isActive === undefined && role === undefined && permissions === undefined && password === undefined && shopName === undefined && name === undefined && phone === undefined && domain === undefined && totalPaid === undefined && monthlyFee === undefined && serverFee === undefined && logoUrl === undefined && primaryColor === undefined && footerColor === undefined && fontFamily === undefined && req.file === undefined) {
      next(createError('Update data is required', 400));
      return;
    }

    const data: any = {};
    if (isActive !== undefined) data.isActive = isActive === 'true' || isActive === true;
    if (role !== undefined) data.role = role;
    if (shopName !== undefined) data.shopName = shopName;
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    if (permissions !== undefined) {
      if (Array.isArray(permissions)) {
        data.permissions = permissions;
      } else if (typeof permissions === 'string') {
        data.permissions = [permissions];
      } else {
        data.permissions = [];
      }
    }

    const customer = await prisma.user.update({
      where: { id },
      data,
      include: { ownedTenant: true }
    });

    if (customer.ownedTenant && (shopName !== undefined || domain !== undefined || totalPaid !== undefined || monthlyFee !== undefined || serverFee !== undefined || logoUrl !== undefined || primaryColor !== undefined || footerColor !== undefined || fontFamily !== undefined || req.file !== undefined)) {
      const tenantData: any = {};
      if (shopName !== undefined) tenantData.name = shopName;
      if (domain !== undefined) {
        const finalDomain = domain && typeof domain === 'string' && domain.trim() !== '' ? domain.trim() : null;
        if (finalDomain && finalDomain !== customer.ownedTenant.domain) {
          const existingDomain = await prisma.tenant.findUnique({ where: { domain: finalDomain } });
          if (existingDomain && existingDomain.id !== customer.ownedTenant.id) {
            next(createError('Domain is already in use by another store', 400));
            return;
          }
        }
        tenantData.domain = finalDomain;
      }
      if (totalPaid !== undefined) tenantData.totalPaid = Number(totalPaid);
      if (monthlyFee !== undefined) tenantData.monthlyFee = Number(monthlyFee);
      if (serverFee !== undefined) tenantData.serverFee = Number(serverFee);
      
      if (Object.keys(tenantData).length > 0) {
        await prisma.tenant.update({
          where: { id: customer.ownedTenant.id },
          data: tenantData
        });
      }

      const file = req.file;
      let uploadedLogoUrl = undefined;
      if (file) {
        const { uploadToS3 } = await import('../../config/s3');
        uploadedLogoUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype, 'ecommerce', customer.ownedTenant.id);
      }

      // Upsert logoUrl, primaryColor, footerColor in siteConfig table
      const logoToSave = uploadedLogoUrl !== undefined ? uploadedLogoUrl : logoUrl;
      if (logoToSave !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: customer.ownedTenant.id, key: 'logo_url' } },
          update: { value: logoToSave || '' },
          create: { tenantId: customer.ownedTenant.id, key: 'logo_url', value: logoToSave || '', group: 'general' }
        });
      }
      if (primaryColor !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: customer.ownedTenant.id, key: 'PRIMARY_COLOR' } },
          update: { value: primaryColor || '#e11955' },
          create: { tenantId: customer.ownedTenant.id, key: 'PRIMARY_COLOR', value: primaryColor || '#e11955', group: 'theme' }
        });
      }
      if (footerColor !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: customer.ownedTenant.id, key: 'FOOTER_COLOR' } },
          update: { value: footerColor || '#0f172a' },
          create: { tenantId: customer.ownedTenant.id, key: 'FOOTER_COLOR', value: footerColor || '#0f172a', group: 'theme' }
        });
      }
      if (fontFamily !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: customer.ownedTenant.id, key: 'STORE_FONT' } },
          update: { value: fontFamily || 'Inter' },
          create: { tenantId: customer.ownedTenant.id, key: 'STORE_FONT', value: fontFamily || 'Inter', group: 'theme' }
        });
      }
      if (supportEmail !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: customer.ownedTenant.id, key: 'STORE_EMAIL' } },
          update: { value: supportEmail },
          create: { tenantId: customer.ownedTenant.id, key: 'STORE_EMAIL', value: supportEmail, group: 'general' }
        });
      }
      if (storeAddress !== undefined) {
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId: customer.ownedTenant.id, key: 'STORE_ADDRESS' } },
          update: { value: storeAddress },
          create: { tenantId: customer.ownedTenant.id, key: 'STORE_ADDRESS', value: storeAddress, group: 'general' }
        });
      }

      // CORS is dynamically permissive now, no need to refresh cache
    }

    res.json({ success: true, data: { is_active: customer.isActive, role: customer.role, permissions: customer.permissions, shopName: customer.shopName, name: customer.name, phone: customer.phone } });
  } catch (err) {
    next(err);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, supportEmail, storeAddress, password, phone, permissions, shopName, role, domain, totalPaid, monthlyFee, serverFee, logoUrl, primaryColor, footerColor, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, razorpayKeyId, razorpayKeySecret, shiprocketEmail, shiprocketPassword, smtpUser, smtpPass, backupEmail } = req.body;

    if (!name || !email || !password) {
      next(createError('Name, email, and password are required', 400));
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      next(createError('Email already in use', 400));
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const finalRole = (role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN') as any;

    const finalPermissions = Array.isArray(permissions)
      ? permissions
      : (typeof permissions === 'string' ? [permissions] : []);

    const finalDomain = domain && typeof domain === 'string' && domain.trim() !== '' ? domain.trim() : null;

    if (finalDomain) {
      const existingDomain = await prisma.tenant.findUnique({ where: { domain: finalDomain } });
      if (existingDomain) {
        next(createError('Domain is already in use by another store', 400));
        return;
      }
    }

    // Generate a URL-safe slug for the tenant from the shop name or admin name
    const baseName = shopName || name;
    const baseSlug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    // Ensure slug is unique
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Use a transaction: create the user and their tenant atomically
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          phone,
          shopName,
          role: finalRole,
          permissions: finalRole === 'SUPER_ADMIN' ? [] : finalPermissions
        }
      });

      const tenant = await tx.tenant.create({
        data: {
          name: shopName || name,
          slug,
          ownerId: customer.id,
          domain: finalDomain,
          totalPaid: totalPaid ? Number(totalPaid) : 0,
          monthlyFee: monthlyFee ? Number(monthlyFee) : 0,
          serverFee: serverFee ? Number(serverFee) : 0,
        }
      });

      // Update the user to also have the tenantId populated (User's request for easier filtering)
      await tx.user.update({
        where: { id: customer.id },
        data: { tenantId: tenant.id }
      });

      // CORS is dynamically permissive now, no need to refresh cache

      // Upload logo if file is provided
      let finalLogoUrl = logoUrl || '';
      if (req.file) {
        const { uploadToS3 } = await import('../../config/s3');
        finalLogoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'ecommerce', tenant.id);
      }

      const integrations = [
        { key: 'CLOUDINARY_CLOUD_NAME', value: cloudinaryCloudName, group: 'integrations' },
        { key: 'CLOUDINARY_API_KEY', value: cloudinaryApiKey, group: 'integrations' },
        { key: 'CLOUDINARY_API_SECRET', value: cloudinaryApiSecret, group: 'integrations' },
        { key: 'RAZORPAY_KEY_ID', value: razorpayKeyId, group: 'integrations' },
        { key: 'RAZORPAY_KEY_SECRET', value: razorpayKeySecret, group: 'integrations' },
        { key: 'SHIPROCKET_EMAIL', value: shiprocketEmail, group: 'integrations' },
        { key: 'SHIPROCKET_PASSWORD', value: shiprocketPassword, group: 'integrations' },
        { key: 'SMTP_USER', value: smtpUser, group: 'integrations' },
        { key: 'SMTP_PASS', value: smtpPass, group: 'integrations' },
        { key: 'BACKUP_DRIVE_EMAIL', value: backupEmail, group: 'integrations' },
        { key: 'logo_url', value: finalLogoUrl, group: 'general' },
        { key: 'PRIMARY_COLOR', value: primaryColor, group: 'theme' },
        { key: 'FOOTER_COLOR', value: footerColor, group: 'theme' },
        { key: 'STORE_EMAIL', value: supportEmail || email, group: 'general' },
        { key: 'STORE_ADDRESS', value: storeAddress, group: 'general' },
        { key: 'STORE_PHONE', value: phone, group: 'general' },
      ].filter(i => i.value);

      if (integrations.length > 0) {
        const { encrypt } = await import('../../config/crypto');
        await tx.siteConfig.createMany({
          data: integrations.map(i => ({
            tenantId: tenant.id,
            group: i.group || 'integrations',
            key: i.key,
            value: i.group === 'integrations' ? encrypt(i.value) : i.value
          }))
        });
      }

      return { customer, tenant };
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.customer.id,
        email: result.customer.email,
        shopName: result.customer.shopName,
        permissions: result.customer.permissions,
        tenant: { id: result.tenant.id, slug: result.tenant.slug }
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getClientIntegrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }
    
    const configs = await prisma.siteConfig.findMany({
      where: { tenantId: (user as any).ownedTenant.id, group: 'integrations' }
    });

    const { decrypt } = await import('../../config/crypto');
    const data = configs.reduce((acc: any, curr) => {
      acc[curr.key] = decrypt(curr.value || '');
      return acc;
    }, {});

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateClientIntegrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }

    const payload = req.body;
    const tenantId = (user as any).ownedTenant.id;

    if (typeof payload !== 'object' || Array.isArray(payload)) {
      next(createError('Expected an object of key-value pairs', 400));
      return;
    }

    const { encrypt } = await import('../../config/crypto');
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) {
        const encryptedValue = encrypt(String(value));
        await prisma.siteConfig.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: { value: encryptedValue },
          create: { tenantId, key, value: encryptedValue, group: 'integrations' }
        });
      }
    }

    res.json({ success: true, message: 'Integrations updated successfully' });
  } catch (err) {
    next(err);
  }
};

export const resetEncryptionKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }

    const crypto = await import('crypto');
    const newKey = crypto.randomBytes(32).toString('hex'); // 64-char hex

    await prisma.tenant.update({
      where: { id: (user as any).ownedTenant.id },
      data: { encryptionKey: newKey }
    });

    res.json({ success: true, data: { encryptionKey: newKey } });
  } catch (err) {
    next(err);
  }
};
export const resetStoreKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id }, include: { ownedTenant: true } });
    if (!user || !(user as any).ownedTenant) {
      next(createError('Tenant not found', 404));
      return;
    }

    const crypto = await import('crypto');
    const newStoreKey = crypto.randomUUID(); // Generate new UUID

    await prisma.tenant.update({
      where: { id: (user as any).ownedTenant.id },
      data: { storeKey: newStoreKey }
    });

    res.json({ success: true, data: { storeKey: newStoreKey } });
  } catch (err) {
    next(err);
  }
};
export const resetCustomerPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      next(createError('Password must be at least 6 characters long', 400));
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      next(createError('User not found', 404));
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

export const deleteAdminCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      next(createError('Customer not found', 404));
      return;
    }
    
    await prisma.user.delete({ where: { id } });
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
};
