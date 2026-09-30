const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../attendance.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Performance & integrity pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hourly_rate REAL NOT NULL DEFAULT 120,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('in', 'out')),
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    edited_by_admin INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (worker_id) REFERENCES workers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_logs_worker_time ON logs(worker_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
`);

// Safe migrations for existing databases (runs safely without deleting current data)
const workerColumns = db.prepare("PRAGMA table_info(workers)").all();
if (!workerColumns.some(col => col.name === 'hourly_rate')) {
  db.exec("ALTER TABLE workers ADD COLUMN hourly_rate REAL DEFAULT 120");
  db.exec("UPDATE workers SET hourly_rate = 120 WHERE hourly_rate IS NULL");
}

const logColumns = db.prepare("PRAGMA table_info(logs)").all();
if (!logColumns.some(col => col.name === 'edited_by_admin')) {
  db.exec("ALTER TABLE logs ADD COLUMN edited_by_admin INTEGER DEFAULT 0");
  db.exec("UPDATE logs SET edited_by_admin = 0 WHERE edited_by_admin IS NULL");
}

module.exports = db;
