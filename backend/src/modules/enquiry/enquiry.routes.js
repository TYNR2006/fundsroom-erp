const express = require("express");
const enquiryController = require("./enquiry.controller");
const authenticateToken = require("../../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

router.post("/", enquiryController.createEnquiry);
router.get("/", enquiryController.getEnquiries);
router.get("/:id", enquiryController.getEnquiryById);
router.patch("/:id/status", enquiryController.updateEnquiryStatus);

module.exports = router;