const express = require("express");
const customerController = require("./customer.controller");
const authenticateToken = require("../../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

router.post("/", customerController.createCustomer);
router.get("/", customerController.getCustomers);
router.get("/:id", customerController.getCustomerById);

module.exports = router;