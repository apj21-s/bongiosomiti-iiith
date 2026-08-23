const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@utsavpass.local',
    password: 'password123'
  })
  console.log("Login result:", data?.user ? "Success" : "Failed", error)
}
run()
