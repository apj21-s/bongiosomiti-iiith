const fs = require('fs');
const content = fs.readFileSync('utils/email.ts', 'utf8');

const startStr = "export async function sendQRPassEmail";
const endStr = "export async function sendRegistrationPendingEmail";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

const targetContent = content.substring(startIndex, endIndex);

const newContent = `export async function sendQRPassEmail(email: string, participantName: string, eventName: string, tokens: string | string[]) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Skipping email send to:', email)
    return
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [tokens]

  // Pass URL (pointing to the first pass if multiple, or just the portal)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const passUrl = \`\${appUrl}/pass\`

  // Generate QR Code base64s
  const attachments = []
  let qrImagesHtml = ''

  for (let i = 0; i < tokenArray.length; i++) {
    const t = tokenArray[i]
    const qrDataUrl = await QRCode.toDataURL(t, { 
      width: 350, 
      margin: 2, 
      color: { dark: '#281208', light: '#ffffff' } 
    })
    const base64Data = qrDataUrl.split(',')[1]
    const cid = \`qr-code-\${i}\`
    
    attachments.push({
      filename: \`qr-pass-\${i + 1}.png\`,
      content: base64Data,
      encoding: 'base64',
      cid: cid
    })

    const passNumber = (i + 1).toString().padStart(2, '0')
    const showDivider = i > 0

    qrImagesHtml += \`
      \${showDivider ? \`<img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/divider-lotus.png" alt="" style="width: 32px; display: block; margin: 20px auto; opacity: 0.5;" />\` : ''}
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 300px; background-color: #f4ebd8; border-radius: 12px; margin: 0 auto; border: 1px solid #eaddcc;">
              <tr>
                <td align="center" style="padding: 20px;">
                  <p style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #7a1f1f; letter-spacing: 2px; margin: 0 0 15px;">PASS \${passNumber}</p>
                  <table border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 10px;">
                    <tr>
                      <td align="center">
                        <img src="cid:\${cid}" alt="QR Pass \${i + 1}" style="display: block; margin: 0 auto; width: 220px; height: 220px;" />
                      </td>
                    </tr>
                  </table>
                  <p style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #6b6352; letter-spacing: 1px; margin: 15px 0 0;">SINGLE ENTRY</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    \`
  }

  const html = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Digital Pass is Ready</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f3ece1; }
        table { border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; }
        @media only screen and (max-width: 600px) {
          .mobile-padding { padding: 15px !important; }
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
                 <td width="30%" align="left" valign="top">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png" alt="" style="max-width: 80px; display: block;" />
                 </td>
                 <td width="40%" align="center" valign="top" style="padding-top: 15px;">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/logo/logo.png" alt="Mahalaya Logo" style="max-width: 120px; display: block;" />
                   <p style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 1.5px; color: #6b6352; text-transform: uppercase; margin: 10px 0 5px;">IIIT Hyderabad Bangiya Samiti</p>
                   <h1 style="font-family: Georgia, serif; color: #7a1f1f; font-size: 28px; font-weight: normal; margin: 0 0 10px;">\${eventName}</h1>
                   <p style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #2c4233; margin: 0 0 5px;">&#10003; VERIFIED</p>
                   <p style="font-family: Georgia, serif; font-size: 18px; color: #4a4a4a; margin: 0 0 15px;">Your Digital Pass is Ready</p>
                 </td>
                 <td width="30%" align="right" valign="top">
                 </td>
               </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #2c332e; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
               <tr>
                 <td align="center" style="padding: 30px 20px;" class="mobile-padding">
                   \${qrImagesHtml}
                   
                   <div style="text-align: left; font-family: Arial, sans-serif; font-size: 15px; color: #f4ebd8; line-height: 1.6; margin-top: 20px;">
                     <p style="margin: 0 0 10px;">Dear <strong>\${participantName}</strong>,</p>
                     <p style="margin: 0 0 20px;">Your registration has been verified and your digital QR pass has been generated.</p>
                     
                     <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #3b423c; border-left: 4px solid #d1bfae; border-radius: 4px; margin-bottom: 10px;">
                       <tr>
                         <td style="padding: 15px;">
                           <p style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #d1bfae; letter-spacing: 1px; margin: 0 0 10px;">ENTRY INFORMATION</p>
                           <p style="margin: 0 0 10px; font-size: 14px;">Please present \${tokenArray.length > 1 ? 'these passes' : 'this pass'} at the entry gate.</p>
                           <p style="margin: 0 0 10px; font-size: 14px;">Each QR pass is valid for a single entry.</p>
                           <p style="margin: 0; font-size: 14px; color: #e8a2a2; font-weight: bold;">IMPORTANT: Do not share or forward \${tokenArray.length > 1 ? 'these QR codes' : 'this QR code'}. \${tokenArray.length > 1 ? 'They are strictly single-entry' : 'It is strictly single-entry'}.</p>
                         </td>
                       </tr>
                     </table>
                   </div>
                 </td>
               </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 20px auto 0 auto;">
               <tr>
                 <td align="center" valign="middle" style="background-color: #2c4233; padding: 25px 10px; border-radius: 8px;">
                    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #f4ebd8; font-weight: bold; margin: 0 0 8px;">IIIT Hyderabad Bangiya Samiti</p>
                    <p style="font-family: Arial, sans-serif; font-size: 11px; color: #b5c7ba; letter-spacing: 2px; text-transform: uppercase; margin: 0;">CULTURE | COMMUNITY | TOGETHER</p>
                 </td>
               </tr>
            </table>
            
          </td>
        </tr>
      </table>
    </body>
    </html>
  \`

  await transporter.sendMail({
    from: \`"Utsav Pass" <\${process.env.FROM_EMAIL || process.env.SMTP_USER}>\`,
    to: email,
    subject: \`Your Digital Pass for \${eventName}\`,
    html,
    attachments
  })
}
\n`;

fs.writeFileSync('utils/email.ts', content.replace(targetContent, newContent));
console.log('File updated successfully.');
