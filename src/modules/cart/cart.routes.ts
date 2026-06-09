import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from './cart.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/', addToCart);
router.put('/:productId', updateCartItem);
router.delete('/', clearCart);
router.delete('/:productId', removeFromCart);

export default router;
