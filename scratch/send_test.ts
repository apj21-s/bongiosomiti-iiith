import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local first!
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  // Dynamically import AFTER dotenv has run
  const { sendRegistrationPendingEmail } = await import('../utils/email.js');

  const email = 'sagarjha7174@gmail.com';
  const participantName = 'Arka';
  const eventName = 'Mahalaya Event 2026';
  const utr = 'UTR1234567890';
  const referenceNo = 'MAH-REF-999';

  console.log(`Sending test email to ${email}...`);
  try {
    await sendRegistrationPendingEmail(email, participantName, eventName, utr, referenceNo);
    console.log('Successfully sent Registration Pending Verification email!');
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

main();
