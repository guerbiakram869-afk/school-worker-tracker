const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { calculateHoursWorked } = require('../payroll');

function getStartOfToday() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return startOfDay.toISOString();
}

/**
 * POST /api/admin/login
 * Simple single-password authentication.
 * Sets a signed HTTP-only cookie.
 */
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || '12345Admin';

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Set signed, HTTP-only cookie
  res.cookie('admin_session', 'authenticated', {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({ success: true, message: 'Logged in successfully' });
});

/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('admin_session', {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/admin/status
 * Check current authentication status
 */
router.get('/status', (req, res) => {
  const isAdmin = Boolean(req.signedCookies && req.signedCookies.admin_session === 'authenticated');
  return res.json({ isAdmin });
});

/**
 * GET /api/admin/live-status
 * Protected: Real-time dashboard view of who is currently IN, OUT, or NOT_SEEN_YET today.
 */
router.get('/live-status', requireAdmin, (req, res) => {
  const startOfToday = getStartOfToday();

  // Query all active workers and their status for today
  const workers = db.prepare(`
    SELECT 
      w.id,
      w.name,
      w.active,
      (
        SELECT l.type 
        FROM logs l 
        WHERE l.worker_id = w.id AND l.timestamp >= ? 
        ORDER BY l.id DESC 
        LIMIT 1
      ) AS latest_type,
      (
        SELECT l.timestamp 
        FROM logs l 
        WHERE l.worker_id = w.id AND l.timestamp >= ? 
        ORDER BY l.id DESC 
        LIMIT 1
      ) AS latest_timestamp,
      (
        SELECT l.timestamp 
        FROM logs l 
        WHERE l.worker_id = w.id AND l.type = 'in' AND l.timestamp >= ? 
        ORDER BY l.id ASC 
        LIMIT 1
      ) AS first_checkin_today
    FROM workers w
    WHERE w.active = 1
    ORDER BY w.name COLLATE NOCASE ASC
  `).all(startOfToday, startOfToday, startOfToday);

  let currentlyIn = 0;
  let currentlyOut = 0;
  let notSeenYet = 0;

  const enrichedWorkers = workers.map(worker => {
    let status = 'NOT_SEEN_YET';
    if (worker.latest_type === 'in') {
      status = 'IN';
      currentlyIn++;
    } else if (worker.latest_type === 'out') {
      status = 'OUT';
      currentlyOut++;
    } else {
      notSeenYet++;
    }

    return {
      id: worker.id,
      name: worker.name,
      status,
      latestTimestamp: worker.latest_timestamp || null,
      firstCheckin: worker.first_checkin_today || null
    };
  });

  return res.json({
    summary: {
      totalWorkers: workers.length,
      currentlyIn,
      currentlyOut,
      notSeenYet
    },
    workers: enrichedWorkers
  });
});

/**
 * GET /api/admin/logs
 * Protected: Daily/weekly logs with optional filters (workerId, date, limit)
 */
router.get('/logs', requireAdmin, (req, res) => {
  const { workerId, date, startDate, endDate, limit = 100 } = req.query;

  let query = `
    SELECT 
      l.id,
      l.worker_id,
      w.name AS worker_name,
      w.active AS worker_active,
      l.type,
      l.timestamp,
      l.edited_by_admin
    FROM logs l
    JOIN workers w ON l.worker_id = w.id
    WHERE 1=1
  `;
  const params = [];

  if (workerId) {
    query += ' AND l.worker_id = ?';
    params.push(Number(workerId));
  }

  if (date) {
    // Specific date YYYY-MM-DD
    query += ' AND date(l.timestamp) = ?';
    params.push(date);
  } else {
    if (startDate) {
      query += ' AND date(l.timestamp) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date(l.timestamp) <= ?';
      params.push(endDate);
    }
  }

  query += ' ORDER BY l.timestamp DESC, l.id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 100, 1000));

  const rawLogs = db.prepare(query).all(...params);
  const logs = rawLogs.map(log => ({
    ...log,
    edited_by_admin: Boolean(log.edited_by_admin)
  }));
  return res.json(logs);
});

/**
 * POST /api/admin/logs
 * Protected: Lets admin manually create a full log entry (for a day a worker forgot to scan entirely).
 * Sets edited_by_admin = true (1) on that log.
 */
router.post('/logs', requireAdmin, (req, res) => {
  const { worker_id, workerId, type, timestamp } = req.body;
  const targetWorkerId = Number(worker_id || workerId);

  if (!targetWorkerId) {
    return res.status(400).json({ error: 'Worker ID is required' });
  }

  const worker = db.prepare('SELECT id, name FROM workers WHERE id = ?').get(targetWorkerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  const logType = (type ? String(type).toLowerCase().trim() : 'in');
  if (logType !== 'in' && logType !== 'out') {
    return res.status(400).json({ error: 'Type must be "in" or "out"' });
  }

  const logTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO logs (worker_id, type, timestamp, edited_by_admin)
    VALUES (?, ?, ?, 1)
  `);
  const result = insertStmt.run(targetWorkerId, logType, logTimestamp);

  const createdLog = db.prepare(`
    SELECT l.id, l.worker_id, w.name AS worker_name, l.type, l.timestamp, l.edited_by_admin
    FROM logs l
    JOIN workers w ON l.worker_id = w.id
    WHERE l.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json({
    ...createdLog,
    edited_by_admin: true
  });
});

/**
 * PUT /api/admin/logs/:id
 * Protected: Lets admin edit the timestamp of an existing check-in/check-out, or add a missing check-out.
 * Sets edited_by_admin = true (1) on that log when this is used.
 */
router.put('/logs/:id', requireAdmin, (req, res) => {
  const logId = Number(req.params.id);
  const { timestamp, type, checkout_timestamp } = req.body;

  const existingLog = db.prepare('SELECT id, worker_id, type, timestamp, edited_by_admin FROM logs WHERE id = ?').get(logId);
  if (!existingLog) {
    return res.status(404).json({ error: 'Log entry not found' });
  }

  const updatedTimestamp = timestamp ? new Date(timestamp).toISOString() : existingLog.timestamp;
  const updatedType = (type && (type === 'in' || type === 'out')) ? type : existingLog.type;

  db.prepare(`
    UPDATE logs 
    SET timestamp = ?, type = ?, edited_by_admin = 1 
    WHERE id = ?
  `).run(updatedTimestamp, updatedType, logId);

  // If adding a missing check-out via this endpoint:
  let createdCheckoutLog = null;
  if (checkout_timestamp) {
    const checkoutIso = new Date(checkout_timestamp).toISOString();
    const insertRes = db.prepare(`
      INSERT INTO logs (worker_id, type, timestamp, edited_by_admin)
      VALUES (?, 'out', ?, 1)
    `).run(existingLog.worker_id, checkoutIso);

    createdCheckoutLog = db.prepare(`
      SELECT l.id, l.worker_id, w.name AS worker_name, l.type, l.timestamp, l.edited_by_admin
      FROM logs l
      JOIN workers w ON l.worker_id = w.id
      WHERE l.id = ?
    `).get(insertRes.lastInsertRowid);
  }

  const updatedLog = db.prepare(`
    SELECT l.id, l.worker_id, w.name AS worker_name, l.type, l.timestamp, l.edited_by_admin
    FROM logs l
    JOIN workers w ON l.worker_id = w.id
    WHERE l.id = ?
  `).get(logId);

  return res.json({
    ...updatedLog,
    edited_by_admin: true,
    createdCheckoutLog: createdCheckoutLog ? { ...createdCheckoutLog, edited_by_admin: true } : undefined
  });
});

/**
 * GET /api/admin/payroll?month=YYYY-MM
 * Protected: Calculates monthly payroll for all active workers.
 * For each active worker, returns:
 * - name
 * - hourly_rate
 * - total_hours (calculated via calculateHoursWorked)
 * - total_pay (total_hours * hourly_rate)
 * - incomplete_days_count (how many days need manual correction)
 */
router.get('/payroll', requireAdmin, (req, res) => {
  const { month } = req.query;

  let targetMonth = month;
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    const now = new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

  const workers = db.prepare(`
    SELECT id, name, hourly_rate, active 
    FROM workers 
    WHERE active = 1 
    ORDER BY name COLLATE NOCASE ASC
  `).all();

  const payroll = workers.map(worker => {
    const hourlyRate = (worker.hourly_rate !== undefined && worker.hourly_rate !== null)
      ? Number(worker.hourly_rate)
      : 120;
    const hoursData = calculateHoursWorked(worker.id, startDate, endDate, db);
    const totalHours = hoursData.total_hours;
    const totalPay = Math.round(totalHours * hourlyRate * 100) / 100;
    const incompleteDays = hoursData.days.filter(d => d.incomplete);

    return {
      id: worker.id,
      worker_id: worker.id,
      name: worker.name,
      hourly_rate: hourlyRate,
      total_hours: totalHours,
      totalHours,
      total_pay: totalPay,
      totalPay,
      incomplete_days_count: hoursData.incomplete_days_count,
      incompleteDaysCount: hoursData.incomplete_days_count,
      incomplete_days: incompleteDays,
      days: hoursData.days
    };
  });

  return res.json(payroll);
});

/**
 * GET /api/admin/export-csv
 * Protected: Explicitly applies requireAdmin middleware!
 * Generates and streams standard RFC 4180 CSV export of attendance logs.
 */
router.get('/export-csv', requireAdmin, (req, res) => {
  const { workerId, startDate, endDate } = req.query;

  let query = `
    SELECT 
      l.id AS log_id,
      l.worker_id,
      w.name AS worker_name,
      l.type,
      l.timestamp
    FROM logs l
    JOIN workers w ON l.worker_id = w.id
    WHERE 1=1
  `;
  const params = [];

  if (workerId) {
    query += ' AND l.worker_id = ?';
    params.push(Number(workerId));
  }
  if (startDate) {
    query += ' AND date(l.timestamp) >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date(l.timestamp) <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY l.timestamp DESC, l.id DESC';

  const rows = db.prepare(query).all(...params);

  // Helper to escape CSV values
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = ['Log ID', 'Worker ID', 'Worker Name', 'Action', 'Date', 'Time', 'ISO Timestamp'];
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const d = new Date(row.timestamp);
    const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US') : '';
    const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';

    const line = [
      escapeCsv(row.log_id),
      escapeCsv(row.worker_id),
      escapeCsv(row.worker_name),
      escapeCsv(row.type === 'in' ? 'Check In' : 'Check Out'),
      escapeCsv(dateStr),
      escapeCsv(timeStr),
      escapeCsv(row.timestamp)
    ].join(',');

    csvLines.push(line);
  }

  const csvContent = csvLines.join('\r\n');
  const filenameDate = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="school-attendance-${filenameDate}.csv"`);
  return res.send(csvContent);
});

module.exports = router;
