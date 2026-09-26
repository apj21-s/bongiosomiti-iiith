const fs = require('fs');

const content = fs.readFileSync('utils/email.ts', 'utf8');

const targetContentRegex = /export async function sendRegistrationPendingEmail\([\s\S]*?^}/m;
const match = content.match(targetContentRegex);
if (!match) {
  console.error("Could not find sendRegistrationPendingEmail function");
  process.exit(1);
}

const newFunction = `export async function sendRegistrationPendingEmail(email: string, participantName: string, eventName: string, utr: string, referenceNo: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Skipping pending email send to:', email)
    return
  }

  const html = \`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Pending Verification</title>
      <style>
        body { margin: 0; padding: 0; background-color: #fcf9f2; }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; outline: none; text-decoration: none; border: none; }
        a { text-decoration: none; }
        .hide-mobile { display: block; }
        @media only screen and (max-width: 600px) {
          .mobile-stack { display: block !important; width: 100% !important; text-align: center !important; }
          .mobile-padding { padding: 30px 20px !important; }
          .hide-mobile { display: none !important; }
          .title-desktop { font-size: 32px !important; }
          .subtitle-desktop { font-size: 10px !important; letter-spacing: 2px !important; }
          .ref-text { font-size: 18px !important; }
          .hero-kash { max-width: 80px !important; }
          .hero-logo { max-width: 120px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #fcf9f2; -webkit-font-smoothing: antialiased;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fcf9f2; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/backgrounds/texture-bg.png'); background-size: cover; background-position: center top; margin: 0; padding: 0;">
        <tr>
          <td align="center" style="padding: 10px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 660px; margin: 0 auto;">
               <tr>
                 <td width="25%" align="left" valign="top" background="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/sun.png" style="background-position: left 20px; background-repeat: no-repeat; background-size: 70px;">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png" alt="" class="hero-kash" style="max-width: 120px; display: block;" />
                 </td>
                 <td width="50%" align="center" valign="top" style="padding-top: 15px;">
                   <img src="cid:mahalaya-logo" alt="Mahalaya Logo" class="hero-logo" style="max-width: 140px; display: block; margin: 0 auto;" />
                   <p style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 2px; color: #6b6352; text-transform: uppercase; margin: 12px 0 5px;">IIIT Hyderabad Bangiya Samiti</p>
                   <h1 class="title-desktop" style="font-family: Georgia, serif; color: #7a1f1f; font-size: 42px; font-weight: normal; margin: 5px 0;">\${eventName}</h1>
                   <p class="subtitle-desktop" style="font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 4px; color: #6b6352; text-transform: uppercase; margin: 0 0 15px;">
                     <span style="color: #7a1f1f;">&mdash;</span> A TASTE OF HOME <span style="color: #7a1f1f;">&mdash;</span>
                   </p>
                 </td>
                 <td width="25%" align="right" valign="top" class="hide-mobile">
                   <p style="font-family: Georgia, serif; font-style: italic; color: #8e806c; font-size: 13px; margin: 25px 25px 0 0; text-align: right; line-height: 1.4;">Food<br/>People<br/>Home<br/><span style="color: #d1bfae; font-style: normal;">&mdash;</span></p>
                 </td>
               </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 10px auto 20px auto; background-color: #fcfbf8; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.04); border: 1px solid #f2eadc;">
               <tr>
                 <td align="center" style="padding: 40px 45px;" class="mobile-padding">
                   <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                     <tr>
                       <td align="center" valign="middle" style="background-color: #f4ebd8; border-radius: 50%; width: 64px; height: 64px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                         <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/icons/hourglass-icon.png" alt="Pending" style="width: 28px; height: 28px; display: block; margin: 0 auto;" />
                       </td>
                     </tr>
                   </table>
                   
                   <h2 style="font-family: Georgia, serif; color: #2c4233; font-size: 26px; margin: 0 0 20px; line-height: 1.35; font-weight: normal;">Registration Pending<br/>Verification</h2>
                   
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/divider-lotus.png" alt="" style="width: 36px; margin-bottom: 35px; display: block;" />

                   <div style="text-align: left; font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6;">
                     <p style="margin: 0 0 15px; color: #2c4233;">Dear <strong>\${participantName}</strong>,</p>
                     
                     <p style="margin: 0 0 25px;">We have received your registration and the UPI transaction reference (<strong>\${utr}</strong>).</p>
                     
                     <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4ebd8; border-radius: 10px; margin-bottom: 30px;">
                       <tr>
                         <td width="60" align="center" valign="middle" style="border-right: 1px solid #e3d3bd;">
                           <table border="0" cellpadding="0" cellspacing="0">
                             <tr>
                               <td align="center" valign="middle" style="width: 26px; height: 18px; background-color: #7a1f1f; border-radius: 2px; border: 1px dashed #f4ebd8;">
                               </td>
                             </tr>
                           </table>
                         </td>
                         <td style="padding: 18px 20px;">
                           <p style="font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8e806c; margin: 0 0 6px;">Registration Reference Number</p>
                           <p class="ref-text" style="font-family: monospace; font-size: 22px; font-weight: bold; color: #7a1f1f; margin: 0; letter-spacing: 1px; word-break: break-all;">\${referenceNo}</p>
                         </td>
                       </tr>
                     </table>
                     
                     <p style="margin: 0 0 25px;">Please use this reference number along with your phone number to track your payment status on our portal.</p>
                     
                     <p style="margin: 0 0 25px;">Our team is currently verifying the payment.<br/><strong>Once your payment is confirmed, you will receive another email containing your digital QR pass.</strong></p>
                     
                     <p style="margin: 0 0 35px;">If you have any questions, please contact the organizers.</p>
                     
                     <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                           <td align="center" style="border-top: 1px solid #eaddcc; padding-top: 25px;">
                              <table border="0" cellpadding="0" cellspacing="0">
                                 <tr>
                                    <td style="padding-right: 15px;" valign="middle">
                                       <table border="0" cellpadding="0" cellspacing="0">
                                          <tr>
                                             <td align="center" valign="middle" style="background-color: #f4ebd8; border-radius: 50%; width: 36px; height: 36px; color: #8e806c; font-size: 16px;">
                                                &#9993;
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

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 660px; margin: 0 auto; margin-bottom: 20px;">
               <tr>
                 <td width="30%" align="left" valign="bottom" class="hide-mobile">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/alpona-corner.png" alt="" style="width: 100%; max-width: 130px; height: auto; opacity: 0.6; display: block;" />
                 </td>
                 
                 <td width="40%" align="center" valign="bottom" style="padding-bottom: 30px; padding-top: 20px;" class="mobile-stack">
                    <p style="font-family: Arial, sans-serif; font-size: 13px; color: #4a4a4a; font-weight: bold; margin: 0 0 8px;">IIIT Hyderabad Bangiya Samiti</p>
                    <p style="font-family: Arial, sans-serif; font-size: 10px; color: #6b6352; letter-spacing: 2px; text-transform: uppercase; margin: 0;">CULTURE | COMMUNITY | TOGETHER</p>
                 </td>
                 
                 <td width="30%" align="right" valign="bottom" class="hide-mobile" style="position: relative;">
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/steam-right.png" alt="" style="width: 100%; max-width: 50px; height: auto; display: block; margin-bottom: -10px; margin-right: 40px; opacity: 0.6;" />
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png" alt="" style="width: 100%; max-width: 120px; height: auto; display: block; margin-bottom: -30px; position: relative; z-index: 2;" />
                   <img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/banana-leaf.png" alt="" style="width: 100%; max-width: 160px; height: auto; display: block; position: relative; z-index: 1;" />
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
    subject: \`Registration Pending Verification for \${eventName}\`,
    html,
    attachments: [
      {
        filename: 'mahalaya-logo.png',
        path: path.join(process.cwd(), 'public', 'assets', 'logo.png'),
        cid: 'mahalaya-logo'
      }
    ]
  })
}`;

fs.writeFileSync('utils/email.ts', content.replace(targetContentRegex, newFunction));
console.log('File updated successfully.');
