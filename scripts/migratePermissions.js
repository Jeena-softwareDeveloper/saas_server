const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PERMISSION_MAP = {
  '/admin/products': 'MODULE_PRODUCTS',
  '/admin/categories': 'MODULE_CATEGORIES',
  '/admin/orders': 'MODULE_ORDERS',
  '/admin/users': 'MODULE_USERS',
  '/admin/banners': 'MODULE_BANNERS',
  '/admin/blogs': 'MODULE_BLOGS',
  '/admin/certifications': 'MODULE_CERTIFICATIONS',
  '/admin/reviews': 'MODULE_REVIEWS',
  '/admin/coupons': 'MODULE_COUPONS',
  '/admin/support': 'MODULE_SUPPORT',
  '/admin/settings': 'MODULE_SETTINGS'
};

async function main() {
  console.log('Starting permission migration using pg pool...');
  
  const res = await pool.query("SELECT id, permissions FROM ecommerce.users WHERE permissions IS NOT NULL AND array_length(permissions, 1) > 0");
  const users = res.rows;
  
  let updatedCount = 0;

  for (const user of users) {
    if (!user.permissions || user.permissions.length === 0) continue;

    let needsUpdate = false;
    const newPermissions = user.permissions.map(p => {
      if (PERMISSION_MAP[p]) {
        needsUpdate = true;
        return PERMISSION_MAP[p];
      }
      return p;
    });

    if (needsUpdate) {
      await pool.query('UPDATE ecommerce.users SET permissions = $1 WHERE id = $2', [newPermissions, user.id]);
      updatedCount++;
      console.log(`Updated user ID ${user.id} with new permissions.`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
