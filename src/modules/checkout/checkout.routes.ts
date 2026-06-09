import { Router } from 'express';
import { validateCoupon, createPaymentIntent, placeOrder } from './checkout.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/validate-coupon', validateCoupon);
router.post('/create-payment-intent', createPaymentIntent);
router.post('/place-order', placeOrder);

export default router;
