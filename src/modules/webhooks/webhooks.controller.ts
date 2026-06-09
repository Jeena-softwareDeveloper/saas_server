import { Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../../config/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '') as any;

export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: any;
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

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;

        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'PAID', stripePaymentId: pi.id, status: 'CONFIRMED' },
          });

        } else {
          const order = await prisma.order.findFirst({
            where: { stripePaymentId: pi.id },
          });
          if (order) {
            await prisma.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
            });

          } else {

          }
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

        } else {
          const order = await prisma.order.findFirst({
            where: { stripePaymentId: pi.id },
          });
          if (order) {
            await prisma.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'FAILED' },
            });

          } else {

          }
        }
        break;
      }

      default:

    }

    res.json({ received: true });
  } catch (dbErr: any) {

    res.status(500).json({ error: 'Database update failed' });
  }
};
