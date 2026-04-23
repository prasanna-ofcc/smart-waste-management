const { supabase } = require('../db/supabase');
const { mapSupabaseError } = require('../utils/errors');

async function logActivity({ userId = null, actionType, entityType = null, entityId = null, metadata = {} }) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) throw mapSupabaseError(error, 'Failed to write activity log.');
}

async function logWorker({ workerId, action, binId = null, requestId = null, details = {} }) {
  const { error } = await supabase.from('worker_logs').insert({
    worker_id: workerId,
    action,
    bin_id: binId,
    request_id: requestId,
    details,
  });

  if (error) throw mapSupabaseError(error, 'Failed to write worker log.');
}

module.exports = { logActivity, logWorker };
