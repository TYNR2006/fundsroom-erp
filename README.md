# FundsRoom ERP

> Full-Stack ERP Workflow Application for **Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**

A production-oriented full-stack implementation of the FundsRoom technical case study using **React, TypeScript, Node.js, Express.js, PostgreSQL, JWT authentication, backend RBAC, validation, transactions, and automated tests**.

The application focuses on **correct business workflow, relational data integrity, inventory consistency, authorization, and transactional behavior** rather than visual complexity.

---

## 1. Project Overview

FundsRoom ERP models a simplified industrial sales workflow in which a customer enquiry is converted into a quotation, an accepted quotation becomes a Sales Order, the Sales Order reserves available inventory, and an administrator can finally dispatch the order.

### Core workflow

```text
Customer
   │
   ▼
Customer Enquiry
   │
   ▼
Quotation
   │  ACCEPTED
   ▼
Sales Order
   │  ADMIN CONFIRMATION
   ▼
Inventory Reservation
   │
   ▼
Dispatch
   │
   ▼
Inventory Updated
```

The implementation deliberately keeps critical business rules on the backend. Frontend checks improve usability, but **authorization, calculations, inventory validation, and transactional consistency are enforced server-side**.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Authentication | JWT |
| Password Security | bcryptjs |
| Validation | express-validator |
| Security Middleware | Helmet, CORS, Rate Limiting |
| Database Driver | node-postgres (`pg`) |
| Testing | Jest + Supertest |
| API Style | REST |

---

## 3. Key Capabilities

### Authentication & Authorization
- JWT-based authentication.
- Passwords stored as bcrypt hashes.
- Backend role-based access control.
- `ADMIN` and `SALES_USER` roles.
- Protected API routes reject unauthenticated requests.
- Restricted operations are enforced by backend middleware, not only by UI visibility.

### Customer & Enquiry Management
- Create and view customers.
- Create enquiries containing multiple products.
- Enquiry lifecycle:

```text
NEW → QUOTED → WON / LOST
```

### Product & Inventory Management
- Product master data.
- Physical and reserved stock tracking.
- Available quantity is derived rather than independently stored:

```text
Available Quantity = Physical Quantity - Reserved Quantity
```

- Inventory updates are restricted to administrators.
- Negative stock and invalid reserved quantities are rejected.

### Quotation Management
- Multi-line quotations.
- Unit price, discount, GST, line amount, and grand total.
- Quotation totals are calculated on the backend.
- Quotation lifecycle:

```text
DRAFT → SENT → ACCEPTED / REJECTED
```

### Sales Orders
- Only accepted quotations can be converted.
- A quotation can generate at most one Sales Order.
- Sales Orders retain quotation traceability.
- Order lifecycle supports confirmation, dispatch, and cancellation states.

### Inventory Reservation
- Reservation occurs when an `ADMIN` confirms the Sales Order.
- Inventory rows are locked during the transaction.
- Available stock is rechecked inside the transaction.
- Physical stock is not reduced during reservation.
- Reserved stock increases atomically.

### Dispatch
- Only administrators can dispatch.
- Dispatch is permitted only for confirmed Sales Orders.
- Reserved and physical quantities are both reduced during dispatch.
- Dispatches for cancelled orders, duplicate quantities, or quantities above reserved stock are rejected.

---

## 4. Roles & Permissions

| Operation | ADMIN | SALES_USER |
|---|:---:|:---:|
| Login | ✅ | ✅ |
| View customers | ✅ | ✅ |
| Create customers | ✅ | ✅ |
| Create enquiries | ✅ | ✅ |
| View inventory | ✅ | ✅ |
| Create quotations | ✅ | ✅ |
| Accept / reject quotations | ✅ | ✅ |
| Convert accepted quotation to Sales Order | ✅ | ✅ |
| Confirm Sales Order / reserve inventory | ✅ | ❌ |
| Manage inventory | ✅ | ❌ |
| Dispatch Sales Order | ✅ | ❌ |

> **Important:** frontend controls are not treated as the security boundary. The backend verifies the JWT and role for every protected operation.

---

## 5. Architecture

```text
┌──────────────────────────────────────────────┐
│                React Frontend                │
│  Login • Enquiries • Quotations • Orders     │
│  Inventory • Dispatches                      │
└──────────────────────┬───────────────────────┘
                       │ HTTP / REST
                       ▼
┌──────────────────────────────────────────────┐
│              Express.js API                  │
│                                              │
│ Auth Middleware → Role Middleware             │
│ Validation → Controllers → Services           │
└──────────────────────┬───────────────────────┘
                       │ SQL / Transactions
                       ▼
┌──────────────────────────────────────────────┐
│                PostgreSQL                    │
│                                              │
│ Users • Customers • Products • Inventory     │
│ Enquiries • Quotations • Sales Orders         │
│ Dispatches + Line Items                      │
└──────────────────────────────────────────────┘
```

