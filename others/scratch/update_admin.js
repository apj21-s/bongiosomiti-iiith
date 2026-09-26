import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabaseUrl or supabaseKey");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupAdmin() {
  const email = 'admin@gmail.com';
  const password = 'admin123';

  // Check if user exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  let adminUser = usersData.users.find(u => u.email === email);

  if (!adminUser) {
    console.log("User not found, creating new user...");
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'IIIT Bongio Samiti Admin' }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return;
    }
    adminUser = createData.user;
    console.log("Created user successfully:", adminUser.id);
  } else {
    console.log("User found, updating password...");
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      { password, email_confirm: true }
    );
    if (updateError) {
      console.error("Error updating user:", updateError);
      return;
    }
    console.log("Updated password successfully.");
  }

  // Ensure admin profile exists
  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .upsert({
      id: adminUser.id,
      name: 'IIIT Bongio Samiti Admin',
      email: email,
      role: 'organiser'
    })
    .select();

  if (profileError) {
    console.error("Error creating/updating admin profile:", profileError);
  } else {
    console.log("Admin profile synced:", profile);
  }
}

setupAdmin();
