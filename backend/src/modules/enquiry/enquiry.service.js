const crypto = require("crypto");
const pool = require("../../config/db");

function generateEnquiryNumber() {
  return `ENQ-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function createEnquiry(data) {
  const {
    customerId,
    requiredDate,
    items,
    notes = null,
  } = data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify customer
    const customerResult = await client.query(
      `SELECT id
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      throw new Error("Customer not found");
    }

    // Verify items
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("At least one enquiry item is required");
    }

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new Error(
          "Each item must contain a valid productId and positive integer quantity"
        );
      }

      const productResult = await client.query(
        `SELECT id
         FROM products
         WHERE id = $1`,
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product not found: ${item.productId}`);
      }
    }

    const enquiryNumber = generateEnquiryNumber();

    const enquiryResult = await client.query(
      `INSERT INTO enquiries
        (
          enquiry_number,
          customer_id,
          required_date,
          status,
          notes
        )
       VALUES ($1, $2, $3, 'NEW', $4)
       RETURNING
         id,
         enquiry_number,
         customer_id,
         enquiry_date,
         required_date,
         status,
         notes,
         created_at`,
      [
        enquiryNumber,
        customerId,
        requiredDate,
        notes,
      ]
    );

    const enquiry = enquiryResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO enquiry_items
          (enquiry_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [
          enquiry.id,
          item.productId,
          item.quantity,
        ]
      );
    }

    await client.query("COMMIT");

    return getEnquiryById(enquiry.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getEnquiries() {
  const result = await pool.query(
    `SELECT
       e.id,
       e.enquiry_number,
       e.customer_id,
       c.company_name,
       c.contact_person,
       c.mobile,
       c.email,
       c.city,
       e.enquiry_date,
       e.required_date,
       e.status,
       e.notes,
       e.created_at,

       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', ei.id,
               'productId', ei.product_id,
               'productCode', p.product_code,
               'productName', p.product_name,
               'quantity', ei.quantity,
               'unit', p.unit
             )
             ORDER BY p.product_name
           )
           FROM enquiry_items ei
           JOIN products p ON p.id = ei.product_id
           WHERE ei.enquiry_id = e.id
         ),
         '[]'::json
       ) AS items

     FROM enquiries e
     JOIN customers c ON c.id = e.customer_id
     ORDER BY e.created_at DESC`
  );

  return result.rows;
}

async function getEnquiryById(id) {
  const result = await pool.query(
    `SELECT
       e.id,
       e.enquiry_number,
       e.customer_id,
       c.company_name,
       c.contact_person,
       c.mobile,
       c.email,
       c.city,
       e.enquiry_date,
       e.required_date,
       e.status,
       e.notes,
       e.created_at,

       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', ei.id,
               'productId', ei.product_id,
               'productCode', p.product_code,
               'productName', p.product_name,
               'quantity', ei.quantity,
               'unit', p.unit
             )
             ORDER BY p.product_name
           )
           FROM enquiry_items ei
           JOIN products p ON p.id = ei.product_id
           WHERE ei.enquiry_id = e.id
         ),
         '[]'::json
       ) AS items

     FROM enquiries e
     JOIN customers c ON c.id = e.customer_id
     WHERE e.id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function updateEnquiryStatus(id, newStatus) {
  const allowedTransitions = {
    NEW: ["QUOTED", "LOST"],
    QUOTED: ["WON", "LOST"],
    WON: [],
    LOST: [],
  };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT status
       FROM enquiries
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      throw new Error("Enquiry not found");
    }

    const currentStatus = currentResult.rows[0].status;

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid enquiry status transition: ${currentStatus} -> ${newStatus}`
      );
    }

    await client.query(
      `UPDATE enquiries
       SET status = $1
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query("COMMIT");

    return getEnquiryById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
};