import nodemailer from 'nodemailer'
import QRCode from 'qrcode'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) !== 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendQRPassEmail(email: string, participantName: string, eventName: string, tokens: string | string[]) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Skipping email send to:', email)
    return
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [tokens]

  // Pass URL (pointing to the first pass if multiple, or just the portal)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const passUrl = `${appUrl}/pass`

  // Generate QR Code base64s
  const attachments = []
  let qrImagesHtml = ''

  for (let i = 0; i < tokenArray.length; i++) {
    const t = tokenArray[i]
    const passCode = t.includes('_') ? t.split('_')[1] : t
    const qrDataUrl = await QRCode.toDataURL(passCode, { 
      width: 350, 
      margin: 2, 
      color: { dark: '#281208', light: '#ffffff' } 
    })
    const base64Data = qrDataUrl.split(',')[1]
    const cid = `qr-code-${i}`
    
    attachments.push({
      filename: `qr-pass-${i + 1}.png`,
      content: base64Data,
      encoding: 'base64',
      cid: cid
    })

    qrImagesHtml += `
      <div style="margin-bottom: 24px;">
        ${tokenArray.length > 1 ? `<p style="margin: 0 0 8px; font-weight: bold; color: #555;">Pass ${i + 1}</p>` : ''}
        <a href="cid:${cid}" target="_blank" style="display: block; text-decoration: none;">
          <img src="cid:${cid}" alt="QR Pass ${i + 1}" style="display: block; margin: 0 auto; width: 250px; height: 250px; border-radius: 12px; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: zoom-in;" />
        </a>
        <p style="margin: 12px 0 0; font-family: monospace; font-size: 16px; color: #281208; font-weight: bold; text-align: center;">Pass Code: ${passCode}</p>
      </div>
    `
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fcf9f2; border: 1px solid #e0d5c1; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #d14620; padding: 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Your Digital Pass is Ready</h1>
      </div>
      <div style="padding: 32px 24px; text-align: center;">
        <h2 style="margin-top: 0; color: #281208; font-size: 20px; margin-bottom: 24px;">${eventName}</h2>
        
        ${qrImagesHtml}

        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Dear <strong>${participantName}</strong>,<br/>
          Your registration has been verified and your digital QR pass has been generated.
        </p>
        <p style="color: #777; font-size: 14px; margin-bottom: 0;">
          Please present ${tokenArray.length > 1 ? 'these passes' : 'this digital pass'} at the entry gate.<br/>DO NOT share ${tokenArray.length > 1 ? 'these QR codes' : 'this QR code'} with anyone, as ${tokenArray.length > 1 ? 'they are strictly single-entry' : 'it is strictly single-entry'}.
        </p>
      </div>
      <div style="background-color: #281208; color: #fcf9f2; padding: 16px; text-align: center; font-size: 12px;">
        IIIT Hyderabad Bangiya Samiti
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Utsav Pass" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: `Your Digital Pass for ${eventName}`,
    html,
    attachments
  })
}

export async function sendRegistrationPendingEmail(email: string, participantName: string, eventName: string, utr: string, referenceNo: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Skipping pending email send to:', email)
    return
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #fcf9f2; border: 1px solid #e0d5c1; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #e0d5c1; padding: 24px; text-align: center; color: #281208;">
        <h1 style="margin: 0; font-size: 24px;">Registration Pending Verification</h1>
      </div>
      <div style="padding: 32px 24px; text-align: center;">
        <h2 style="margin-top: 0; color: #281208; font-size: 20px; margin-bottom: 24px;">${eventName}</h2>
        
        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Dear <strong>${participantName}</strong>,<br/><br/>
          We have received your registration and the UPI transaction reference (<strong>${utr}</strong>).<br/><br/>
          Your registration reference number is <strong>${referenceNo}</strong>. Please use this reference number along with your phone number to track your payment status on our portal.<br/><br/>
          Our team is currently verifying the payment. <strong>Once your payment is confirmed, you will receive another email containing your digital QR pass.</strong>
        </p>
        
        <p style="color: #777; font-size: 14px; margin-bottom: 0;">
          If you have any questions, please contact the organizers.
        </p>
      </div>
      <div style="background-color: #281208; color: #fcf9f2; padding: 16px; text-align: center; font-size: 12px;">
        IIIT Hyderabad Bangiya Samiti
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Utsav Pass" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: `Registration Pending Verification for ${eventName}`,
    html,
  })
}
