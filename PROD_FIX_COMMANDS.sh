# Production Fix Commands
# SSH into your production VPS and run these commands:

cd /www/wwwroot/saas_server

# Step 1: Run the DB migration to add missing columns
node -e "
const {Pool} = require('pg');
require('dotenv').config();
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.connect().then(async (client) => {
  try {
    const {rows} = await client.query(\"SELECT table_schema FROM information_schema.tables WHERE table_name='product_variants'\");
    const schema = rows[0]?.table_schema || 'ecommerce';
    console.log('Using schema:', schema);
    const sqls = [
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
      \`ALTER TABLE \${schema}.product_variants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) NOT NULL DEFAULT now();\`,
    ];
    for (const sql of sqls) { await client.query(sql); console.log('OK:', sql.substring(0,60)); }
    console.log('DONE - All columns added!');
  } finally { client.release(); pool.end(); }
}).catch(e => { console.error('ERROR:', e.message); pool.end(); });
"

# Step 2: Regenerate Prisma client
npx prisma generate --schema=./src/prisma/schema.prisma

# Step 3: Rebuild
npm run build

# Step 4: Restart PM2
pm2 restart saas-api
