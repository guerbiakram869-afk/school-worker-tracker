const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Use an isolated test database
const testDbPath = path.join(__dirname, 'test-attendance.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
process.env.DB_PATH = testDbPath;
process.env.ADMIN_PASSWORD = 'test-secret-password-123';
process.env.COOKIE_SECRET = 'test-cookie-secret';
process.env.PORT = '5099';

const db = require('../server/db');
const { calculateHoursWorked } = require('../server/payroll');
const appModule = require('../server/index');
const app = appModule;

let server;
let baseUrl;
let adminCookie = '';

test.before(async () => {
  // Start server on an ephemeral or test port
  await new Promise((resolve) => {
    server = app.listen(5099, () => {
      baseUrl = 'http://localhost:5099';
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    server.close();
  }
  db.close();
  // Clean up test DB
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  const walPath = `${testDbPath}-wal`;
  const shmPath = `${testDbPath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
});

test('1. Setup initial worker directly in database', () => {
  const insert = db.prepare('INSERT INTO workers (name, active) VALUES (?, 1)');
  const res = insert.run('Alice Test');
  assert.strictEqual(res.lastInsertRowid, 1);
});

test('2. GET /api/workers returns public active worker list', async () => {
  const res = await fetch(`${baseUrl}/api/workers`);
  assert.strictEqual(res.status, 200);
  const workers = await res.json();
  assert.strictEqual(workers.length, 1);
  assert.strictEqual(workers[0].name, 'Alice Test');
  assert.strictEqual(workers[0].active, 1);
});

test('3. Worker check-in/check-out toggle logic (POST /api/scan)', async () => {
  // 1st scan -> Expect 'in'
  const scan1 = await fetch(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 1 })
  });
  assert.strictEqual(scan1.status, 200);
  const data1 = await scan1.json();
  assert.strictEqual(data1.success, true);
  assert.strictEqual(data1.action, 'in');
  assert.match(data1.message, /Checked in/);

  // 2nd scan -> Expect 'out'
  const scan2 = await fetch(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 1 })
  });
  assert.strictEqual(scan2.status, 200);
  const data2 = await scan2.json();
  assert.strictEqual(data2.success, true);
  assert.strictEqual(data2.action, 'out');
  assert.match(data2.message, /Checked out/);

  // 3rd scan -> Expect 'in'
  const scan3 = await fetch(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 1 })
  });
  assert.strictEqual(scan3.status, 200);
  const data3 = await scan3.json();
  assert.strictEqual(data3.success, true);
  assert.strictEqual(data3.action, 'in');
  assert.match(data3.message, /Checked in/);
});

test('4. Security check: Unauthenticated access rejected with 401', async () => {
  // POST /api/workers without cookie
  const addRes = await fetch(`${baseUrl}/api/workers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker' })
  });
  assert.strictEqual(addRes.status, 401);

  // DELETE /api/workers/:id without cookie
  const delRes = await fetch(`${baseUrl}/api/workers/1`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes.status, 401);

  // GET /api/admin/live-status without cookie
  const liveRes = await fetch(`${baseUrl}/api/admin/live-status`);
  assert.strictEqual(liveRes.status, 401);

  // GET /api/admin/logs without cookie
  const logsRes = await fetch(`${baseUrl}/api/admin/logs`);
  assert.strictEqual(logsRes.status, 401);

  // GET /api/admin/export-csv without cookie
  const csvRes = await fetch(`${baseUrl}/api/admin/export-csv`);
  assert.strictEqual(csvRes.status, 401);
});

test('5. Admin Login: Wrong password rejected, correct password sets cookie', async () => {
  // Wrong password
  const badLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrongpassword' })
  });
  assert.strictEqual(badLogin.status, 401);

  // Correct password
  const goodLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test-secret-password-123' })
  });
  assert.strictEqual(goodLogin.status, 200);

  // Capture Set-Cookie
  const setCookieHeader = goodLogin.headers.get('set-cookie');
  assert.ok(setCookieHeader, 'Set-Cookie header must be present');
  adminCookie = setCookieHeader.split(';')[0];
  assert.ok(adminCookie.startsWith('admin_session='), 'Cookie should be admin_session');
});

