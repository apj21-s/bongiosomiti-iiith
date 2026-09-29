import { sendVerificationCodeEmail } from '../utils/email'
require('dotenv').config({ path: '.env.local' })

async function run() {
  console.log('Sending test OTP email...')
  const res = await sendVerificationCodeEmail('arkaprava.jana@research.iiit.ac.in', '789123', 15)
  console.log('Result:', res)
}

run().catch(console.error)
