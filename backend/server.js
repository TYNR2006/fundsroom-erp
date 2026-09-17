const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Routes
const authRoutes = require("./src/modules/auth/auth.routes");
const customerRoutes = require("./src/modules/customer/customer.routes");
const enquiryRoutes = require("./src/modules/enquiry/enquiry.routes");
const productRoutes = require("./src/modules/product/product.routes");
const quotationRoutes = require("./src/modules/quotation/quotation.routes");
const salesOrderRoutes = require("./src/modules/salesOrder/salesOrder.routes");
const dispatchRoutes = require("./src/modules/dispatch/dispatch.routes");
const app = express();

/* =========================================================
   SECURITY
   ========================================================= */

// Secure HTTP headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

/* =========================================================
   BODY PARSING
   ========================================================= */

app.use(
  express.json({
    limit: "1mb",
  })
);

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "FundsRoom ERP API is running",
  });
});

/* =========================================================
   API ROUTES
   ========================================================= */

// Authentication
app.use("/api/auth", authRoutes);

// Customers
app.use("/api/customers", customerRoutes);

// Enquiries
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use("/api/dispatches", dispatchRoutes);
/* =========================================================
   404 HANDLER
   ========================================================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

/* =========================================================
   SERVER
   ========================================================= */

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`FundsRoom ERP API running on port ${PORT}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received. Shutting down server...`);

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = {
  app,
  server,
};