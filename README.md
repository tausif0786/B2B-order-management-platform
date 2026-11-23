# Northstar Commerce — B2B Order Management Platform

A portfolio-ready full-stack B2B distributor ordering application built for the Arrowstack Project 1 brief.

## Features
- JWT authentication, bcrypt password hashing and customer/admin roles
- Product catalogue, search, SKU/category data and admin inventory management
- Stock adjustment with non-negative stock protection
- Customer cart and order placement with database transactions and row-level stock locking
- GST estimate (18%), order lifecycle and automatic invoice record creation
- Admin dashboard metrics, low-stock visibility, recent orders and activity audit log
- REST API, request validation with Zod, Helmet security headers, CORS and rate limiting

## Stack and documented alternative
React + Vite frontend, Node.js + Express REST API, MySQL database, JWT/bcrypt authentication. The internship brief recommends PostgreSQL but explicitly permits reasonable alternatives when documented. MySQL is used here as an accessible relational database; the schema uses standard relational design, foreign keys, constraints and indexes.

## Requirements
- Node.js 20+
- MySQL 8+

## Setup
1. Create a MySQL database by running `backend/migrations/001_init.sql` in MySQL Workbench. The script creates `b2b_order_management` and its tables.
2. In `backend`, copy `.env.example` to `.env` and set your MySQL password plus a long random `JWT_SECRET`.
3. Create the demo admin account once. From the project root run:

```bash
cd backend
npm install
node --env-file=.env -e "import('mysql2/promise').then(async m=>{const bcrypt=(await import('bcryptjs')).default;const c=await m.createConnection({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'b2b_order_management'});const h=await bcrypt.hash('Admin@12345',12);await c.execute('INSERT INTO users(name,email,password_hash,role,company_name) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE role='admin'',['Northstar Admin','admin@northstar.demo',h,'admin','Northstar Distribution']);await c.end();console.log('Demo admin ready')})"
```

Also run `backend/seed.sql` in MySQL Workbench to load the sample product catalogue.

4. Start backend: `npm run dev` (from `backend`).
5. In a second terminal, start frontend: `cd frontend && npm install && npm run dev`.
6. Open the Vite URL, normally `http://localhost:5173`.

Demo admin: `admin@northstar.demo` / `Admin@12345`. Change this password before any shared or deployed demo. Customer accounts can be registered from the sign-in screen.

## Environment
Backend variables are documented in `backend/.env.example`. For a deployed frontend set `VITE_API_URL` to the deployed API base URL, e.g. `https://your-api.example.com/api`.

## Main API routes
| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Customer registration |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/auth/me` | Authenticated | Current user |
| GET | `/api/products` | Public | Product catalogue/search |
| POST/PUT | `/api/products` or `/api/products/:id` | Admin | Create/update product |
| PATCH | `/api/products/:id/stock` | Admin | Adjust inventory |
| GET | `/api/orders` | Authenticated | Own orders / all orders for admin |
| POST | `/api/orders` | Customer | Place order |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |
| GET | `/api/dashboard/summary` | Admin | Dashboard KPIs |
| GET | `/api/dashboard/activity` | Admin | Audit trail |

## Important demo limitations / next steps
- Checkout asks for a shipping address in the demo. Replace the browser prompt with a validated checkout form before a live deployment.
- Invoice records are created in the database; a downloadable PDF invoice endpoint is a recommended next enhancement.
- GST is a configurable demo estimate at 18%; confirm the applicable tax rules before real commercial use.
- Add automated API tests, password reset, email verification, pagination, Docker deployment, production secrets management and CI before production use.
- The demo seed account should be changed and never used as a production credential.

## Suggested test walkthrough
1. Sign in as admin and review the dashboard.
2. Register a customer in a second browser/incognito session.
3. As admin, create products using the API or add seed products in MySQL.
4. As customer, add products to cart and place an order.
5. As admin, confirm the order, move it through processing/shipped/delivered.
6. Check stock reduction, invoice row and activity log in MySQL/admin UI.
7. Attempt an order quantity greater than stock and confirm it is rejected without partial stock changes.

## Suggested GitHub presentation
Use a clean repository name such as `b2b-order-management-platform`. Add screenshots of the admin dashboard, catalogue, order table and audit trail after running the app. Do not commit `.env`, passwords or real customer data.
