import React, { useEffect, useMemo, useState } from "react";
import { api, downloadInvoice } from "./lib/api";
import {
  ShoppingCart,
  Package,
  ClipboardList,
  Users,
  TrendingUp,
  LogOut,
  Search,
  Plus,
  RefreshCw,
  Boxes,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
const productImages = {
  "A4 Copier Paper (500 sheets)": "/images/a4-paper.jpg",
  "Wireless Optical Mouse":
    "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500",
  "A5 Executive Notebook":
    "https://images.unsplash.com/photo-1517842645767-c639042777db?w=500",
  "USB Keyboard":
    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500",
  "Packaging Tape 48mm":
    "https://equalityventas.cl/cdn/shop/files/CINTAEMBALAJETRANSPARENTE1X180MT_grande.png?v=1715186568",
};

function CancellationRequests({ flash, setError }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await api("/orders/cancellation-requests");
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function reviewRequest(id, action) {
    const reviewNote = window.prompt(
      `Enter review note for ${action} (optional):`,
    );

    if (reviewNote === null) return;

    if (
      !window.confirm(
        `Are you sure you want to ${action} this cancellation request?`,
      )
    )
      return;

    setProcessing(id);

    try {
      await api(`/orders/cancellation-requests/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          reviewNote: reviewNote.trim(),
        }),
      });

      flash(`Cancellation request ${action} successfully.`);
      await loadRequests();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <section className="content-card">
      <div className="section-head">
        <div>
          <h3>Cancellation Requests</h3>
          <p>Review and manage customer cancellation requests</p>
        </div>

        <button className="secondary" onClick={loadRequests}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading cancellation requests...</p>
      ) : requests.length === 0 ? (
        <div className="empty">No cancellation requests found.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ORDER</th>
                <th>CUSTOMER</th>
                <th>AMOUNT</th>
                <th>REASON</th>
                <th>REQUESTED</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((r) => (
                <tr key={r.request_id}>
                  <td>
                    <b>{r.order_number}</b>
                  </td>

                  <td>
                    <b>{r.customer_name}</b>
                    <br />
                    <small>{r.customer_email}</small>
                  </td>

                  <td>{money(r.total_amount)}</td>

                  <td>{r.reason}</td>

                  <td>
                    {r.requested_at
                      ? new Date(r.requested_at).toLocaleDateString("en-IN")
                      : "—"}
                  </td>

                  <td>
                    <span className={`badge ${r.request_status}`}>
                      {r.request_status}
                    </span>
                  </td>

                  <td>
                    {r.request_status === "pending" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="primary"
                          disabled={processing === r.request_id}
                          onClick={() =>
                            reviewRequest(r.request_id, "approved")
                          }
                        >
                          Approve
                        </button>

                        <button
                          className="secondary"
                          disabled={processing === r.request_id}
                          onClick={() =>
                            reviewRequest(r.request_id, "rejected")
                          }
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span>{r.review_note || "Reviewed"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CustomersPanel({ flash, setError }) {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    total_customers: 0,
    active_customers: 0,
    inactive_customers: 0,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const data = await api("/customers/analytics");
      setAnalytics(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (status !== "all") params.set("status", status);

      const data = await api(`/customers?${params.toString()}`);
      setCustomers(data.customers || []);
      setStats(data.stats || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 250);
    return () => clearTimeout(timer);
  }, [search, status]);

  async function openCustomer(id) {
    setSelected(id);
    setDetails(null);
    setDetailLoading(true);
    try {
      const data = await api(`/customers/${id}`);
      setDetails(data);
    } catch (e) {
      setError(e.message);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleStatus(customer) {
    const next = !Boolean(customer.is_active);
    const action = next ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${customer.name}'s account?`,
      )
    )
      return;

    try {
      await api(`/customers/${customer.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      flash(
        `Customer account ${next ? "activated" : "deactivated"} successfully`,
      );
      await loadCustomers();

      if (selected === customer.id) {
        const data = await api(`/customers/${customer.id}`);
        setDetails(data);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  const money = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  return (
    <>
      <section className="customer-stats">
        <div className="customer-stat-card">
          <span>Total Customers</span>
          <strong>
            {analyticsLoading
              ? "..."
              : (analytics?.summary?.total_customers ?? 0)}
          </strong>
          <small>Registered accounts</small>
        </div>

        <div className="customer-stat-card">
          <span>Total Purchases</span>
          <strong>
            {analyticsLoading
              ? "..."
              : money(analytics?.summary?.total_purchases)}
          </strong>
          <small>Excluding cancelled orders</small>
        </div>

        <div className="customer-stat-card">
          <span>Average Order Value</span>
          <strong>
            {analyticsLoading
              ? "..."
              : money(analytics?.summary?.average_order_value)}
          </strong>
          <small>Per completed order</small>
        </div>

        <div className="customer-stat-card">
          <span>Repeat Customers</span>
          <strong>
            {analyticsLoading
              ? "..."
              : `${analytics?.summary?.repeat_percentage ?? 0}%`}
          </strong>
          <small>Customers with 2+ orders</small>
        </div>
      </section>

      <section className="content-card customer-directory">
        <div className="section-head">
          <div>
            <h3>Monthly Customer Purchases</h3>
            <p>Purchase performance over the last 6 months</p>
          </div>
        </div>

        {analyticsLoading ? (
          <p>Loading analytics...</p>
        ) : (
          <div className="customer-chart">
            {(analytics?.monthlyPurchases || []).map((item) => {
              const maxSales = Math.max(
                1,
                ...analytics.monthlyPurchases.map((x) => Number(x.sales)),
              );
              const height = (Number(item.sales) / maxSales) * 100;

              return (
                <div className="customer-chart-column" key={item.month_key}>
                  <strong>{money(item.sales)}</strong>
                  <div className="customer-chart-track">
                    <div
                      className="customer-chart-bar"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <small>{item.month}</small>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="content-card customer-directory">
        <div className="section-head">
          <div>
            <h3>Top 5 Customers</h3>
            <p>Ranked by total purchase value</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>COMPANY</th>
                <th>ORDERS</th>
                <th>TOTAL PURCHASES</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.topCustomers || []).map((customer, index) => (
                <tr key={customer.id}>
                  <td>
                    <b>
                      #{index + 1} {customer.name}
                    </b>
                  </td>
                  <td>{customer.company_name || "—"}</td>
                  <td>{customer.total_orders}</td>
                  <td>
                    <b>{money(customer.total_purchases)}</b>
                  </td>
                </tr>
              ))}
              {!analyticsLoading && !analytics?.topCustomers?.length && (
                <tr>
                  <td colSpan="4">No purchase data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card customer-directory">
        <div className="section-head">
          <div>
            <h3>Customer directory</h3>
            <p>Manage customer accounts and view their purchase activity</p>
          </div>
          <button className="secondary" onClick={loadCustomers}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="customer-toolbar">
          <label className="search customer-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or company..."
            />
          </label>

          <select
            className="customer-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All customers</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="customer-table">
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>COMPANY</th>
                <th>ORDERS</th>
                <th>TOTAL PURCHASES</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6">Loading customers...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="6">No customers found.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-identity">
                        <div className="customer-avatar">
                          {customer.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <b>{customer.name}</b>
                          <small>{customer.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{customer.company_name || "—"}</td>
                    <td>{customer.total_orders}</td>
                    <td>
                      <b>{money(customer.total_spent)}</b>
                    </td>
                    <td>
                      <span
                        className={`customer-status ${customer.is_active ? "active" : "inactive"}`}
                      >
                        {customer.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="customer-actions">
                        <button
                          className="customer-view-btn"
                          onClick={() => openCustomer(customer.id)}
                        >
                          View
                        </button>
                        <button
                          className={
                            customer.is_active
                              ? "customer-deactivate-btn"
                              : "customer-activate-btn"
                          }
                          onClick={() => toggleStatus(customer)}
                        >
                          {customer.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="customer-result-count">
          Showing {customers.length} customer{customers.length === 1 ? "" : "s"}
        </p>
      </section>

      {selected !== null && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="cart-modal customer-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <div>
                <h3>Customer details</h3>
                <p>Profile and order history</p>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            {detailLoading || !details ? (
              <p>Loading customer details...</p>
            ) : (
              <>
                <div className="customer-detail-profile">
                  <div className="customer-avatar large">
                    {details.customer.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3>{details.customer.name}</h3>
                    <p>{details.customer.company_name || "No company added"}</p>
                    <span
                      className={`customer-status ${details.customer.is_active ? "active" : "inactive"}`}
                    >
                      {details.customer.is_active
                        ? "Active account"
                        : "Inactive account"}
                    </span>
                  </div>
                </div>

                <div className="customer-detail-grid">
                  <div>
                    <small>Email</small>
                    <b>{details.customer.email}</b>
                  </div>
                  <div>
                    <small>Mobile</small>
                    <b>{details.customer.mobile || "Not provided"}</b>
                  </div>
                  <div>
                    <small>Total orders</small>
                    <b>{details.totals.total_orders}</b>
                  </div>
                  <div>
                    <small>Total purchases</small>
                    <b>{money(details.totals.total_spent)}</b>
                  </div>
                  <div className="full-detail">
                    <small>Address</small>
                    <b>{details.customer.address || "Not provided"}</b>
                  </div>
                </div>

                <div className="customer-history">
                  <h4>Order history</h4>
                  {details.orders.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>ORDER</th>
                            <th>DATE</th>
                            <th>STATUS</th>
                            <th>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.orders.map((order) => (
                            <tr key={order.id}>
                              <td>
                                <b>{order.order_number}</b>
                              </td>
                              <td>
                                {order.created_at
                                  ? new Date(
                                      order.created_at,
                                    ).toLocaleDateString("en-IN")
                                  : "—"}
                              </td>
                              <td>
                                <span className={`badge ${order.status}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td>
                                <b>{money(order.total_amount)}</b>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty">
                      This customer has not placed any orders yet.
                    </p>
                  )}
                </div>

                <button
                  className={
                    details.customer.is_active
                      ? "customer-deactivate-btn"
                      : "customer-activate-btn"
                  }
                  onClick={() => toggleStatus(details.customer)}
                >
                  {details.customer.is_active
                    ? "Deactivate account"
                    : "Activate account"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  const [user, setUser] = useState(null),
    [token, setToken] = useState(localStorage.getItem("b2b_token")),
    [view, setView] = useState(
      sessionStorage.getItem("b2b_view") || "overview",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [summary, setSummary] = useState(null),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [q, setQ] = useState(""),
    [cart, setCart] = useState([]),
    [modal, setModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [profile, setProfile] = useState({
    name: "",
    companyName: "",
    email: "",
    mobile: "",
    address: "",
  });
  async function openOrder(id) {
    try {
      setError("");
      const data = await api(`/orders/${id}`);
      setSelectedOrder(id);
      setOrderDetails(data);
    } catch (e) {
      setError(e.message);
    }
  }
  async function handleDownloadInvoice(orderId) {
    try {
      setError("");
      await downloadInvoice(orderId);
      flash("Invoice downloaded successfully!");
    } catch (e) {
      setError(e.message);
    }
  }
  const flash = (m) => {
    setNotice(m);
    setTimeout(() => setNotice(""), 3000);
  };
  useEffect(() => {
    sessionStorage.setItem("b2b_view", view);
  }, [view]);

  useEffect(() => {
    if (!user) return;

    const allowedViews =
      user.role === "admin"
        ? [
            "overview",
            "products",
            "orders",
            "cancellations",
            "customers",
            "activity",
          ]
        : ["overview", "catalog", "orders", "profile"];

    if (!allowedViews.includes(view)) {
      setView("overview");
    }
  }, [user, view]);

  async function load() {
    if (!token) return;

    setBusy(true);
    setError("");

    try {
      // Step 1: Verify login session
      const me = await api("/auth/me");
      setUser(me.user);

      // Step 2: Load dashboard data separately
      try {
        if (me.user.role === "admin") {
          const s = await api("/dashboard/summary");
          setSummary(s);

          const p = await api("/products/admin/all");
          setProducts(p.products);
        } else {
          const p = await api("/products");
          setProducts(p.products);
        }

        const o = await api("/orders");
        setOrders(o.orders);
      } catch (e) {
        setError("Dashboard data loading failed: " + e.message);
      }
    } catch (e) {
      // Only remove token if authentication fails
      setError(e.message);
      localStorage.removeItem("b2b_token");
      setToken(null);
      setUser(null);
    } finally {
      setBusy(false);
    }
  }

  async function loadProfile() {
    try {
      const data = await api("/auth/profile");

      setProfile({
        name: data.user.name || "",
        companyName: data.user.company_name || "",
        email: data.user.email || "",
        mobile: data.user.mobile || "",
        address: data.user.address || "",
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function updateProfile(e) {
    e.preventDefault();
    setError("");

    try {
      const data = await api("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          companyName: profile.companyName,
          mobile: profile.mobile,
          address: profile.address,
        }),
      });

      setProfile({
        name: data.user.name || "",
        companyName: data.user.company_name || "",
        email: data.user.email || "",
        mobile: data.user.mobile || "",
        address: data.user.address || "",
      });

      setUser(data.user);
      flash("Profile updated successfully!");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [token]);
  async function login(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const d = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      localStorage.setItem("b2b_token", d.token);
      setToken(d.token);
      setUser(d.user);
    } catch (e) {
      setError(e.message);
    }
  }
  async function register(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const d = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          companyName: f.get("company"),
        }),
      });
      localStorage.setItem("b2b_token", d.token);
      setToken(d.token);
      setUser(d.user);
    } catch (e) {
      setError(e.message);
    }
  }
  function logout() {
    localStorage.removeItem("b2b_token");
    setToken(null);
    setUser(null);
    setCart([]);
    setView("overview");
  }

  async function placeOrder() {
    try {
      const profileData = await api("/auth/profile");
      const savedProfile = profileData.user;

      const shippingAddress = prompt(
        "Enter complete shipping address (minimum 10 characters):",
        savedProfile.address || "",
      );

      if (!shippingAddress || shippingAddress.trim().length < 10) {
        setError("Please enter a complete shipping address.");
        return;
      }

      const shippingMobile = prompt(
        "Enter your 10-digit mobile number:",
        savedProfile.mobile || "",
      );

      if (!shippingMobile || !/^[0-9]{10}$/.test(shippingMobile.trim())) {
        setError("Please enter a valid 10-digit mobile number.");
        return;
      }

      const d = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.id,
            quantity: i.qty,
          })),
          shippingAddress: shippingAddress.trim(),
          shippingMobile: shippingMobile.trim(),
        }),
      });

      setCart([]);
      flash(`Order ${d.orderNumber} placed`);
      setView("orders");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function changeStatus(id, status) {
    try {
      await api(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      flash("Order status updated");
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function requestCancellation(id) {
    const reason = window.prompt(
      "Please enter cancellation reason (minimum 5 characters):",
    );

    if (reason === null) return;

    if (reason.trim().length < 5) {
      setError("Cancellation reason must be at least 5 characters.");
      return;
    }

    try {
      await api(`/orders/${id}/cancellation-request`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      flash("Cancellation request submitted successfully.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  const filtered = useMemo(
    () =>
      products.filter((p) =>
        `${p.name} ${p.sku} ${p.category}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [products, q],
  );
  if (!user)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-mark">N</div>
          <p className="eyebrow">NORTHSTAR COMMERCE</p>
          <h1>
            Business ordering,
            <br />
            <span>without the friction.</span>
          </h1>
          <p className="muted">
            A unified workspace for orders, inventory and customer operations.
          </p>
          <div className="auth-tabs">
            <button className="active">Sign in</button>
            <button
              onClick={() =>
                document
                  .getElementById("register")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              Create account
            </button>
          </div>
          <form onSubmit={login} className="form">
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="Enter your email address"
                required
                defaultValue=""
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="Enter password"
                required
                defaultValue=""
              />
            </label>
            <button className="primary full">
              Sign in to workspace <ArrowUpRight size={16} />
            </button>
          </form>
          
          <form
            id="register"
            onSubmit={register}
            className="form register-form"
          >
            <h3>New customer account</h3>
            <label>
              Full name
              <input name="name" placeholder="Your name" required />
            </label>
            <label>
              Company
              <input name="company" placeholder="Company name" />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength="8"
                placeholder="At least 8 characters"
                required
              />
            </label>
            <button className="secondary full">Create customer account</button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
        <div className="auth-side">
          <div className="side-content">
            <span className="pill">B2B OPERATIONS PLATFORM</span>
            <h2>
              One clear view
              <br />
              of your business.
            </h2>
            <p>
              From first order to final delivery, keep every moving part
              connected.
            </p>
            <div className="side-stats">
              <div>
                <strong>24/7</strong>
                <small>Order visibility</small>
              </div>
              <div>
                <strong>100%</strong>
                <small>Traceable activity</small>
              </div>
              <div>
                <strong>1</strong>
                <small>Connected workspace</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  const admin = user.role === "admin";
  const nav = admin
    ? [
        ["overview", "Overview", TrendingUp],
        ["products", "Products", Package],
        ["orders", "Orders", ClipboardList],
        ["cancellations", "Cancellation Requests", ClipboardList],
        ["customers", "Customers", Users],
        ["activity", "Activity log", ShieldCheck],
      ]
    : [
        ["overview", "Overview", TrendingUp],
        ["catalog", "Product catalogue", Boxes],
        ["orders", "My orders", ClipboardList],
        ["profile", "My Profile", Users],
      ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="brand-mark small">N</div>
          <div>
            <b>northstar</b>
            <small>COMMERCE SUITE</small>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? "selected" : ""}
              onClick={() => {
                setView(id);
                if (id === "profile") loadProfile();
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{user.name?.[0]}</div>
            <div>
              <b>{user.name}</b>
              <small>{admin ? "Administrator" : "Customer"}</small>
            </div>
          </div>
          <button className="logout" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {admin ? "ADMINISTRATION" : "CUSTOMER PORTAL"}
            </p>
            <h2>
              {view === "overview"
                ? "Overview"
                : view === "catalog"
                  ? "Product catalogue"
                  : view === "products"
                    ? "Product management"
                    : view === "orders"
                      ? "Orders"
                      : view === "cancellations"
                        ? "Cancellation Requests"
                        : view === "customers"
                          ? "Customer Management"
                          : view === "profile"
                            ? "My Profile"
                            : "Activity log"}
            </h2>
          </div>
          <div className="top-actions">
            <span className="status-dot">System operational</span>
            {!admin && (
              <button className="cart-button" onClick={() => setModal(true)}>
                <ShoppingCart size={17} /> Cart{" "}
                <b>{cart.reduce((a, b) => a + b.qty, 0)}</b>
              </button>
            )}
            <button className="icon-button" onClick={load} title="Refresh">
              <RefreshCw size={17} />
            </button>
            <div className="avatar">{user.name?.[0]}</div>
          </div>
        </header>
        {error && (
          <div className="alert">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {notice && <div className="notice">{notice}</div>}

        {view === "overview" && (
          <>
            {admin ? (
              <>
                <section className="welcome">
                  <div>
                    <p className="eyebrow light">OPERATIONS SNAPSHOT</p>
                    <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
                    <p>Here's what's happening across your business today.</p>
                  </div>
                  <span className="pill light-pill">LIVE WORKSPACE</span>
                </section>

                <OrderAnalytics orders={orders} admin={true} />
                <section className="metric-grid">
                  {[
                    [
                      "Total revenue",
                      money(summary?.revenue),
                      "Across non-cancelled orders",
                      TrendingUp,
                    ],
                    [
                      "Total orders",
                      summary?.totalOrders ?? "—",
                      "All order statuses",
                      ClipboardList,
                    ],
                    [
                      "Customers",
                      summary?.totalCustomers ?? "—",
                      "Active customer accounts",
                      Users,
                    ],
                    [
                      "Low stock items",
                      summary?.low_stock ?? "—",
                      "At or below reorder level",
                      AlertTriangle,
                    ],
                  ].map(([t, v, s, I]) => (
                    <div className="metric" key={t}>
                      <div className="metric-head">
                        <span>{t}</span>
                        <I size={18} />
                      </div>
                      <strong>{v}</strong>
                      <small>{s}</small>
                    </div>
                  ))}
                </section>

                <section className="content-card">
                  <div className="section-head">
                    <div>
                      <h3>Recent orders</h3>
                      <p>Latest customer activity across your store</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("orders")}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <OrderTable
                    orders={summary?.recentOrders || []}
                    admin={admin}
                    onStatus={changeStatus}
                    onSelect={openOrder}
                    onCancel={requestCancellation}
                  />
                </section>

                <section className="content-card">
                  <div className="section-head">
                    <div>
                      <h3>Inventory health</h3>
                      <p>Quick view of stock availability</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("products")}
                    >
                      Manage inventory <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="inventory-strip">
                    <div>
                      <Package />
                      <b>{summary?.total_products ?? 0}</b>
                      <span>Active products</span>
                    </div>
                    <div>
                      <Boxes />
                      <b>{summary?.units_in_stock ?? 0}</b>
                      <span>Units in stock</span>
                    </div>
                    <div>
                      <AlertTriangle />
                      <b>{summary?.low_stock ?? 0}</b>
                      <span>Need attention</span>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="welcome customer-welcome">
                  <div>
                    <p className="eyebrow light">YOUR BUSINESS WORKSPACE</p>
                    <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
                    <p>
                      Manage your purchases, explore products and track your
                      orders.
                    </p>
                  </div>
                  <span className="pill light-pill">CUSTOMER PORTAL</span>
                </section>

                <OrderAnalytics orders={orders} admin={false} />
                <section className="metric-grid">
                  {[
                    [
                      "Total orders",
                      orders.length,
                      "Orders placed by you",
                      ClipboardList,
                    ],
                    [
                      "Total purchases",
                      money(
                        orders
                          .filter((o) => o.status !== "cancelled")
                          .reduce(
                            (sum, o) => sum + Number(o.total_amount || 0),
                            0,
                          ),
                      ),
                      "Excluding cancelled orders",
                      TrendingUp,
                    ],
                    [
                      "In progress",
                      orders.filter((o) =>
                        ["confirmed", "processing", "shipped"].includes(
                          o.status,
                        ),
                      ).length,
                      "Orders being processed",
                      Package,
                    ],
                    [
                      "Pending orders",
                      orders.filter((o) => o.status === "pending").length,
                      "Awaiting confirmation",
                      AlertTriangle,
                    ],
                  ].map(([t, v, s, I]) => (
                    <div className="metric" key={t}>
                      <div className="metric-head">
                        <span>{t}</span>
                        <I size={18} />
                      </div>
                      <strong>{v}</strong>
                      <small>{s}</small>
                    </div>
                  ))}
                </section>

                <section className="content-card customer-actions">
                  <div className="section-head">
                    <div>
                      <h3>Quick actions</h3>
                      <p>Everything you need, just one click away</p>
                    </div>
                  </div>

                  <div className="customer-action-grid">
                    <button onClick={() => setView("catalog")}>
                      <span className="customer-action-icon">
                        <Boxes size={22} />
                      </span>
                      <b>Explore products</b>
                      <small>Browse the product catalogue</small>
                      <ArrowUpRight size={17} />
                    </button>

                    <button onClick={() => setView("orders")}>
                      <span className="customer-action-icon">
                        <ClipboardList size={22} />
                      </span>
                      <b>Track your orders</b>
                      <small>Check order status and history</small>
                      <ArrowUpRight size={17} />
                    </button>

                    <button onClick={() => setModal(true)}>
                      <span className="customer-action-icon">
                        <ShoppingCart size={22} />
                      </span>
                      <b>Open shopping cart</b>
                      <small>Review your selected products</small>
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </section>

                <section className="content-card">
                  <div className="section-head">
                    <div>
                      <h3>Recent orders</h3>
                      <p>Your latest purchase activity</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("orders")}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>

                  <OrderTable
                    orders={orders.slice(0, 5)}
                    admin={false}
                    onSelect={openOrder}
                    onCancel={requestCancellation}
                  />
                </section>
              </>
            )}
          </>
        )}

        {(view === "catalog" || view === "products") && (
          <section className="content-card">
            <div className="section-head">
              <div>
                <h3>{admin ? "Product inventory" : "Browse products"}</h3>
                <p>
                  {admin
                    ? "Manage product details and stock levels"
                    : "Find products and add them to your order"}
                </p>
              </div>
              <div className="search">
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search products or SKU"
                />
              </div>
            </div>
            <div className="product-grid">
              {filtered.map((p) => (
                <article className="product-card" key={p.id}>
                  <div className="product-art">
                    <img
                      src={productImages[p.name]}
                      alt={p.name}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span>{p.category}</span>
                  </div>
                  <div className="product-info">
                    <small>{p.sku}</small>
                    <h4>{p.name}</h4>
                    <p>
                      {p.description ||
                        "Reliable supply for your business operations."}
                    </p>
                    <div className="product-bottom">
                      <strong>{money(p.price)}</strong>
                      <span
                        className={
                          p.stock_quantity <= p.reorder_level
                            ? "low-stock"
                            : "in-stock"
                        }
                      >
                        {p.stock_quantity} in stock
                      </span>
                    </div>
                    {admin ? (
                      <div className="stock-actions">
                        <button
                          className="secondary"
                          onClick={async () => {
                            const n = prompt(
                              "Enter stock adjustment (+/-):",
                              "10",
                            );
                            if (n !== null) {
                              try {
                                await api(`/products/${p.id}/stock`, {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    adjustment: Number(n),
                                    reason: "Admin inventory adjustment",
                                  }),
                                });
                                flash("Stock updated");
                                load();
                              } catch (e) {
                                setError(e.message);
                              }
                            }
                          }}
                        >
                          Adjust stock
                        </button>
                      </div>
                    ) : (
                      <button
                        className="primary full"
                        disabled={p.stock_quantity < 1}
                        onClick={() =>
                          setCart((c) => {
                            const old = c.find((x) => x.id === p.id);
                            return old
                              ? c.map((x) =>
                                  x.id === p.id
                                    ? {
                                        ...x,
                                        qty: Math.min(
                                          x.qty + 1,
                                          p.stock_quantity,
                                        ),
                                      }
                                    : x,
                                )
                              : [...c, { ...p, qty: 1 }];
                          })
                        }
                      >
                        <Plus size={16} /> Add to order
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="empty">
                No products found. Try another search.
              </div>
            )}
          </section>
        )}
        {view === "orders" && (
          <section className="content-card">
            <div className="section-head">
              <div>
                <h3>{admin ? "All customer orders" : "Your orders"}</h3>
                <p>Track fulfilment status and order value</p>
              </div>
            </div>
            <OrderTable
              orders={orders}
              admin={admin}
              onStatus={changeStatus}
              onSelect={openOrder}
              onCancel={requestCancellation}
            />
          </section>
        )}
        {view === "cancellations" && admin && (
          <CancellationRequests flash={flash} setError={setError} />
        )}
        {view === "customers" && admin && (
          <CustomersPanel flash={flash} setError={setError} />
        )}
        {view === "profile" && (
          <div className="content-card">
            <h2>My Profile</h2>
            <p>View and update your personal information.</p>

            <form onSubmit={updateProfile} className="form">
              <label>Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                required
              />

              <label>Email Address</label>
              <input type="email" value={profile.email} disabled />

              <label>Company Name</label>
              <input
                type="text"
                value={profile.companyName}
                onChange={(e) =>
                  setProfile({ ...profile, companyName: e.target.value })
                }
              />

              <label>Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                value={profile.mobile}
                onChange={(e) =>
                  setProfile({ ...profile, mobile: e.target.value })
                }
                placeholder="Enter 10-digit mobile number"
              />

              <label>Delivery Address</label>
              <textarea
                rows={3}
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
                placeholder="Enter your delivery address"
              />

              <button type="submit" className="primary">
                Save Changes
              </button>
            </form>
          </div>
        )}
        {view === "activity" && <ActivityLog />}
        <footer>
          Northstar Commerce Suite{" "}
          <span>Built for transparent B2B operations · Demo environment</span>
        </footer>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="cart-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <div>
                <h3>Your order cart</h3>
                <p>Review quantities before checkout</p>
              </div>
              <button className="icon-button" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            {cart.length ? (
              cart.map((i) => (
                <div className="cart-line" key={i.id}>
                  <div>
                    <b>{i.name}</b>
                    <small>{money(i.price)} each</small>
                  </div>
                  <div className="qty">
                    <button
                      onClick={() =>
                        setCart((c) =>
                          c.map((x) =>
                            x.id === i.id
                              ? { ...x, qty: Math.max(1, x.qty - 1) }
                              : x,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    {i.qty}
                    <button
                      onClick={() =>
                        setCart((c) =>
                          c.map((x) =>
                            x.id === i.id
                              ? {
                                  ...x,
                                  qty: Math.min(i.stock_quantity, x.qty + 1),
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  <b>{money(i.price * i.qty)}</b>
                </div>
              ))
            ) : (
              <div className="empty">Your cart is empty.</div>
            )}
            <div className="cart-total">
              <span>Subtotal (excl. tax)</span>
              <b>{money(cart.reduce((a, i) => a + i.price * i.qty, 0))}</b>
            </div>
            <div className="cart-total">
              <span>Estimated GST (18%)</span>
              <b>
                {money(cart.reduce((a, i) => a + i.price * i.qty, 0) * 0.18)}
              </b>
            </div>
            <button
              className="primary full"
              disabled={!cart.length}
              onClick={placeOrder}
            >
              Place order <ArrowUpRight size={16} />
            </button>
            <p className="tiny-note">
              Demo checkout: update the shipping address in the order form
              before production use.
            </p>
          </div>
        </div>
      )}

      {orderDetails && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setOrderDetails(null);
            setSelectedOrder(null);
          }}
        >
          <div
            className="cart-modal order-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <div>
                <h3>Order Details</h3>
                <p>{orderDetails.order.order_number}</p>
              </div>

              <button
                className="icon-button"
                onClick={() => {
                  setOrderDetails(null);
                  setSelectedOrder(null);
                }}
              >
                <X />
              </button>
            </div>

            <div className="order-detail-info">
              <p>
                <b>Order Status:</b>{" "}
                <span className={`badge ${orderDetails.order.status}`}>
                  {orderDetails.order.status}
                </span>
              </p>

              <p>
                <b>Order Date:</b>{" "}
                {new Date(orderDetails.order.created_at).toLocaleDateString(
                  "en-IN",
                )}
              </p>

              <p>
                <b>Delivery Address:</b>{" "}
                {orderDetails.order.shipping_address || "Not available"}
              </p>

              <p>
                <b>Mobile Number:</b>{" "}
                {orderDetails.order.shipping_mobile || "Not available"}
              </p>
            </div>

            <div className="order-detail-tracking">
              <h4>Order Tracking History</h4>

              {(() => {
                const steps = [
                  "pending",
                  "confirmed",
                  "processing",
                  "shipped",
                  "delivered",
                ];

                const history = orderDetails.history || [];

                return (
                  <>
                    <div className="tracking-history-list">
                      {steps.map((step, index) => {
                        const entry = history.find((h) => h.status === step);

                        return (
                          <div
                            key={step}
                            className={`tracking-history-item ${
                              entry ? "completed" : ""
                            }`}
                          >
                            <div className="history-marker">
                              {entry ? "✓" : index + 1}
                            </div>

                            <div className="history-content">
                              <b>
                                {step.charAt(0).toUpperCase() + step.slice(1)}
                              </b>

                              {entry ? (
                                <>
                                  <small>
                                    {new Date(entry.created_at).toLocaleString(
                                      "en-IN",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </small>

                                  <small>
                                    Updated by:{" "}
                                    {entry.changed_by_name || "System"}
                                  </small>
                                </>
                              ) : (
                                <small>Waiting for this stage</small>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {history
                        .filter((h) => h.status === "cancelled")
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="tracking-history-item cancelled-history"
                          >
                            <div className="history-marker">!</div>

                            <div className="history-content">
                              <b>Order Cancelled</b>
                              <small>
                                {new Date(entry.created_at).toLocaleString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </small>
                              <small>
                                Updated by: {entry.changed_by_name || "System"}
                              </small>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                );
              })()}
            </div>

            <h4>Ordered Products</h4>

            {orderDetails.items.map((item) => (
              <div className="cart-line" key={item.id}>
                <b>{item.product_name}</b>
                <span>
                  Qty: {item.quantity} × {money(item.unit_price)}
                </span>
                <b>{money(item.line_total)}</b>
              </div>
            ))}

            <div className="cart-total">
              <span>Total Amount</span>
              <b>{money(orderDetails.order.total_amount)}</b>
            </div>
            <button
              className="primary full"
              onClick={() => handleDownloadInvoice(orderDetails.order.id)}
            >
              <FileText size={16} /> Download Invoice PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderAnalytics({ orders = [], admin }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - i));

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      amount: 0,
      count: 0,
    };
  });

  const monthMap = new Map(months.map((m) => [m.key, m]));

  orders.forEach((order) => {
    const date = new Date(order.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const month = monthMap.get(key);

    if (month && order.status !== "cancelled") {
      month.amount += Number(order.total_amount || 0);
      month.count += 1;
    }
  });

  const maxAmount = Math.max(...months.map((m) => m.amount), 1);
  const totalAmount = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const statuses = [
    { name: "Pending", key: "pending", color: "#f5bd58" },
    { name: "Confirmed", key: "confirmed", color: "#8b9fff" },
    { name: "Processing", key: "processing", color: "#5d9cff" },
    { name: "Shipped", key: "shipped", color: "#b18cff" },
    { name: "Delivered", key: "delivered", color: "#36d6a0" },
    { name: "Cancelled", key: "cancelled", color: "#fb7185" },
  ];

  const statusCounts = statuses.map((s) => ({
    ...s,
    count: orders.filter((o) => o.status === s.key).length,
  }));

  const total = orders.length || 1;
  let offset = 0;
  const gradient = statusCounts
    .map((s) => {
      const start = offset;
      offset += (s.count / total) * 100;
      return `${s.color} ${start}% ${offset}%`;
    })
    .join(", ");

  return (
    <section className="analytics-grid">
      <div className="content-card analytics-card">
        <div className="section-head">
          <div>
            <h3>{admin ? "Revenue analytics" : "Purchase analytics"}</h3>
            <p>Monthly order value · Last 6 months</p>
          </div>
          <span className="analytics-period">6 MONTHS</span>
        </div>

        <div className="chart-total">
          <strong>{money(totalAmount)}</strong>
          <small>
            {orders.filter((o) => o.status !== "cancelled").length} active
            orders
          </small>
        </div>

        <div className="bar-chart">
          {months.map((m) => (
            <div className="bar-column" key={m.key}>
              <div className="bar-value">
                {m.amount > 0 ? money(m.amount) : ""}
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    height: `${Math.max((m.amount / maxAmount) * 100, m.amount ? 5 : 0)}%`,
                  }}
                  title={`${m.label}: ${money(m.amount)}`}
                />
              </div>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="content-card analytics-card">
        <div className="section-head">
          <div>
            <h3>Order distribution</h3>
            <p>Breakdown by current status</p>
          </div>
        </div>

        <div className="distribution-layout">
          <div
            className="donut-chart"
            style={{
              background: `conic-gradient(${gradient})`,
            }}
          >
            <div className="donut-center">
              <strong>{orders.length}</strong>
              <small>Total orders</small>
            </div>
          </div>

          <div className="distribution-legend">
            {statusCounts.map((s) => (
              <div className="legend-row" key={s.key}>
                <span>
                  <i style={{ background: s.color }} />
                  {s.name}
                </span>
                <b>{s.count}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrderTable({ orders, admin, onStatus, onSelect, onCancel }) {
  const [trackingOrder, setTrackingOrder] = React.useState(null);

  const trackingSteps = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
  ];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ORDER</th>
            {admin && <th>CUSTOMER</th>}
            {admin && <th>MOBILE</th>}
            <th>DATE</th>
            <th>AMOUNT</th>
            <th>STATUS</th>
            {!admin && <th>TRACK</th>}
            {admin && <th>UPDATE</th>}
          </tr>
        </thead>

        <tbody>
          {orders.map((o) => (
            <React.Fragment key={o.id}>
              <tr>
                <td>
                  <button
                    type="button"
                    className="order-link"
                    onClick={() => onSelect(o.id)}
                  >
                    {o.order_number}
                  </button>
                </td>

                {admin && <td>{o.customer_name}</td>}
                {admin && <td>{o.shipping_mobile || "N/A"}</td>}

                <td>{new Date(o.created_at).toLocaleDateString("en-IN")}</td>

                <td>{money(o.total_amount)}</td>

                <td>
                  <span className={`badge ${o.status}`}>{o.status}</span>
                </td>

                {!admin && (
                  <td>
                    <div
                      style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                    >
                      {o.status === "cancelled" ? (
                        <span className="badge cancelled">Cancelled</span>
                      ) : (
                        <button
                          type="button"
                          className="track-btn"
                          onClick={() =>
                            setTrackingOrder(
                              trackingOrder === o.id ? null : o.id,
                            )
                          }
                        >
                          {trackingOrder === o.id ? "Hide" : "Track Order"}
                        </button>
                      )}

                      {["pending", "confirmed"].includes(o.status) && (
                        <button
                          type="button"
                          className="track-btn"
                          onClick={() => onCancel(o.id)}
                        >
                          Request Cancellation
                        </button>
                      )}
                    </div>
                  </td>
                )}

                {admin && (
                  <td>
                    <select
                      value={o.status}
                      disabled={["cancelled", "delivered"].includes(o.status)}
                      onChange={(e) => onStatus(o.id, e.target.value)}
                    >
                      <option value={o.status}>{o.status}</option>

                      {["confirmed", "processing", "shipped", "delivered"]
                        .filter((s) => s !== o.status)
                        .map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                    </select>
                  </td>
                )}
              </tr>

              {!admin && trackingOrder === o.id && (
                <tr>
                  <td colSpan={5}>
                    <div className="tracking-panel">
                      {o.status === "cancelled" ? (
                        <p>This order has been cancelled.</p>
                      ) : (
                        <div className="tracking-steps">
                          {trackingSteps.map((step, index) => {
                            const currentIndex = trackingSteps.indexOf(
                              o.status,
                            );

                            const completed = currentIndex >= index;

                            return (
                              <div
                                key={step}
                                className={`tracking-step ${
                                  completed ? "completed" : ""
                                }`}
                              >
                                <span>{completed ? "✓" : index + 1}</span>
                                <p>{step}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}

          {!orders.length && (
            <tr>
              <td colSpan={admin ? 7 : 5}>
                <div className="empty">
                  No orders yet. Orders will appear here when customers check
                  out.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActivityLog() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api("/dashboard/activity")
      .then((d) => setRows(d.activities))
      .catch(() => {});
  }, []);
  return (
    <section className="content-card">
      <div className="section-head">
        <div>
          <h3>Audit trail</h3>
          <p>Recent actions recorded for accountability</p>
        </div>
      </div>
      <div className="activity-list">
        {rows.map((a) => (
          <div className="activity-row" key={a.id}>
            <div className="activity-icon">
              <ShieldCheck size={17} />
            </div>
            <div>
              <b>{a.action.replaceAll("_", " ")}</b>
              <small>
                {a.user_name || "System"} · {a.entity_type}{" "}
                {a.entity_id ? `#${a.entity_id}` : ""}
              </small>
            </div>
            <time>{new Date(a.created_at).toLocaleString("en-IN")}</time>
          </div>
        ))}
        {!rows.length && <div className="empty">No activity recorded yet.</div>}
      </div>
    </section>
  );
}
export default App;
