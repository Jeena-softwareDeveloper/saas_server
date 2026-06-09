import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';

export const getAdminLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = '1', limit = '50', tenantId, action } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;
    if (action) whereClause.action = action;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { name: true, slug: true } },
          user: { select: { name: true, email: true, role: true } }
        }
      }),
      prisma.activityLog.count({ where: whereClause })
    ]);

    res.json({ success: true, data: { data: logs, total, page: pageNum, limit: limitNum } });
  } catch (err) {
    next(err);
  }
};

export const getActiveLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tenantId } = req.query;
    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;
    
    // Only show sessions active in the last 15 seconds
    const fifteenSecondsAgo = new Date(Date.now() - 15000);
    whereClause.lastActive = { gte: fifteenSecondsAgo };

    const activeSessions = await prisma.activeSession.findMany({
      where: whereClause,
      orderBy: { lastActive: 'desc' },
      include: {
        tenant: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true, role: true } }
      }
    });

    res.json({ success: true, data: activeSessions });
  } catch (err) {
    next(err);
  }
};

export const trackActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tenantId, action, entity, entityId, details, sessionId } = req.body;
    
    // Auth payload uses userId, not id
    const userId = (req as any).user?.userId || null;
    const tId = tenantId || (req as any).tenant?.id || null;

    if (!action) {
      res.status(400).json({ success: false, error: 'Action is required' });
      return;
    }

    if (action === 'ENTER' || action === 'PING') {
      if (sessionId && details?.path) {
        try {
          const existingSession = await prisma.activeSession.findFirst({
            where: { sessionId, path: details.path }
          });

          if (existingSession) {
            await prisma.activeSession.update({
              where: { id: existingSession.id },
              data: { 
                duration: action === 'PING' ? { increment: 5 } : undefined,
                visits: action === 'ENTER' ? { increment: 1 } : undefined,
                lastActive: new Date()
              }
            });
          } else {
            await prisma.activeSession.create({
              data: {
                sessionId,
                tenantId: tId,
                userId: userId,
                path: details.path,
                duration: 0,
                visits: 1
              }
            });
          }
        } catch (dbErr) {
          console.error('[trackActivity PING/ENTER DB Error]', dbErr);
          throw dbErr;
        }
      }
      res.json({ success: true, message: 'Activity tracked (live)' });
      return;
    }

    if (action === 'LEAVE') {
      if (sessionId && details?.path) {
        try {
          await prisma.activeSession.deleteMany({
            where: { sessionId, path: details.path }
          });
        } catch (dbErr) {
          console.error('[trackActivity LEAVE DB Error]', dbErr);
        }
      }
      try {
        await prisma.activityLog.create({
          data: {
            tenantId: tId,
            userId: userId,
            action: 'PAGE_VIEW',
            entity,
            entityId: entityId || null,
            details: details || {}
          }
        });
      } catch (dbErr) {
        console.error('[trackActivity PAGE_VIEW Log Error]', dbErr);
      }
      res.json({ success: true, message: 'Activity tracked (leave)' });
      return;
    }

    // Default historical tracking (for products created, etc)
    try {
      await prisma.activityLog.create({
        data: {
          tenantId: tId,
          userId: userId,
          action,
          entity,
          entityId: entityId || null,
          details: details || {}
        }
      });
    } catch (dbErr) {
      console.error('[trackActivity Default Log Error]', dbErr);
    }

    res.json({ success: true, message: 'Activity tracked' });
  } catch (err: any) {
    console.error('[trackActivity Critical Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error in trackActivity' });
  }
};
