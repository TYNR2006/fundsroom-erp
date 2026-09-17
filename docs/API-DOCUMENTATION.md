# FundsRoom ERP — API Documentation

## 1. API Overview

FundsRoom ERP exposes a REST API for the complete business workflow:

**Customer → Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

Base URL during local development:

```text
http://localhost:5000/api
```

All protected endpoints use JWT Bearer authentication.

```http
Authorization: Bearer <JWT_TOKEN>
```

### Role model

| Role | Access |
|---|---|
| `ADMIN` | View all records, manage inventory, confirm Sales Orders, process dispatch |
| `SALES_USER` | Create customers/enquiries, create quotations, convert accepted quotations, view inventory |

Backend authorization is authoritative. Frontend visibility is only a usability layer.

---

## 2. Standard Response Pattern

Successful responses generally follow:

```json
{
  "success": true,
  "data": {}
}
```

Validation or business-rule failures follow the same predictable structure:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

HTTP status codes are used to distinguish validation, authorization, not-found, conflict, and server errors.

---

# 3. Authentication

## POST `/api/auth/login`

Authenticate a user and receive a JWT.

### Request

```json
{
  "email": "admin@fundsroom.com",
  "password": "Admin@123"
}
```

### Success

```json
{
  "success": true,
  "data": {
    "token": "<JWT_TOKEN>",
    "user": {
      "id": "<UUID>",
      "email": "admin@fundsroom.com",
      "role": "ADMIN"
    }
  }
}
```

The frontend stores the token for the active session and sends it as a Bearer token on subsequent protected requests.

---

# 4. Customers

## POST `/api/customers`

**Auth:** Required  
**Roles:** `ADMIN`, `SALES_USER`

Creates a customer.

### Request

```json
{
  "companyName": "Bharat Industrial Solutions",
  "contactPerson": "Ravi Kumar",
  "mobile": "9876543210",
  "email": "ravi@example.com",
  "city": "Bengaluru"
}
```

## GET `/api/customers`

**Auth:** Required  
**Roles:** `ADMIN`, `SALES_USER`

Returns customers available to the authenticated user.

## GET `/api/customers/:id`

**Auth:** Required  
**Roles:** `ADMIN`, `SALES_USER`

Returns one customer by UUID.

---

# 5. Customer Enquiries

## POST `/api/enquiries`

**Auth:** Required  
**Roles:** `ADMIN`, `SALES_USER`

Creates an enquiry with one or more products.

### Request

```json
{
  "customerId": "<CUSTOMER_UUID>",
  "requiredDate": "2026-09-30",
  "products": [
    {
      "productId": "<PRODUCT_UUID>",
      "quantity": 10
    },
    {
      "productId": "<PRODUCT_UUID_2>",
      "quantity": 5
    }
  ],
  "notes": "Required for September procurement cycle."
}
```

### Business rules

- Customer must exist.
- Every referenced product must exist.
- Quantity must be positive.
- Multiple products are supported per enquiry.
- New enquiries start in `NEW` status.

## GET `/api/enquiries`

**Auth:** Required

Returns enquiries.

## GET `/api/enquiries/:id`

**Auth:** Required

Returns an enquiry with its items and linked customer/product information.

## PATCH `/api/enquiries/:id/status`

**Auth:** Required

Updates enquiry status.

Supported business flow:

```text
NEW → QUOTED → WON / LOST
```

Quotation creation moves an enquiry into the quoted stage. A successful Sales Order conversion moves the associated enquiry to `WON`.

---

# 6. Products & Inventory

## GET `/api/products`

**Auth:** Required

Returns the product catalogue.

## GET `/api/products/inventory`

**Auth:** Required

Returns products together with:

```text
Physical Quantity
Reserved Quantity
Available Quantity
```

Available quantity is derived by the backend:

```text
Available = Physical - Reserved
```

It is not treated as an independently editable field.

## GET `/api/products/inventory/:productId`

**Auth:** Required

Returns inventory for a specific product.

## PATCH `/api/products/inventory/:productId`

**Auth:** Required  
**Role:** `ADMIN`

Updates inventory quantities.

### Important rules

- Quantities cannot become negative.
- Reserved quantity cannot exceed physical quantity.
- Backend validates inventory updates.
- Inventory calculations are performed server-side.

---

# 7. Quotations

## POST `/api/quotations`

**Auth:** Required  
**Roles:** `ADMIN`, `SALES_USER`

Creates a quotation for an enquiry.

### Request

```json
{
  "enquiryId": "<ENQUIRY_UUID>",
  "validUntil": "2026-10-10",
  "items": [
    {
      "productId": "<PRODUCT_UUID>",
      "quantity": 10,
      "unitPrice": 18500,
      "discountPercent": 5,
      "gstPercent": 18
    }
  ]
}
```

### Server-side calculation

The backend calculates the total rather than trusting a React-supplied grand total.

For each line:

```text
Line Gross = Quantity × Unit Price
Line Discount = Line Gross × Discount %
Taxable Amount = Line Gross - Discount
GST = Taxable Amount × GST %
Line Amount = Taxable Amount + GST
```

The quotation total is derived from the submitted line items and percentages.

This prevents the frontend from becoming the authority for money calculations.

## GET `/api/quotations`

**Auth:** Required

Returns quotations.

## GET `/api/quotations/:id`

**Auth:** Required

Returns a quotation with customer, enquiry, and line-item information.

## PATCH `/api/quotations/:id/status`

**Auth:** Required

