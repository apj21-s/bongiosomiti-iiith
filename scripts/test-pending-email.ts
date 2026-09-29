import { sendRegistrationPendingEmail } from '../utils/email'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testPendingEmail() {
  console.log('Sending Pending Verification email...');
  try {
    await sendRegistrationPendingEmail(
      'arkaprava.jana@research.iiit.ac.in',
      'Arkaprava Jana',
      'Mahalaya\'r Bangali Bhoj 2026',
      '123456789012',
      'MAH-12345'
    )
    console.log('Successfully sent.');
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}

testPendingEmail();
