const { sendMail, readAccounts } = require('./utils/mail-transport');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const accounts = readAccounts();
  const account = accounts[2]; // Use the 3rd account (Resend)
  console.log("Testing with account:", account.label);
  
  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: 'otp@aceiiit.in', // Sending to itself to safely test
    subject: 'Test Email',
    text: 'This is a test email.'
  });
  console.log("SendMail result:", JSON.stringify(result, null, 2));
}

test();
