const salesOrderService = require("./salesOrder.service");

async function convertQuotation(req, res) {
  try {
    const order =
      await salesOrderService.convertQuotationToSalesOrder(
        req.params.quotationId
      );

    return res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Convert quotation error:", error);

    if (
      error.message === "Quotation not found" ||
      error.message.startsWith("Only ACCEPTED") ||
      error.message.startsWith("Sales Order already exists") ||
      error.message === "Quotation has no items"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to convert quotation",
    });
  }
}

async function confirmSalesOrder(req, res) {
  try {
    const order =
      await salesOrderService.confirmSalesOrder(
        req.params.id
      );

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Confirm Sales Order error:", error);

    if (
      error.message === "Sales Order not found" ||
      error.message === "Sales Order has no items" ||
      error.message.startsWith("Only PENDING") ||
      error.message.startsWith("Insufficient stock") ||
      error.message.startsWith("Inventory record missing")
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to confirm Sales Order",
    });
  }
}

async function getSalesOrders(req, res) {
  try {
    const orders =
      await salesOrderService.getSalesOrders();

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get Sales Orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Sales Orders",
    });
  }
}

async function getSalesOrderById(req, res) {
  try {
    const order =
      await salesOrderService.getSalesOrderById(
        req.params.id
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sales Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get Sales Order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Sales Order",
    });
  }
}

module.exports = {
  convertQuotation,
  confirmSalesOrder,
  getSalesOrders,
  getSalesOrderById,
};