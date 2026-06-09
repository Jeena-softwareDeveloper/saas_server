import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';

export const getThemeConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenant?.id;
    const storeName = (req as any).tenant?.name || '';

    const configs = await prisma.siteConfig.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        key: {
          in: ['PRIMARY_COLOR', 'SECONDARY_COLOR', 'STORE_PHONE', 'STORE_EMAIL', 'STORE_ADDRESS', 'TOPBAR_USP_1', 'TOPBAR_USP_2', 'TOPBAR_USP_3', 'FOOTER_COLOR', 'logo_url', 'STORE_FONT']
        }
      }
    });

    const theme: any = {
      storeName,
      logoUrl: null,
      primaryColor: '#e11955', // Default fallback
      secondaryColor: '#be0027', // Default fallback
      footerColor: '#0f172a', // Default fallback (#0f172a is slate-900)
      fontFamily: 'Inter', // Default fallback
      storePhone: '',
      storeEmail: '',
      storeAddress: '',
      usp1: 'Free Delivery on orders above ₹499',
      usp2: '100% Natural & Chemical Free',
      usp3: 'Secure Payment | 14 Days Easy Returns',
    };

    configs.forEach(conf => {
      if (conf.key === 'PRIMARY_COLOR') theme.primaryColor = conf.value;
      if (conf.key === 'SECONDARY_COLOR') theme.secondaryColor = conf.value;
      if (conf.key === 'FOOTER_COLOR') theme.footerColor = conf.value;
      if (conf.key === 'STORE_PHONE') theme.storePhone = conf.value;
      if (conf.key === 'STORE_EMAIL') theme.storeEmail = conf.value;
      if (conf.key === 'STORE_ADDRESS') theme.storeAddress = conf.value;
      if (conf.key === 'TOPBAR_USP_1') theme.usp1 = conf.value;
      if (conf.key === 'TOPBAR_USP_2') theme.usp2 = conf.value;
      if (conf.key === 'TOPBAR_USP_3') theme.usp3 = conf.value;
      if (conf.key === 'logo_url') theme.logoUrl = conf.value;
      if (conf.key === 'STORE_FONT') theme.fontFamily = conf.value;
    });

    res.json({ success: true, data: theme });
  } catch (err) {
    next(err);
  }
};
