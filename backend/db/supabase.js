const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isPlaceholder(value) {
  if (!value) return true;
  return (
    value.includes('YOUR_PROJECT_ID') ||
    value.includes('YOUR_SERVICE_ROLE_KEY') ||
    value.includes('example.supabase.co')
  );
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
}

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseServiceRoleKey)) {
  throw new Error(
    'Supabase is not configured. Set real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env (placeholders are not valid).'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };
