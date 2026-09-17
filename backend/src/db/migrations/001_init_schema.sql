CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS dispatch_items CASCADE;
DROP TABLE IF EXISTS dispatches CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS quotation_items CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS enquiry_items CASCADE;
DROP TABLE IF EXISTS enquiries CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS sales_order_status CASCADE;
DROP TYPE IF EXISTS quotation_status CASCADE;
DROP TYPE IF EXISTS enquiry_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

CREATE TYPE user_role AS ENUM ('ADMIN', 'SALES_USER');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'SALES_USER',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE RESTRICT,
    physical_quantity INT NOT NULL DEFAULT 0 CHECK (physical_quantity >= 0),
    reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_reserved_le_physical CHECK (reserved_quantity <= physical_quantity)
);

CREATE TYPE enquiry_status AS ENUM ('NEW', 'QUOTED', 'WON', 'LOST');

CREATE TABLE enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date DATE NOT NULL,
    status enquiry_status NOT NULL DEFAULT 'NEW',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enquiry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TYPE quotation_status AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    enquiry_id UUID NOT NULL REFERENCES enquiries(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    valid_until DATE NOT NULL,
    status quotation_status NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent BETWEEN 0 AND 100),
    gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00 CHECK (gst_percent >= 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount >= 0)
);

CREATE TYPE sales_order_status AS ENUM ('PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED');

CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id UUID UNIQUE NOT NULL REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status sales_order_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount >= 0)
);

CREATE TABLE dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_number VARCHAR(50) NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_enquiries_customer ON enquiries(customer_id);
CREATE INDEX idx_quotations_enquiry ON quotations(enquiry_id);
CREATE INDEX idx_sales_orders_quotation ON sales_orders(quotation_id);
CREATE INDEX idx_dispatches_sales_order ON dispatches(sales_order_id);