const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Helper to get the start of the current day in ISO format
 */
function getStartOfToday() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return startOfDay.toISOString();
}

/**
 * Format time for user display (e.g. "8:30 AM")
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * POST /api/scan
 * Public route used by workers scanning the entrance QR code.
 * Toggles check-in / check-out based on the worker's latest log today.
 */
router.post('/', (req, res) => {
  const { workerId } = req.body;

  if (!workerId) {
    return res.status(400).json({ error: 'Worker ID is required' });
  }

  // Find worker and ensure active
  const worker = db.prepare('SELECT id, name, active FROM workers WHERE id = ?').get(workerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  if (!worker.active) {
    return res.status(403).json({ 
      error: 'Worker account is inactive. Please contact school administration.' 
    });
  }

  const startOfToday = getStartOfToday();
  const now = new Date();
  const currentTimestamp = now.toISOString();

  // Query latest log for today
  const lastLog = db.prepare(`
    SELECT id, worker_id, type, timestamp 
    FROM logs 
    WHERE worker_id = ? AND timestamp >= ? 
    ORDER BY id DESC 
    LIMIT 1
  `).get(worker.id, startOfToday);

  // Logic:
  // No check-in yet today, or last action was 'out' -> log 'in'
  // Last action was 'in' -> log 'out'
  const nextType = (!lastLog || lastLog.type === 'out') ? 'in' : 'out';

  // Insert new log
  const insertStmt = db.prepare(`
    INSERT INTO logs (worker_id, type, timestamp)
    VALUES (?, ?, ?)
  `);
  const result = insertStmt.run(worker.id, nextType, currentTimestamp);

  const formattedTime = formatTime(now);
  const actionText = nextType === 'in' ? 'Checked in' : 'Checked out';
  const emoji = nextType === 'in' ? '✅' : '👋';
  const displayMessage = `${emoji} ${worker.name} — ${actionText} at ${formattedTime}`;

  return res.json({
    success: true,
    logId: result.lastInsertRowid,
    worker: {
      id: worker.id,
      name: worker.name
    },
    action: nextType,
    previousAction: lastLog ? lastLog.type : null,
    timestamp: currentTimestamp,
    formattedTime,
    message: displayMessage
  });
});

module.exports = router;
