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

module.exports = {
  getWorkerPerformance,
  getBinUsage,
  getRequestStats,
};
