const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: users, error: e1 } = await supabase.from('admin_profiles').select('*')
  console.log('admin_profiles:', users, e1)
}
run()
