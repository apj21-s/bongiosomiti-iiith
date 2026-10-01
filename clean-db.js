const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
  console.log("Cleaning checkins...");
  const { error: err1 } = await supabase.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (err1) console.error("Error cleaning checkins:", err1);

  console.log("Cleaning tickets...");
  const { error: err2 } = await supabase.from('tickets').delete().neq('token', 'xxx');
  if (err2) console.error("Error cleaning tickets:", err2);

  console.log("Cleaning email_verifications...");
  const { error: err3 } = await supabase.from('email_verifications').delete().neq('email', 'non_existent_email@example.com');
  if (err3) console.error("Error cleaning email_verifications:", err3);

  console.log("Database cleaned!");
}

clean();
