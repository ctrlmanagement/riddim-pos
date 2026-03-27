const { createClient } = require('@supabase/supabase-js');

// Public client — reads (BOH portal, config)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Service role client — writes (sync daemon)
// Bypasses RLS, used only server-side for upserting synced data
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = (serviceKey && serviceKey !== 'your_service_role_key_here')
  ? createClient(process.env.SUPABASE_URL, serviceKey)
  : null;

module.exports = { supabase, supabaseAdmin };
