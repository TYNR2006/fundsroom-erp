import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Send,
  Truck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fundsroom_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

type User = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "SALES_USER";
};

type Customer = {
  id: string;
  company_name: string;
  contact_person: string;
  mobile: string;
  email: string;
  city: string;
};

type Product = {
  id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  base_price: string;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
};

type EnquiryItem = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
};

type Enquiry = {
  id: string;
  enquiry_number: string;
  customer_id: string;
  company_name: string;
  contact_person: string;
  enquiry_date: string;
  required_date: string;
  status: "NEW" | "QUOTED" | "WON" | "LOST";
  notes: string | null;
  items: EnquiryItem[];
};

type QuotationItem = {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstPercent: number;
  lineAmount: number;
};

type Quotation = {
  id: string;
  quotation_number: string;
  enquiry_id: string;
  enquiry_number: string;
  customer_id: string;
  company_name: string;
  valid_until: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  subtotal: string;
  discount_total: string;
  gst_total: string;
  grand_total: string;
  items: QuotationItem[];
};

type SalesOrderItem = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
};

type SalesOrder = {
  id: string;
  order_number: string;
  quotation_id: string;
  quotation_number: string;
  customer_id: string;
  company_name: string;
  order_date: string;
  total_amount: string;
  status: "PENDING" | "CONFIRMED" | "DISPATCHED" | "CANCELLED";
  items: SalesOrderItem[];
};

type InventoryItem = {
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
};

type Dispatch = {
  id: string;
  dispatch_number: string;
  sales_order_id: string;
  order_number: string;
  dispatch_date: string;
  vehicle_number: string;
  driver_name: string;
};

type Screen =
  | "dashboard"
  | "customers"
  | "enquiries"
  | "quotations"
  | "orders"
  | "inventory"
  | "dispatches";

const currency = (value: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));

const formatDate = (value: string) => {
  // PostgreSQL DATE values should be displayed without timezone shifting.
  const dateOnly = value.includes("T") ? value.split("T")[0] : value;
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("fundsroom_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [screen, setScreen] = useState<Screen>("dashboard");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const notify = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const [
        customersResponse,
        productsResponse,
        enquiriesResponse,
        quotationsResponse,
        ordersResponse,
        inventoryResponse,
        dispatchResponse,
      ] = await Promise.all([
        api.get("/customers"),
        api.get("/products"),
        api.get("/enquiries"),
        api.get("/quotations"),
        api.get("/sales-orders"),
        api.get("/products/inventory"),
        api.get("/dispatches"),
      ]);

      setCustomers(customersResponse.data.data);
      setProducts(productsResponse.data.data);
      setEnquiries(enquiriesResponse.data.data);
      setQuotations(quotationsResponse.data.data);
      setOrders(ordersResponse.data.data);
      setInventory(inventoryResponse.data.data);
      setDispatches(dispatchResponse.data.data);
    } catch (error) {
      console.error(error);
      notify("error", "Unable to load ERP data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const logout = () => {
    localStorage.removeItem("fundsroom_token");
    localStorage.removeItem("fundsroom_user");
    setUser(null);
  };

  if (!user) {
    return (
      <LoginPage
        onLogin={(loggedUser) => {
          setUser(loggedUser);
          setScreen("dashboard");
        }}
        notify={notify}
      />
    );
  }

  return (
    <div className="app-shell">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <XCircle size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>FundsRoom</strong>
            <span>ERP Console</span>
          </div>
        </div>

        <nav className="nav">
          <NavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active={screen === "dashboard"}
            onClick={() => setScreen("dashboard")}
          />

          <NavItem
            icon={<Users size={18} />}
            label="Customers"
            active={screen === "customers"}
            onClick={() => setScreen("customers")}
          />

          <NavItem
            icon={<ClipboardList size={18} />}
            label="Enquiries"
            active={screen === "enquiries"}
            onClick={() => setScreen("enquiries")}
          />

          <NavItem
            icon={<FileText size={18} />}
            label="Quotations"
            active={screen === "quotations"}
            onClick={() => setScreen("quotations")}
          />

          <NavItem
            icon={<Boxes size={18} />}
            label="Sales Orders"
            active={screen === "orders"}
            onClick={() => setScreen("orders")}
          />

          <NavItem
            icon={<Package size={18} />}
            label="Inventory"
            active={screen === "inventory"}
            onClick={() => setScreen("inventory")}
          />

          <NavItem
            icon={<Truck size={18} />}
            label="Dispatches"
            active={screen === "dispatches"}
            onClick={() => setScreen("dispatches")}
          />
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <strong>{user.fullName}</strong>
              <span>{user.role}</span>
            </div>
          </div>

          <button className="logout-button" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">FundsRoom ERP</div>
            <h1>{getScreenTitle(screen)}</h1>
          </div>

          <button
            className="refresh-button"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </header>

        {screen === "dashboard" && (
          <Dashboard
            customers={customers}
            enquiries={enquiries}
            quotations={quotations}
            orders={orders}
            inventory={inventory}
            dispatches={dispatches}
            onNavigate={setScreen}
          />
        )}

        {screen === "customers" && (
          <CustomersPage
            customers={customers}
            onCreated={loadData}
            notify={notify}
          />
        )}

        {screen === "enquiries" && (
          <EnquiriesPage
            enquiries={enquiries}
            customers={customers}
            products={products}
            onCreated={loadData}
            notify={notify}
          />
        )}

        {screen === "quotations" && (
          <QuotationsPage
            quotations={quotations}
            enquiries={enquiries}
            products={products}
            onRefresh={loadData}
            notify={notify}
          />
        )}

        {screen === "orders" && (
          <OrdersPage
            orders={orders}
            quotations={quotations}
            onRefresh={loadData}
            notify={notify}
            isAdmin={user.role === "ADMIN"}
          />
        )}

        {screen === "inventory" && (
          <InventoryPage inventory={inventory} />
        )}

        {screen === "dispatches" && (
          <DispatchesPage
            orders={orders}
            dispatches={dispatches}
            onRefresh={loadData}
            notify={notify}
            isAdmin={user.role === "ADMIN"}
          />
        )}
      </main>
    </div>
  );
}

