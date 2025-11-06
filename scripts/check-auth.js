const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAuthSettings() {
  console.log('\n=== Checking Supabase Auth Configuration ===\n');

  // List recent users
  console.log('Recent sign-ups:');
  const { data: users, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 10
  });

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  if (users && users.users.length > 0) {
    users.users.forEach(user => {
      console.log(`- ${user.email} | Created: ${user.created_at} | Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    });
  } else {
    console.log('No users found');
  }

  console.log('\nTotal users:', users?.users.length || 0);

  // Check for unconfirmed emails
  const unconfirmed = users?.users.filter(u => !u.email_confirmed_at) || [];
  if (unconfirmed.length > 0) {
    console.log('\nUnconfirmed emails:', unconfirmed.length);
    console.log('Users waiting for email confirmation:');
    unconfirmed.forEach(u => console.log(`  - ${u.email}`));
  }
}

async function confirmUserEmail(email) {
  console.log(`\nManually confirming email for: ${email}`);

  // First, get the user
  const { data: users, error: fetchError } = await supabase.auth.admin.listUsers();

  if (fetchError) {
    console.error('Error fetching users:', fetchError);
    return;
  }

  const user = users.users.find(u => u.email === email);

  if (!user) {
    console.log('User not found');
    return;
  }

  // Update user to confirm email
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { email_confirm: true }
  );

  if (error) {
    console.error('Error confirming email:', error);
  } else {
    console.log('Email confirmed successfully!');
  }
}

// Run the check
checkAuthSettings().then(() => {
  // If you want to manually confirm a specific email, uncomment and modify:
  // confirmUserEmail('user@example.com');
});