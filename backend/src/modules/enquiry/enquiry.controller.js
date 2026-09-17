const enquiryService = require("./enquiry.service");

async function createEnquiry(req, res) {
  try {
    const {
      customerId,
      requiredDate,
      items,
    } = req.body;

    if (
      typeof customerId !== "string" ||
      !customerId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "customerId is required",
      });
    }

    if (
      typeof requiredDate !== "string" ||
      !requiredDate.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "requiredDate is required",
      });
    }

    if (Number.isNaN(Date.parse(requiredDate))) {
      return res.status(400).json({
        success: false,
        message: "Invalid requiredDate",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one enquiry item is required",
      });
    }

    const enquiry = await enquiryService.createEnquiry(req.body);

    return res.status(201).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("Create enquiry error:", error);

    if (
      error.message === "Customer not found" ||
      error.message.startsWith("Product not found") ||
      error.message.includes("item")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create enquiry",
    });
  }
}

async function getEnquiries(req, res) {
  try {
    const enquiries = await enquiryService.getEnquiries();

    return res.status(200).json({
      success: true,
      data: enquiries,
    });
  } catch (error) {
    console.error("Get enquiries error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch enquiries",
    });
  }
}

async function getEnquiryById(req, res) {
  try {
    const enquiry = await enquiryService.getEnquiryById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("Get enquiry error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch enquiry",
    });
  }
}

async function updateEnquiryStatus(req, res) {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "NEW",
      "QUOTED",
      "WON",
      "LOST",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry status",
      });
    }

    const enquiry = await enquiryService.updateEnquiryStatus(
      req.params.id,
      status
    );

    return res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("Update enquiry status error:", error);

    if (
      error.message === "Enquiry not found" ||
      error.message.startsWith("Invalid enquiry status transition")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update enquiry status",
    });
  }
}

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
};