import nodemailer from 'nodemailer'
import QRCode from 'qrcode'
import path from 'path'

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
<<<<<<< HEAD
    const qrDataUrl = await QRCode.toDataURL(t, {
      width: 350,
      margin: 2,
      color: { dark: '#281208', light: '#ffffff' }
=======
    const passCode = t.includes('_') ? t.split('_')[1] : t
    const qrDataUrl = await QRCode.toDataURL(passCode, {
      width: 350,
      margin: 2,
      color: { dark: '#281208', light: '#ffffff' }
>>>>>>> 260040b3f30497e19ebba25ed68916c92adae7ee
    })
    const base64Data = qrDataUrl.split(',')[1]
    const cid = `qr-code-${i}`

    attachments.push({
      filename: `qr-pass-${i + 1}.png`,
      content: base64Data,
      encoding: 'base64',
      cid: cid
    })

    const passNumber = (i + 1).toString().padStart(2, '0')
    const showDivider = i > 0

    qrImagesHtml += `
<<<<<<< HEAD
      ${showDivider ? `<img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/divider-lotus.png" alt="" style="width: 32px; display: block; margin: 20px auto; opacity: 0.5;" />` : ''}
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 300px; background-color: #f4ebd8; border-radius: 12px; margin: 0 auto; border: 1px solid #eaddcc;">
              <tr>
                <td align="center" style="padding: 20px;">
                  <p style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #7a1f1f; letter-spacing: 2px; margin: 0 0 15px;">PASS ${passNumber}</p>
                  <table border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 10px;">
                    <tr>
                      <td align="center">
                        <img src="cid:${cid}" alt="QR Pass ${i + 1}" style="display: block; margin: 0 auto; width: 220px; height: 220px;" />
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
=======
      <div style="margin-bottom: 24px;">
        ${tokenArray.length > 1 ? `<p style="margin: 0 0 8px; font-weight: bold; color: #555;">Pass ${i + 1}</p>` : ''}
        <a href="cid:${cid}" target="_blank" style="display: block; text-decoration: none;">
          <img src="cid:${cid}" alt="QR Pass ${i + 1}" style="display: block; margin: 0 auto; width: 250px; height: 250px; border-radius: 12px; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: zoom-in;" />
        </a>
        <p style="margin: 12px 0 0; font-family: monospace; font-size: 16px; color: #281208; font-weight: bold; text-align: center;">Pass Code: ${passCode}</p>
      </div>
>>>>>>> 260040b3f30497e19ebba25ed68916c92adae7ee
    `
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Your Digital Pass is Ready</title>
      <style>
        :root {
          color-scheme: light;
          supported-color-schemes: light;
        }
        body { margin: 0; padding: 0; background-color: #f3ece1; }
        table { border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; }
        @media only screen and (max-width: 680px) {
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
                   <h1 style="font-family: Georgia, serif; color: #7a1f1f; font-size: 28px; font-weight: normal; margin: 0 0 10px;">${eventName}</h1>
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
                   ${qrImagesHtml}
                   
                   <div style="text-align: left; font-family: Arial, sans-serif; font-size: 15px; color: #f4ebd8; line-height: 1.6; margin-top: 20px;">
                     <p style="margin: 0 0 10px;">Dear <strong>${participantName}</strong>,</p>
                     <p style="margin: 0 0 20px;">Your registration has been verified and your digital QR pass has been generated.</p>
                     
                     <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #3b423c; border-left: 4px solid #d1bfae; border-radius: 4px; margin-bottom: 10px;">
                       <tr>
                         <td style="padding: 15px;">
                           <p style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #d1bfae; letter-spacing: 1px; margin: 0 0 10px;">ENTRY INFORMATION</p>
                           <p style="margin: 0 0 10px; font-size: 14px;">Please present ${tokenArray.length > 1 ? 'these passes' : 'this pass'} at the entry gate.</p>
                           <p style="margin: 0 0 10px; font-size: 14px;">Each QR pass is valid for a single entry.</p>
                           <p style="margin: 0; font-size: 14px; color: #e8a2a2; font-weight: bold;">IMPORTANT: Do not share or forward ${tokenArray.length > 1 ? 'these QR codes' : 'this QR code'}. ${tokenArray.length > 1 ? 'They are strictly single-entry' : 'It is strictly single-entry'}.</p>
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
  `

  await transporter.sendMail({
    from: `"Utsav Pass" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: `Your Digital Pass for ${eventName}`,
    html,
    attachments
  })
}

export async function sendRegistrationPendingEmail(
  email: string,
  participantName: string,
  eventName: string,
  utr: string,
  referenceNo: string,
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials missing. Skipping pending email send to:', email)
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Mahalaya Registration</title>
  <style>
    :root {
      color-scheme: light;
      supported-color-schemes: light;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #ffffff;
    }
    .outer-table {
      background-color: #ffffff;
    }
    table {
      border-collapse: collapse;
    }
    img {
      border: 0;
      display: block;
      max-width: 100%;
      height: auto;
      -ms-interpolation-mode: bicubic;
    }
    .master-canvas {
      width: 100% !important;
      max-width: 680px !important;
      margin: 0 auto;
    }
    .main-layout {
      width: 100% !important;
      max-width: 680px !important;
    }
    .main-card {
      width: 100% !important;
      max-width: 516px !important;
      background-color: #fdfbf7;
      background-image: linear-gradient(#fdfbf7, #fdfbf7);
      border-radius: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.03);
    }
    .content-padding {
      padding-left: 44px;
      padding-right: 44px;
    }
    .mobile-fluid {
      width: 100% !important;
    }

    @media only screen and (max-width: 600px) {
      body {
        width: 100% !important;
      }
      .master-canvas {
        width: 100% !important;
        max-width: 100% !important;
      }
      .main-layout {
        width: 100% !important;
      }
      .desktop-spacer {
        width: 16px !important;
      }
      .center-column {
        width: calc(100% - 32px) !important;
        max-width: none !important;
      }
      .main-card {
        width: 100% !important;
        max-width: none !important;
      }
      .content-padding {
        padding-left: 24px !important;
        padding-right: 24px !important;
      }
      .mobile-auto-height {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
      .hero-logo {
        width: 110px !important;
        height: auto !important;
      }
      .event-title {
        font-size: 32px !important;
        line-height: 1.1 !important;
      }
      .card-heading {
        width: 100% !important;
        max-width: none !important;
        font-size: 23px !important;
        line-height: 1.25 !important;
      }
      .body-copy {
        font-size: 13px !important;
        line-height: 1.45 !important;
      }
      .reference-box {
        width: 100% !important;
      }
      .reference-label {
        font-size: 8px !important;
        letter-spacing: 1px !important;
      }
      .reference-number {
        font-size: 17px !important;
        letter-spacing: .5px !important;
      }
      .canvas-hide {
        background-image: none !important;
      }
      .alpona-layer {
        background-position: -40px bottom !important;
        background-size: 150px auto !important;
      }
      .canvas-banana {
        background-position: right -40px bottom !important;
        background-size: 170px auto !important;
        background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/banana-leaf.png') !important;
      }
      .banana-layer {
        background-position: right -56px bottom !important;
        background-size: 170px auto !important;
      }
      .canvas-food {
        background-position: right -40px bottom !important;
        background-size: 105px auto !important;
        background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png') !important;
      }
      .food-layer {
        background-position: right -56px bottom !important;
        background-size: 105px auto !important;
      }
      .kash-layer {
        background-image: none !important;
      }
      .hourglass-circle {
        width: 95px !important;
        height: 95px !important;
      }
      .hourglass-icon {
        width: 70px !important;
        height: auto !important;
      }
      .reference-box-icon {
        width: 50px !important;
      }
      .reference-box-content {
        padding-left: 14px !important;
        padding-right: 10px !important;
        padding-top: 14px !important;
        padding-bottom: 14px !important;
      }
      .contact-text {
        font-size: 9px !important;
        line-height: 1.25 !important;
      }
      .contact-icon {
        padding-right: 8px !important;
      }
      .contact-icon-bg {
        width: 22px !important;
        height: 22px !important;
      }
      .contact-icon-inner {
        transform: scale(0.7) !important;
      }
      .footer-title {
        font-size: 8px !important;
        letter-spacing: 1.5px !important;
      }
      .footer-tagline {
        font-size: 7px !important;
        letter-spacing: 2px !important;
      }
      .mobile-gap-small {
        height: 6px !important;
        max-height: 6px !important;
      }
      .mobile-gap-medium {
        height: 10px !important;
        max-height: 10px !important;
      }
      .mobile-gap-large {
        height: 18px !important;
        max-height: 18px !important;
      }
    }

    @media (prefers-color-scheme: dark) {
      body, .outer-table {
        background-color: #1c1c1c !important;
      }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;" class="outer-table">
<table width="100%" border="0" cellpadding="0" cellspacing="0" class="outer-table" style="background-color:#ffffff;">
<tr><td align="center">
  <!-- START MASTER CANVAS -->
  <table border="0" cellpadding="0" cellspacing="0" class="master-canvas"
         style="background-color: #f3ece1; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/backgrounds/texture-bg.png'); background-position: 0 0; background-repeat: repeat; background-size: 680px auto;">
    <tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-hide" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/alpona-corner.png'); background-position: -40px bottom; background-repeat: no-repeat; background-size: 280px 292px;"><tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-banana" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/banana-leaf.png'); background-position: 460px bottom; background-repeat: no-repeat; background-size: 320px auto;"><tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-food" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png'); background-position: 490px bottom; background-repeat: no-repeat; background-size: 220px auto;"><tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-hide" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/sun.png'); background-position: 70px 17px; background-repeat: no-repeat; background-size: 110px 110px;"><tr><td valign="top" class="canvas-hide" style="background-image: linear-gradient(to bottom, rgba(243,236,225,0) 75%, rgba(243,236,225,1) 100%), url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png'); background-position: -30px 17px, -30px 17px; background-repeat: no-repeat, no-repeat; background-size: 173px 315px, 173px 315px;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-hide" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/cloud-motif.png'); background-position: 20px 66px; background-repeat: no-repeat; background-size: 179px 86px;"><tr><td valign="top">
      
      <!-- CONTENT -->
      <table border="0" cellpadding="0" cellspacing="0" class="main-layout">
        <tr>
          <!-- LEFT COLUMN (Empty Spacer for Card Margin) -->
          <td width="82" valign="top" class="desktop-spacer" style="width: 82px;"></td>

          <!-- CENTER COLUMN (Hero, Card, Footer) -->
          <td width="516" valign="top" class="center-column" style="width: 516px;">
            
            <!-- HERO REGION -->
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height" style="table-layout: fixed;">
              <tr>
                <td valign="top" class="mobile-auto-height">
                  <!-- Spacer to Logo (Y=0 to 13) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="13" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  <!-- Logo (Y=13 to 109, Height=96) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="96" align="center" valign="middle">
                    <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="cid:mahalaya-logo" width="126" height="96" class="hero-logo" style="display:block; border:none; pointer-events:none;" alt="Logo"></a>
                  </td></tr></table>
                  <!-- Spacer to Org (Y=109 to 112) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="3" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  <!-- Org Text (Y=112 to 129, Height=17) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="17" align="center" valign="middle">
                    <p style="font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 2px; color: #6b6352; text-transform: uppercase; margin: 0; line-height: 1;">IIIT Hyderabad<br/>Bangiya Samiti</p>
                  </td></tr></table>
                  <!-- Spacer to Title (Y=129 to 136) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="7" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  <!-- Title (Y=136 to 186, Height=50) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="50" align="center" valign="middle">
                    <h1 class="event-title" style="font-family: Georgia, serif; color: #7a1f1f; font-size: 44px; font-weight: bold; margin: 0; line-height: 1;">\${eventName}</h1>
                  </td></tr></table>
                  <!-- Spacer to Tagline (Y=186 to 191) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="5" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  <!-- Tagline (Y=191 to 211, Height=20) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="20" align="center" valign="middle">
                    <table width="282" border="0" cellpadding="0" cellspacing="0" class="mobile-fluid">
                        <tr>
                            <td valign="middle" width="30%" style="border-bottom: 1px solid #c4b5a3;"></td>
                            <td valign="middle" align="center" style="padding: 0 10px;">
                                <p style="font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 2px; color: #6b6352; text-transform: uppercase; margin: 0;">A TASTE OF HOME</p>
                            </td>
                            <td valign="middle" width="30%" style="border-bottom: 1px solid #c4b5a3;"></td>
                        </tr>
                    </table>
                  </td></tr></table>
                  <!-- Spacer to Card (Y=211 to 222) -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="11" class="mobile-gap-small" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                </td>
              </tr>
            </table>

            <!-- MAIN CARD REGION -->
            <table border="0" cellpadding="0" cellspacing="0" class="main-card" style="background-color: #fdfbf7; background-image: linear-gradient(#fdfbf7, #fdfbf7); box-shadow: 0 4px 15px rgba(0,0,0,0.03);" bgcolor="#fdfbf7">
              <tr><td valign="top" class="mobile-auto-height" style="padding: 0; overflow: hidden; border-radius: 16px;">
                
                <!-- INNER DECORATIVE LAYERS (Stamping foreground overlaps) -->
                <!-- Alpona -->
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="alpona-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/alpona-corner.png'); background-position: -122px calc(100% + 46px); background-repeat: no-repeat; background-size: 280px 292px;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">
                <!-- Banana Leaf -->
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="banana-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/banana-leaf.png'); background-position: 378px calc(100% + 46px); background-repeat: no-repeat; background-size: 320px auto;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">

                <!-- Food Bowl -->
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="food-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png'); background-position: 408px calc(100% + 46px); background-repeat: no-repeat; background-size: 220px auto;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">
                <!-- Kash -->
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="kash-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: linear-gradient(to bottom, rgba(253,251,247,0) 75%, rgba(253,251,247,1) 100%), url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png'); background-position: -112px -205px, -112px -205px; background-repeat: no-repeat, no-repeat; background-size: 173px 315px, 173px 315px;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">
                
                <!-- CARD INTERNAL GEOMETRY -->
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  
                  <!-- Spacer: Y=0 to 16 -->
                  <tr><td height="16" class="mobile-auto-height mobile-gap-medium" style="height: 16px; max-height: 16px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Hourglass: Y=16 to 109, Height=93 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr><td align="center" valign="middle" class="hourglass-circle" style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 120px; height: 120px;" bgcolor="#f4ebd8">
                        <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/icons/hourglass-icon.png" class="hourglass-icon" style="width: 93px; height: auto; display:block; pointer-events:none;"></a>
                      </td></tr>
                    </table>
                  </td></tr>
                  
                  <!-- Heading: Y=109 to 175, Height=66 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <h2 class="card-heading" style="font-family: Georgia, serif; color: #2c4233; font-size: 26px; font-weight: normal; margin: 0; line-height: 1.25; width: 322px;">Registration Pending<br/>Verification</h2>
                  </td></tr>

                  <!-- Spacer: Y=175 to 186 -->
                  <tr><td height="11" class="mobile-auto-height mobile-gap-small" style="height: 11px; max-height: 11px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Lotus: Y=186 to 206, Height=20 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/divider-lotus.png" style="width: 169px; height: auto; display:block; pointer-events:none;"></a>
                  </td></tr>

                  <!-- Spacer: Y=206 to 222 -->
                  <tr><td height="16" class="mobile-auto-height mobile-gap-medium" style="height: 16px; max-height: 16px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Greeting: Y=222 to 249, Height=27 -->
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Dear <strong>\${participantName}</strong>,</p>
                  </td></tr>

                  <!-- Spacer: Y=249 to 255 -->
                  <tr><td height="6" class="mobile-auto-height" style="height: 6px; max-height: 6px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- UPI: Y=255 to 301, Height=46 -->
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">We have received your registration and the UPI transaction reference (<strong>\${utr}</strong>).</p>
                  </td></tr>

                  <!-- Spacer: Y=301 to 315 -->
                  <tr><td height="14" class="mobile-auto-height" style="height: 14px; max-height: 14px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Ref Box: Y=315 to 395, Height=80 -->
                  <tr><td align="center" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 35px; padding-right: 35px;">
                    <table border="0" cellpadding="0" cellspacing="0" class="reference-box" style="width: 100%; background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 8px;" bgcolor="#f4ebd8">
                      <tr>
                        <td width="70" align="center" valign="middle" class="reference-box-icon" style="border-right: 1px solid #d1bfae; border-top-left-radius: 8px; border-bottom-left-radius: 8px;">
                          <div style="width: 26px; height: 14px; background-color: #7a1f1f; background-image: linear-gradient(#7a1f1f, #7a1f1f); border-radius: 2px; transform: rotate(-45deg); position: relative; margin: 0 auto;">
                            <div style="position: absolute; left: -4px; top: 3px; width: 8px; height: 8px; background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%;"></div>
                            <div style="position: absolute; right: -4px; top: 3px; width: 8px; height: 8px; background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%;"></div>
                            <div style="position: absolute; top: 6px; left: 6px; right: 6px; border-top: 2px dashed #f4ebd8;"></div>
                          </div>
                        </td>
                        <td align="left" valign="middle" class="reference-box-content" style="padding-left: 20px; padding-right: 10px; padding-top: 15px; padding-bottom: 15px;">
                          <p class="reference-label" style="font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8e806c; margin: 0 0 5px;">Registration Ref.</p>
                          <p class="reference-number" style="font-family: monospace; font-size: 21px; font-weight: bold; color: #7a1f1f; margin: 0; letter-spacing: 1px;"><span style="-webkit-user-select: all; user-select: all; cursor: pointer;" title="Click to select all">\${referenceNo}</span></p>
                        </td>
                      </tr>
                    </table>
                  </td></tr>

                  <!-- Spacer: Y=395 to 406 -->
                  <tr><td height="11" class="mobile-auto-height" style="height: 11px; max-height: 11px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Tracking: Y=406 to 449, Height=43 -->
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Please use this reference number along with your phone number to track your payment status on <a href="\${appUrl}" style="color: #7a1f1f; text-decoration: none; font-weight: bold;">our portal</a>.</p>
                  </td></tr>

                  <!-- Spacer: Y=449 to 469 -->
                  <tr><td height="20" class="mobile-auto-height" style="height: 20px; max-height: 20px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Verification: Y=469 to 535, Height=66 -->
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Our team is currently verifying the payment.<br/><strong>Once your payment is confirmed, you will receive another email containing your digital QR pass.</strong></p>
                  </td></tr>

                  <!-- Spacer: Y=535 to 558 -->
                  <tr><td height="23" class="mobile-auto-height" style="height: 23px; max-height: 23px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- ContactS: Y=558 to 581, Height=23 -->
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">If you have any questions, please contact the organizers.</p>
                  </td></tr>

                  <!-- Spacer: Y=581 to 593 -->
                  <tr><td height="12" class="mobile-auto-height mobile-gap-medium" style="height: 12px; max-height: 12px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Cont.Div: Y=593 to 600, Height=7 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <div style="width: 40px; border-top: 1px solid #c4b5a3;"></div>
                  </td></tr>

                  <!-- Spacer: Y=600 to 617 -->
                  <tr><td height="17" class="mobile-auto-height mobile-gap-small" style="height: 17px; max-height: 17px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- ContactR: Y=617 to 647, Height=30 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <a href="mailto:bangiya.samiti.iith@gmail.com" style="text-decoration: none; cursor: pointer;">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                         <td class="contact-icon" style="padding-right: 15px;" valign="middle">
                            <table border="0" cellpadding="0" cellspacing="0">
                               <tr>
                                  <td align="center" valign="middle" class="contact-icon-bg" style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 30px; height: 30px;" bgcolor="#f4ebd8">
                                     <div class="contact-icon-inner" style="width: 16px; height: 10px; border: 1.5px solid #8e806c; border-radius: 2px; position: relative; overflow: hidden; margin: 0 auto; box-sizing: border-box;">
                                       <div style="position: absolute; top: 0; left: -1px; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 6px solid #8e806c;"></div>
                                       <div style="position: absolute; top: 0; left: 1px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 5px solid #f4ebd8;"></div>
                                     </div>
                                  </td>
                               </tr>
                            </table>
                         </td>
                         <td align="left" valign="middle">
                            <p class="body-copy contact-text" style="font-family: Arial, sans-serif; font-size: 13px; color: #6b6352; margin: 0; line-height: 1.5;">For any queries, reach out to us at<br/>the official contacts.</p>
                         </td>
                      </tr>
                   </table>
                    </a>
                  </td></tr>

                  <!-- Spacer to Footer Title: Y=647 to 692 -->
                  <tr><td height="45" class="mobile-auto-height mobile-gap-large" style="height: 45px; max-height: 45px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Footer Title: Y=692 to 709, Height=17 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <p class="footer-title" style="font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 2px; color: #6b6352; text-transform: uppercase; margin: 0; line-height: 1;">IIIT Hyderabad Bangiya Samiti</p>
                  </td></tr>

                  <!-- Spacer to Footer Sub: Y=709 to 718 -->
                  <tr><td height="9" class="mobile-auto-height mobile-gap-small" style="height: 9px; max-height: 9px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  <!-- Footer Sub: Y=718 to 735, Height=17 -->
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <p class="footer-tagline" style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 3px; color: #8e806c; text-transform: uppercase; margin: 0; line-height: 1;">CULTURE | COMMUNITY | TOGETHER</p>
                  </td></tr>

                  <!-- Bottom Edge Padding: Y=735 to 752 -->
                  <tr><td height="17" class="mobile-auto-height mobile-gap-large" style="height: 17px; max-height: 17px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                </table>
                
                <!-- Close Decorative Wrappers -->
                </td></tr></table>
                </td></tr></table>
                </td></tr></table>
                </td></tr></table>
              </td></tr>
            </table>

            <!-- BOTTOM CANVAS EDGE -->
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height">
              <tr><td class="mobile-auto-height" style="height: 46px; max-height: 46px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>
            </table>

          </td>

          <!-- RIGHT COLUMN (Empty Spacer) -->
          <td width="82" valign="top" class="desktop-spacer" style="width: 82px;"></td>
        </tr>
      </table>

    </td></tr></table>
    </td></tr></table>
    </td></tr></table>
    </td></tr></table>
    </td></tr></table>

    </td></tr></table>
    </td></tr></table>
    </td></tr></table>

  </table>
  <!-- END MASTER CANVAS -->

</td></tr>
</table>
</body>
</html>
  `;

  const attachments = [
    {
      filename: 'mahalaya-logo.png',
      path: path.join(process.cwd(), 'public', 'assets', 'logo.png'),
      cid: 'mahalaya-logo'
    }
  ]

  await transporter.sendMail({
    from: `"Utsav Pass" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: `Registration Pending Verification for ${eventName}`,
    html,
    attachments
  })
}
