require('dotenv').config();
const { Client } = require('pg');

async function getTenants() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SET search_path TO ecommerce, public');
  const res = await client.query('SELECT id, name, domain, store_key as "storeKey", is_active as "isActive" FROM tenants');
  console.log(res.rows);
  await client.end();
}
getTenants().catch(console.error);
