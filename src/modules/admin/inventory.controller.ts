import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';
import { createError } from '../../middleware/errorHandler';

export const getInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        lowStockThreshold: true,
      },
      orderBy: { stockQuantity: 'asc' }
    });

    const mapped = products.map(p => ({
      product_id: p.id,
      name: p.name,
      stock: p.stockQuantity,
      threshold: p.lowStockThreshold
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

export const updateInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = req.params['productId'] as string;
    const { stockQuantity } = req.body;

    if (stockQuantity === undefined) {
      next(createError('Stock quantity is required', 400));
      return;
    }

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      next(createError('Product not found', 404));
      return;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: parseInt(stockQuantity) }
    });

    res.json({ 
      success: true, 
      data: { product_id: product.id, new_stock: product.stockQuantity } 
    });
  } catch (err) {
    next(err);
  }
};
