/**
 * Production DB Migration Script
 * Adds all missing columns to product_variants table on PRODUCTION database
 * Run: node migrate_prod.js
 */

const { Pool } = require('pg');

// ← Production DB connection (from production server .env)
// We'll try to detect it from env or use explicit production URL
const PROD_DB_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!PROD_DB_URL) {
  console.error('❌ No database URL found. Set PROD_DATABASE_URL or DATABASE_URL env var.');
  process.exit(1);
}

console.log('Connecting to:', PROD_DB_URL.replace(/:([^:@]+)@/, ':****@'));

const pool = new Pool({ connectionString: PROD_DB_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('✅ Connected to database.\n');

    // Check what schema the tables are in
    const { rows: schemas } = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'product_variants'
      ORDER BY table_schema;
    `);
    console.log('Found product_variants in schemas:', schemas.map(r => r.table_schema));
    
    // Try both 'ecommerce' and 'public' schemas
    for (const { table_schema: schema } of schemas) {
      console.log(`\n--- Migrating schema: ${schema} ---`);
      
      const { rows: cols } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'product_variants'
        ORDER BY ordinal_position;
      `, [schema]);
      
      const existing = cols.map(c => c.column_name);
      console.log('Existing columns:', existing.join(', '));
      
      const toAdd = [
        { col: 'compare_at_price',  sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10,2);` },
        { col: 'description',       sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS description TEXT;` },
        { col: 'tags',              sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';` },
        { col: 'weight',            sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS weight DECIMAL(8,2);` },
        { col: 'gst_percentage',    sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS gst_percentage INTEGER DEFAULT 0;` },
        { col: 'shipping_charge',   sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS shipping_charge DECIMAL(10,2) DEFAULT 0;` },
        { col: 'cod_charge',        sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS cod_charge DECIMAL(10,2) DEFAULT 0;` },
        { col: 'is_cod_enabled',    sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS is_cod_enabled BOOLEAN NOT NULL DEFAULT true;` },
        { col: 'is_published',      sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;` },
        { col: 'is_featured',       sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;` },
        { col: 'attributes',        sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS attributes JSONB;` },
        { col: 'updated_at',        sql: `ALTER TABLE ${schema}.product_variants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) NOT NULL DEFAULT now();` },
      ];
      
      let applied = 0;
      for (const { col, sql } of toAdd) {
        if (!existing.includes(col)) {
          console.log(`  Adding missing column: ${col}...`);
          await client.query(sql);
          console.log(`  ✅ Added: ${col}`);
          applied++;
        }
      }
      
      // Check and create variant_images table
      const { rows: viTable } = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'variant_images';
      `, [schema]);
      
      if (viTable.length === 0) {
        console.log(`  Creating missing variant_images table...`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${schema}.variant_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            variant_id UUID NOT NULL REFERENCES ${schema}.product_variants(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            is_primary BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER NOT NULL DEFAULT 0
          );
        `);
        console.log(`  ✅ Created variant_images table`);
        applied++;
      }
      
      if (applied === 0) {
        console.log(`  ✅ Schema "${schema}" — no migrations needed, all columns exist!`);
      } else {
        console.log(`\n🎉 Applied ${applied} migration(s) to schema "${schema}"`);
      }
    }
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
