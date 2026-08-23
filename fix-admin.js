const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const correctId = '3a984996-ed16-45ed-8b22-fdcd54f99db4'
  
  // Try inserting into admin_profiles
  const { error } = await supabase.from('admin_profiles').upsert({
    id: correctId,
    name: 'IIIT Bongio Samiti Admin',
    email: 'admin@gmail.com',
    role: 'organiser'
  })
  console.log("Upserted admin_profiles:", error)
}
run()
