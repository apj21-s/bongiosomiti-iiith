import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
  const { sendQRPassEmail } = await import('./utils/email')
  console.log('Testing SMTP connection for:', process.env.SMTP_USER)
  try {
    await sendQRPassEmail(
      'sagarjha7174@gmail.com',
      'Sagar Jha',
      'Test Event',
      'TEST-TOKEN-123'
    )
    console.log('Email sent successfully!')
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

run()
