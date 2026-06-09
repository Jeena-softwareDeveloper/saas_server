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
      console.log(`❌ Error: User with email ${email} not found in the database.`);
    }
  } catch (err) {
    console.error('Error updating password:', err);
  } finally {
    pool.end();
  }
}

main();
