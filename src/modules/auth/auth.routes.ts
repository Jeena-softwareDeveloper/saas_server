import { Router } from 'express';
import { register, login, adminLogin, refreshToken, logout, getMe, updateMe, forgotPassword, resetPassword } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

const loginLimiter = rateLimit({
  windowMs: isDev ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
  max: isDev ? 100 : 5, // 100 in dev, 5 in prod
  message: { success: false, error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

import { resolveStoreTenant } from '../../middleware/tenant';

const router = Router();

router.post('/register', resolveStoreTenant, register);
router.post('/login', resolveStoreTenant, loginLimiter, login);
router.post('/admin/login', loginLimiter, adminLogin);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe); // Add multer upload.single('profileImage') here if we want image uploading

export default router;
