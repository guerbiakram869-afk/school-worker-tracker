const db = require('./db');

const sampleWorkers = [
  'Marcus Vance (Maintenance)',
  'Elena Rodriguez (Security)',
  'David Kim (Custodian)',
  'Sarah Jenkins (Cafeteria Lead)',
  'Patricia Moore (Admin Assistant)',
  'James Wilson (Groundskeeper)'
];

function seed() {
  console.log('🌱 Starting database seeding...');

  // Check existing workers
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM workers').get().count;

  const insertWorker = db.prepare('INSERT INTO workers (name, active) VALUES (?, 1)');
  const getWorkerByName = db.prepare('SELECT id, name FROM workers WHERE name = ?');

  const seededWorkers = [];

  for (const name of sampleWorkers) {
    let worker = getWorkerByName.get(name);
    if (!worker) {
      const res = insertWorker.run(name);
      worker = { id: res.lastInsertRowid, name };
      console.log(`  ➕ Added worker: ${name}`);
    } else {
      console.log(`  ℹ️ Worker already exists: ${name}`);
    }
    seededWorkers.push(worker);
  }

  // If this was a fresh database, add a few sample logs for today so dashboard has data
  const logsCount = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
  if (logsCount === 0 && seededWorkers.length >= 4) {
    console.log('  🕒 Adding sample attendance logs for today...');
    const now = new Date();
    
    // Marcus arrived at 7:30 AM and is currently IN
    const marcusTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30, 0).toISOString();
    db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)').run(seededWorkers[0].id, 'in', marcusTime);

    // Elena arrived at 7:45 AM and is currently IN
    const elenaTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 45, 0).toISOString();
    db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)').run(seededWorkers[1].id, 'in', elenaTime);

    // David arrived at 8:00 AM, stepped out for lunch at 12:00 PM (currently OUT)
    const davidIn = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString();
    const davidOut = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
    db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)').run(seededWorkers[2].id, 'in', davidIn);
    db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)').run(seededWorkers[2].id, 'out', davidOut);

    // Sarah arrived at 6:45 AM and is currently IN
    const sarahTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 45, 0).toISOString();
    db.prepare('INSERT INTO logs (worker_id, type, timestamp) VALUES (?, ?, ?)').run(seededWorkers[3].id, 'in', sarahTime);
  }

  const finalWorkers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE active = 1').get().count;
  const finalLogs = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
  console.log(`✅ Seeding complete! Active workers: ${finalWorkers}, Total logs: ${finalLogs}`);
}

seed();
