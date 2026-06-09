const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT id, name, domain, owner_id FROM ecommerce.tenants", (err, res) => {
  if (err) console.error("DB Error:", err);
  else console.log("Tenants:", res.rows);
  pool.end();
});
