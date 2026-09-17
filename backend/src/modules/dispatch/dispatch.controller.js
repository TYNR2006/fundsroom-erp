const dispatchService = require("./dispatch.service");

async function dispatchSalesOrder(req, res) {
  try {
    const {
      vehicleNumber,
      driverName,
      dispatchDate,
    } = req.body;

    if (
      typeof vehicleNumber !== "string" ||
      !vehicleNumber.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number is required",
      });
    }

    if (
      typeof driverName !== "string" ||
      !driverName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Driver name is required",
      });
    }

    if (
      dispatchDate !== undefined &&
      (typeof dispatchDate !== "string" ||
        Number.isNaN(Date.parse(dispatchDate)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid dispatchDate",
      });
    }

    const dispatch =
      await dispatchService.dispatchSalesOrder(
        req.params.salesOrderId,
        {
          vehicleNumber,
          driverName,
          dispatchDate,
        }
      );

    return res.status(201).json({
      success: true,
      data: dispatch,
    });
  } catch (error) {
    console.error("Dispatch error:", error);

    if (
      error.message === "Sales Order not found" ||
      error.message === "Sales Order has no items" ||
      error.message.includes("cancelled") ||
      error.message.startsWith("Only CONFIRMED") ||
      error.message.startsWith("Sales Order already dispatched") ||
      error.message.startsWith("Cannot dispatch") ||
      error.message.startsWith("Inventory record missing")
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to dispatch Sales Order",
    });
  }
}

async function getDispatches(req, res) {
  try {
    const dispatches =
      await dispatchService.getDispatches();

    return res.status(200).json({
      success: true,
      data: dispatches,
    });
  } catch (error) {
    console.error("Get dispatches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dispatches",
    });
  }
}

async function getDispatchById(req, res) {
  try {
    const dispatch =
      await dispatchService.getDispatchById(
        req.params.id
      );

    if (!dispatch) {
      return res.status(404).json({
        success: false,
        message: "Dispatch not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: dispatch,
    });
  } catch (error) {
    console.error("Get dispatch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dispatch",
    });
  }
}

module.exports = {
  dispatchSalesOrder,
  getDispatches,
  getDispatchById,
};