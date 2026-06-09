require('dotenv').config();
const { Pool } = require('pg');

async function fixAdmins() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Fixing Admin tenant_ids...');
    // Find all tenants and their owners
    const res = await pool.query('SELECT id, owner_id FROM ecommerce.tenants');
    
    let updatedCount = 0;
    for (const tenant of res.rows) {
      if (tenant.owner_id) {
        const updateRes = await pool.query(
          'UPDATE ecommerce.users SET tenant_id = $1 WHERE id = $2 AND tenant_id IS NULL',
          [tenant.id, tenant.owner_id]
        );
        updatedCount += updateRes.rowCount;
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} admin users with their tenant_id!`);
  } catch (err) {
    console.error('Error fixing admins:', err);
  } finally {
    pool.end();
  }
}

fixAdmins();
