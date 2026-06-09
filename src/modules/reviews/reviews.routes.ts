import { Router } from 'express';
import { getReviews, createReview, updateReview, deleteReview } from './reviews.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', getReviews);

router.use(authenticate);
router.post('/', createReview);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

export default router;
