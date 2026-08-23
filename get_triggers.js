const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.rpc('get_triggers', {})
  // If rpc doesn't exist, just do a direct query using postgrest on pg_trigger
  // Actually we can't easily query pg_trigger from postgrest.
}
run()
