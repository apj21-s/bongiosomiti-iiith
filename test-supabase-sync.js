require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const dummyRow = [{
      id: "test_1",
      title: "Test",
      date: "Date",
      src: "src.webp",
      pos: "center center",
      sort_order: 1
    }];

  const { data, error } = await supabase
      .from('album_photos')
      .upsert(dummyRow, { onConflict: 'id' });

  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS");
  }
}

test();
