const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Starting DB Cleanup...');
  
  try {
    // We will just delete all users except the super admin.
    // PostgreSQL CASCADE will delete everything else if constraints are set up properly.
    // However, sometimes Prisma doesn't set up DB-level cascades if it's set in application level.
    // Let's delete dependent tables first.
    
    await pool.query('DELETE FROM ecommerce.orders;');
    await pool.query('DELETE FROM ecommerce.cart_items;');
    await pool.query('DELETE FROM ecommerce.wishlist_items;');
    await pool.query('DELETE FROM ecommerce.reviews;');
    await pool.query('DELETE FROM ecommerce.support_tickets;');
    await pool.query('DELETE FROM ecommerce.products;');
    await pool.query('DELETE FROM ecommerce.categories;');
    await pool.query('DELETE FROM ecommerce.banners;');
    await pool.query('DELETE FROM ecommerce.blogs;');
    await pool.query('DELETE FROM ecommerce.certifications;');
    await pool.query('DELETE FROM ecommerce.coupons;');
    await pool.query('DELETE FROM ecommerce.site_config;');
    await pool.query('DELETE FROM ecommerce.client_payments;');
    await pool.query('DELETE FROM ecommerce.notifications;');
    await pool.query('DELETE FROM ecommerce.refresh_tokens;');
    
    // Now delete all tenants
    await pool.query('DELETE FROM ecommerce.tenants;');
    
    // Now delete all users EXCEPT the super admin
    const result = await pool.query("DELETE FROM ecommerce.users WHERE email != 'admin@shopnest.com'");
    console.log(`Deleted ${result.rowCount} users.`);
    
    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    pool.end();
  }
}

main();
