const crypto = require("crypto");
const pool = require("../../config/db");

function generateDispatchNumber() {
  return `DSP-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

async function dispatchSalesOrder(
  salesOrderId,
  { vehicleNumber, driverName, dispatchDate }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the order so it cannot be dispatched twice concurrently.
    const orderResult = await client.query(
      `SELECT
         id,
         order_number,
         status
       FROM sales_orders
       WHERE id = $1
       FOR UPDATE`,
      [salesOrderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("Sales Order not found");
    }

    const order = orderResult.rows[0];

    if (order.status === "CANCELLED") {
      throw new Error("Cannot dispatch a cancelled Sales Order");
    }

    if (order.status !== "CONFIRMED") {
      throw new Error(
        `Only CONFIRMED Sales Orders can be dispatched. Current status: ${order.status}`
      );
    }

    // Prevent duplicate dispatch.
    const existingDispatch = await client.query(
      `SELECT id, dispatch_number
       FROM dispatches
       WHERE sales_order_id = $1
       LIMIT 1`,
      [salesOrderId]
    );

    if (existingDispatch.rows.length > 0) {
      throw new Error(
        `Sales Order already dispatched: ${existingDispatch.rows[0].dispatch_number}`
      );
    }

    if (
      typeof vehicleNumber !== "string" ||
      !vehicleNumber.trim()
    ) {
      throw new Error("Vehicle number is required");
    }

    if (
      typeof driverName !== "string" ||
      !driverName.trim()
    ) {
      throw new Error("Driver name is required");
    }

    const orderItemsResult = await client.query(
      `SELECT
         soi.product_id,
         p.product_code,
         p.product_name,
         soi.quantity
       FROM sales_order_items soi
       JOIN products p ON p.id = soi.product_id
       WHERE soi.sales_order_id = $1
       ORDER BY soi.product_id`,
      [salesOrderId]
    );

    if (orderItemsResult.rows.length === 0) {
      throw new Error("Sales Order has no items");
    }

    /*
     * Lock inventory rows before checking reserved quantity.
     */
    const productIds = orderItemsResult.rows.map(
      (item) => item.product_id
    );

    const inventoryResult = await client.query(
      `SELECT
         product_id,
         physical_quantity,
         reserved_quantity
       FROM inventory
       WHERE product_id = ANY($1::uuid[])
       ORDER BY product_id
       FOR UPDATE`,
      [productIds]
    );

    const inventoryMap = new Map(
      inventoryResult.rows.map((row) => [
        row.product_id,
        row,
      ])
    );

    /*
     * Validate all items before changing any stock.
     */
    for (const item of orderItemsResult.rows) {
      const inventory = inventoryMap.get(item.product_id);

      if (!inventory) {
        throw new Error(
          `Inventory record missing for ${item.product_name}`
        );
      }

      const reserved = Number(inventory.reserved_quantity);
      const quantity = Number(item.quantity);

      if (quantity > reserved) {
        throw new Error(
          `Cannot dispatch ${item.product_name}. Reserved: ${reserved}, Required: ${quantity}`
        );
      }

      const physical = Number(inventory.physical_quantity);

      if (quantity > physical) {
        throw new Error(
          `Cannot dispatch ${item.product_name}. Physical stock: ${physical}, Required: ${quantity}`
        );
      }
    }

    const dispatchNumber = generateDispatchNumber();

    const dispatchResult = await client.query(
      `INSERT INTO dispatches
       (
         dispatch_number,
         sales_order_id,
         dispatch_date,
         vehicle_number,
         driver_name
       )
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5)
       RETURNING *`,
      [
        dispatchNumber,
        salesOrderId,
        dispatchDate || null,
        vehicleNumber.trim().toUpperCase(),
        driverName.trim(),
      ]
    );

    const dispatch = dispatchResult.rows[0];

    for (const item of orderItemsResult.rows) {
      await client.query(
        `INSERT INTO dispatch_items
         (
           dispatch_id,
           product_id,
           quantity
         )
         VALUES ($1, $2, $3)`,
        [
          dispatch.id,
          item.product_id,
          item.quantity,
        ]
      );

      // Physical stock decreases AND reserved stock decreases.
      await client.query(
        `UPDATE inventory
         SET physical_quantity = physical_quantity - $1,
             reserved_quantity = reserved_quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2`,
        [
          item.quantity,
          item.product_id,
        ]
      );
    }

    await client.query(
      `UPDATE sales_orders
       SET status = 'DISPATCHED',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [salesOrderId]
    );

    await client.query("COMMIT");

    return getDispatchById(dispatch.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getDispatchById(dispatchId) {
  const result = await pool.query(
    `
    SELECT
      d.id,
      d.dispatch_number,
      d.sales_order_id,
      so.order_number,
      d.dispatch_date,
      d.vehicle_number,
      d.driver_name,
      d.created_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'productId', di.product_id,
              'productCode', p.product_code,
              'productName', p.product_name,
              'quantity', di.quantity
            )
            ORDER BY p.product_name
          )
          FROM dispatch_items di
          JOIN products p ON p.id = di.product_id
          WHERE di.dispatch_id = d.id
        ),
        '[]'::json
      ) AS items

    FROM dispatches d
    JOIN sales_orders so
      ON so.id = d.sales_order_id
    WHERE d.id = $1
    `,
    [dispatchId]
  );

  return result.rows[0] || null;
}

async function getDispatches() {
  const result = await pool.query(
    `
    SELECT
      d.id,
      d.dispatch_number,
      d.sales_order_id,
      so.order_number,
      c.company_name,
      d.dispatch_date,
      d.vehicle_number,
      d.driver_name,
      d.created_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'productId', di.product_id,
              'productCode', p.product_code,
              'productName', p.product_name,
              'quantity', di.quantity
            )
            ORDER BY p.product_name
          )
          FROM dispatch_items di
          JOIN products p ON p.id = di.product_id
          WHERE di.dispatch_id = d.id
        ),
        '[]'::json
      ) AS items

    FROM dispatches d
    JOIN sales_orders so
      ON so.id = d.sales_order_id
    JOIN customers c
      ON c.id = so.customer_id
    ORDER BY d.created_at DESC
    `
  );

  return result.rows;
}

module.exports = {
  dispatchSalesOrder,
  getDispatchById,
  getDispatches,
};