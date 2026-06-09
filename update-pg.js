require('dotenv').config();
const { Client } = require('pg');

async function updateTenants() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SET search_path TO ecommerce, public');
  await client.query("UPDATE tenants SET domain = 'http://192.23.1.35:3001' WHERE domain = 'http://192.23.1.52:3001'");
  console.log('Domain updated!');
  await client.end();
}
updateTenants().catch(console.error);