### Backend responsibility split

```text
Routes
  ↓
Controllers
  ↓
Services / Business Logic
  ↓
Database Layer
  ↓
PostgreSQL
```

The service layer contains workflow-critical rules so that business behavior is not dependent on a particular frontend implementation.

---

## 6. Database Design

The database is relational and normalised around the main workflow entities.

### Main entities

```text
users
customers
products
inventory

 enquiries
 └── enquiry_items

 quotations
 └── quotation_items

 sales_orders
 └── sales_order_items

 dispatches
 └── dispatch_items
```

### Relationship overview

```text
CUSTOMER
   │
   └──────────< ENQUIRY ──────────< ENQUIRY_ITEM >──────── PRODUCT
                   │
                   └──────────────< QUOTATION
                                      │
                                      └────< QUOTATION_ITEM >──── PRODUCT
                                                  │
                                                  ▼
                                           SALES_ORDER
                                              │    │
                                              │    └────< SALES_ORDER_ITEM >──── PRODUCT
                                              │
                                              ▼
                                           DISPATCH
                                              │
                                              └────< DISPATCH_ITEM >──── PRODUCT

PRODUCT ───────────── INVENTORY

USERS ─────────────── authentication / ownership context
```

### Integrity rules

- Foreign keys maintain relationships between workflow entities.
- Product and user emails are unique where required.
- `quotation_id` on Sales Orders is unique to prevent duplicate conversion.
- Inventory constraints prevent reserved quantity from exceeding physical quantity.
- Numeric monetary fields use PostgreSQL `NUMERIC` types.
- Workflow transitions are validated by the backend.

---

## 7. Inventory Consistency Model

Inventory is intentionally modelled using two quantities:

```text
Physical Quantity
Reserved Quantity
```

with:

```text
Available Quantity = Physical Quantity - Reserved Quantity
```

### Example

```text
Physical   = 100
Reserved   = 30
Available  = 70
```

A reservation request for `60` succeeds:

```text
Physical   = 100
Reserved   = 90
Available  = 10
```

A reservation request for `80` from the same initial state is rejected because only `70` units are available.

### Concurrency protection

The important inventory check is performed at the database level.

Conceptually:

```text
BEGIN TRANSACTION
      │
      ▼
Lock required inventory rows
      │
      ▼
Recalculate available quantity
      │
      ├── insufficient → ROLLBACK
      │
      └── sufficient
              │
              ▼
      Increase reserved quantity
              │
              ▼
      Confirm Sales Order
              │
              ▼
           COMMIT
```

Rows are locked in a deterministic product order before reservation updates. This prevents two concurrent requests from both passing a stale application-level availability check and over-reserving the same inventory.

---

## 8. Quotation Calculation

Quotation totals are calculated and validated by the backend rather than trusting a client-supplied grand total.

For every line:

```text
Line Base Amount = Quantity × Unit Price
```

Quotation-level calculation:

```text
Subtotal
  = Σ(Line Base Amount)

Discount Amount
  = Subtotal × Discount %

Taxable Amount
  = Subtotal - Discount Amount

GST Amount
  = Taxable Amount × GST %

Grand Total
  = Taxable Amount + GST Amount
```

This ensures the authoritative quotation total is produced by server-side business logic.

---

## 9. Sales Order Conversion Rules

A quotation can be converted into a Sales Order only when:

```text
Quotation Status = ACCEPTED
```

The following are rejected:

```text
DRAFT quotation     → rejected
SENT quotation      → rejected
REJECTED quotation  → rejected
```

Duplicate conversion is prevented using both:

1. service-level validation, and
2. a database uniqueness constraint on `sales_orders.quotation_id`.

This creates a second layer of protection against duplicate Sales Orders.

---

## 10. Dispatch Rules

Dispatch is performed only for a confirmed Sales Order.

At dispatch time the system verifies:

- Sales Order is confirmed.
- Sales Order is not cancelled.
- Requested quantity does not exceed reserved quantity.
- Duplicate dispatch of the same order quantity is prevented.

On successful dispatch:

```text
Physical Quantity  ↓
Reserved Quantity  ↓
```

Both updates happen in the same database transaction as the dispatch record creation.

---

## 11. API Overview

Base URL during local development:

```text
http://localhost:5000/api
```

### Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Authenticate user and issue JWT |

