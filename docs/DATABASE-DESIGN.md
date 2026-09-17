# FundsRoom ERP — Database Design

## 1. Database Overview

FundsRoom ERP uses PostgreSQL with a normalized relational model for the complete business workflow:

**Customer → Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

The design keeps workflow data in related tables rather than storing the entire process as JSON. Primary keys, foreign keys, unique constraints, check constraints, and transactions are used together to protect data consistency.

## 2. Core Entities

| Entity | Purpose |
|---|---|
| `users` | Application users and their roles |
| `customers` | Customer/company master data |
| `products` | Industrial product catalogue |
| `inventory` | Physical and reserved stock per product |
| `enquiries` | Customer purchase enquiries |
| `enquiry_items` | Products and quantities requested in an enquiry |
| `quotations` | Commercial quotation header and workflow status |
| `quotation_items` | Products, prices, discounts and GST in a quotation |
| `sales_orders` | Orders generated from accepted quotations |
| `sales_order_items` | Products and quantities in a Sales Order |
| `dispatches` | Dispatch transactions against Sales Orders |
| `dispatch_items` | Products and quantities included in a dispatch |

## 3. Relationship Model

```text
customers 1 ──────── N enquiries
                         │
                         └── 1 ──────── N enquiry_items ──────── N:1 products

customers 1 ──────── N quotations
                         │
                         ├── N quotation_items ──────────────── N:1 products
                         │
                         └── 1 ──────── 0..1 sales_orders
                                            │
                                            ├── N sales_order_items ── N:1 products
                                            │
                                            └── 1 ──────── N dispatches
                                                            │
                                                            └── N dispatch_items ── N:1 products

products 1 ────────── 1 inventory

users → application authentication / authorization
```

## 4. Table Responsibilities

### `users`

Stores authenticated application users.

Important fields:

- `id` — UUID primary key
- `email` — unique login identifier
- `password_hash` — hashed password
- `role` — `ADMIN` or `SALES_USER`

The role is used by backend RBAC middleware.

### `customers`

Stores customer master information such as company name, contact person, mobile, email and city.

### `products`

Stores the product catalogue:

- Product code
- Product name
- Category
- Unit
- Base price

`product_code` is uniquely constrained.

### `inventory`

Stores stock state for each product.

```text
physical_quantity
reserved_quantity
```

The product is the identity of the inventory row.

### `enquiries`

Stores enquiry-level information including customer, enquiry number, dates, notes and status.

Supported enquiry lifecycle:

```text
NEW → QUOTED → WON / LOST
```

### `enquiry_items`

Stores the one-to-many product lines belonging to an enquiry.

This allows a single enquiry to contain multiple products without storing product lists as JSON.

### `quotations`

Stores quotation-level data including quotation number, enquiry reference, dates, status and calculated totals.

Supported lifecycle:

```text
DRAFT → SENT → ACCEPTED / REJECTED
```

### `quotation_items`

Stores quotation line details including:

- Product
- Quantity
- Unit price
- Discount percentage
- GST percentage
- Line amount

Commercial totals are calculated/validated by the backend.

### `sales_orders`

Stores orders created from accepted quotations.

The `quotation_id` relationship is uniquely constrained so one quotation cannot create multiple Sales Orders.

Supported lifecycle includes:

```text
PENDING → CONFIRMED → DISPATCHED
                  ↘ CANCELLED
```

### `sales_order_items`

Stores the product lines and quantities belonging to a Sales Order.

### `dispatches`

Stores dispatch-level information such as dispatch number, Sales Order reference, dispatch date, vehicle number and driver name.

### `dispatch_items`

Stores the products and quantities included in the dispatch.

## 5. Inventory Invariant

Available inventory is **derived**, not independently stored:

```text
Available Quantity = Physical Quantity - Reserved Quantity
```

Example:

```text
Physical   = 100
Reserved   = 30
Available  = 70
```

During Sales Order confirmation, only the reserved quantity changes:

```text
Physical   = 100
Reserved   = 90
Available  = 10
```

During dispatch:

```text
Physical Quantity -= dispatched quantity
Reserved Quantity -= dispatched quantity
```

Example:

```text
Before dispatch:
Physical   = 100
Reserved   = 10
Available  = 90

Dispatch   = 10

After dispatch:
Physical   = 90
Reserved   = 0
Available  = 90
```

## 6. Integrity Constraints

### Primary keys

Each entity has a primary key, using UUIDs for application entities where applicable.

### Foreign keys

Relationships are enforced at database level, including:

```text
inventory.product_id → products.id
enquiries.customer_id → customers.id
enquiry_items.enquiry_id → enquiries.id
enquiry_items.product_id → products.id
quotations.enquiry_id → enquiries.id
quotation_items.quotation_id → quotations.id
quotation_items.product_id → products.id
sales_orders.quotation_id → quotations.id
sales_order_items.sales_order_id → sales_orders.id
sales_order_items.product_id → products.id
dispatches.sales_order_id → sales_orders.id
dispatch_items.dispatch_id → dispatches.id
dispatch_items.product_id → products.id
```

### Unique constraints

Important uniqueness rules include:

- User email
- Product code
- Quotation-to-Sales-Order relationship

The unique quotation relationship enforces:

```text
One quotation → at most one Sales Order
```

### Check constraints

The schema protects against invalid quantity states, including preventing negative quantities and preventing reserved stock from exceeding physical stock.

## 7. Why a Relational Model?

The workflow has strong relationships and business invariants between entities. PostgreSQL provides:

- Foreign-key enforcement
- Unique constraints
- Check constraints
- Transactions
- Row-level locking
- Consistent updates across related records

These capabilities are particularly important for inventory reservation and dispatch.

## 8. Transaction-Sensitive Operations

### Enquiry creation

The enquiry header and all enquiry items are created atomically.

### Quotation creation

Quotation header, quotation items and workflow-state update are handled as one business operation.

### Sales Order confirmation

Sales Order state and inventory reservation are committed together.

### Dispatch

Dispatch records and inventory decrement are committed together.

The rule is:

> Either all dependent changes are committed, or none of them are.

## 9. Concurrency Protection

Inventory reservation is performed inside a database transaction with row-level locking on the required inventory records.

The service:

1. Begins a transaction.
2. Locks the relevant inventory rows.
3. Recalculates available quantity.
4. Validates requested quantities.
5. Updates `reserved_quantity`.
6. Commits the Sales Order state and inventory changes together.

This prevents two concurrent requests from both reserving stock that only one of them should receive.

## 10. Traceability

The relational design preserves the complete commercial trace:

```text
Customer
  ↓
Enquiry
  ↓
Quotation
  ↓
Sales Order
  ↓
Dispatch
```

A reviewer can therefore trace an order back to the original customer enquiry and quotation, while dispatch remains linked to the Sales Order.

## 11. Design Trade-offs

The implementation intentionally focuses on the mandatory case-study workflow rather than introducing unnecessary complexity.

Examples of deferred extensions include:

- DAMAGED stock as an additional inventory bucket
- Sales Order cancellation with reservation release
- Partial dispatch support
- Audit history tables
- Pagination and advanced filtering

The existing schema can be extended through incremental migrations when these requirements are introduced.
