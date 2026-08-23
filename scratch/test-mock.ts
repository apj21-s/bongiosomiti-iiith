import { createMockClient } from '../utils/supabase/mock-client'

async function run() {
  const supabase = createMockClient()
  const { data: recentRegistrations, error } = await supabase
    .from('tickets')
    .select(`
      *,
      event:events(name)
    `)
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log('recentRegistrations', JSON.stringify(recentRegistrations, null, 2))
  console.log('error', error)
}
run()
