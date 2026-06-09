require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Seeding Database with Categories and Products...');
  const client = await pool.connect();

  try {
    // Ensure we use the correct schema
    await client.query('SET search_path TO ecommerce, public');

    // 0. Create Admin User
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shopnest.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Check if admin exists
    const adminCheck = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (adminCheck.rows.length === 0) {
      const adminId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, role, is_active, email_verified, updated_at)
        VALUES ($1, $2, $3, $4, 'super_admin', true, true, CURRENT_TIMESTAMP)
      `, [adminId, 'Super Admin', adminEmail, passwordHash]);
      console.log('Super Admin user created!');
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, adminEmail]);
      console.log('Admin user password updated.');
    }

    // 1. Create Categories
    const electronicsId = crypto.randomUUID();
    await client.query(`
      INSERT INTO categories (id, name, slug, description, is_active)
      VALUES ($1, 'Electronics', 'electronics', 'Gadgets, phones, and laptops.', true)
      ON CONFLICT (slug) DO NOTHING;
    `, [electronicsId]);

    const clothingId = crypto.randomUUID();
    await client.query(`
      INSERT INTO categories (id, name, slug, description, is_active)
      VALUES ($1, 'Clothing', 'clothing', 'Men and Women clothing.', true)
      ON CONFLICT (slug) DO NOTHING;
    `, [clothingId]);

    console.log('Categories created!');

    // Fetch category IDs in case they already existed
    const resElec = await client.query("SELECT id FROM categories WHERE slug = 'electronics'");
    const elecDbId = resElec.rows[0].id;

    const resClo = await client.query("SELECT id FROM categories WHERE slug = 'clothing'");
    const cloDbId = resClo.rows[0].id;

    // 2. Create Products
    const p1Id = crypto.randomUUID();
    await client.query(`
      INSERT INTO products (id, category_id, name, slug, description, short_desc, sku, price, stock_quantity, is_published, updated_at)
      VALUES ($1, $2, 'Smartphone Pro Max', 'smartphone-pro-max', 'The latest premium smartphone with amazing camera.', 'A powerful smartphone.', 'ELEC-PHONE-001', 89900, 50, true, CURRENT_TIMESTAMP)
      ON CONFLICT (slug) DO NOTHING;
    `, [p1Id, elecDbId]);

    const p2Id = crypto.randomUUID();
    await client.query(`
      INSERT INTO products (id, category_id, name, slug, description, short_desc, sku, price, stock_quantity, is_published, updated_at)
      VALUES ($1, $2, 'UltraBook Laptop 14"', 'ultrabook-laptop-14', 'Lightweight laptop for developers and creators.', 'High-performance laptop.', 'ELEC-LAPTOP-002', 125000, 20, true, CURRENT_TIMESTAMP)
      ON CONFLICT (slug) DO NOTHING;
    `, [p2Id, elecDbId]);

    const p3Id = crypto.randomUUID();
    await client.query(`
      INSERT INTO products (id, category_id, name, slug, description, short_desc, sku, price, stock_quantity, is_published, updated_at)
      VALUES ($1, $2, 'Classic Cotton T-Shirt', 'classic-cotton-tshirt', '100% premium cotton t-shirt for everyday wear.', 'Comfortable everyday wear.', 'CLO-TSHIRT-001', 799, 150, true, CURRENT_TIMESTAMP)
      ON CONFLICT (slug) DO NOTHING;
    `, [p3Id, cloDbId]);

    console.log('Products created successfully!');
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