### Customers

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/customers` | Authenticated | Create customer |
| GET | `/customers` | Authenticated | List customers |
| GET | `/customers/:id` | Authenticated | Get customer |

### Enquiries

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/enquiries` | Authenticated | Create enquiry with items |
| GET | `/enquiries` | Authenticated | List enquiries |
| GET | `/enquiries/:id` | Authenticated | Get enquiry details |
| PATCH | `/enquiries/:id/status` | Authenticated | Update enquiry status |

### Products & Inventory

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/products` | Authenticated | List products |
| GET | `/products/inventory` | Authenticated | View inventory and availability |
| GET | `/products/inventory/:productId` | Authenticated | View product inventory |
| PATCH | `/products/inventory/:productId` | ADMIN | Update inventory |

### Quotations

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/quotations` | Authenticated | Create quotation |
| GET | `/quotations` | Authenticated | List quotations |
| GET | `/quotations/:id` | Authenticated | Get quotation |
| PATCH | `/quotations/:id/status` | Authenticated | Update quotation status |

### Sales Orders

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/sales-orders/from-quotation/:quotationId` | Authenticated | Convert accepted quotation |
| GET | `/sales-orders` | Authenticated | List Sales Orders |
| GET | `/sales-orders/:id` | Authenticated | Get Sales Order |
| POST | `/sales-orders/:id/confirm` | ADMIN | Confirm and reserve inventory |

### Dispatches

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/dispatches/sales-orders/:salesOrderId/dispatch` | ADMIN | Dispatch confirmed order |
| GET | `/dispatches` | Authenticated | List dispatches |
| GET | `/dispatches/:id` | Authenticated | Get dispatch |

---

## 12. Authentication

Protected endpoints expect a bearer token:

```http
Authorization: Bearer <JWT_TOKEN>
```

The authentication flow is:

```text
Login
  ↓
Verify email + password
  ↓
Compare bcrypt password hash
  ↓
Sign JWT with user identity + role
  ↓
Client stores token
  ↓
Protected requests include Bearer token
  ↓
Auth middleware verifies JWT
  ↓
Role middleware authorizes restricted operations
```

---

## 13. Error Handling & Validation

The backend validates incoming request data before executing business operations.

Typical protected conditions include:

- Missing authentication token.
- Invalid or expired JWT.
- Insufficient role permissions.
- Missing required fields.
- Invalid UUID / identifiers.
- Invalid status transitions.
- Non-existent customer or product references.
- Negative quantities.
- Invalid inventory state.
- Quotation conversion when quotation is not accepted.
- Duplicate Sales Order conversion.
- Insufficient available stock.
- Dispatch quantity greater than reserved quantity.
- Dispatch of invalid order state.

Errors are returned as structured JSON responses.

Example:

```json
{
  "success": false,
  "message": "Insufficient available inventory"
}
```

---

## 14. Security Measures

The application includes several server-side protections:

- JWT authentication.
- bcrypt password hashing.
- Backend role authorization.
- Helmet security headers.
- Configurable CORS.
- API rate limiting.
- JSON request-size limit.
- Environment-based configuration.
- Parameterised PostgreSQL queries.
- Transactional handling of critical state changes.

### Environment secrets

Secrets are kept outside source control using environment variables.

Do **not** commit the real `.env` file.

Use:

```text
.env.example
```

for documenting required configuration keys.

---

## 15. Project Structure

```text
fundsroom-erp/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   ├── seeds/
│   │   │   └── migrate.js
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── customer/
│   │   │   ├── dispatch/
│   │   │   ├── enquiry/
│   │   │   ├── product/
│   │   │   ├── quotation/
│   │   │   └── salesOrder/
│   │   └── utils/
│   │
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── er-diagram.*
│
├── .gitignore
└── README.md
```

---

## 16. Local Setup

### Prerequisites

- Node.js
- npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone <repository-url>
cd fundsroom-erp
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create:

```text
backend/.env
```

