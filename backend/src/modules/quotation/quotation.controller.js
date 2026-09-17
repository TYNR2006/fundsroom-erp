const quotationService = require("./quotation.service");

async function createQuotation(req, res) {
  try {
    const {
      enquiryId,
      validUntil,
      items,
    } = req.body;

    if (
      typeof enquiryId !== "string" ||
      !enquiryId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "enquiryId is required",
      });
    }

    if (
      typeof validUntil !== "string" ||
      !validUntil.trim() ||
      Number.isNaN(Date.parse(validUntil))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid validUntil date is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one quotation item is required",
      });
    }

    const quotation =
      await quotationService.createQuotation(req.body);

    return res.status(201).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Create quotation error:", error);

    if (
      error.message === "Enquiry not found" ||
      error.message.includes("quotation item") ||
      error.message.includes("Product not found") ||
      error.message.includes("lost enquiry") ||
      error.message.includes("Unit price") ||
      error.message.includes("Discount") ||
      error.message.includes("GST")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create quotation",
    });
  }
}

async function getQuotations(req, res) {
  try {
    const quotations = await quotationService.getQuotations();

    return res.status(200).json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    console.error("Get quotations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch quotations",
    });
  }
}

async function getQuotationById(req, res) {
  try {
    const quotation =
      await quotationService.getQuotationById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Get quotation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
    });
  }
}

async function updateQuotationStatus(req, res) {
  try {
    const allowedStatuses = [
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "REJECTED",
    ];

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quotation status",
      });
    }

    const quotation =
      await quotationService.updateQuotationStatus(
        req.params.id,
        status
      );

    return res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Update quotation status error:", error);

    if (
      error.message === "Quotation not found" ||
      error.message.startsWith(
        "Invalid quotation status transition"
      )
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update quotation status",
    });
  }
}

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
};