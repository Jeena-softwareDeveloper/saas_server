import { Router } from 'express';
import multer from 'multer';
import { authorizeAdmin, requirePermission } from '../../middleware/auth';
import { resolveTenant } from '../../middleware/tenant';

import { getDashboardStats, getRecentOrders, getLowStock, getSalesChart } from './dashboard.controller';
import { getAllCategories, createCategory, updateCategory, deleteCategory, toggleCategoryStatus } from './categories.controller';
import { getAdminProducts, getAdminProduct, generateIdentifiers, createAdminProduct, updateAdminProduct, deleteAdminProduct, toggleProductPublish, removeVariantImage, addProductVariant, updateProductVariant, deleteProductVariant, bulkImportProducts, getProductByBarcode, createProductAttributes, bulkCreateVariants, bulkUpdateInventory, setPrimaryVariantImage } from './products.controller';
import { getInventory, updateInventory } from './inventory.controller';
import { getAdminOrders, getAdminOrder, updateAdminOrderStatus, initiateOrderRefund } from './orders.controller';
import { getAdminCustomers, getAdminCustomer, updateCustomerStatus, createCustomer, getClientIntegrations, updateClientIntegrations, resetEncryptionKey, resetStoreKey, resetCustomerPassword, deleteAdminCustomer } from './customers.controller';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from './coupons.controller';
import { getConfig, updateConfig, uploadLogo } from './config.controller';
import { getAllBanners, createBanner, updateBanner, deleteBanner, toggleBannerStatus } from './banners.controller';
import { getReviews, createReview, updateReviewStatus, deleteReview } from './reviews.controller';
import { getBlogs, createBlog, updateBlog, deleteBlog } from './blogs.controller';
import { getCertifications, createCertification, updateCertification, deleteCertification, toggleCertificationStatus } from './certifications.controller';
import { getNotifications, sendNotification } from './notifications.controller';
import { getClientPayments, addClientPayment, deleteClientPayment } from './client-payments.controller';
import { getAllMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemStatus } from './menus.controller';
import { getAdminLogs, trackActivity, getActiveLogs } from './logs.controller';
import supportRoutes from './support.routes';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

router.use(authorizeAdmin);
router.use(resolveTenant);

router.use('/categories', requirePermission('MODULE_CATEGORIES'));
router.use('/products', requirePermission('MODULE_PRODUCTS'));
router.use('/inventory', requirePermission('MODULE_PRODUCTS'));
router.use('/orders', requirePermission('MODULE_ORDERS'));
router.use('/customers', requirePermission('MODULE_USERS'));
router.use('/coupons', requirePermission('MODULE_COUPONS'));
router.use('/config', requirePermission('MODULE_SETTINGS'));
router.use('/reviews', requirePermission('MODULE_REVIEWS'));
router.use('/banners', requirePermission('MODULE_BANNERS'));
router.use('/blogs', requirePermission('MODULE_BLOGS'));
router.use('/certifications', requirePermission('MODULE_CERTIFICATIONS'));

router.use('/support', requirePermission('MODULE_SUPPORT'), supportRoutes);

router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/recent-orders', getRecentOrders);
router.get('/dashboard/low-stock', getLowStock);
router.get('/dashboard/sales-chart', getSalesChart);

router.get('/logs', getAdminLogs);
router.get('/logs/active', getActiveLogs);
router.post('/logs/track', trackActivity);

router.get('/categories', getAllCategories);
router.post('/categories', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), createCategory);
router.put('/categories/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateCategory);
router.delete('/categories/:id', deleteCategory);
router.patch('/categories/:id/toggle', toggleCategoryStatus);

router.get('/products', getAdminProducts);
router.get('/products/generate-identifiers', generateIdentifiers);
router.get('/products/:id', getAdminProduct);
router.post('/products', upload.array('images', 5), createAdminProduct);
router.put('/products/:id', upload.array('images', 5), updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);
router.patch('/products/:id/publish', toggleProductPublish);

router.post('/products/:id/attributes', createProductAttributes);
router.post('/products/:id/variants/bulk', bulkCreateVariants);
router.post('/products/:id/inventory/bulk', bulkUpdateInventory);

router.post('/products/:id/variants', upload.array('images', 10), addProductVariant);
router.put('/products/:id/variants/:vid', upload.array('images', 10), updateProductVariant);
router.delete('/products/:id/variants/:vid', deleteProductVariant);
router.delete('/products/:id/variants/:vid/images/:imgId', removeVariantImage);
router.patch('/products/:id/variants/:vid/images/:imgId/primary', setPrimaryVariantImage);
router.post('/products/bulk-import', upload.single('file'), bulkImportProducts);
router.get('/products/scan/:barcode', getProductByBarcode);

router.get('/inventory', getInventory);
router.patch('/inventory/:productId', updateInventory);

router.get('/orders', getAdminOrders);
router.get('/orders/:id', getAdminOrder);
router.patch('/orders/:id/status', updateAdminOrderStatus);
router.post('/orders/:id/refund', initiateOrderRefund);

router.get('/customers', getAdminCustomers);
router.post('/customers', upload.single('logo'), createCustomer);
router.get('/customers/:id', getAdminCustomer);
router.patch('/customers/:id/status', upload.single('logo'), updateCustomerStatus);
router.delete('/customers/:id', deleteAdminCustomer);
router.get('/customers/:id/integrations', getClientIntegrations);
router.put('/customers/:id/integrations', updateClientIntegrations);
router.post('/customers/:id/encryption-key', resetEncryptionKey);
router.post('/customers/:id/store-key', resetStoreKey);
router.patch('/customers/:id/password', resetCustomerPassword);
router.get('/customers/:id/payments', getClientPayments);
router.post('/customers/:id/payments', addClientPayment);
router.delete('/customers/:id/payments/:paymentId', deleteClientPayment);

router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

router.get('/notifications', getNotifications);
router.post('/notifications', sendNotification);

router.get('/config', getConfig);
router.put('/config', updateConfig);
router.post('/config/logo', upload.single('logo'), uploadLogo);
router.get('/reviews', getReviews);
router.post('/reviews', createReview);
router.patch('/reviews/:id/approve', updateReviewStatus);
router.delete('/reviews/:id', deleteReview);

router.get('/banners', getAllBanners);
router.post('/banners', upload.single('image'), createBanner);
router.put('/banners/:id', upload.single('image'), updateBanner);
router.delete('/banners/:id', deleteBanner);
router.patch('/banners/:id/toggle', toggleBannerStatus);

router.get('/blogs', getBlogs);
router.post('/blogs', createBlog);
router.put('/blogs/:id', updateBlog);
router.delete('/blogs/:id', deleteBlog);

router.get('/certifications', getCertifications);
router.post('/certifications', upload.single('image'), createCertification);
router.put('/certifications/:id', upload.single('image'), updateCertification);
router.delete('/certifications/:id', deleteCertification);
router.patch('/certifications/:id/toggle', toggleCertificationStatus);

router.get('/menus', getAllMenuItems);
router.post('/menus', createMenuItem);
router.put('/menus/:id', updateMenuItem);
router.delete('/menus/:id', deleteMenuItem);
router.patch('/menus/:id/toggle', toggleMenuItemStatus);

export default router;
