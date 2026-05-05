const { supabase } = require('../db/supabase');
const { mapSupabaseError } = require('../utils/errors');

async function getWorkerPerformance() {
  const { data: workers, error: workersError } = await supabase
    .from('users')
    .select('id,name,email,worker_status')
    .eq('role', 'worker');
  if (workersError) throw mapSupabaseError(workersError, 'Failed to fetch workers.');

  const { data: workerLogs, error: logsError } = await supabase.from('worker_logs').select('*');
  if (logsError) throw mapSupabaseError(logsError, 'Failed to fetch worker logs.');

  return workers.map((worker) => {
    const logs = workerLogs.filter((log) => log.worker_id === worker.id);
    const binsCollected = logs.filter((log) => log.action === 'BIN_COLLECTED').length;
    const requestsHandled = logs.filter((log) => log.action === 'REQUEST_COMPLETED').length;
    return {
      workerId: worker.id,
      name: worker.name,
      email: worker.email,
      workerStatus: worker.worker_status,
      binsCollected,
      requestsHandled,
    };
  });
}

async function getBinUsage() {
  const { data: bins, error: binsError } = await supabase.from('bins').select('id,label,fill_level,status,last_collected_at');
  if (binsError) throw mapSupabaseError(binsError, 'Failed to fetch bins.');

  const { data: fillEvents, error: eventsError } = await supabase.from('bin_fill_events').select('bin_id,filled_at,fill_duration_seconds');
  if (eventsError) throw mapSupabaseError(eventsError, 'Failed to fetch fill events.');

  return bins.map((bin) => {
    const events = fillEvents.filter((event) => event.bin_id === bin.id);
    return {
      binId: bin.id,
      label: bin.label,
      currentFillLevel: bin.fill_level,
      status: bin.status,
      lastCollectedAt: bin.last_collected_at,
      fillFrequencyCount: events.length,
      averageFillDurationSeconds: events.length
        ? Math.floor(events.reduce((acc, event) => acc + (event.fill_duration_seconds || 0), 0) / events.length)
        : null,
    };
  });
}

async function getRequestStats() {
  const { data: requests, error } = await supabase.from('requests').select('status,request_type,accepted_by,completed_by');
  if (error) throw mapSupabaseError(error, 'Failed to fetch request stats.');

  return {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    garbageCollection: requests.filter((r) => r.request_type === 'garbage_collection').length,
    newBinPlacement: requests.filter((r) => r.request_type === 'new_bin_placement').length,
  };
}

function buildDateSeries(keys, countsMap) {
  return keys.map((key) => ({
    date: key,
    count: countsMap.get(key) || 0,
  }));
}

function buildLastNDaysKeys(days) {
  const keys = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function buildLastNMonthsKeys(months) {
  const keys = [];
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

async function getCollectionSummary() {
  const { data: logs, error } = await supabase
    .from('worker_logs')
    .select('id,worker_id,bin_id,action,created_at,users(name)')
    .eq('action', 'BIN_COLLECTED')
    .order('created_at', { ascending: false });

  if (error) throw mapSupabaseError(error, 'Failed to fetch collection logs.');

  const dayCounts = new Map();
  const monthCounts = new Map();
  const workerCounts = new Map();

  const workerDetails = (logs || []).map((row) => {
    const createdAt = new Date(row.created_at);
    const dayKey = createdAt.toISOString().slice(0, 10);
    const monthKey = createdAt.toISOString().slice(0, 7);

    dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);

    const workerKey = row.worker_id;
    const existing = workerCounts.get(workerKey) || { workerId: workerKey, workerName: row.users?.name || 'Unknown', total: 0 };
    existing.total += 1;
    if (row.users?.name) existing.workerName = row.users.name;
    workerCounts.set(workerKey, existing);

    return {
      id: row.id,
      workerId: row.worker_id,
      workerName: row.users?.name || 'Unknown',
      binId: row.bin_id,
      collectedAt: row.created_at,
      dayKey,
      monthKey,
    };
  });

  const dayKeys = buildLastNDaysKeys(30);
  const monthKeys = buildLastNMonthsKeys(12);

  return {
    dayWise: buildDateSeries(dayKeys, dayCounts),
    monthWise: buildDateSeries(monthKeys, monthCounts),
    perWorker: Array.from(workerCounts.values()).sort((a, b) => b.total - a.total),
    perWorkerDetails: workerDetails,
  };
}

module.exports = {
  getWorkerPerformance,
  getBinUsage,
  getRequestStats,
  getCollectionSummary,
};
