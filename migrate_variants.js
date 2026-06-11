const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Connected to DB. Running migration...\n');

    // Check existing columns in product_variants
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'ecommerce' AND table_name = 'product_variants'
      ORDER BY ordinal_position;
    `);
    console.log('Existing columns in ecommerce.product_variants:');
    cols.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));
    console.log('');

    // Check existing columns in variant_images
    const { rows: viCols } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'ecommerce' AND table_name = 'variant_images'
      ORDER BY ordinal_position;
    `);
    console.log('Existing columns in ecommerce.variant_images:');
    viCols.forEach(c => console.log(` - ${c.column_name}`));
    console.log('');

    const existingCols = cols.map(c => c.column_name);
    const migrations = [];

    // Add missing columns to product_variants
    if (!existingCols.includes('compare_at_price')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN compare_at_price DECIMAL(10,2);`);
    }
    if (!existingCols.includes('description')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN description TEXT;`);
    }
    if (!existingCols.includes('tags')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';`);
    }
    if (!existingCols.includes('weight')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN weight DECIMAL(8,2);`);
    }
    if (!existingCols.includes('gst_percentage')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN gst_percentage INTEGER DEFAULT 0;`);
    }
    if (!existingCols.includes('shipping_charge')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN shipping_charge DECIMAL(10,2) DEFAULT 0;`);
    }
    if (!existingCols.includes('cod_charge')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN cod_charge DECIMAL(10,2) DEFAULT 0;`);
    }
    if (!existingCols.includes('is_cod_enabled')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN is_cod_enabled BOOLEAN NOT NULL DEFAULT true;`);
    }
    if (!existingCols.includes('is_published')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT true;`);
    }
    if (!existingCols.includes('is_featured')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;`);
    }
    if (!existingCols.includes('attributes')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN attributes JSONB;`);
    }
    if (!existingCols.includes('updated_at')) {
      migrations.push(`ALTER TABLE ecommerce.product_variants ADD COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT now();`);
    }

    // Check and create variant_images table if missing
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'ecommerce' AND table_name = 'variant_images';
    `);

    if (tables.length === 0) {
      migrations.push(`
        CREATE TABLE ecommerce.variant_images (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          variant_id UUID NOT NULL REFERENCES ecommerce.product_variants(id) ON DELETE CASCADE,
          image_url TEXT NOT NULL,
          is_primary BOOLEAN NOT NULL DEFAULT false,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
      `);
      console.log('variant_images table does not exist — will create it.');
    }

    if (migrations.length === 0) {
      console.log('✅ No migrations needed — all columns already exist!');
    } else {
      console.log(`Running ${migrations.length} migration(s)...\n`);
      for (const sql of migrations) {
        console.log('Executing:', sql.trim());
        await client.query(sql);
        console.log('✅ Done\n');
      }
      console.log('🎉 All migrations applied successfully!');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
