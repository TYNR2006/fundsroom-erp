const express = require("express");
const dispatchController = require("./dispatch.controller");
const authenticateToken = require("../../middleware/auth");
const authorizeRoles = require("../../middleware/role");

const router = express.Router();

router.use(authenticateToken);

// ADMIN only
router.post(
  "/sales-orders/:salesOrderId/dispatch",
  authorizeRoles("ADMIN"),
  dispatchController.dispatchSalesOrder
);

router.get(
  "/",
  dispatchController.getDispatches
);

router.get(
  "/:id",
  dispatchController.getDispatchById
);

module.exports = router;