import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { createError } from './errorHandler';

/**
 * Resolves the tenant for the currently authenticated admin user.
 * 
 * - If the logged-in user owns a Tenant → attaches tenant to req.tenant
 * - If no tenant found (platform super admin from admin portal) → passes through without tenant
 * 
 * Usage: Apply after `authorizeAdmin` on tenant-specific routes.
 */
export const resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      next(createError('Unauthorized', 401));
      return;
    }

    let tenant = null;

    const providedStoreKey = req.headers['x-store-key'] as string;

    if (providedStoreKey && providedStoreKey !== 'localhost' && providedStoreKey !== '127.0.0.1') {
      tenant = await prisma.tenant.findFirst({
        where: { storeKey: providedStoreKey }
      });
      
      if (!tenant) {
        next(createError('Invalid Store API Key', 401));
        return;
      }

      // If user is not super admin, they must own the tenant
      if ((req as any).user?.role !== 'SUPER_ADMIN' && tenant.ownerId !== userId) {
        next(createError('Forbidden: You do not own this store', 403));
        return;
      }
    } else {
      // No store key provided (e.g. Super Admin Panel)
      tenant = await prisma.tenant.findUnique({
        where: { ownerId: userId }
      });
    }

    // Attach tenant to request (may be null for platform-level super admins in the super admin panel)
    (req as any).tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Strict version: requires a tenant. Rejects if no tenant found.
 */
export const requireTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  await resolveTenant(req, res, () => {
    if (!(req as any).tenant) {
      next(createError('No tenant associated with this account', 403));
      return;
    }
    next();
  });
};

/**
 * Resolves the tenant for public storefront requests.
 * Uses the `x-tenant-slug` header provided by the frontend.
 */
export const resolveStoreTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeKey = req.headers['x-store-key'] as string;
    
    let tenant = null;
    if (storeKey && storeKey !== 'localhost' && storeKey !== '127.0.0.1') {
      tenant = await prisma.tenant.findFirst({
        where: { storeKey: storeKey }
      });
      
      // Strict enforcement: If they provided a store key but it was wrong, fail immediately!
      if (!tenant) {
        next(createError('Invalid Store API Key', 401));
        return;
      }
    } else {
      const origin = req.headers.origin as string;
      const referer = req.headers.referer as string;
      const host = req.headers.host as string;
      
      const searchDomains: string[] = [];
      if (origin) {
        searchDomains.push(origin);
        searchDomains.push(origin.endsWith('/') ? origin : `${origin}/`);
      }
      if (referer) {
        try {
          const refUrl = new URL(referer);
          const refOrigin = refUrl.origin;
          searchDomains.push(refOrigin);
          searchDomains.push(refOrigin.endsWith('/') ? refOrigin : `${refOrigin}/`);
        } catch (_) {
          searchDomains.push(referer);
        }
      }
      if (host) {
        searchDomains.push(host);
        searchDomains.push(`http://${host}`);
        searchDomains.push(`http://${host}/`);
        searchDomains.push(`https://${host}`);
        searchDomains.push(`https://${host}/`);
      }

      tenant = await prisma.tenant.findFirst({
        where: {
          isActive: true,
          domain: {
            in: searchDomains.filter(Boolean)
          }
        }
      });
    }

    // Fallback removed to strictly enforce Store Key (tenant-slug) validation

    if (!tenant || !tenant.isActive) {
      next(createError('Store not found or inactive', 404));
      return;
    }

    (req as any).tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
};
