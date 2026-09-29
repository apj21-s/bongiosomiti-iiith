import { 
  sendQRPassEmail, 
  sendRegistrationPendingEmail, 
  sendPaymentRejectedEmail, 
  sendVerificationCodeEmail, 
  sendManagerDigestEmail 
} from '../utils/email'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function sendAllTestEmails() {
  const testEmail = 'arkaprava.jana@research.iiit.ac.in';
  const testName = 'Arkaprava Jana';
  const eventName = "Mahalaya'r Bangali Bhoj 2026";
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  console.log('Sending Registration Pending Email...');
  try {
    await sendRegistrationPendingEmail(testEmail, testName, eventName, '123456789012', 'MAH-12345');
    console.log('✔ Registration Pending sent.');
  } catch (e) { console.error('Failed', e); }
  await wait(2000);

  console.log('Sending Payment Rejected Email...');
  try {
    await sendPaymentRejectedEmail(testEmail, testName, eventName);
    console.log('✔ Payment Rejected sent.');
  } catch (e) { console.error('Failed', e); }
  await wait(2000);

  console.log('Sending Verification Code Email...');
  try {
    await sendVerificationCodeEmail(testEmail, '938152', 15);
    console.log('✔ Verification Code sent.');
  } catch (e) { console.error('Failed', e); }
  await wait(2000);

  console.log('Sending Manager Digest Email...');
  try {
    await sendManagerDigestEmail(
      testEmail, 
      testName, 
      'admin@okicici', 
      { total: 15, verified: 10, pending: 3, rejected: 2, reallocated: 1 }, 
      'Your Daily Payment Digest'
    );
    console.log('✔ Manager Digest sent.');
  } catch (e) { console.error('Failed', e); }
  await wait(2000);

  console.log('Sending Digital QR Pass (Single)...');
  try {
    await sendQRPassEmail(testEmail, testName, eventName, 'TOKEN_singlepass123');
    console.log('✔ Digital QR Pass (Single) sent.');
  } catch (e) { console.error('Failed', e); }
  await wait(2000);

  console.log('Sending Digital QR Pass (Multiple)...');
  try {
    await sendQRPassEmail(testEmail, testName, eventName, ['TOKEN_multipass123', 'TOKEN_multipass456']);
    console.log('✔ Digital QR Pass (Multiple) sent.');
  } catch (e) { console.error('Failed', e); }

  console.log('\\nAll test emails have been sent successfully!');
}

sendAllTestEmails();
