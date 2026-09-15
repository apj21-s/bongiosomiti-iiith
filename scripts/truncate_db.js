require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function truncateDB() {
  console.log("Deleting checkins...");
  const { error: err1 } = await supabase.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (err1) console.error("Error deleting checkins:", err1);

  console.log("Deleting tickets...");
  const { error: err2 } = await supabase.from('tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (err2) console.error("Error deleting tickets:", err2);

  // Optional: delete from events too if we don't want them in DB at all, but user said "just keep events only"
  console.log("DB cleared (kept events).");
}

truncateDB();
