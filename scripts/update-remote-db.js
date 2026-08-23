const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('Updating mahalaya image to .webp...')
  const { data, error } = await supabase
    .from('events')
    .update({ image_url: 'assets/mahalaya-bhoj.webp' })
    .eq('slug', 'mahalaya')
    
  if (error) console.error('Error updating mahalaya:', error)
  else console.log('Successfully updated mahalaya.')

  console.log('Updating saraswati image to .webp...')
  const { data: d2, error: e2 } = await supabase
    .from('events')
    .update({ image_url: 'assets/saraswati-puja.webp' })
    .eq('slug', 'saraswati')

  if (e2) console.error('Error updating saraswati:', e2)
  else console.log('Successfully updated saraswati.')
}

run()
