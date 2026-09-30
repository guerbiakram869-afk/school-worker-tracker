const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

function getStartOfToday() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return startOfDay.toISOString();
}

/**
 * GET /api/workers
 * Public route returning active workers for the /scan page.
 * If query parameter ?all=true is passed and caller has admin cookie, returns all workers (active + inactive).
 */
router.get('/', (req, res) => {
  const isAdmin = req.signedCookies && req.signedCookies.admin_session === 'authenticated';
  const showAll = req.query.all === 'true' && isAdmin;
  const startOfToday = getStartOfToday();

  let query = `
    SELECT 
      w.id, 
      w.name, 
      w.hourly_rate,
      w.active, 
      w.created_at,
      (
        SELECT l.type 
        FROM logs l 
        WHERE l.worker_id = w.id AND l.timestamp >= ? 
        ORDER BY l.id DESC 
        LIMIT 1
      ) AS current_status,
      (
        SELECT l.timestamp 
        FROM logs l 
        WHERE l.worker_id = w.id AND l.timestamp >= ? 
        ORDER BY l.id DESC 
        LIMIT 1
      ) AS last_timestamp
    FROM workers w
  `;

  if (!showAll) {
    query += ' WHERE w.active = 1';
  }

  query += ' ORDER BY w.name COLLATE NOCASE ASC';

  const workers = db.prepare(query).all(startOfToday, startOfToday);
  res.json(workers);
});

/**
 * POST /api/workers
 * Admin-only: Add a new worker (accepts optional hourly_rate, default 120)
 */
router.post('/', requireAdmin, (req, res) => {
  const { name, hourly_rate } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Worker name is required' });
  }

  const trimmedName = name.trim();
  const rate = (hourly_rate !== undefined && hourly_rate !== null && hourly_rate !== '' && !isNaN(Number(hourly_rate)) && Number(hourly_rate) >= 0)
    ? Number(hourly_rate)
    : 120;

  const stmt = db.prepare('INSERT INTO workers (name, hourly_rate, active) VALUES (?, ?, 1)');
  const result = stmt.run(trimmedName, rate);

  const createdWorker = db.prepare('SELECT id, name, hourly_rate, active, created_at FROM workers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(createdWorker);
});

/**
 * PUT /api/workers/:id
 * Admin-only: Update worker name, active status, or hourly_rate
 */
router.put('/:id', requireAdmin, (req, res) => {
  const workerId = Number(req.params.id);
  const { name, active, hourly_rate } = req.body;

  const worker = db.prepare('SELECT id, name, hourly_rate, active FROM workers WHERE id = ?').get(workerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  const updatedName = (typeof name === 'string' && name.trim()) ? name.trim() : worker.name;
  const updatedActive = (active !== undefined) ? (active ? 1 : 0) : worker.active;
  const updatedRate = (hourly_rate !== undefined && hourly_rate !== null && hourly_rate !== '' && !isNaN(Number(hourly_rate)) && Number(hourly_rate) >= 0)
    ? Number(hourly_rate)
    : (worker.hourly_rate !== undefined && worker.hourly_rate !== null ? worker.hourly_rate : 120);

  db.prepare('UPDATE workers SET name = ?, active = ?, hourly_rate = ? WHERE id = ?').run(updatedName, updatedActive, updatedRate, workerId);

  const updated = db.prepare('SELECT id, name, hourly_rate, active, created_at FROM workers WHERE id = ?').get(workerId);
  res.json(updated);
});

/**
 * DELETE /api/workers/:id
 * Admin-only: Deactivates a worker.
 * NOTE: Never hard-deletes the row so historical logs remain intact.
 */
router.delete('/:id', requireAdmin, (req, res) => {
  const workerId = Number(req.params.id);

  const worker = db.prepare('SELECT id, name, active FROM workers WHERE id = ?').get(workerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  // Soft deactivate only
  db.prepare('UPDATE workers SET active = 0 WHERE id = ?').run(workerId);

  res.json({
    success: true,
    message: `Worker "${worker.name}" deactivated successfully`,
    id: workerId,
    active: 0
  });
});

module.exports = router;
