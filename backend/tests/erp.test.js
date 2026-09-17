const request = require("supertest");
const { app, server } = require("../server");
const pool = require("../src/config/db");

jest.setTimeout(30000);

let adminToken;
let salesToken;
let productIds = [];
const testCustomerIds = [];

async function login(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

async function createCustomer() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const response = await request(app)
    .post("/api/customers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      companyName: `Test Industrial ${suffix}`,
      contactPerson: "Test User",
      mobile: "9876543210",
      email: `test-${suffix}@example.com`,
      city: "Bengaluru",
    });

  expect(response.status).toBe(201);

  const customerId = response.body.data.id;
  testCustomerIds.push(customerId);

  return customerId;
}

async function createEnquiry({
  customerId,
  quantity = 2,
  productId = productIds[0],
}) {
  const response = await request(app)
    .post("/api/enquiries")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customerId,
      requiredDate: "2026-10-15",
      notes: "Automated test enquiry",
      items: [
        {
          productId,
          quantity,
        },
      ],
    });

  expect(response.status).toBe(201);

  return response.body.data;
}

async function createQuotation({
  quantity = 2,
  unitPrice = 1000,
  discountPercent = 10,
  gstPercent = 18,
} = {}) {
  const customerId = await createCustomer();

  const enquiry = await createEnquiry({
    customerId,
    quantity,
  });

  const response = await request(app)
    .post("/api/quotations")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      enquiryId: enquiry.id,
      validUntil: "2026-10-30",
      items: [
        {
          productId: productIds[0],
          quantity,
          unitPrice,
          discountPercent,
          gstPercent,
        },
      ],
    });

  expect(response.status).toBe(201);

  return response.body.data;
}

async function acceptQuotation(quotationId) {
  let response = await request(app)
    .patch(`/api/quotations/${quotationId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "SENT" });

  expect(response.status).toBe(200);

  response = await request(app)
    .patch(`/api/quotations/${quotationId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "ACCEPTED" });

  expect(response.status).toBe(200);
}

async function createPendingSalesOrder(quantity = 2) {
  const quotation = await createQuotation({
    quantity,
    unitPrice: 1000,
    discountPercent: 0,
    gstPercent: 18,
  });

  await acceptQuotation(quotation.id);

  const response = await request(app)
    .post(
      `/api/sales-orders/from-quotation/${quotation.id}`
    )
    .set("Authorization", `Bearer ${adminToken}`);

  expect(response.status).toBe(201);

  return response.body.data;
}

beforeAll(async () => {
  adminToken = await login(
    "admin@fundsroom.com",
    "Admin@123"
  );

  salesToken = await login(
    "sales@fundsroom.com",
    "Sales@123"
  );

  const result = await pool.query(`
    SELECT id
    FROM products
    ORDER BY product_code
    LIMIT 2
  `);

  productIds = result.rows.map((row) => row.id);

  expect(productIds.length).toBeGreaterThanOrEqual(2);
});

afterAll(async () => {
  if (testCustomerIds.length > 0) {
    await pool.query(
      `
      DELETE FROM sales_orders
      WHERE customer_id = ANY($1::uuid[])
      `,
      [testCustomerIds]
    );

    await pool.query(
      `
      DELETE FROM quotations
      WHERE customer_id = ANY($1::uuid[])
      `,
      [testCustomerIds]
    );

    await pool.query(
      `
      DELETE FROM enquiries
      WHERE customer_id = ANY($1::uuid[])
      `,
      [testCustomerIds]
    );

    await pool.query(
      `
      DELETE FROM customers
      WHERE id = ANY($1::uuid[])
      `,
      [testCustomerIds]
    );
  }

  if (server && server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }

  await pool.end();
});

/* =========================================================
   TEST 1
   Quotation total calculated correctly
   ========================================================= */

test("calculates quotation total correctly", async () => {
  const quotation = await createQuotation({
    quantity: 2,
    unitPrice: 1000,
    discountPercent: 10,
    gstPercent: 18,
  });

  expect(quotation.subtotal).toBe("2000.00");
  expect(quotation.discount_total).toBe("200.00");
  expect(quotation.gst_total).toBe("324.00");
  expect(quotation.grand_total).toBe("2124.00");

  expect(quotation.items[0].lineAmount).toBe(2124);
});

/* =========================================================
   TEST 2
   Draft / Rejected quotation cannot create Sales Order
   ========================================================= */

test("draft and rejected quotation cannot create Sales Order", async () => {
  const draftQuotation = await createQuotation();

  let response = await request(app)
    .post(
      `/api/sales-orders/from-quotation/${draftQuotation.id}`
    )
    .set("Authorization", `Bearer ${adminToken}`);

  expect(response.status).toBe(400);

  // Move to SENT
  response = await request(app)
    .patch(`/api/quotations/${draftQuotation.id}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "SENT" });

  expect(response.status).toBe(200);

  // Reject
  response = await request(app)
    .patch(`/api/quotations/${draftQuotation.id}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "REJECTED" });

  expect(response.status).toBe(200);

  // Rejected must not create Sales Order
  response = await request(app)
    .post(
      `/api/sales-orders/from-quotation/${draftQuotation.id}`
    )
    .set("Authorization", `Bearer ${adminToken}`);

  expect(response.status).toBe(400);
});

/* =========================================================
   TEST 3
   Same quotation cannot generate duplicate Sales Orders
   ========================================================= */

test("same quotation cannot generate duplicate Sales Orders", async () => {
  const quotation = await createQuotation();

  await acceptQuotation(quotation.id);

  const first = await request(app)
    .post(
      `/api/sales-orders/from-quotation/${quotation.id}`
    )
    .set("Authorization", `Bearer ${adminToken}`);

  expect(first.status).toBe(201);

  const second = await request(app)
    .post(
      `/api/sales-orders/from-quotation/${quotation.id}`
    )
    .set("Authorization", `Bearer ${adminToken}`);

  expect(second.status).toBe(400);
  expect(second.body.message).toMatch(
    /Sales Order already exists/
  );
});

/* =========================================================
   TEST 4
   Cannot reserve more than available inventory
   ========================================================= */

test("cannot reserve more than available inventory", async () => {
  const order = await createPendingSalesOrder(1000);

  const response = await request(app)
    .post(`/api/sales-orders/${order.id}/confirm`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(response.status).toBe(409);
  expect(response.body.message).toMatch(
    /Insufficient stock/
  );
});

/* =========================================================
   TEST 5
   SALES_USER cannot perform ADMIN-only operation
   ========================================================= */

test("SALES_USER cannot confirm Sales Order", async () => {
  const order = await createPendingSalesOrder(2);

  const response = await request(app)
    .post(`/api/sales-orders/${order.id}/confirm`)
    .set("Authorization", `Bearer ${salesToken}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toMatch(
    /not authorized/i
  );
});