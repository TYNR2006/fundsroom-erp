const productService = require("./product.service");

async function getProducts(req, res) {
  try {
    const products = await productService.getProducts();

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
}

async function getInventory(req, res) {
  try {
    const inventory = await productService.getInventory();

    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Get inventory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
}

async function getInventoryByProductId(req, res) {
  try {
    const inventory = await productService.getInventoryByProductId(
      req.params.productId
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Get inventory item error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
}

async function updateInventory(req, res) {
  try {
    const physicalQuantity = req.body.physicalQuantity;

    if (
      !Number.isInteger(physicalQuantity) ||
      physicalQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "physicalQuantity must be a non-negative integer",
      });
    }

    const inventory = await productService.updatePhysicalQuantity(
      req.params.productId,
      physicalQuantity
    );

    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error("Update inventory error:", error);

    if (
      error.message === "Inventory record not found" ||
      error.message.startsWith("Physical quantity cannot") ||
      error.message.startsWith("Physical quantity must")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update inventory",
    });
  }
}

module.exports = {
  getProducts,
  getInventory,
  getInventoryByProductId,
  updateInventory,
};