const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fundsroom_erp'
});

async function runMigrations() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '001_init_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing PostgreSQL database migrations...');
    await pool.query(sql);
    console.log('✅ Migrations executed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();