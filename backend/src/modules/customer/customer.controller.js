const customerService = require("./customer.service");

async function createCustomer(req, res) {
  try {
    const {
      companyName,
      contactPerson,
      mobile,
      email,
      city,
    } = req.body;

    if (
      typeof companyName !== "string" ||
      typeof contactPerson !== "string" ||
      typeof mobile !== "string" ||
      typeof email !== "string" ||
      typeof city !== "string" ||
      !companyName.trim() ||
      !contactPerson.trim() ||
      !mobile.trim() ||
      !email.trim() ||
      !city.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "companyName, contactPerson, mobile, email and city are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    const customer = await customerService.createCustomer(req.body);

    return res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Create customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create customer",
    });
  }
}

async function getCustomers(req, res) {
  try {
    const customers = await customerService.getCustomers();

    return res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
}

async function getCustomerById(req, res) {
  try {
    const customer = await customerService.getCustomerById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Get customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
    });
  }
}

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
};