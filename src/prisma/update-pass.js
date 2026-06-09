require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function updatePassword() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const hash = await bcrypt.hash('admin123', 10);
  await client.query('SET search_path TO ecommerce, public');
  await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@shopnest.com']);
  console.log('Password updated to admin123 via pg!');
  await client.end();
}

updatePassword().catch(console.error);