function getScreenTitle(screen: Screen) {
  const titles: Record<Screen, string> = {
    dashboard: "Operations Dashboard",
    customers: "Customers",
    enquiries: "Customer Enquiries",
    quotations: "Quotations",
    orders: "Sales Orders",
    inventory: "Inventory",
    dispatches: "Dispatches",
  };

  return titles[screen];
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LoginPage({
  onLogin,
  notify,
}: {
  onLogin: (user: User) => void;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [email, setEmail] = useState("admin@fundsroom.com");
  const [password, setPassword] = useState("Admin@123");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      const loggedUser = response.data.data.user;
      const token = response.data.data.token;

      localStorage.setItem("fundsroom_token", token);
      localStorage.setItem(
        "fundsroom_user",
        JSON.stringify(loggedUser)
      );

      onLogin(loggedUser);
    } catch (error) {
      console.error(error);
      notify("error", "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">F</div>

        <div className="login-heading">
          <div className="eyebrow">FundsRoom ERP</div>
          <h1>Sign in to your workspace</h1>
          <p>
            Manage enquiries, quotations, orders, inventory and dispatch.
          </p>
        </div>

        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button className="primary-button" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
            <ChevronRight size={17} />
          </button>
        </form>

        <div className="login-hint">
          <strong>Demo accounts</strong>
          <span>ADMIN: admin@fundsroom.com / Admin@123</span>
          <span>SALES: sales@fundsroom.com / Sales@123</span>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  customers,
  enquiries,
  quotations,
  orders,
  inventory,
  dispatches,
  onNavigate,
}: {
  customers: Customer[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: SalesOrder[];
  inventory: InventoryItem[];
  dispatches: Dispatch[];
  onNavigate: (screen: Screen) => void;
}) {
  const availableUnits = inventory.reduce(
    (sum, item) => sum + Number(item.available_quantity),
    0
  );

  const cards = [
    {
      label: "Customers",
      value: customers.length,
      icon: Users,
      target: "customers" as Screen,
    },
    {
      label: "Open Enquiries",
      value: enquiries.filter((e) =>
        ["NEW", "QUOTED"].includes(e.status)
      ).length,
      icon: ClipboardList,
      target: "enquiries" as Screen,
    },
    {
      label: "Accepted Quotations",
      value: quotations.filter((q) => q.status === "ACCEPTED").length,
      icon: FileText,
      target: "quotations" as Screen,
    },
    {
      label: "Active Orders",
      value: orders.filter((o) =>
        ["PENDING", "CONFIRMED"].includes(o.status)
      ).length,
      icon: Boxes,
      target: "orders" as Screen,
    },
  ];

  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <span className="hero-label">OPERATIONS OVERVIEW</span>
          <h2>Customer enquiry to dispatch</h2>
          <p>
            Track the complete FundsRoom workflow from initial enquiry
            through quotation, reservation and dispatch.
          </p>
        </div>

        <div className="workflow">
          {["Enquiry", "Quotation", "Order", "Reserve", "Dispatch"].map(
            (item, index) => (
              <div className="workflow-step" key={item}>
                <div className="workflow-number">{index + 1}</div>
                <span>{item}</span>
              </div>
            )
          )}
        </div>
      </section>

      <section className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              className="stat-card"
              key={card.label}
              onClick={() => onNavigate(card.target)}
            >
              <div className="stat-icon">
                <Icon size={19} />
              </div>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            </button>
          );
        })}
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">INVENTORY</span>
              <h3>Stock snapshot</h3>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("inventory")}
            >
              View all
            </button>
          </div>

          <div className="mini-table">
            {inventory.slice(0, 5).map((item) => (
              <div className="mini-row" key={item.product_id}>
                <div>
                  <strong>{item.product_name}</strong>
                  <span>{item.product_code}</span>
                </div>
                <div className="stock-pill">
                  {item.available_quantity} {item.unit}
                </div>
              </div>
            ))}
          </div>

          <div className="inventory-summary">
            <div>
              <span>Available units</span>
              <strong>{availableUnits}</strong>
            </div>
            <div>
              <span>Dispatches</span>
              <strong>{dispatches.length}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">LATEST ORDERS</span>
              <h3>Sales order pipeline</h3>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("orders")}
            >
              View all
            </button>
          </div>

          <div className="mini-table">
            {orders.slice(0, 5).map((order) => (
              <div className="mini-row" key={order.id}>
                <div>
                  <strong>{order.order_number}</strong>
                  <span>{order.company_name}</span>
                </div>
                <div className={`badge badge-${order.status.toLowerCase()}`}>
                  {order.status}
                </div>
              </div>
            ))}

            {orders.length === 0 && (
              <div className="empty-state compact">
                No sales orders yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomersPage({
  customers,
  onCreated,
  notify,
}: {
  customers: Customer[];
  onCreated: () => void;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    city: "",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      await api.post("/customers", form);

      setForm({
        companyName: "",
        contactPerson: "",
        mobile: "",
        email: "",
        city: "",
      });

      notify("success", "Customer created successfully.");
      onCreated();
    } catch (error) {
      console.error(error);
      notify("error", "Unable to create customer.");
    }
  };

  return (
    <div className="page">
      <section className="section-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">CREATE</span>
              <h3>New customer</h3>
            </div>
            <UserPlus size={20} />
          </div>

          <form onSubmit={submit} className="form-stack">
            <label>
              Company name
              <input
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                required
              />
            </label>

            <label>
              Contact person
              <input
                value={form.contactPerson}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
                required
              />
            </label>

            <div className="two-column">
              <label>
                Mobile
                <input
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({ ...form, mobile: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                City
                <input
                  value={form.city}
                  onChange={(e) =>
                    setForm({ ...form, city: e.target.value })
                  }
                  required
                />
              </label>
            </div>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                required
              />
            </label>

            <button className="primary-button">
              <Plus size={17} />
              Create customer
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">CUSTOMERS</span>
              <h3>{customers.length} registered</h3>
            </div>
          </div>

          <div className="list-stack">
            {customers.map((customer) => (
              <div className="list-card" key={customer.id}>
                <div>
                  <strong>{customer.company_name}</strong>
                  <span>
                    {customer.contact_person} • {customer.city}
                  </span>
                  <small>
                    {customer.email} • {customer.mobile}
                  </small>
                </div>
              </div>
            ))}

            {customers.length === 0 && (
              <div className="empty-state">No customers found.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function EnquiriesPage({
  enquiries,
  customers,
  products,
  onCreated,
  notify,
}: {
  enquiries: Enquiry[];
  customers: Customer[];
  products: Product[];
  onCreated: () => void;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [customerId, setCustomerId] = useState(
    customers[0]?.id ?? ""
  );
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<
    { productId: string; quantity: number }[]
  >([]);

  useEffect(() => {
    if (!customerId && customers.length) {
      setCustomerId(customers[0].id);
    }

    if (!productId && products.length) {
      setProductId(products[0].id);
    }
  }, [customers, products, customerId, productId]);

  const selectedProducts = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        product: products.find((product) => product.id === item.productId),
      })),
    [items, products]
  );

  const addItem = () => {
    if (!productId || quantity <= 0) return;

    setItems((current) => {
      const existing = current.find(
        (item) => item.productId === productId
      );

      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...current, { productId, quantity }];
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!items.length) {
      notify("error", "Add at least one product.");
      return;
    }

    try {
      await api.post("/enquiries", {
        customerId,
        requiredDate,
        notes,
        items,
      });

      setItems([]);
      setNotes("");
      setRequiredDate("");

      notify("success", "Enquiry created successfully.");
      onCreated();
    } catch (error) {
      console.error(error);
      notify("error", "Unable to create enquiry.");
    }
  };

  return (
    <div className="page">
      <section className="section-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">NEW ENQUIRY</span>
              <h3>Create enquiry</h3>
            </div>
          </div>

          <form onSubmit={submit} className="form-stack">
            <label>
              Customer
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Required date
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                required
              />
            </label>

            <div className="add-line">
              <label>
                Product
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_code} — {product.product_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Qty
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>

              <button
                type="button"
                className="secondary-button add-button"
                onClick={addItem}
              >
                <Plus size={16} />
                Add
              </button>
            </div>

            <div className="selected-lines">
              {selectedProducts.map((item) => (
                <div className="selected-line" key={item.productId}>
                  <span>{item.product?.product_name}</span>
                  <strong>{item.quantity}</strong>
                </div>
              ))}

              {!selectedProducts.length && (
                <div className="empty-state compact">
                  No products added.
                </div>
              )}
            </div>

            <label>
              Notes
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add customer requirement..."
              />
            </label>

            <button className="primary-button">
              <ClipboardList size={17} />
              Create enquiry
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">ENQUIRY PIPELINE</span>
              <h3>{enquiries.length} enquiries</h3>
            </div>
          </div>

          <div className="list-stack">
            {enquiries.map((enquiry) => (
              <div className="list-card" key={enquiry.id}>
                <div className="list-main">
                  <strong>{enquiry.enquiry_number}</strong>
                  <span>{enquiry.company_name}</span>
                  <small>
                    Required: {formatDate(enquiry.required_date)}
                  </small>
                  <div className="tag-row">
                    {enquiry.items.map((item) => (
                      <span className="tag" key={item.id || item.productId}>
                        {item.productCode} × {item.quantity}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={`badge badge-${enquiry.status.toLowerCase()}`}>
                  {enquiry.status}
                </div>
              </div>
            ))}

            {!enquiries.length && (
              <div className="empty-state">No enquiries found.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function QuotationsPage({
  quotations,
  enquiries,
  products,
  onRefresh,
  notify,
}: {
  quotations: Quotation[];
  enquiries: Enquiry[];
  products: Product[];
  onRefresh: () => void;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [enquiryId, setEnquiryId] = useState(enquiries[0]?.id ?? "");
  const [validUntil, setValidUntil] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(
    products[0]?.id ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);

  useEffect(() => {
    if (!enquiryId && enquiries.length) {
      setEnquiryId(enquiries[0].id);
    }

    if (!selectedProductId && products.length) {
      setSelectedProductId(products[0].id);
    }
  }, [enquiries, products, enquiryId, selectedProductId]);

  useEffect(() => {
    const product = products.find(
      (item) => item.id === selectedProductId
    );

    if (product) {
      setUnitPrice(Number(product.base_price));
    }
  }, [selectedProductId, products]);

  const createQuotation = async (event: FormEvent) => {
    event.preventDefault();

    try {
      await api.post("/quotations", {
        enquiryId,
        validUntil,
        items: [
          {
            productId: selectedProductId,
            quantity,
            unitPrice,
            discountPercent: discount,
            gstPercent: gst,
          },
        ],
      });

      notify("success", "Quotation created.");
      onRefresh();
    } catch (error) {
      console.error(error);
      notify("error", "Unable to create quotation.");
    }
  };

  const updateStatus = async (
    quotationId: string,
    status: "SENT" | "ACCEPTED" | "REJECTED"
  ) => {
    try {
      await api.patch(`/quotations/${quotationId}/status`, {
        status,
      });

      notify("success", `Quotation moved to ${status}.`);
      onRefresh();
    } catch (error) {
      console.error(error);
      notify("error", "Quotation status update failed.");
    }
  };

  return (
    <div className="page">
      <section className="section-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">NEW QUOTATION</span>
              <h3>Create quotation</h3>
            </div>
          </div>

          <form onSubmit={createQuotation} className="form-stack">
            <label>
              Enquiry
              <select
                value={enquiryId}
                onChange={(e) => setEnquiryId(e.target.value)}
                required
              >
                <option value="">Select enquiry</option>
                {enquiries
                  .filter((e) => e.status !== "LOST")
                  .map((enquiry) => (
                    <option key={enquiry.id} value={enquiry.id}>
                      {enquiry.enquiry_number} — {enquiry.company_name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Valid until
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </label>

            <label>
              Product
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_code} — {product.product_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="two-column">
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>

              <label>
                Unit price
                <input
                  type="number"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="two-column">
              <label>
                Discount %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </label>

              <label>
                GST %
                <input
                  type="number"
                  min="0"
                  value={gst}
                  onChange={(e) => setGst(Number(e.target.value))}
                />
              </label>
            </div>

            <button className="primary-button">
              <FileText size={17} />
              Create quotation
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">QUOTATIONS</span>
              <h3>{quotations.length} documents</h3>
            </div>
          </div>

          <div className="list-stack">
            {quotations.map((quotation) => (
              <div className="list-card vertical-card" key={quotation.id}>
                <div className="list-main">
                  <div className="row-between">
                    <strong>{quotation.quotation_number}</strong>
                    <div
                      className={`badge badge-${quotation.status.toLowerCase()}`}
                    >
                      {quotation.status}
                    </div>
                  </div>

                  <span>{quotation.company_name}</span>
                  <small>
                    {quotation.enquiry_number} • Valid until{" "}
                    {formatDate(quotation.valid_until)}
                  </small>

                  <div className="quotation-total">
                    {currency(quotation.grand_total)}
                  </div>
                </div>

                <div className="action-row">
                  {quotation.status === "DRAFT" && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        updateStatus(quotation.id, "SENT")
                      }
                    >
                      <Send size={15} />
                      Mark sent
                    </button>
                  )}

                  {quotation.status === "SENT" && (
                    <>
                      <button
                        className="success-button"
                        onClick={() =>
                          updateStatus(quotation.id, "ACCEPTED")
                        }
                      >
                        <CheckCircle2 size={15} />
                        Accept
                      </button>

                      <button
                        className="danger-button"
                        onClick={() =>
                          updateStatus(quotation.id, "REJECTED")
                        }
                      >
                        <XCircle size={15} />
                        Reject
                      </button>
                    </>
                  )}
                </div>

                <div className="item-preview">
                  {quotation.items.map((item) => (
                    <span className="tag" key={item.productId}>
                      {item.productCode} × {item.quantity}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {!quotations.length && (
              <div className="empty-state">No quotations found.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function OrdersPage({
  orders,
  quotations,
  onRefresh,
  notify,
  isAdmin,
}: {
  orders: SalesOrder[];
  quotations: Quotation[];
  onRefresh: () => void;
  notify: (type: "success" | "error", message: string) => void;
  isAdmin: boolean;
}) {
  const acceptedQuotes = quotations.filter(
    (quotation) => quotation.status === "ACCEPTED"
  );

  const convertQuote = async (quotationId: string) => {
    try {
      await api.post(
        `/sales-orders/from-quotation/${quotationId}`
      );

      notify("success", "Sales Order created.");
      onRefresh();
    } catch (error) {
      console.error(error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          "Unable to create Sales Order."
        : "Unable to create Sales Order.";

      notify("error", message);
    }
  };

  const confirmOrder = async (orderId: string) => {
    try {
      await api.post(`/sales-orders/${orderId}/confirm`);

      notify(
        "success",
        "Order confirmed and inventory reserved."
      );
      onRefresh();
    } catch (error) {
      console.error(error);

      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          "Unable to confirm Sales Order."
        : "Unable to confirm Sales Order.";

      notify("error", message);
    }
  };

  return (
    <div className="page">
      {acceptedQuotes.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">READY FOR CONVERSION</span>
              <h3>Accepted quotations</h3>
            </div>
          </div>

          <div className="ready-grid">
            {acceptedQuotes.map((quotation) => {
              const alreadyConverted = orders.some(
                (order) => order.quotation_id === quotation.id
              );

              return (
                <div className="ready-card" key={quotation.id}>
                  <div>
                    <strong>{quotation.quotation_number}</strong>
                    <span>{quotation.company_name}</span>
                  </div>

                  <div className="ready-value">
                    {currency(quotation.grand_total)}
                  </div>

                  {!alreadyConverted ? (
                    <button
                      className="primary-button"
                      onClick={() => convertQuote(quotation.id)}
                    >
                      Convert to Sales Order
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <span className="success-text">
                      Sales Order already created
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">SALES ORDERS</span>
            <h3>{orders.length} orders</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Products</th>
                {isAdmin && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.order_number}</strong>
                    <span className="table-sub">
                      {formatDate(order.order_date)}
                    </span>
                  </td>
                  <td>{order.company_name}</td>
                  <td>{currency(order.total_amount)}</td>
                  <td>
                    <span
                      className={`badge badge-${order.status.toLowerCase()}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div className="tag-row">
                      {order.items.map((item) => (
                        <span className="tag" key={item.id}>
                          {item.productCode} × {item.quantity}
                        </span>
                      ))}
                    </div>
                  </td>
                  {isAdmin && (
                    <td>
                      {order.status === "PENDING" && (
                        <button
                          className="success-button"
                          onClick={() => confirmOrder(order.id)}
                        >
                          <CheckCircle2 size={15} />
                          Confirm & Reserve
                        </button>
                      )}

                      {order.status === "CONFIRMED" && (
                        <span className="success-text">
                          Ready for dispatch
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {!orders.length && (
            <div className="empty-state">No Sales Orders found.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function InventoryPage({
  inventory,
}: {
  inventory: InventoryItem[];
}) {
  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">STOCK CONTROL</span>
            <h3>Inventory availability</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Code</th>
                <th>Physical</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.product_id}>
                  <td>
                    <strong>{item.product_name}</strong>
                  </td>
                  <td>{item.product_code}</td>
                  <td>{item.physical_quantity}</td>
                  <td>{item.reserved_quantity}</td>
                  <td>
                    <span
                      className={
                        item.available_quantity <= 10
                          ? "stock-low"
                          : "stock-good"
                      }
                    >
                      {item.available_quantity}
                    </span>
                  </td>
                  <td>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DispatchesPage({
  orders,
  dispatches,
  onRefresh,
  notify,
  isAdmin,
}: {
  orders: SalesOrder[];
  dispatches: Dispatch[];
  onRefresh: () => void;
  notify: (type: "success" | "error", message: string) => void;
  isAdmin: boolean;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("KA01AB1234");
  const [driverName, setDriverName] = useState("Suresh Kumar");

  const confirmedOrders = orders.filter(
    (order) => order.status === "CONFIRMED"
  );

  useEffect(() => {
    if (!selectedOrderId && confirmedOrders.length) {
      setSelectedOrderId(confirmedOrders[0].id);
    }
  }, [confirmedOrders, selectedOrderId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedOrderId) {
      notify("error", "Select a confirmed Sales Order.");
      return;
    }

    try {
      await api.post(
        `/dispatches/sales-orders/${selectedOrderId}/dispatch`,
        {
          vehicleNumber,
          driverName,
        }
      );

      notify("success", "Sales Order dispatched successfully.");
      setSelectedOrderId("");
      onRefresh();
    } catch (error) {
      console.error(error);

      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ||
          "Unable to dispatch order."
        : "Unable to dispatch order.";

      notify("error", message);
    }
  };

  return (
    <div className="page">
      {isAdmin && (
        <section className="section-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">NEW DISPATCH</span>
                <h3>Dispatch confirmed order</h3>
              </div>
              <Truck size={20} />
            </div>

            <form onSubmit={submit} className="form-stack">
              <label>
                Confirmed Sales Order
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  required
                >
                  <option value="">Select order</option>
                  {confirmedOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.order_number} — {order.company_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Vehicle number
                <input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  required
                />
              </label>

              <label>
                Driver name
                <input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  required
                />
              </label>

              <button
                className="primary-button"
                disabled={!confirmedOrders.length}
              >
                <Truck size={17} />
                Dispatch order
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">READY ORDERS</span>
                <h3>{confirmedOrders.length} confirmed</h3>
              </div>
            </div>

            <div className="list-stack">
              {confirmedOrders.map((order) => (
                <div className="list-card" key={order.id}>
                  <div>
                    <strong>{order.order_number}</strong>
                    <span>{order.company_name}</span>
                  </div>

                  <div className="badge badge-confirmed">
                    CONFIRMED
                  </div>
                </div>
              ))}

              {!confirmedOrders.length && (
                <div className="empty-state">
                  No confirmed orders ready for dispatch.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">DISPATCH HISTORY</span>
            <h3>{dispatches.length} dispatches</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dispatch</th>
                <th>Sales Order</th>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Driver</th>
              </tr>
            </thead>

            <tbody>
              {dispatches.map((dispatch) => (
                <tr key={dispatch.id}>
                  <td>
                    <strong>{dispatch.dispatch_number}</strong>
                  </td>
                  <td>{dispatch.order_number}</td>
                  <td>{formatDate(dispatch.dispatch_date)}</td>
                  <td>{dispatch.vehicle_number}</td>
                  <td>{dispatch.driver_name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!dispatches.length && (
            <div className="empty-state">
              No dispatches found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;