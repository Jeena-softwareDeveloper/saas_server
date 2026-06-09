import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from './wishlist.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
