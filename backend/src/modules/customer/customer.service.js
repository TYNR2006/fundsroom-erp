const pool = require("../../config/db");

async function createCustomer(data) {
  const {
    companyName,
    contactPerson,
    mobile,
    email,
    city,
  } = data;

  const result = await pool.query(
    `INSERT INTO customers
      (company_name, contact_person, mobile, email, city)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       company_name,
       contact_person,
       mobile,
       email,
       city,
       created_at,
       updated_at`,
    [
      companyName.trim(),
      contactPerson.trim(),
      mobile.trim(),
      email.trim().toLowerCase(),
      city.trim(),
    ]
  );

  return result.rows[0];
}

async function getCustomers() {
  const result = await pool.query(
    `SELECT
       id,
       company_name,
       contact_person,
       mobile,
       email,
       city,
       created_at,
       updated_at
     FROM customers
     ORDER BY created_at DESC`
  );

  return result.rows;
}

async function getCustomerById(id) {
  const result = await pool.query(
    `SELECT
       id,
       company_name,
       contact_person,
       mobile,
       email,
       city,
       created_at,
       updated_at
     FROM customers
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
};