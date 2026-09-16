require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) !== 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const eventName = 'Mahalaya Bhoj';
const participantName = 'Arka';
const utr = '123456789012';
const referenceNo = 'MAH-1234-ABCD';

// Extract HTML exactly from utils/email.ts
const fs = require('fs');
const emailTsContent = fs.readFileSync('utils/email.ts', 'utf8');
const match = emailTsContent.match(/const html = `([\s\S]*?)`/);
let html = match ? match[1] : '';

// Manually replace template literals
html = html.replace(/\$\{eventName\}/g, eventName)
           .replace(/\$\{participantName\}/g, participantName)
           .replace(/\$\{utr\}/g, utr)
           .replace(/\$\{referenceNo\}/g, referenceNo);

transporter.sendMail({
  from: `"Utsav Pass" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
  to: 'arka24apj@gmail.com',
  subject: `Registration Pending Verification for ${eventName}`,
  html,
  attachments: [
    {
      filename: 'mahalaya-logo.png',
      path: path.join(process.cwd(), 'public', 'assets', 'logo.png'),
      cid: 'mahalaya-logo'
    }
  ]
}).then(info => {
  console.log('Email sent: ' + info.messageId);
}).catch(console.error);