test('6. Admin operations with valid cookie', async () => {
  // Add worker
  const addRes = await fetch(`${baseUrl}/api/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ name: 'Bob Smith (Maintenance)' })
  });
  assert.strictEqual(addRes.status, 201);
  const newWorker = await addRes.json();
  assert.strictEqual(newWorker.name, 'Bob Smith (Maintenance)');
  assert.strictEqual(newWorker.active, 1);
  const bobId = newWorker.id;

  // Soft Deactivate worker: Verify active becomes 0 and row still exists in DB
  const deactRes = await fetch(`${baseUrl}/api/workers/${bobId}`, {
    method: 'DELETE',
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(deactRes.status, 200);

  const bobInDb = db.prepare('SELECT id, name, active FROM workers WHERE id = ?').get(bobId);
  assert.ok(bobInDb, 'Worker row must NOT be deleted from the database');
  assert.strictEqual(bobInDb.active, 0, 'Worker active flag must be set to 0');

  // Verify deactivated worker does not appear in public active workers
  const publicWorkersRes = await fetch(`${baseUrl}/api/workers`);
  const publicWorkers = await publicWorkersRes.json();
  assert.ok(!publicWorkers.some(w => w.id === bobId), 'Deactivated worker should not appear in public active list');

  // Reactivate worker via PUT
  const reactRes = await fetch(`${baseUrl}/api/workers/${bobId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ active: true })
  });
  assert.strictEqual(reactRes.status, 200);
  const reactWorker = await reactRes.json();
  assert.strictEqual(reactWorker.active, 1);
});

