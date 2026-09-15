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
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Pending Verification</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f3ece1; }
        table { border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; }
        @media only screen and (max-width: 600px) {
          .mobile-stack { display: block !important; width: 100% !important; text-align: center !important; }
          .mobile-padding { padding: 20px !important; }
          .hide-mobile { display: none !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3ece1;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f3ece1; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/backgrounds/texture-bg.png'); margin: 0; padding: 0;">
        <tr>
          <td align="center" style="padding: 10px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto;">
               <tr>
                 <td width="25%" align="left" valign="top">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png" alt="" style="max-width: 100px; display: block;" />
                 </td>
                 <td width="50%" align="center" valign="top" style="padding-top: 20px;">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/sun.png" alt="" style="max-width: 60px; opacity: 0.6; display: block; margin-bottom: -20px;" />
                 </td>
                 <td width="25%" align="right" valign="top">
                   <p style="font-family: Georgia, serif; font-style: italic; color: #8e806c; font-size: 13px; margin: 20px 20px 0 0; text-align: right; line-height: 1.5;" class="hide-mobile">Food<br/>People<br/>Home<br/><span style="color: #d1bfae;">&mdash;</span></p>
                 </td>
               </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: -20px auto 30px auto;">
               <tr>
                 <td align="center">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/logo/mahalaya-logo.png" alt="Mahalaya Bhoj" style="max-width: 160px; display: block;" />
                   <p style="font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 1.5px; color: #6b6352; text-transform: uppercase; margin: 15px 0 5px;">IIIT Hyderabad Bangiya Samiti</p>
                   <h1 style="font-family: Georgia, serif; color: #7a1f1f; font-size: 38px; font-weight: normal; margin: 5px 0;">${eventName}</h1>
                   <p style="font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 3px; color: #6b6352; text-transform: uppercase; margin: 0 0 10px;"><span style="color: #7a1f1f;">&mdash;</span> A TASTE OF HOME <span style="color: #7a1f1f;">&mdash;</span></p>
                 </td>
               </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #fcfbf8; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
               <tr>
                 <td align="center" style="padding: 40px 30px;" class="mobile-padding">
                   
                   <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                     <tr>
                       <td align="center" valign="middle" style="background-color: #f0e6d2; border-radius: 50%; width: 64px; height: 64px;">
                         <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/icons/hourglass-icon.png" alt="Pending" style="width: 28px; height: 28px; display: block; margin: 0 auto;" />
                       </td>
                     </tr>
                   </table>
                   
                   <h2 style="font-family: Georgia, serif; color: #2c4233; font-size: 26px; margin: 0 0 15px; line-height: 1.3; font-weight: normal;">Registration Pending<br/>Verification</h2>
                   
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/divider-lotus.png" alt="" style="width: 32px; margin-bottom: 30px; display: block;" />

                   <div style="text-align: left; font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6;">
                     <p style="margin: 0 0 15px;">Dear <strong>${participantName}</strong>,</p>
                     
                     <p style="margin: 0 0 25px;">We have received your registration and the UPI transaction reference (<strong>${utr}</strong>).</p>
                     
                     <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4ebd8; border-radius: 8px; margin-bottom: 25px;">
                       <tr>
                         <td style="padding: 20px; text-align: center;">
                           <p style="font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8e806c; margin: 0 0 8px;">Registration Reference Number</p>
                           <p style="font-family: monospace; font-size: 22px; font-weight: bold; color: #7a1f1f; margin: 0; letter-spacing: 1px; word-break: break-all;">${referenceNo}</p>
                         </td>
                       </tr>
                     </table>
                     
                     <p style="margin: 0 0 20px;">Please use this reference number along with your phone number to track your payment status on our portal.</p>
                     
                     <p style="margin: 0 0 25px;">Our team is currently verifying the payment.<br/><strong>Once your payment is confirmed, you will receive another email containing your digital QR pass.</strong></p>
                     
                     <p style="margin: 0 0 30px;">If you have any questions, please contact the organizers.</p>
                     
                     <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                           <td align="center" style="border-top: 1px solid #eaddcc; padding-top: 20px;">
                              <table border="0" cellpadding="0" cellspacing="0">
                                 <tr>
                                    <td style="padding-right: 15px;" valign="middle">
                                       <table border="0" cellpadding="0" cellspacing="0">
                                          <tr>
                                             <td align="center" valign="middle" style="background-color: #f4ebd8; border-radius: 50%; width: 36px; height: 36px;">
                                                <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/flower-sprinkle.png" alt="" style="width: 16px; height: 16px;" />
                                             </td>
                                          </tr>
                                       </table>
                                    </td>
                                    <td align="left" valign="middle">
                                       <p style="font-family: Arial, sans-serif; font-size: 13px; color: #6b6352; margin: 0; line-height: 1.5;">For any queries, reach out to us at<br/>the official contacts.</p>
                                    </td>
                                 </tr>
                              </table>
                           </td>
                        </tr>
                     </table>
                     
                   </div>
                 </td>
               </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; margin-top: 10px;">
               <tr>
                 <td width="30%" align="left" valign="bottom" class="hide-mobile">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/alpona-corner.png" alt="" style="width: 100%; max-width: 120px; height: auto; opacity: 0.6; display: block;" />
                 </td>
                 
                 <td width="40%" align="center" valign="bottom" style="padding-bottom: 40px; padding-top: 30px;" class="mobile-stack">
                    <p style="font-family: Arial, sans-serif; font-size: 13px; color: #4a4a4a; font-weight: bold; margin: 0 0 8px;">IIIT Hyderabad Bangiya Samiti</p>
                    <p style="font-family: Arial, sans-serif; font-size: 10px; color: #6b6352; letter-spacing: 2px; text-transform: uppercase; margin: 0;">Culture | Community | Together</p>
                 </td>
                 
                 <td width="30%" align="right" valign="bottom" class="hide-mobile">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png" alt="" style="width: 100%; max-width: 140px; height: auto; display: block;" />
                 </td>
               </tr>
            </table>
            
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  await transporter.sendMail({
    from: `"Utsav Pass" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: `Registration Pending Verification for ${eventName}`,
    html,
  })
}
