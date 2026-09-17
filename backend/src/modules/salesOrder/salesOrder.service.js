const crypto = require("crypto");
const pool = require("../../config/db");

function generateOrderNumber() {
  return `SO-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/*
 * Convert ACCEPTED quotation -> PENDING Sales Order
 */
async function convertQuotationToSalesOrder(quotationId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quotationResult = await client.query(
      `SELECT
         q.id,
         q.quotation_number,
         q.customer_id,
         q.grand_total,
         q.status
       FROM quotations q
       WHERE q.id = $1
       FOR UPDATE`,
      [quotationId]
    );

    if (quotationResult.rows.length === 0) {
      throw new Error("Quotation not found");
    }

    const quotation = quotationResult.rows[0];

    if (quotation.status !== "ACCEPTED") {
      throw new Error(
        `Only ACCEPTED quotations can be converted. Current status: ${quotation.status}`
      );
    }

    // Database has UNIQUE(quotation_id), but checking first
    // gives a cleaner application-level error.
    const existingOrder = await client.query(
      `SELECT id, order_number, status
       FROM sales_orders
       WHERE quotation_id = $1
       LIMIT 1`,
      [quotationId]
    );

    if (existingOrder.rows.length > 0) {
      throw new Error(
        `Sales Order already exists for this quotation: ${existingOrder.rows[0].order_number}`
      );
    }

    const quotationItems = await client.query(
      `SELECT
         product_id,
         quantity,
         unit_price,
         line_amount
       FROM quotation_items
       WHERE quotation_id = $1
       ORDER BY product_id`,
      [quotationId]
    );

    if (quotationItems.rows.length === 0) {
      throw new Error("Quotation has no items");
    }

    const orderNumber = generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO sales_orders
       (
         order_number,
         quotation_id,
         customer_id,
         order_date,
         total_amount,
         status
       )
       VALUES
       ($1, $2, $3, CURRENT_DATE, $4, 'PENDING')
       RETURNING *`,
      [
        orderNumber,
        quotation.id,
        quotation.customer_id,
        quotation.grand_total,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of quotationItems.rows) {
      await client.query(
        `INSERT INTO sales_order_items
         (
           sales_order_id,
           product_id,
           quantity,
           unit_price,
           line_amount
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.line_amount,
        ]
      );
    }

    await client.query("COMMIT");

    return getSalesOrderById(order.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/*
 * Confirm Sales Order and reserve inventory.
 *
 * FOR UPDATE locks the inventory rows inside the transaction,
 * preventing two simultaneous confirmations from both reserving
 * the same stock.
 */
async function confirmSalesOrder(orderId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT
         id,
         order_number,
         status
       FROM sales_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("Sales Order not found");
    }

    const order = orderResult.rows[0];

    if (order.status !== "PENDING") {
      throw new Error(
        `Only PENDING Sales Orders can be confirmed. Current status: ${order.status}`
      );
    }

    /*
     * Aggregate by product so that even if the same product somehow
     * appears in multiple SO lines, reservation is done correctly.
     */
    const itemsResult = await client.query(
      `SELECT
         soi.product_id,
         p.product_code,
         p.product_name,
         SUM(soi.quantity)::INT AS required_quantity
       FROM sales_order_items soi
       JOIN products p ON p.id = soi.product_id
       WHERE soi.sales_order_id = $1
       GROUP BY
         soi.product_id,
         p.product_code,
         p.product_name
       ORDER BY soi.product_id`,
      [orderId]
    );

    if (itemsResult.rows.length === 0) {
      throw new Error("Sales Order has no items");
    }

    /*
     * Lock inventory rows in deterministic product_id order.
     * This is important for concurrent transactions.
     */
    const productIds = itemsResult.rows.map(
      (item) => item.product_id
    );

    const inventoryResult = await client.query(
      `SELECT
         i.product_id,
         i.physical_quantity,
         i.reserved_quantity,
         (i.physical_quantity - i.reserved_quantity)
           AS available_quantity
       FROM inventory i
       WHERE i.product_id = ANY($1::uuid[])
       ORDER BY i.product_id
       FOR UPDATE`,
      [productIds]
    );

    if (inventoryResult.rows.length !== productIds.length) {
      throw new Error(
        "Inventory record missing for one or more ordered products"
      );
    }

    const inventoryMap = new Map(
      inventoryResult.rows.map((row) => [
        row.product_id,
        row,
      ])
    );

    // Validate ALL products before updating ANY product.
    for (const item of itemsResult.rows) {
      const inventory = inventoryMap.get(item.product_id);

      const available = Number(
        inventory.available_quantity
      );

      const required = Number(item.required_quantity);

      if (required > available) {
        throw new Error(
          `Insufficient stock for ${item.product_name}. Available: ${available}, Required: ${required}`
        );
      }
    }

    // All stock checks passed — perform reservations.
    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE inventory
         SET reserved_quantity =
               reserved_quantity + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2`,
        [
          item.required_quantity,
          item.product_id,
        ]
      );
    }

    await client.query(
      `UPDATE sales_orders
       SET status = 'CONFIRMED',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [orderId]
    );

    // Sale successfully won once the order is confirmed.
    await client.query(
      `UPDATE enquiries e
       SET status = 'WON'
       FROM sales_orders so
       JOIN quotations q ON q.id = so.quotation_id
       WHERE so.id = $1
         AND e.id = q.enquiry_id`,
      [orderId]
    );

    await client.query("COMMIT");

    return getSalesOrderById(orderId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getSalesOrders() {
  const result = await pool.query(`
    SELECT
      so.id,
      so.order_number,
      so.quotation_id,
      q.quotation_number,
      so.customer_id,
      c.company_name,
      so.order_date,
      so.total_amount,
      so.status,
      so.created_at,
      so.updated_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', soi.id,
              'productId', soi.product_id,
              'productCode', p.product_code,
              'productName', p.product_name,
              'quantity', soi.quantity,
              'unitPrice', soi.unit_price,
              'lineAmount', soi.line_amount
            )
            ORDER BY p.product_name
          )
          FROM sales_order_items soi
          JOIN products p ON p.id = soi.product_id
          WHERE soi.sales_order_id = so.id
        ),
        '[]'::json
      ) AS items

    FROM sales_orders so
    JOIN quotations q ON q.id = so.quotation_id
    JOIN customers c ON c.id = so.customer_id
    ORDER BY so.created_at DESC
  `);

  return result.rows;
}

async function getSalesOrderById(orderId) {
  const result = await pool.query(
    `
    SELECT
      so.id,
      so.order_number,
      so.quotation_id,
      q.quotation_number,
      q.enquiry_id,
      e.enquiry_number,
      so.customer_id,
      c.company_name,
      so.order_date,
      so.total_amount,
      so.status,
      so.created_at,
      so.updated_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', soi.id,
              'productId', soi.product_id,
              'productCode', p.product_code,
              'productName', p.product_name,
              'quantity', soi.quantity,
              'unitPrice', soi.unit_price,
              'lineAmount', soi.line_amount
            )
            ORDER BY p.product_name
          )
          FROM sales_order_items soi
          JOIN products p ON p.id = soi.product_id
          WHERE soi.sales_order_id = so.id
        ),
        '[]'::json
      ) AS items

    FROM sales_orders so
    JOIN quotations q ON q.id = so.quotation_id
    JOIN enquiries e ON e.id = q.enquiry_id
    JOIN customers c ON c.id = so.customer_id
    WHERE so.id = $1
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

module.exports = {
  convertQuotationToSalesOrder,
  confirmSalesOrder,
  getSalesOrders,
  getSalesOrderById,
};