Example configuration:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/fundsroom_case2
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=1d
```

Replace the database credentials and JWT secret with local values.

### 4. Run database migration

```bash
npm run db:migrate
```

### 5. Seed sample data

```bash
npm run db:seed
```

### 6. Start the backend

Development mode:

```bash
npm run dev
```

Production-style local start:

```bash
npm start
```

The API runs on:

```text
http://localhost:5000
```

Health check:

```text
GET http://localhost:5000/api/health
```

### 7. Install frontend dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

### 8. Start frontend

```bash
npm run dev
```

The Vite development server runs on the URL shown in the terminal, typically:

```text
http://localhost:5173
```

---

## 17. Database Commands

Backend scripts:

```bash
npm run db:migrate
npm run db:seed
npm run db:reset
```

`db:reset` is intended for development/test environments because it recreates the initial schema and seed data.

---

## 18. Seeded Demo Users

### Administrator

```text
Email:    admin@fundsroom.com
Password: Admin@123
Role:     ADMIN
```

### Sales User

```text
Email:    sales@fundsroom.com
Password: Sales@123
Role:     SALES_USER
```

These credentials are for local/demo use only and should be changed for any real deployment.

---

## 19. Testing

Run the backend test suite with:

```bash
cd backend
npm test
```

The mandatory case-study scenarios are covered:

```text
✓ Calculates quotation total correctly
✓ Draft/rejected quotation cannot create Sales Order
✓ Same quotation cannot create duplicate Sales Orders
✓ Cannot reserve more than available inventory
✓ SALES_USER cannot confirm Sales Order
```

Current verification result:

```text
Test Suites: 1 passed
Tests:       5 passed
```

The tests use a separate test database so that automated verification does not intentionally modify the development/demo database.

---

## 20. End-to-End Demo Flow

The recommended demonstration sequence is:

```text
1. Login as SALES_USER
2. Create / view customer
3. Create customer enquiry with multiple products
4. Create quotation
5. Move quotation through SENT → ACCEPTED
6. Convert accepted quotation into Sales Order
7. Login as ADMIN
8. Confirm Sales Order
9. Show reserved inventory / available inventory
10. Dispatch the Sales Order
11. Show final physical + reserved inventory values
```

### Inventory demonstration

Before confirmation:

```text
Physical   = 100
Reserved   = 0
Available  = 100
```

After reservation of 10 units:

```text
Physical   = 100
Reserved   = 10
Available  = 90
```

After dispatch of 10 units:

```text
Physical   = 90
Reserved   = 0
Available  = 90
```

---

## 21. Important Design Decisions

### Why calculate quotation totals on the backend?

The frontend is untrusted input. The backend recalculates monetary totals to prevent a client from submitting an arbitrary grand total.

### Why use database transactions for reservation and dispatch?

These operations modify multiple pieces of related state. A transaction ensures the changes either complete together or roll back together.

### Why lock inventory rows?

An application-level availability check alone can race under concurrent requests. Database row locking allows the transaction to re-check and update the inventory safely.

### Why use both application and database duplicate protection?

Service validation provides clear business errors. Database uniqueness is the final integrity boundary if two requests arrive concurrently.

### Why keep inventory availability derived?

Storing both `physical`, `reserved`, and `available` independently creates an opportunity for the values to drift out of sync. Deriving availability from the two source quantities keeps the model consistent.

---

## 22. Scope & Trade-offs

The implementation intentionally prioritises correctness of the requested workflow over feature expansion.

Examples of deliberate scope choices:

- Clean functional ERP interface rather than an excessively complex dashboard.
- Relational tables instead of storing the complete business workflow as JSON.
- Service-layer business rules instead of embedding logic inside React components.
- Transactional reservation and dispatch because they affect shared inventory state.
- Minimal dependencies to keep the codebase understandable and easy to review.

Potential future extensions could include audit trails, pagination/filtering, richer reporting, partial dispatch workflows, cancellation/release workflows, and production observability.

---

## 23. Known Development Notes

- The development database is named `fundsroom_case2`.
- A separate database is used for automated tests.
- The seeded credentials are intended only for demonstration/local testing.
- `.env` contains local secrets and should remain uncommitted.

---

## 24. Submission Checklist

Before submitting the repository, verify:

- [ ] Source code is complete and runs from a clean checkout.
- [ ] `.env` is not committed.
- [ ] `.env.example` documents required environment variables.
- [ ] PostgreSQL migration runs successfully.
- [ ] Seed script runs successfully.
- [ ] Frontend builds successfully.
- [ ] Backend tests pass.
- [ ] JWT authentication works.
- [ ] ADMIN / SALES_USER restrictions work.
- [ ] Quotation totals are backend-calculated.
- [ ] Accepted-only quotation conversion works.
- [ ] Duplicate quotation conversion is blocked.
- [ ] Inventory reservation is transactional.
- [ ] Over-reservation is blocked.
- [ ] Dispatch updates physical and reserved quantities correctly.
- [ ] README is complete.
- [ ] Architecture / ER / API documentation is included.
- [ ] Git history contains meaningful development commits.
- [ ] Demo credentials are documented for evaluation.

---

## 25. Final Verification

The project is designed around a single principle:

> **Business correctness is enforced at the backend and database boundaries, while the frontend provides a clean interface to the workflow.**

This approach keeps the system understandable, testable, and resilient against invalid client input and inventory race conditions while satisfying the core FundsRoom ERP case-study workflow.

---

## License

This project was developed as a technical case-study submission for FundsRoom Infotech Pvt. Ltd.
