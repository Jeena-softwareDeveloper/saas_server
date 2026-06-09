import { Router } from 'express';
import { getMyOrders, getOrder, cancelOrder } from './orders.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getMyOrders);
router.get('/:id', getOrder);
router.post('/:id/cancel', cancelOrder);

export default router;
