# Northstar Commerce — B2B Order Management Platform

A full-stack B2B Order Management Platform designed to simplify business purchasing, inventory management, order processing, and customer operations.

Built using React, Vite, Node.js, Express.js, and MySQL.

## Features

### Authentication & User Management
- JWT-based authentication
- Secure password hashing using bcrypt
- Role-based access control for Admin and Customers
- Customer registration and login
- Customer management

### Product & Inventory Management
- Product catalogue with search and category information
- Product and inventory management for administrators
- Stock adjustment and non-negative stock protection
- Automatic stock deduction during order placement

### Order Management
- Shopping cart and checkout
- Order placement with database transactions
- Order tracking and status management
- Order cancellation request workflow
- Admin approval and rejection of cancellation requests
- Stock restoration after approved cancellations

### Invoice & Refund Management
- Automatic invoice record creation
- Downloadable PDF invoices
- GST calculation (18% demo estimate)
- Refund record management and status updates

### Admin Dashboard
- Dashboard metrics and order summaries
- Low-stock visibility
- Recent orders
- Customer management
- Activity audit log

### Security & API
- RESTful API architecture
- Request validation using Zod
- Helmet security headers
- CORS configuration
- API rate limiting
- JWT-protected routes

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Styling | CSS, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MySQL |
| Authentication | JWT, bcrypt |
| Validation | Zod |
| PDF Generation | PDFKit |
| API Communication | Fetch API |

## Project Structure

```text
b2b-order-management/
│
├── backend/
│   ├── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── utils/
│   ├── .env.example
│   ├── package.json
│   └── seed.sql
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   └── package.json
│
├── .gitignore
├── README.md
├── package.json
└── package-lock.json
```

## Requirements

- Node.js 20 or later
- MySQL 8 or later
- npm
- Git

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/tausif0786/B2B-order-management-platform.git
cd B2B-order-management-platform
```

### 2. Configure MySQL Database

Open MySQL Workbench and execute:

```text
backend/migrations/001_init.sql
```

This initializes the database and required tables.

Next, execute:

```text
backend/seed.sql
```

This loads the sample product catalogue.

### 3. Configure Backend Environment

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env` and configure your database credentials and JWT secret.

### 4. Start Backend

```bash
npm run dev
```

Backend normally runs at:

```text
http://localhost:5000
```

### 5. Start Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite development URL:

```text
http://localhost:5173
```

## Environment Variables

Backend configuration is provided in `backend/.env.example`.

Important variables:

- PORT
- NODE_ENV
- CLIENT_ORIGIN
- DB_HOST
- DB_PORT
- DB_USER
- DB_PASSWORD
- DB_NAME
- JWT_SECRET
- JWT_EXPIRES_IN

For deployment, configure the frontend API URL using `VITE_API_URL`.

Never commit actual environment files, passwords, or production secrets.

## Main API Routes

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | /api/auth/register | Public | Customer registration |
| POST | /api/auth/login | Public | User login |
| GET | /api/auth/me | Authenticated | Current user |
| GET | /api/products | Public | Product catalogue |
| POST | /api/products | Admin | Create product |
| PUT | /api/products/:id | Admin | Update product |
| PATCH | /api/products/:id/stock | Admin | Adjust inventory |
| GET | /api/orders | Authenticated | Retrieve orders |
| POST | /api/orders | Customer | Place order |
| GET | /api/orders/:id/invoice | Authorized | Download PDF invoice |
| PATCH | /api/orders/:id/status | Admin | Update order status |
| GET | /api/dashboard/summary | Admin | Dashboard statistics |
| GET | /api/dashboard/activity | Admin | Activity audit log |

Additional customer cancellation and refund management routes are implemented in the application.

## Important Notes & Future Improvements

- Checkout currently uses a demo shipping-address prompt. A validated checkout form would improve the experience.
- GST is a configurable demo estimate of 18%. Verify applicable tax rules before commercial use.
- Automated API tests and frontend tests can improve reliability.
- Password reset and email verification can be added in future versions.
- Pagination and production deployment configuration can be further improved.
- Refund status management is provided; actual payment transfers are not performed by the demo application.

## Suggested Test Workflow

1. Sign in as an administrator and review the dashboard.
2. Register customer accounts.
3. Browse products and manage inventory.
4. Add products to the cart and place orders.
5. Verify stock deduction after order placement.
6. Update order statuses through the admin dashboard.
7. Submit and process cancellation requests.
8. Verify stock restoration after approved cancellations.
9. Download and verify PDF invoices.
10. Review customer orders and dashboard activity.

## Security Considerations

- Keep `.env` files out of version control.
- Use strong JWT secrets.
- Never publish passwords or private credentials.
- Use HTTPS and production environment variables when deploying.
- Do not use demo credentials for production accounts.

## Author

**Tausif Aman**

GitHub: https://github.com/tausif0786

---

*Northstar Commerce — Streamlining Business Ordering and Operations.*
