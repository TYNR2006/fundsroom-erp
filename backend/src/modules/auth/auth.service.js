const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");

async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, email, password_hash, full_name, role
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];

  const passwordValid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordValid) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
  };
}

module.exports = {
  login,
};