import { Router } from 'express';
import { resolveStoreTenant } from '../../middleware/tenant';

import productRoutes from '../products/products.routes';
import categoryRoutes from '../categories/categories.routes';
import cartRoutes from '../cart/cart.routes';
import orderRoutes from '../orders/orders.routes';
import reviewRoutes from '../reviews/reviews.routes';

import homepageRoutes from './homepage.routes';
import checkoutRoutes from '../checkout/checkout.routes';
import addressRoutes from '../addresses/addresses.routes';
import wishlistRoutes from '../wishlist/wishlist.routes';

import { getThemeConfig } from './theme.controller';
import { trackActivity } from '../admin/logs.controller';
import { getAllBlogs, getBlogBySlug } from './blogs.controller';
import { getActiveCoupons } from './coupons.controller';
import { getSupportInfo, createSupportTicket } from './support.controller';
import { getStoreMenus } from './menus.store.controller';

const router = Router();

router.use(resolveStoreTenant);

router.post('/track', trackActivity);
router.get('/theme', getThemeConfig);

router.get('/menus', getStoreMenus);

router.get('/blogs', getAllBlogs);
router.get('/blogs/:slug', getBlogBySlug);

router.get('/coupons', getActiveCoupons);
router.get('/support', getSupportInfo);
router.post('/support/tickets', createSupportTicket);

router.use('/homepage', homepageRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/addresses', addressRoutes);
router.use('/wishlist', wishlistRoutes);

export default router;
