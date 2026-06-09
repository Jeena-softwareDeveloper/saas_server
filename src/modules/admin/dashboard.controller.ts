import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';

// Helper to get tenant filter from request
const getTenantFilter = (req: Request) => {
  const tenant = (req as any).tenant;
  return tenant ? { tenantId: tenant.id } : {};
};

const getTenantCustomerFilter = (req: Request) => {
  const tenant = (req as any).tenant;
  return tenant ? { role: 'CUSTOMER' as any, tenantId: tenant.id } : { role: 'CUSTOMER' as any };
};

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tf = getTenantFilter(req);
    const tcf = getTenantCustomerFilter(req);

    const [orders, revenueAgg, products, customers, overdueAgg, blockedUsers] = await Promise.all([
      prisma.order.count({ where: tf }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...tf, paymentStatus: 'PAID' }
      }),
      prisma.product.count({ where: tf }),
      prisma.user.count({ where: tcf }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...tf, paymentStatus: 'PENDING' }
      }),
      prisma.user.count({ where: { ...tcf, isActive: false } })
    ]);

    res.json({
      success: true,
      data: {
        orders,
        revenue: revenueAgg._sum.totalAmount || 0,
        products,
        customers,
        overdue: overdueAgg._sum.totalAmount || 0,
        blockedUsers
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getRecentOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tf = getTenantFilter(req);
    const orders = await prisma.order.findMany({
      where: tf,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    const mappedOrders = orders.map(o => ({
      order_number: o.orderNumber,
      customer: o.user?.name || 'Guest',
      total: o.totalAmount,
      status: o.status
    }));

    res.json({ success: true, data: mappedOrders });
  } catch (err) {
    next(err);
  }
};

export const getLowStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tf = getTenantFilter(req);
    const allProducts = await prisma.product.findMany({
      where: tf,
      select: { id: true, name: true, stockQuantity: true, lowStockThreshold: true }
    });
    const mapped = allProducts
      .filter(p => p.stockQuantity < p.lowStockThreshold)
      .map(p => ({ product_id: p.id, name: p.name, stock_quantity: p.stockQuantity }));
    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

export const getSalesChart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tf = getTenantFilter(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: {
        ...tf,
        createdAt: { gte: thirtyDaysAgo },
        paymentStatus: 'PAID'
      },
      select: {
        createdAt: true,
        totalAmount: true
      }
    });

    const grouped = orders.reduce((acc, order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { revenue: 0, orders: 0 };
      }
      acc[date].revenue += Number(order.totalAmount);
      acc[date].orders += 1;
      return acc;
    }, {} as Record<string, { revenue: number; orders: number }>);

    const chartData = Object.entries(grouped).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: chartData });
  } catch (err) {
    next(err);
  }
};
