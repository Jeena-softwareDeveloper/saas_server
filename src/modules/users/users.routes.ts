import { Router } from 'express';
import { getAllUsers, getMe, updateMe, updateUserRole, toggleUserActive } from './users.controller';
import { authenticate } from '../../middleware/auth';
import { isAdmin, isSuperAdmin } from '../../middleware/role';

const router = Router();

router.get('/', authenticate, isAdmin, getAllUsers);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.put('/:id/role', authenticate, isSuperAdmin, updateUserRole);
router.put('/:id/toggle-active', authenticate, isAdmin, toggleUserActive);

export default router;
