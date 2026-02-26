# VTS — Visitor Tracking System
## Full-Stack Web App · React + Node.js + PostgreSQL

---

## Project Structure

```
vts-web/
├── package.json          ← root: runs both server + client together
├── server/
│   ├── index.js          ← Express entry point
│   ├── .env              ← DB credentials (edit this first)
│   ├── db/
│   │   ├── pool.js       ← PostgreSQL connection pool
│   │   └── migrate.js    ← Auto-migrations on startup
│   ├── middleware/
│   │   └── auth.js       ← JWT verification middleware
│   └── routes/
│       ├── auth.js       ← POST /api/auth/login, logout, me
│       ├── api.js        ← visitors, visits, cards, doors, users
│       └── dashboard.js  ← stats, active-visits, activity feed
└── client/
    ├── vite.config.js    ← Vite + proxy to :5000
    └── src/
        ├── App.jsx       ← Router
        ├── api.js        ← Axios client with JWT
        ├── context/
        │   └── AuthContext.jsx
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── CheckIn.jsx
            ├── Cards.jsx
            └── Logs.jsx
```

---

## Setup (one-time)

### 1. Install Node.js
Download from https://nodejs.org — choose the LTS version.
Verify: `node --version` and `npm --version`

### 2. Configure your database
Open `server/.env` and update:
```
DB_NAME=postgres          ← your database name
DB_USER=postgres          ← your PostgreSQL username
DB_PASSWORD=your_password ← your password
JWT_SECRET=replace_with_a_long_random_string
```

### 3. Install all dependencies
```bash
cd vts-web
npm run install:all
```

### 4. Run the app
```bash
npm run dev
```

This starts:
- **Backend** on http://localhost:5000
- **Frontend** on http://localhost:5173

Open http://localhost:5173 in your browser.

---

## First Login

On first run, if the users table is empty, a default admin is created automatically:

| Field    | Value           |
|----------|-----------------|
| Email    | admin@vts.local |
| Password | Admin@1234      |

**Change this password immediately.**

---

## Adding users via SQL

```sql
-- First generate a bcrypt hash in Node:
-- node -e "const b=require('bcrypt'); b.hash('YourPass',12).then(console.log)"

INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES ('officer@vts.local', '$2b$12$...', 'Ahmed Al-Mansoori', 'security', true);
```

---

## API Endpoints

| Method | Route                          | Auth | Description            |
|--------|--------------------------------|------|------------------------|
| POST   | /api/auth/login                | No   | Login, returns JWT     |
| POST   | /api/auth/logout               | Yes  | Revoke session         |
| GET    | /api/auth/me                   | Yes  | Current user info      |
| GET    | /api/dashboard/stats           | Yes  | KPI counts             |
| GET    | /api/dashboard/active-visits   | Yes  | Live visitor table     |
| GET    | /api/dashboard/activity        | Yes  | Audit log feed         |
| GET    | /api/visitors                  | Yes  | All visitors           |
| POST   | /api/visitors                  | Yes  | Create/upsert visitor  |
| POST   | /api/visitors/check-cpr        | Yes  | Check banned list      |
| GET    | /api/visits                    | Yes  | All visits             |
| POST   | /api/visits                    | Yes  | New check-in           |
| PATCH  | /api/visits/:id/checkout       | Yes  | Check out visitor      |
| GET    | /api/cards                     | Yes  | All cards              |
| GET    | /api/cards/next-available      | Yes  | Next free card         |
| GET    | /api/doors                     | Yes  | All active doors       |
| GET    | /api/users                     | Yes  | All users (admin only) |
