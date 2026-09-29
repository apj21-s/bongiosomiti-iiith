import { sendQRPassEmail } from '../utils/email'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testEmails() {
  console.log('Sending single pass...');
  await sendQRPassEmail('arkaprava.jana@research.iiit.ac.in', 'Arkaprava Jana', 'Mahalaya 2026', 'TOKEN_singlepass123');
  
  console.log('Sending multiple passes...');
  await sendQRPassEmail('arkaprava.jana@research.iiit.ac.in', 'Arkaprava Jana', 'Mahalaya 2026', ['TOKEN_multipass123', 'TOKEN_multipass456']);
  console.log('Done!');
}
testEmails().catch(console.error);
