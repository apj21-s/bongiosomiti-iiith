require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) !== 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendTestEmail() {
  const toEmail = 'sagar.vishwakarma@students.iiit.ac.in';
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("Missing SMTP credentials in .env.local");
    process.exit(1);
  }

  try {
    const info = await transporter.sendMail({
      from: `"Utsav Pass Test" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: "Test Email from Utsav System",
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>This is a test email</h2>
          <p>If you received this, the SMTP configuration is working correctly.</p>
        </div>
      `,
    });
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending test email:", error);
  }
}

sendTestEmail();
