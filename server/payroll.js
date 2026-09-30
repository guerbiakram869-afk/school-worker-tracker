const defaultDb = require('./db');

/**
 * Calculates hours worked for a worker within a given date range.
 *
 * Logic:
 * - Fetches all logs for that worker within the date range, ordered by timestamp.
 * - Pairs them: each check-in matches the next check-out on the same calendar day.
 * - Calculates the time difference in hours (decimal, e.g. 7.5) for each complete pair.
 * - If a check-in has no matching check-out for that day, it is NOT included in the total.
 *   That day is marked as incomplete: true in the returned data.
 * - Sums all complete pairs to get total hours for the period.
 *
 * @param {number} workerId
 * @param {string} [startDate] Optional start date ('YYYY-MM-DD' or ISO string)
 * @param {string} [endDate] Optional end date ('YYYY-MM-DD' or ISO string)
 * @param {object} [customDb] Optional SQLite database instance (for tests)
 * @returns {object} { workerId, total_hours, totalHours, incomplete_days_count, incompleteDaysCount, days }
 */
function calculateHoursWorked(workerId, startDate, endDate, customDb) {
  const db = customDb || defaultDb;

  let query = `
    SELECT id, worker_id, type, timestamp, edited_by_admin
    FROM logs
    WHERE worker_id = ?
  `;
  const params = [workerId];

  if (startDate) {
    query += ' AND date(timestamp) >= date(?)';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date(timestamp) <= date(?)';
    params.push(endDate);
  }

  query += ' ORDER BY timestamp ASC, id ASC';

  const logs = db.prepare(query).all(...params);

  // Group logs by calendar day (YYYY-MM-DD)
  const daysMap = {};
  for (const log of logs) {
    const day = log.timestamp ? log.timestamp.slice(0, 10) : '';
    if (!day) continue;
    if (!daysMap[day]) {
      daysMap[day] = [];
    }
    daysMap[day].push(log);
  }

  let totalHours = 0;
  let incompleteDaysCount = 0;
  const days = [];

  // Sort dates chronologically
  const sortedDates = Object.keys(daysMap).sort();

  for (const date of sortedDates) {
    const dayLogs = daysMap[date];
    // Ensure chronological order within day
    dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let dayHours = 0;
    let dayIncomplete = false;
    const pairs = [];
    let pendingIn = null;

    for (const log of dayLogs) {
      if (log.type === 'in') {
        if (pendingIn) {
          // Check-in was never closed by a check-out before another check-in arrived
          dayIncomplete = true;
        }
        pendingIn = log;
      } else if (log.type === 'out') {
        if (pendingIn) {
          // Found matching check-out for the check-in on the same day
          const inTime = new Date(pendingIn.timestamp).getTime();
          const outTime = new Date(log.timestamp).getTime();
          const diffMs = outTime - inTime;
          const hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
          const roundedPairHours = Math.round(hours * 100) / 100;

          dayHours += roundedPairHours;
          pairs.push({
            checkIn: pendingIn,
            checkOut: log,
            hours: roundedPairHours
          });
          pendingIn = null;
        } else {
          // Check-out without preceding check-in on this day
          dayIncomplete = true;
        }
      }
    }

    if (pendingIn) {
      // Check-in has no matching check-out on this day
      dayIncomplete = true;
    }

    dayHours = Math.round(dayHours * 100) / 100;
    if (dayIncomplete) {
      incompleteDaysCount++;
    }
    totalHours += dayHours;

    const dayObj = {
      date,
      hours: dayHours,
      incomplete: dayIncomplete,
      pairs,
      logs: dayLogs
    };

    days.push(dayObj);
    days[date] = dayObj;
  }

  totalHours = Math.round(totalHours * 100) / 100;

  return {
    workerId,
    total_hours: totalHours,
    totalHours,
    incomplete_days_count: incompleteDaysCount,
    incompleteDaysCount,
    days
  };
}

module.exports = {
  calculateHoursWorked
};
