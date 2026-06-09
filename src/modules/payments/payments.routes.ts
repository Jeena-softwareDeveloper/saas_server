import { Router, raw } from 'express';
import { createPaymentIntent, stripeWebhook } from './payments.controller';
import { authenticate } from '../../middleware/auth';
import { isCustomer } from '../../middleware/role';

const router = Router();

router.post('/intent', authenticate, isCustomer, createPaymentIntent);
router.post('/webhook', raw({ type: 'application/json' }), stripeWebhook);

export default router;
