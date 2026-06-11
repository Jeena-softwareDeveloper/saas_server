# Production Fix Commands - COMPLETE (includes created_at fix)
# SSH into your production VPS and run this SINGLE command:

cd /www/wwwroot/saas_server

node -e "
const {Pool} = require('pg');
require('dotenv').config();
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.connect().then(async (client) => {
  try {
    const {rows} = await client.query(\"SELECT table_schema FROM information_schema.tables WHERE table_name='product_variants'\");
    const schema = rows[0]?.table_schema || 'ecommerce';
    console.log('Schema:', schema);

    const migrations = [
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10,2);\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS description TEXT;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS weight DECIMAL(8,2);\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS gst_percentage INTEGER DEFAULT 0;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS shipping_charge DECIMAL(10,2) DEFAULT 0;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS cod_charge DECIMAL(10,2) DEFAULT 0;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS is_cod_enabled BOOLEAN NOT NULL DEFAULT true;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS attributes JSONB;\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(6) NOT NULL DEFAULT now();\`,
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) NOT NULL DEFAULT now();\`,
    ];

    for (const sql of migrations) {
      await client.query(sql);
      const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];
      console.log('✅ OK:', col);
    }

    // Also ensure variant_images table exists
    await client.query(\`
      CREATE TABLE IF NOT EXISTS \${schema}.variant_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        variant_id UUID NOT NULL REFERENCES \${schema}.product_variants(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    \`);
    console.log('✅ OK: variant_images table');

    console.log('\\n🎉 ALL MIGRATIONS DONE! Restart your server now.');
  } catch(e) {
    console.error('❌ ERROR:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}).catch(e => { console.error('❌ Connection failed:', e.message); pool.end(); });
"

# After the above completes, restart PM2:
pm2 restart saas-api
