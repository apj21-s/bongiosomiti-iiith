const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportTable(tableName) {
  let allData = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + limit - 1);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    allData = allData.concat(data);
    if (data.length < limit) {
      hasMore = false;
    } else {
      from += limit;
    }
  }

  await fs.writeFile(`export_${tableName}.json`, JSON.stringify(allData, null, 2));
  console.log(`Exported ${allData.length} rows from ${tableName}`);
}

async function main() {
  const tables = ['events', 'admin_profiles', 'tickets', 'checkins'];
  for (const table of tables) {
    await exportTable(table);
  }
  console.log("Export complete.");
}

main();
