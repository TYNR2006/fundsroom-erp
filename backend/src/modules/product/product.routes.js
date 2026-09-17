const express = require("express");
const productController = require("./product.controller");
const authenticateToken = require("../../middleware/auth");
const authorizeRoles = require("../../middleware/role");

const router = express.Router();

router.use(authenticateToken);

router.get("/", productController.getProducts);

router.get("/inventory", productController.getInventory);

router.get(
  "/inventory/:productId",
  productController.getInventoryByProductId
);

router.patch(
  "/inventory/:productId",
  authorizeRoles("ADMIN"),
  productController.updateInventory
);

module.exports = router;