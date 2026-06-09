import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import prisma from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '') as any;

export const createPaymentIntent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { orderId } = req.body;

    if (!orderId) { next(createError('Order ID required', 400)); return; }

    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) { next(createError('Order not found', 404)); return; }
    if (order.paymentStatus === 'PAID') { next(createError('Order already paid', 400)); return; }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(order.totalAmount) * 100), // Convert to paise
      currency: 'inr',
      metadata: { orderId, userId },
    });

    res.json({
      success: true,
      data: { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id },
    });
  } catch (err) {
    next(err);
  }
};

export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;

  let event: { type: string; data: { object: any } };
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const orderId = pi.metadata?.orderId;
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID', stripePaymentId: pi.id, status: 'CONFIRMED' },
        });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const orderId = pi.metadata?.orderId;
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'FAILED' },
        });
      }
      break;
    }
  }

  res.json({ received: true });
};
