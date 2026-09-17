const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const adminPassword = await bcrypt.hash("Admin@123", 10);
    const salesPassword = await bcrypt.hash("Sales@123", 10);

    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES
       ('admin@fundsroom.com', $1, 'FundsRoom Admin', 'ADMIN'),
       ('sales@fundsroom.com', $2, 'FundsRoom Sales', 'SALES_USER')
       ON CONFLICT (email) DO NOTHING`,
      [adminPassword, salesPassword]
    );

    const products = [
      ["IND-MTR-001", "Industrial Electric Motor", "Motors", "PCS", 12500],
      ["IND-PMP-002", "Centrifugal Water Pump", "Pumps", "PCS", 18500],
      ["IND-VLV-003", "Stainless Steel Valve", "Valves", "PCS", 4200],
      ["IND-BRG-004", "Heavy Duty Ball Bearing", "Bearings", "PCS", 2800],
      ["IND-CBL-005", "Industrial Power Cable", "Electrical", "MTR", 350],
      ["IND-GEN-006", "Industrial Generator", "Generators", "PCS", 85000],
    ];

    for (const product of products) {
      const result = await client.query(
        `INSERT INTO products
         (product_code, product_name, category, unit, base_price)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (product_code)
         DO UPDATE SET
           product_name = EXCLUDED.product_name,
           category = EXCLUDED.category,
           unit = EXCLUDED.unit,
           base_price = EXCLUDED.base_price
         RETURNING id`,
        product
      );

      const productId = result.rows[0].id;

      await client.query(
        `INSERT INTO inventory
         (product_id, physical_quantity, reserved_quantity)
         VALUES ($1, 100, 0)
         ON CONFLICT (product_id) DO NOTHING`,
        [productId]
      );
    }

    await client.query("COMMIT");

    console.log("Seed completed successfully.");
    console.log("Admin: admin@fundsroom.com / Admin@123");
    console.log("Sales: sales@fundsroom.com / Sales@123");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();