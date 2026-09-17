const pool = require("../../config/db");

async function getProducts() {
  const result = await pool.query(`
    SELECT
      p.id,
      p.product_code,
      p.product_name,
      p.category,
      p.unit,
      p.base_price,
      COALESCE(i.physical_quantity, 0) AS physical_quantity,
      COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
      (
        COALESCE(i.physical_quantity, 0)
        - COALESCE(i.reserved_quantity, 0)
      ) AS available_quantity
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    ORDER BY p.product_name
  `);

  return result.rows;
}

async function getInventory() {
  const result = await pool.query(`
    SELECT
      i.product_id,
      p.product_code,
      p.product_name,
      p.category,
      p.unit,
      i.physical_quantity,
      i.reserved_quantity,
      (i.physical_quantity - i.reserved_quantity)
        AS available_quantity,
      i.updated_at
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    ORDER BY p.product_name
  `);

  return result.rows;
}

async function getInventoryByProductId(productId) {
  const result = await pool.query(
    `
    SELECT
      i.product_id,
      p.product_code,
      p.product_name,
      p.category,
      p.unit,
      i.physical_quantity,
      i.reserved_quantity,
      (i.physical_quantity - i.reserved_quantity)
        AS available_quantity,
      i.updated_at
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE i.product_id = $1
    `,
    [productId]
  );

  return result.rows[0] || null;
}

async function updatePhysicalQuantity(productId, physicalQuantity) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT physical_quantity, reserved_quantity
      FROM inventory
      WHERE product_id = $1
      FOR UPDATE
      `,
      [productId]
    );

    if (result.rows.length === 0) {
      throw new Error("Inventory record not found");
    }

    const current = result.rows[0];

    if (!Number.isInteger(physicalQuantity) || physicalQuantity < 0) {
      throw new Error("Physical quantity must be a non-negative integer");
    }

    if (physicalQuantity < current.reserved_quantity) {
      throw new Error(
        `Physical quantity cannot be less than reserved quantity (${current.reserved_quantity})`
      );
    }

    await client.query(
      `
      UPDATE inventory
      SET physical_quantity = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2
      `,
      [physicalQuantity, productId]
    );

    await client.query("COMMIT");

    return getInventoryByProductId(productId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getProducts,
  getInventory,
  getInventoryByProductId,
  updatePhysicalQuantity,
};