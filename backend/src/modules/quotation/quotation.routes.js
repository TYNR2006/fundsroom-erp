const express = require("express");
const quotationController = require("./quotation.controller");
const authenticateToken = require("../../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

router.post("/", quotationController.createQuotation);
router.get("/", quotationController.getQuotations);
router.get("/:id", quotationController.getQuotationById);
router.patch(
  "/:id/status",
  quotationController.updateQuotationStatus
);

module.exports = router;