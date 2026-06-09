const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // -----------------------------------------------------
  // Set your Super Admin credentials here
  // -----------------------------------------------------
  const name = 'Super Admin';
  const email = 'admin@shopnest.com';
  const password = 'password123';
  
  console.log(`Configuring Super Admin account for: ${email}`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const check = await pool.query("SELECT id FROM ecommerce.users WHERE email = $1", [email]);
  
  if (check.rows.length > 0) {
    await pool.query(
      "UPDATE ecommerce.users SET role = 'super_admin', name = $1, password_hash = $2 WHERE email = $3",
      [name, passwordHash, email]
    );
    console.log(`✅ Success! Existing user updated.`);
  } else {
    // Insert new user if it doesn't exist
    await pool.query(
      `INSERT INTO ecommerce.users 
       (id, name, email, password_hash, role, is_active, email_verified, created_at, updated_at) 
       VALUES (gen_random_uuid(), $1, $2, $3, 'super_admin', true, true, NOW(), NOW())`,
      [name, email, passwordHash]
    );
    console.log(`✅ Success! New Super Admin user created.`);
  }
  
  console.log(`\n🔑 Login Credentials:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);
}

main()
  .catch(console.error)
  .finally(() => pool.end());