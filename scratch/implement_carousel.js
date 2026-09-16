const fs = require('fs');
const emailFile = 'utils/email.ts';
let content = fs.readFileSync(emailFile, 'utf8');

// I need to replace the qrImagesHtml generation loop.
const oldLoopRegex = /let qrImagesHtml = ''\s*for \(let i = 0; i < tokenArray\.length; i\+\+\) \{[\s\S]*?\${qrImagesHtml}/;

// Wait, I should just regex replace the entire sendQRPassEmail function to be safe.
const newQRPassEmail = `export async function sendQRPassEmail(email: string, participantName: string, eventName: string, tokens: string | string[]) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Skipping email send to:', email)
    return
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [tokens]
  const attachments = []
  let qrImagesHtml = ''

  for (let i = 0; i < tokenArray.length; i++) {
    const t = tokenArray[i]
    const passCode = t.includes('_') ? t.split('_')[1] : t
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

    qrImagesHtml += \`
      <div style="display: inline-block; vertical-align: top; margin: 0 10px; white-space: normal;">
        <table border="0" cellpadding="0" cellspacing="0" style="max-width: 280px; width: 280px; background-color: #f4ebd8; border-radius: 12px; margin: 0 auto; border: 1px solid #eaddcc; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="padding: 15px;">
              <p style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #7a1f1f; letter-spacing: 2px; margin: 0 0 10px;">PASS \${passNumber}</p>
              <table border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 10px; margin: 0 auto;">
                <tr>
                  <td align="center">
                    <a href="cid:\${cid}" target="_blank" download="QR_Pass_\${passNumber}.png" style="display: block; text-decoration: none;">
                      <img src="cid:\${cid}" alt="QR Pass \${i + 1}" style="display: block; margin: 0 auto; width: 220px; height: 220px; cursor: zoom-in;" />
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 8px 0 0; font-family: monospace; font-size: 14px; color: #281208; font-weight: bold; text-align: center;">Code: \${passCode}</p>
              <p style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #6b6352; letter-spacing: 1px; margin: 8px 0 0;">SINGLE ENTRY</p>
              <p style="font-family: Arial, sans-serif; font-size: 11px; color: #7a1f1f; margin: 10px 0 0;"><a href="cid:\${cid}" download="QR_Pass_\${passNumber}.png" style="color: #7a1f1f; text-decoration: underline;">Click QR to view/download</a></p>
            </td>
          </tr>
        </table>
      </div>
    \`
  }

  // Wrap qrImagesHtml in a horizontal scroll container
  const carouselHtml = \`
    \${tokenArray.length > 1 ? '<p style="font-family: Arial, sans-serif; font-size: 12px; color: #6b6352; font-style: italic; margin: 0 0 15px 0;">&#8592; Swipe left/right to view all passes &#8594;</p>' : ''}
    <div style="width: 100%; max-width: 550px; margin: 0 auto; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; white-space: nowrap; text-align: center; padding-bottom: 15px;">
      \${qrImagesHtml}
    </div>
  \`

  const html = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Your Digital Pass is Ready</title>
      <link href="https://cdn.hugeicons.com/font/hgi-stroke-rounded.css" rel="stylesheet">
      <style>
        :root {
          color-scheme: light;
          supported-color-schemes: light;
        }
        body { margin: 0; padding: 0; background-color: #ebdccc; }
        table { border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; }
        
        /* Hide scrollbar for a cleaner swipe experience on webkit */
        .qr-carousel::-webkit-scrollbar {
          height: 6px;
        }
        .qr-carousel::-webkit-scrollbar-track {
          background: #fdfbf7;
          border-radius: 4px;
        }
        .qr-carousel::-webkit-scrollbar-thumb {
          background-color: #eaddcc;
          border-radius: 4px;
        }

        @media only screen and (max-width: 680px) {
          .mobile-padding { padding: 15px !important; }
          .hide-mobile { display: none !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #ebdccc;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #ebdccc; margin: 0; padding: 0;">
        <tr>
          <td align="center" style="padding: 10px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="master-canvas" style="max-width: 680px; margin: 0 auto; background-color: #ebdccc; background-image: radial-gradient(ellipse at 20% 20%, rgba(255,253,247,0.8) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 80% 80%, rgba(255,253,247,0.7) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 50% 120%, rgba(219,199,178,0.5) 0%, transparent 60%), radial-gradient(ellipse at -20% 50%, rgba(219,199,178,0.4) 0%, transparent 50%), repeating-radial-gradient(circle at 50% 50%, rgba(219,199,178,0.05) 0px, rgba(219,199,178,0.05) 2px, transparent 2px, transparent 4px); background-position: center; background-repeat: no-repeat;">
              <tr>
                <td align="center">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto;">
                     <tr>
                       <td width="10%" align="left" valign="top"></td>
                       <td width="80%" align="center" valign="top" style="padding-top: 15px;">
                         <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/logo/logo.png" alt="Mahalaya Logo" style="max-width: 120px; display: block;" />
                         <p style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 1.5px; color: #6b6352; text-transform: uppercase; margin: 10px 0 5px;">IIIT Hyderabad Bangiya Samiti</p>
                         <h1 style="font-family: Georgia, serif; color: #7a1f1f; font-size: 28px; font-weight: normal; margin: 0 0 10px;">\${eventName}</h1>
                       </td>
                       <td width="10%" align="right" valign="top"></td>
                     </tr>
                  </table>
      
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 10px auto; background-color: #fdfbf7; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                     <tr>
                       <td align="center" style="padding: 25px 15px;" class="mobile-padding">
                          
                          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                            <tr><td align="center" valign="middle" style="background-color: #fcf9f2; background-image: linear-gradient(#fcf9f2, #fcf9f2); border-radius: 50%; width: 70px; height: 70px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);" bgcolor="#fcf9f2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" color="#2c4233" fill="none" stroke="#2c4233" stroke-width="1.5" style="filter: drop-shadow(0 2px 4px rgba(44, 66, 51, 0.2));">
                                <path d="M18.9905 19H19M18.9905 19C18.3678 19.6175 17.2393 19.4637 16.4479 19.4637C15.4765 19.4637 15.0087 19.6537 14.3154 20.347C13.7251 20.9374 12.9337 22 12 22C11.0663 22 10.2749 20.9374 9.68457 20.347C8.99128 19.6537 8.52349 19.4637 7.55206 19.4637C6.76068 19.4637 5.63218 19.6175 5.00949 19C4.38181 18.3776 4.53628 17.2444 4.53628 16.4479C4.53628 15.4414 4.31616 14.9786 3.59938 14.2618C2.53314 13.1956 2.00002 12.6624 2 12C2.00001 11.3375 2.53312 10.8044 3.59935 9.73817C4.2392 9.09832 4.53628 8.46428 4.53628 7.55206C4.53628 6.76065 4.38249 5.63214 5 5.00944C5.62243 4.38178 6.7556 4.53626 7.55208 4.53626C8.46427 4.53626 9.09832 4.2392 9.73815 3.59937C10.8044 2.53312 11.3375 2 12 2C12.6625 2 13.1956 2.53312 14.2618 3.59937C14.9015 4.23907 15.5355 4.53626 16.4479 4.53626C17.2393 4.53626 18.3679 4.38247 18.9906 5C19.6182 5.62243 19.4637 6.75559 19.4637 7.55206C19.4637 8.55858 19.6839 9.02137 20.4006 9.73817C21.4669 10.8044 22 11.3375 22 12C22 12.6624 21.4669 13.1956 20.4006 14.2618C19.6838 14.9786 19.4637 15.4414 19.4637 16.4479C19.4637 17.2444 19.6182 18.3776 18.9905 19Z"></path>
                                <path d="M9 12.8929C9 12.8929 10.2 13.5447 10.8 14.5C10.8 14.5 12.6 10.75 15 9.5" stroke-linecap="round" stroke-linejoin="round"></path>
                              </svg>
                            </td></tr>
                          </table>
                          
                          <h2 style="font-family: Georgia, serif; color: #2c4233; font-size: 24px; font-weight: normal; margin: 15px 0 10px; line-height: 1.25;">Registration Confirmed</h2>
                          
                          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 15px auto;">
                            <tr><td align="center" valign="middle">
                              <div style="width: 40px; height: 1px; background-color: #eaddcc; display: inline-block; vertical-align: middle;"></div>
                              <div style="display: inline-block; vertical-align: middle; margin: 0 8px; font-size: 0; line-height: 0;">
                                <div style="display: inline-block; width: 10px; height: 10px; background-color: #7a1f1f; border-radius: 50% 0 50% 0; transform: rotate(45deg);"></div>
                              </div>
                              <div style="width: 40px; height: 1px; background-color: #eaddcc; display: inline-block; vertical-align: middle;"></div>
                            </td></tr>
                          </table>
      
                          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #4a4a4a; line-height: 1.5; margin: 0 0 15px;">Dear <strong>\${participantName}</strong>, your QR \${tokenArray.length > 1 ? 'passes are' : 'pass is'} ready. Please present \${tokenArray.length > 1 ? 'these' : 'this'} at the gate.</p>
                          
                          <!-- QR Carousel Container -->
                          <div class="qr-carousel">
                            \${carouselHtml}
                          </div>
      
                          <p style="margin: 15px 0 20px; font-family: Arial, sans-serif; font-size: 12px; color: #7a1f1f; font-weight: bold;">IMPORTANT: \${tokenArray.length > 1 ? 'These are' : 'This is'} strictly single-entry. Do not share.</p>
      
                          <!-- Contact Section -->
                          <a href="mailto:bangiya.samiti.iith@gmail.com" style="text-decoration: none; cursor: pointer; display: inline-block;">
                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                              <tr>
                                <td width="36" valign="middle" align="center">
                                  <div style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 32px; height: 32px; text-align: center; line-height: 32px; display: inline-block;">
                                    <div style="width: 14px; height: 9px; border: 1.5px solid #8e806c; border-radius: 2px; position: relative; overflow: hidden; margin: 11px auto 0; box-sizing: border-box;">
                                     <div style="position: absolute; top: 0; left: -1px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 5px solid #8e806c;"></div>
                                     <div style="position: absolute; top: 0; left: 1px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 4px solid #f4ebd8;"></div>
                                   </div>
                                  </div>
                                </td>
                                <td align="left" valign="middle" style="padding-left: 10px;">
                                  <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 12px; color: #6b6352; line-height: 1.4; margin: 0;">For any queries, click here to<br/><span style="text-decoration: underline;">reach out to us .</span></p>
                                </td>
                              </tr>
                            </table>
                          </a>
      
                       </td>
                     </tr>
                  </table>
      
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
                     <tr>
                       <td align="center" valign="middle">
                          <p style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #2c4233; margin: 0 0 6px 0;">IIIT Hyderabad Bangiya Samiti</p>
                          <p style="font-family: Arial, sans-serif; font-size: 9px; color: #8e806c; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 15px;">CULTURE | COMMUNITY | TOGETHER</p>
                       </td>
                     </tr>
                  </table>
                  
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
}`

const oldSendQRPassRegex = /export async function sendQRPassEmail[\s\S]*?attachments\n\s*}\)\n}/;
content = content.replace(oldSendQRPassRegex, newQRPassEmail);

fs.writeFileSync(emailFile, content, 'utf8');
console.log('Carousel implementation complete');
