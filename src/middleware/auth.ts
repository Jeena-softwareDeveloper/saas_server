import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../config/jwt';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Access token missing or malformed' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired access token' });
  }
};

export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  authenticate(req, res, () => {
    if (req.user) {
      const r = req.user.role.toUpperCase();
      if (r === 'ADMIN' || r === 'SUPER_ADMIN') {
        return next();
      }
    }
    res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  });
};

export const requirePermission = (moduleKey: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    authenticate(req, res, async () => {
      try {
        if (!req.user) {
          console.log('[requirePermission] Unauthorized: No req.user');
          res.status(401).json({ success: false, message: 'Unauthorized' });
          return;
        }

        console.log(`[requirePermission] User role: ${req.user.role}, Module: ${moduleKey}`);

        if (req.user.role.toUpperCase() === 'SUPER_ADMIN') {
          console.log('[requirePermission] SUPER_ADMIN granted access');
          return next();
        }

        if (req.user.role.toUpperCase() === 'ADMIN') {
          const prisma = (await import('../config/db')).default;
          const dbUser = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { permissions: true, role: true, email: true }
          });

          if (dbUser?.role === 'SUPER_ADMIN') {
            console.log(`[requirePermission] User ${dbUser.email} upgraded to SUPER_ADMIN via DB`);
            return next();
          }

          console.log(`[requirePermission] ADMIN ${dbUser?.email} permissions:`, dbUser?.permissions);

          if (dbUser && dbUser.permissions && dbUser.permissions.includes(moduleKey)) {
            console.log('[requirePermission] ADMIN granted access');
            return next();
          }
        }

        console.log(`[requirePermission] Forbidden: Missing ${moduleKey} permission`);
        res.status(403).json({ success: false, message: `Forbidden: Missing ${moduleKey} permission` });
      } catch (error) {
        console.error('[requirePermission] Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during permission check' });
      }
    });
  };
};
