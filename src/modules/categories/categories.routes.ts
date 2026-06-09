import { Router } from 'express';
import { getCategories, getCategory } from './categories.controller';

const router = Router();

router.get('/', getCategories);
router.get('/:id', getCategory);

export default router;
