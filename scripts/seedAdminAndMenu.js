require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Seeding Database with Admin and Menu Items...');
  const client = await pool.connect();

  try {
    await client.query('SET search_path TO ecommerce, public');

    const adminEmail = 'admin@shopnest.com';
    const adminPassword = 'password123';
    
    const adminCheck = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    if (adminCheck.rows.length === 0) {
      const adminId = crypto.randomUUID();
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, role, is_active, email_verified, created_at, updated_at)
        VALUES ($1, 'Super Admin', $2, $3, 'super_admin', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [adminId, adminEmail, passwordHash]);
      console.log('✅ Super Admin user created!');
    } else {
      await client.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [passwordHash, 'super_admin', adminEmail]);
      console.log('✅ Admin user updated!');
    }

    await client.query('DELETE FROM menu_items WHERE tenant_id IS NULL');

    const menus = [
      { label: 'Home', link: '/', sort_order: 1 },
      { label: 'Shop', link: '/shop', sort_order: 2 },
      { label: 'Categories', link: '/categories', sort_order: 3 },
      { label: 'About Us', link: '/about', sort_order: 4 },
      { label: 'Contact Us', link: '/contact', sort_order: 5 }
    ];

    for (const menu of menus) {
      await client.query(`
        INSERT INTO menu_items (id, label, link, is_active, sort_order, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, true, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [menu.label, menu.link, menu.sort_order]);
    }

    console.log('✅ Menu Items created successfully!');
    
    console.log(`\n🔑 Login Credentials:`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}\n`);
    
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  });
