const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.auth.admin.getUserById('33333333-3333-3333-3333-333333333333')
  console.log("User exists?", data?.user ? "Yes" : "No", error)
}
run()
