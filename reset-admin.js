require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const email = process.argv[2] || 'jeena2284@gmail.com';
  const password = process.argv[3] || 'jeena.123';

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query(
      "UPDATE ecommerce.users SET password_hash = $1, role = 'super_admin' WHERE email = $2",
      [hash, email]
    );
    
    if (res.rowCount > 0) {
      console.log(`✅ Success! Password for ${email} has been updated to: ${password}`);
      console.log(`✅ Role is also set to 'super_admin'.`);
    } else {
      console.log(`User not found. Creating a new super_admin account for ${email}...`);
      const crypto = require('crypto');
      const userId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO ecommerce.users (id, name, email, password_hash, role, is_active, email_verified, created_at, updated_at) VALUES ($1, 'Super Admin', $2, $3, 'super_admin', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        [userId, email, hash]
      );
      console.log(`✅ Success! New Super Admin created: ${email}`);
    }
  } catch (err) {
    console.error('Error updating password:', err);
  } finally {
    pool.end();
  }
}

main();