test('7. Admin live-status and logs retrieval', async () => {
  // Live status
  const liveRes = await fetch(`${baseUrl}/api/admin/live-status`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(liveRes.status, 200);
  const liveData = await liveRes.json();
  assert.ok(liveData.summary);
  assert.strictEqual(liveData.summary.currentlyIn, 1); // Alice is 'in'

  // Logs
  const logsRes = await fetch(`${baseUrl}/api/admin/logs`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(logsRes.status, 200);
  const logsData = await logsRes.json();
  assert.strictEqual(logsData.length, 3); // 3 scans performed earlier
  assert.strictEqual(logsData[0].worker_name, 'Alice Test');
});

test('8. CSV Export (GET /api/admin/export-csv)', async () => {
  const csvRes = await fetch(`${baseUrl}/api/admin/export-csv`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(csvRes.status, 200);
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
  const csvText = await csvRes.text();

  assert.ok(csvText.includes('Log ID,Worker ID,Worker Name,Action,Date,Time,ISO Timestamp'));
  assert.ok(csvText.includes('Alice Test'));
  assert.ok(csvText.includes('Check In'));
  assert.ok(csvText.includes('Check Out'));
});

test('9. SPA serving: GET /scan and GET /admin return React client HTML', async () => {
  const scanHtmlRes = await fetch(`${baseUrl}/scan`);
  assert.strictEqual(scanHtmlRes.status, 200);
  const scanHtml = await scanHtmlRes.text();
  assert.ok(scanHtml.includes('<div id="root"></div>'));

  const adminHtmlRes = await fetch(`${baseUrl}/admin`);
  assert.strictEqual(adminHtmlRes.status, 200);
  const adminHtml = await adminHtmlRes.text();
  assert.ok(adminHtml.includes('<div id="root"></div>'));
});

test('10. calculateHoursWorked returns correct totals for complete day pairs', () => {
  // Create a worker for this test
  const insertWorker = db.prepare('INSERT INTO workers (name, hourly_rate, active) VALUES (?, ?, 1)');
  const workerRes = insertWorker.run('Complete Worker', 150);
  const workerId = workerRes.lastInsertRowid;

  // Insert two complete day pairs:
  // Day 1: 2026-09-10 from 08:00 to 16:30 -> 8.5 hours
  // Day 2: 2026-09-11 from 09:00 to 12:00 (3h) and 13:00 to 17:00 (4h) -> 7.0 hours
  // Total hours = 15.5
  const insertLog = db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)');
  insertLog.run(workerId, 'in', '2026-09-10T08:00:00.000Z');
  insertLog.run(workerId, 'out', '2026-09-10T16:30:00.000Z');

  insertLog.run(workerId, 'in', '2026-09-11T09:00:00.000Z');
  insertLog.run(workerId, 'out', '2026-09-11T12:00:00.000Z');
  insertLog.run(workerId, 'in', '2026-09-11T13:00:00.000Z');
  insertLog.run(workerId, 'out', '2026-09-11T17:00:00.000Z');

  const result = calculateHoursWorked(workerId, '2026-09-01', '2026-09-30', db);
  assert.strictEqual(result.total_hours, 15.5);
  assert.strictEqual(result.incomplete_days_count, 0);
  assert.strictEqual(result.days.length, 2);
  assert.strictEqual(result.days[0].incomplete, false);
  assert.strictEqual(result.days[0].hours, 8.5);
  assert.strictEqual(result.days[1].incomplete, false);
  assert.strictEqual(result.days[1].hours, 7.0);
});

test('11. A check-in with no check-out is excluded from totals and flagged incomplete', () => {
  const insertWorker = db.prepare('INSERT INTO workers (name, hourly_rate, active) VALUES (?, ?, 1)');
  const workerRes = insertWorker.run('Incomplete Worker', 100);
  const workerId = workerRes.lastInsertRowid;

  const insertLog = db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)');
  // Day 1: complete pair 8:00 to 16:00 -> 8.0 hours
  insertLog.run(workerId, 'in', '2026-09-15T08:00:00.000Z');
  insertLog.run(workerId, 'out', '2026-09-15T16:00:00.000Z');

  // Day 2: check-in at 08:30 with NO matching check-out
  insertLog.run(workerId, 'in', '2026-09-16T08:30:00.000Z');

  const result = calculateHoursWorked(workerId, '2026-09-01', '2026-09-30', db);
  // Day 2 check-in is excluded from total hours!
  assert.strictEqual(result.total_hours, 8.0);
  assert.strictEqual(result.incomplete_days_count, 1);

  const day1 = result.days.find(d => d.date === '2026-09-15');
  assert.ok(day1);
  assert.strictEqual(day1.incomplete, false);
  assert.strictEqual(day1.hours, 8.0);

  const day2 = result.days.find(d => d.date === '2026-09-16');
  assert.ok(day2);
  assert.strictEqual(day2.incomplete, true);
  assert.strictEqual(day2.hours, 0);
});

test('12. GET /api/admin/payroll without admin cookie → 401 Unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/admin/payroll?month=2026-09`);
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /Unauthorized/);
});

test('13. GET /api/admin/payroll with admin cookie returns payroll summary', async () => {
  const res = await fetch(`${baseUrl}/api/admin/payroll?month=2026-09`, {
    headers: { 'Cookie': adminCookie }
  });
  assert.strictEqual(res.status, 200);
  const payroll = await res.json();
  assert.ok(Array.isArray(payroll));

  // Find 'Complete Worker'
  const completeWorker = payroll.find(w => w.name === 'Complete Worker');
  assert.ok(completeWorker);
  assert.strictEqual(completeWorker.hourly_rate, 150);
  assert.strictEqual(completeWorker.total_hours, 15.5);
  assert.strictEqual(completeWorker.total_pay, 15.5 * 150);
  assert.strictEqual(completeWorker.incomplete_days_count, 0);

  // Find 'Incomplete Worker'
  const incompleteWorker = payroll.find(w => w.name === 'Incomplete Worker');
  assert.ok(incompleteWorker);
  assert.strictEqual(incompleteWorker.hourly_rate, 100);
  assert.strictEqual(incompleteWorker.total_hours, 8.0);
  assert.strictEqual(incompleteWorker.total_pay, 800);
  assert.strictEqual(incompleteWorker.incomplete_days_count, 1);
});

