const crypto = require("crypto");
const pool = require("../../config/db");

function generateQuotationNumber() {
  return `QUO-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function calculateLine(item) {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const discountPercent = Number(item.discountPercent || 0);
  const gstPercent = Number(item.gstPercent ?? 18);

  const grossAmount = quantity * unitPrice;
  const discountAmount = grossAmount * (discountPercent / 100);
  const taxableAmount = grossAmount - discountAmount;
  const gstAmount = taxableAmount * (gstPercent / 100);
  const lineAmount = taxableAmount + gstAmount;

  return {
    grossAmount,
    discountAmount,
    gstAmount,
    lineAmount,
  };
}

async function createQuotation({
  enquiryId,
  validUntil,
  items,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("At least one quotation item is required");
    }

    const enquiryResult = await client.query(
      `SELECT id, customer_id, status
       FROM enquiries
       WHERE id = $1
       FOR UPDATE`,
      [enquiryId]
    );

    if (enquiryResult.rows.length === 0) {
      throw new Error("Enquiry not found");
    }

    const enquiry = enquiryResult.rows[0];

    if (enquiry.status === "LOST") {
      throw new Error("Cannot create quotation for a lost enquiry");
    }

    let subtotal = 0;
    let discountTotal = 0;
    let gstTotal = 0;
    let grandTotal = 0;

    const calculatedItems = [];

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new Error(
          "Each quotation item must have a valid productId and positive integer quantity"
        );
      }

      const productResult = await client.query(
        `SELECT id, base_price
         FROM products
         WHERE id = $1`,
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const product = productResult.rows[0];

      const unitPrice =
        item.unitPrice === undefined
          ? Number(product.base_price)
          : Number(item.unitPrice);

      const discountPercent = Number(item.discountPercent || 0);
      const gstPercent = Number(item.gstPercent ?? 18);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Unit price must be a non-negative number");
      }

      if (
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        throw new Error("Discount must be between 0 and 100");
      }

      if (!Number.isFinite(gstPercent) || gstPercent < 0) {
        throw new Error("GST cannot be negative");
      }

      const calculated = calculateLine({
        quantity: item.quantity,
        unitPrice,
        discountPercent,
        gstPercent,
      });

      subtotal += calculated.grossAmount;
      discountTotal += calculated.discountAmount;
      gstTotal += calculated.gstAmount;
      grandTotal += calculated.lineAmount;

      calculatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discountPercent,
        gstPercent,
        lineAmount: calculated.lineAmount,
      });
    }

    const quotationNumber = generateQuotationNumber();

    const quotationResult = await client.query(
      `INSERT INTO quotations
       (
         quotation_number,
         enquiry_id,
         customer_id,
         valid_until,
         status,
         subtotal,
         discount_total,
         gst_total,
         grand_total
       )
       VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8)
       RETURNING *`,
      [
        quotationNumber,
        enquiryId,
        enquiry.customer_id,
        validUntil,
        subtotal.toFixed(2),
        discountTotal.toFixed(2),
        gstTotal.toFixed(2),
        grandTotal.toFixed(2),
      ]
    );

    const quotation = quotationResult.rows[0];

    for (const item of calculatedItems) {
      await client.query(
        `INSERT INTO quotation_items
         (
           quotation_id,
           product_id,
           quantity,
           unit_price,
           discount_percent,
           gst_percent,
           line_amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          quotation.id,
          item.productId,
          item.quantity,
          item.unitPrice.toFixed(2),
          item.discountPercent.toFixed(2),
          item.gstPercent.toFixed(2),
          item.lineAmount.toFixed(2),
        ]
      );
    }

    // Once a quotation is created, the enquiry has reached QUOTED.
    if (enquiry.status === "NEW") {
      await client.query(
        `UPDATE enquiries
         SET status = 'QUOTED'
         WHERE id = $1`,
        [enquiryId]
      );
    }

    await client.query("COMMIT");

    return getQuotationById(quotation.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getQuotations() {
  const result = await pool.query(`
    SELECT
      q.id,
      q.quotation_number,
      q.enquiry_id,
      e.enquiry_number,
      q.customer_id,
      c.company_name,
      q.valid_until,
      q.status,
      q.subtotal,
      q.discount_total,
      q.gst_total,
      q.grand_total,
      q.created_at,
      q.updated_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', qi.id,
              'productId', qi.product_id,
              'productName', p.product_name,
              'productCode', p.product_code,
              'quantity', qi.quantity,
              'unitPrice', qi.unit_price,
              'discountPercent', qi.discount_percent,
              'gstPercent', qi.gst_percent,
              'lineAmount', qi.line_amount
            )
            ORDER BY p.product_name
          )
          FROM quotation_items qi
          JOIN products p ON p.id = qi.product_id
          WHERE qi.quotation_id = q.id
        ),
        '[]'::json
      ) AS items

    FROM quotations q
    JOIN enquiries e ON e.id = q.enquiry_id
    JOIN customers c ON c.id = q.customer_id
    ORDER BY q.created_at DESC
  `);

  return result.rows;
}

async function getQuotationById(id) {
  const result = await pool.query(
    `
    SELECT
      q.id,
      q.quotation_number,
      q.enquiry_id,
      e.enquiry_number,
      q.customer_id,
      c.company_name,
      q.valid_until,
      q.status,
      q.subtotal,
      q.discount_total,
      q.gst_total,
      q.grand_total,
      q.created_at,
      q.updated_at,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', qi.id,
              'productId', qi.product_id,
              'productName', p.product_name,
              'productCode', p.product_code,
              'quantity', qi.quantity,
              'unitPrice', qi.unit_price,
              'discountPercent', qi.discount_percent,
              'gstPercent', qi.gst_percent,
              'lineAmount', qi.line_amount
            )
            ORDER BY p.product_name
          )
          FROM quotation_items qi
          JOIN products p ON p.id = qi.product_id
          WHERE qi.quotation_id = q.id
        ),
        '[]'::json
      ) AS items

    FROM quotations q
    JOIN enquiries e ON e.id = q.enquiry_id
    JOIN customers c ON c.id = q.customer_id
    WHERE q.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updateQuotationStatus(id, newStatus) {
  const allowedTransitions = {
    DRAFT: ["SENT"],
    SENT: ["ACCEPTED", "REJECTED"],
    ACCEPTED: [],
    REJECTED: [],
  };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, status
       FROM quotations
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error("Quotation not found");
    }

    const currentStatus = result.rows[0].status;

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new Error(
        `Invalid quotation status transition: ${currentStatus} -> ${newStatus}`
      );
    }

    await client.query(
      `UPDATE quotations
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStatus, id]
    );

    await client.query("COMMIT");

    return getQuotationById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
};