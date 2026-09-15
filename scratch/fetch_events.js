require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchEvents() {
  const { data, error } = await supabase.from('events').select('*');
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

fetchEvents();