test('14. PUT /api/admin/logs/:id without admin cookie → 401 Unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/admin/logs/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp: '2026-09-01T17:00:00.000Z' })
  });
  assert.strictEqual(res.status, 401);
});

test('15. After manual correction, edited_by_admin is true on that log entry', async () => {
  // Get an existing log ID
  const firstLog = db.prepare('SELECT id FROM logs LIMIT 1').get();
  assert.ok(firstLog, 'Must have at least one log');

  const updateRes = await fetch(`${baseUrl}/api/admin/logs/${firstLog.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ timestamp: '2026-09-01T17:30:00.000Z' })
  });
  assert.strictEqual(updateRes.status, 200);
  const updatedLog = await updateRes.json();
  assert.strictEqual(updatedLog.edited_by_admin, true);

  // Check in database
  const dbLog = db.prepare('SELECT edited_by_admin FROM logs WHERE id = ?').get(firstLog.id);
  assert.strictEqual(Boolean(dbLog.edited_by_admin), true);
});

test('16. POST /api/admin/logs creates manual entry with edited_by_admin = true', async () => {
  // Test POST /api/admin/logs without cookie -> 401
  const unauthRes = await fetch(`${baseUrl}/api/admin/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worker_id: 1, type: 'out' })
  });
  assert.strictEqual(unauthRes.status, 401);

  // Test with admin cookie
  const authRes = await fetch(`${baseUrl}/api/admin/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({
      worker_id: 1,
      type: 'out',
      timestamp: '2026-09-30T17:00:00.000Z'
    })
  });
  assert.strictEqual(authRes.status, 201);
  const newLog = await authRes.json();
  assert.strictEqual(newLog.edited_by_admin, true);

  const dbNewLog = db.prepare('SELECT edited_by_admin FROM logs WHERE id = ?').get(newLog.id);
  assert.strictEqual(Boolean(dbNewLog.edited_by_admin), true);
});

test('17. Worker routes accept optional hourly_rate with default 120', async () => {
  // POST with hourly_rate
  const customRateRes = await fetch(`${baseUrl}/api/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ name: 'Rate Tester Custom', hourly_rate: 180 })
  });
  assert.strictEqual(customRateRes.status, 201);
  const customWorker = await customRateRes.json();
  assert.strictEqual(customWorker.hourly_rate, 180);

  // POST without hourly_rate -> default 120
  const defaultRateRes = await fetch(`${baseUrl}/api/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ name: 'Rate Tester Default' })
  });
  assert.strictEqual(defaultRateRes.status, 201);
  const defaultWorker = await defaultRateRes.json();
  assert.strictEqual(defaultWorker.hourly_rate, 120);

  // PUT updating hourly_rate
  const putRateRes = await fetch(`${baseUrl}/api/workers/${defaultWorker.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({ hourly_rate: 220 })
  });
  assert.strictEqual(putRateRes.status, 200);
  const updatedDefaultWorker = await putRateRes.json();
  assert.strictEqual(updatedDefaultWorker.hourly_rate, 220);
});

test('18. Production environment requires secure secrets', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  const originalCookieSecret = process.env.COOKIE_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    delete process.env.COOKIE_SECRET;

    assert.throws(() => {
      if (typeof appModule.validateEnvironment !== 'function') {
        throw new Error('validateEnvironment is not defined');
      }
      appModule.validateEnvironment();
    }, /ADMIN_PASSWORD|COOKIE_SECRET/);
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAdminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = originalAdminPassword;
    }

    if (originalCookieSecret === undefined) {
      delete process.env.COOKIE_SECRET;
    } else {
      process.env.COOKIE_SECRET = originalCookieSecret;
    }
  }
});
