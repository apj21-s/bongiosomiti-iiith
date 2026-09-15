const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const email = 'admin@gmail.com';
  const password = 'admin@123';

  // Check if user already exists
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }
  
  let user = users.find(u => u.email === email);

  if (user) {
    console.log(`User ${email} already exists. Updating password...`);
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: password }
    );
    if (updateError) {
      console.error("Error updating password:", updateError);
      return;
    }
  } else {
    console.log(`Creating user ${email}...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    if (createError) {
      console.error("Error creating user:", createError);
      return;
    }
    user = createData.user;
    console.log("User created successfully.");
  }

  // Ensure admin profile exists
  if (user) {
    console.log("Upserting admin_profiles...");
    const { error: profileError } = await supabase
      .from('admin_profiles')
      .upsert({
        id: user.id,
        email: email,
        name: 'Super Admin',
        role: 'admin'
      }, { onConflict: 'id' });
    
    if (profileError) {
      console.error("Error upserting profile:", profileError);
    } else {
      console.log("Admin profile created successfully.");
    }
  }
}

createAdmin();
