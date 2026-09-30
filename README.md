# School Worker Attendance Tracker (QR-Based)

A lightweight, zero-friction attendance tracking web application designed for school workers using a **single fixed QR code posted at the entrance**.

---

## 🌟 How It Works

1. **Entrance QR Code**: A single QR code is printed and posted on the wall/door at the entrance of the school. It links directly to `/scan`.
2. **Worker Flow (`/scan`)**:
   - Workers scan the entrance QR code with their smartphone camera (or use a shared tablet kiosk at the entrance).
   - **No login, no PIN, no app installation required.**
   - Workers tap their name from large touch-friendly buttons.
   - The app automatically toggles between **Check In** and **Check Out** based on their activity today:
     - *No check-in yet or last action was check-out* &rarr; logs **Check In**.
     - *Last action was check-in* &rarr; logs **Check Out**.
   - Displays clear instant confirmation (e.g. `✅ Marcus Vance — Checked in at 8:15 AM`) and auto-resets after a few seconds for the next person in line.
3. **Admin Flow (`/admin`)**:
   - Protected by a single password (`ADMIN_PASSWORD`).
   - Authenticates with a secure, signed HTTP-only cookie (`admin_session`).
   - **Live Status**: Real-time overview of who is currently IN, OUT, or hasn't arrived yet today.
   - **Attendance Logs**: Searchable, filterable by date and worker.
   - **Export CSV**: One-click download of attendance logs for payroll and reporting.
   - **Worker Management**: Add workers, edit names, and toggle active status (**Deactivate** / **Reactivate** — historical attendance records are always preserved).
   - **Entrance Poster Generator**: View and print high-resolution QR code posters sized for A4/Letter paper to tape at school entrances.

---

## 🛠️ Tech Stack

- **Frontend**: React (TypeScript), Vite, Lucide Icons, Mobile-first Responsive CSS
- **Backend**: Node.js, Express, `cookie-parser`, `cors`, `dotenv`
- **Database**: SQLite (`better-sqlite3`) — single file (`attendance.db`), zero configuration required
- **Deployment**: Render-ready single service configuration

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- Node.js (version 20.0.0 or later)
- npm (version 9 or later)

### 2. Install Dependencies
In the root directory, install server dependencies:
```bash
npm install
```

Install client dependencies:
```bash
cd client
npm install
cd ..
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (or copy `.env.example`):
```bash
cp .env.example .env
```

Configuration variables:
| Variable | Description | Default |
|---|---|---|
| `PORT` | Server HTTP port | `5000` |
| `ADMIN_PASSWORD` | Password required to access `/admin` | `admin123` |
| `COOKIE_SECRET` | Secret key used to sign session cookies | `school-secret-key-change-me` |
| `NODE_ENV` | Application environment (`development` or `production`) | `development` |

### 4. Seed the Database
Populate the database with sample school workers and today's initial attendance logs:
```bash
npm run seed
```

### 5. Run in Development Mode
Start the backend server (on `http://localhost:5000`):
```bash
npm run dev:server
```

In a second terminal, start the Vite development server (on `http://localhost:5173`):
```bash
npm run dev:client
```
The Vite development server automatically proxies all `/api/*` calls to the backend on port `5000`.

### 6. Run in Production Mode (Single Process)
Build the frontend and run the Express server serving both the API and client static assets:
```bash
npm run build
npm start
```
Open your browser to `http://localhost:5000`.

---

## 🧪 Automated Testing

Run the end-to-end integration and security test suite:
```bash
npm test
```
The test suite validates:
- SQLite schema initialization
- Public worker listing (`GET /api/workers`)
- Worker check-in / check-out toggle logic (`POST /api/scan`)
- Admin cookie security & rejection of unauthorized requests (401)
- Admin password login and cookie verification
- Worker addition, editing, and soft deactivation
- Historical log queries and RFC 4180 CSV export
- Static SPA fallback serving for `/scan` and `/admin`

---

## 🔒 Security Architecture

- **Public Endpoints**: `/scan` and `GET /api/workers` (active workers only) are publicly accessible without authentication so workers can check in quickly from their personal phones.
- **Protected Endpoints**:
  - `POST /api/workers` (Add worker)
  - `PUT /api/workers/:id` (Edit worker)
  - `DELETE /api/workers/:id` (Soft deactivate worker)
  - `GET /api/admin/live-status` (Live status)
  - `GET /api/admin/logs` (Historical logs)
  - `GET /api/admin/export-csv` (Export attendance to CSV)
- **Zero-Dependency Cookie Check**: Protected endpoints pass through `middleware/auth.js`, which verifies the signed `admin_session` HTTP-only cookie.
- **Data Protection**: Worker deactivation sets `active = 0`. **Worker rows are never hard-deleted**, ensuring historical attendance logs and CSV exports remain 100% accurate.

---

## ☁️ Deployment to Render

This repository includes a `render.yaml` blueprint for one-click deployment.

### Option A: Deploy via Blueprint (`render.yaml`)
1. Push this repository to GitHub or GitLab.
2. In the Render Dashboard, click **New** &rarr; **Blueprint**.
3. Select your repository.
4. Set the `ADMIN_PASSWORD` environment variable in the dashboard.
5. Click **Apply**.

### Option B: Manual Web Service Setup
1. In the Render Dashboard, click **New** &rarr; **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && cd client && npm install && npm run build && cd ..`
   - **Start Command**: `npm start`
4. In **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `ADMIN_PASSWORD`: *(Choose a strong administrator password)*
   - `COOKIE_SECRET`: *(Enter a random secret string)*
5. *(Optional for persistence)*: In the Render service settings, attach a **Persistent Disk** (e.g., Mount path `/var/data`) and set `DB_PATH=/var/data/attendance.db` so the SQLite database is retained across redeployments.

---

## 📄 License
MIT
