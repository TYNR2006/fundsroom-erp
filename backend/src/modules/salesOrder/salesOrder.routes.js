const express = require("express");
const salesOrderController = require("./salesOrder.controller");
const authenticateToken = require("../../middleware/auth");
const authorizeRoles = require("../../middleware/role");

const router = express.Router();

router.use(authenticateToken);

// SALES_USER and ADMIN can convert an accepted quotation.
router.post(
  "/from-quotation/:quotationId",
  salesOrderController.convertQuotation
);

// ADMIN only can confirm and reserve inventory.
router.post(
  "/:id/confirm",
  authorizeRoles("ADMIN"),
  salesOrderController.confirmSalesOrder
);

router.get(
  "/",
  salesOrderController.getSalesOrders
);

router.get(
  "/:id",
  salesOrderController.getSalesOrderById
);

module.exports = router;