Updates quotation status.

Supported lifecycle:

```text
DRAFT → SENT → ACCEPTED
             ↘ REJECTED
```

### Conversion restriction

Only an `ACCEPTED` quotation can be converted into a Sales Order.

---

# 8. Sales Orders

## POST `/api/sales-orders/from-quotation/:quotationId`

**Auth:** Required  
**Roles:** `ADMIN`, `SALES_USER`

Converts an accepted quotation into a Sales Order.

### Preconditions

- Quotation exists.
- Quotation status is `ACCEPTED`.
- Quotation must not already have a Sales Order.
- Quotation line items are copied into Sales Order items.

### Duplicate protection

The database uses a unique relationship between quotation and Sales Order so one quotation cannot accidentally create multiple Sales Orders.

Business invariant:

```text
One accepted quotation → at most one Sales Order
```

## GET `/api/sales-orders`

**Auth:** Required

Returns Sales Orders.

## GET `/api/sales-orders/:id`

**Auth:** Required

Returns a Sales Order and its line items.

## POST `/api/sales-orders/:id/confirm`

**Auth:** Required  
**Role:** `ADMIN`

Confirms the Sales Order and reserves inventory.

### Reservation logic

The backend performs the following inside a database transaction:

1. Lock the Sales Order.
2. Lock required inventory rows.
3. Recalculate available stock.
4. Verify every requested quantity.
5. Update `reserved_quantity`.
6. Mark the Sales Order `CONFIRMED`.
7. Commit all changes together.

This prevents overselling when concurrent requests target the same inventory.

Example:

```text
Physical = 100
Reserved = 30
Available = 70
```

An order for `80` fails.

An order for `60` succeeds:

```text
Physical = 100
Reserved = 90
Available = 10
```

The physical quantity does not change during reservation.

---

# 9. Dispatch

## POST `/api/dispatches/sales-orders/:salesOrderId/dispatch`

**Auth:** Required  
**Role:** `ADMIN`

Dispatches a confirmed Sales Order.

### Request

```json
{
  "vehicleNumber": "KA01AB1234",
  "driverName": "Suresh Kumar",
  "items": [
    {
      "productId": "<PRODUCT_UUID>",
      "quantity": 10
    }
  ]
}
```

### Preconditions

- Sales Order must exist.
- Sales Order must be `CONFIRMED`.
- Sales Order must not be cancelled.
- Dispatch quantity cannot exceed reserved quantity.
- Duplicate dispatch of the same quantity is prevented.

### Atomic inventory update

On successful dispatch:

```text
Physical Quantity -= Dispatched Quantity
Reserved Quantity -= Dispatched Quantity
```

Example:

```text
Before:
Physical = 100
Reserved = 10
Available = 90

Dispatch = 10

After:
Physical = 90
Reserved = 0
Available = 90
```

The dispatch record and inventory changes are committed in the same transaction.

## GET `/api/dispatches`

**Auth:** Required

Returns dispatch records.

## GET `/api/dispatches/:id`

**Auth:** Required

Returns a dispatch and its item details.

---

# 10. Authorization Matrix

| Endpoint / Operation | ADMIN | SALES_USER |
|---|:---:|:---:|
| Login | ✓ | ✓ |
| Create customer | ✓ | ✓ |
| Create enquiry | ✓ | ✓ |
| Create quotation | ✓ | ✓ |
| Accept / reject quotation | ✓ | ✓ |
| Convert accepted quotation | ✓ | ✓ |
| View inventory | ✓ | ✓ |
| Update inventory | ✓ | — |
| Confirm Sales Order | ✓ | — |
| Dispatch Sales Order | ✓ | — |

Authorization is enforced on the backend using JWT authentication and role middleware.

---

# 11. Important Error Cases

The API explicitly rejects invalid business operations including:

```text
Invalid credentials
Missing/invalid JWT
Insufficient role permissions
Unknown customer/product
Invalid quantity
Invalid inventory update
Quotation not eligible for conversion
Duplicate quotation → Sales Order conversion
Insufficient available inventory
Sales Order not eligible for dispatch
Dispatch quantity beyond reservation
Duplicate dispatch
```

---

# 12. Transaction Boundaries

Database transactions are used for operations where multiple writes must succeed or fail together.

### Enquiry creation

Creates the enquiry and enquiry items atomically.

### Quotation creation

Creates quotation header and quotation items atomically and updates enquiry workflow state.

### Sales Order confirmation

Reservation is atomic across:

```text
Sales Order
+
Inventory rows
```

### Dispatch

Dispatch header/items and inventory decrements are atomic.

The goal is to prevent partially completed business operations.

---

# 13. Example Complete Workflow

```text
POST /customers
        ↓
POST /enquiries
        ↓
POST /quotations
        ↓
PATCH /quotations/:id/status
        ↓
POST /sales-orders/from-quotation/:quotationId
        ↓
POST /sales-orders/:id/confirm
        ↓
POST /dispatches/sales-orders/:salesOrderId/dispatch
```

This sequence represents the core business workflow implemented by the application.

---

# 14. Testing Coverage

The mandatory case-study scenarios are covered by automated tests:

```text
✓ Quotation total calculated correctly
✓ Draft/Rejected quotation cannot create Sales Order
✓ Same quotation cannot generate duplicate Sales Orders
✓ Cannot reserve more than available inventory
✓ Unauthorized SALES_USER cannot confirm Sales Order
```

The test suite is run with:

```bash
npm test
```
