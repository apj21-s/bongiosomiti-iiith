import { config } from 'dotenv'
config({ path: ['.env.local', '.env'] })

const { sendQRPassEmail, sendRegistrationPendingEmail } = require('../utils/email')

async function test() {
  const testEmail = 'arka24apj@gmail.com'
  const name = 'John Doe'
  const eventName = 'Mahalaya 2026'
  const utr = '987654321012'
  const referenceNo = '54321'
  const tokens = ['token_test_1', 'token_test_2']

  console.log(`Sending pending test email to ${testEmail}...`)
  try {
    await sendRegistrationPendingEmail(testEmail, name, eventName, utr, referenceNo)
    console.log('Successfully sent pending email!')
  } catch (error) {
    console.error('Error sending pending email:', error)
  }

  // Brief pause between sends
  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log(`Sending QR pass test email to ${testEmail}...`)
  try {
    await sendQRPassEmail(testEmail, name, eventName, tokens)
    console.log('Successfully sent QR Pass email!')
  } catch (error) {
    console.error('Error sending QR Pass email:', error)
  }
}

test()
