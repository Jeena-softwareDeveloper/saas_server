import { Router } from 'express';
import { getHomepageData } from './homepage.controller';

const router = Router();

router.get('/', getHomepageData);

export default router;
