import { Router } from 'express';
import { getProducts, getProduct, searchProducts, getRelatedProducts } from './products.controller';
import { authenticate } from '../../middleware/auth';
import { isAdmin } from '../../middleware/role';

const router = Router();

router.get('/search', searchProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.get('/:id/related', getRelatedProducts);

export default router;
