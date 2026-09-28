import QRCode from 'qrcode'
import path from 'path'
import { mailIsConfigured, sendMail } from './mail-transport'

/**
 * Every message in this file goes through utils/mail-transport.ts rather than
 * a transporter of its own. That module holds the configured SMTP accounts,
 * alternates between them so the day's free allowances add up instead of one
 * being exhausted alone, and moves a refused message to the next account
 * before giving up. It also owns the From address, because a relay rejects a
 * sender it has not verified and the right sender depends on which account
 * ends up carrying the message.
 */

export async function sendQRPassEmail(email: string, participantName: string, eventName: string, tokens: string | string[]) {
  if (!mailIsConfigured()) {
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
    const cid = `qr-code-${i}`

    attachments.push({
      filename: `qr-pass-${i + 1}.png`,
      content: base64Data,
      encoding: 'base64',
      cid: cid
    })

    const passNumber = (i + 1).toString().padStart(2, '0')

    qrImagesHtml += `
      <div style="display: inline-block; vertical-align: top; margin: 0 10px; white-space: normal;">
        <table border="0" cellpadding="0" cellspacing="0" style="max-width: 280px; width: 280px; background-color: #f4ebd8; border-radius: 12px; margin: 0 auto; border: 1px solid #eaddcc; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="padding: 5px;">
              <p style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #7a1f1f; letter-spacing: 2px; margin: 0 0 5px;">PASS ${passNumber}</p>
              <table border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 10px; margin: 0 auto;">
                <tr>
                  <td align="center">
                    <a href="cid:${cid}" target="_blank" download="QR_Pass_${passNumber}.png" style="display: block; text-decoration: none;">
                      <img src="cid:${cid}" alt="QR Pass ${i + 1}" style="display: block; margin: 0 auto; width: 220px; height: 220px; cursor: zoom-in;" />
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 4px 0 0; font-family: monospace; font-size: 14px; color: #281208; font-weight: bold; text-align: center;">Code: ${passCode}</p>
              <p style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #6b6352; letter-spacing: 1px; margin: 4px 0 0;">SINGLE ENTRY</p>
              <p style="font-family: Arial, sans-serif; font-size: 11px; color: #7a1f1f; margin: 5px 0 0;"><a href="cid:${cid}" download="QR_Pass_${passNumber}.png" style="color: #7a1f1f; text-decoration: underline;">Click QR to view/download</a></p>
            </td>
          </tr>
        </table>
      </div>
    `
  }

  
  const carouselHtml = `
    ${tokenArray.length > 1 ? '<p style="font-family: Arial, sans-serif; font-size: 12px; color: #6b6352; font-style: italic; margin: 0 0 8px 0;">&#8592; Swipe left/right to view all passes &#8594;</p>' : ''}
    <div style="width: 100%; max-width: 100%; margin: 0 auto; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; white-space: nowrap; text-align: center; padding-bottom: 8px;">
      ${qrImagesHtml}
    </div>
  `

  const html = `
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
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="table-layout: fixed; width: 100%; background-color: #ebdccc; margin: 0; padding: 0;">
        <tr>
          <td align="center" style="padding: 5px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="master-canvas" style="table-layout: fixed; width: 100%; max-width: 680px; margin: 0 auto; background-color: #ebdccc; background-image: radial-gradient(ellipse at 20% 20%, rgba(255,253,247,0.8) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 80% 80%, rgba(255,253,247,0.7) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 50% 120%, rgba(219,199,178,0.5) 0%, transparent 60%), radial-gradient(ellipse at -20% 50%, rgba(219,199,178,0.4) 0%, transparent 50%), repeating-radial-gradient(circle at 50% 50%, rgba(219,199,178,0.05) 0px, rgba(219,199,178,0.05) 2px, transparent 2px, transparent 4px); background-position: center; background-repeat: no-repeat;">
              <tr>
                <td align="center">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto;">
                     <tr>
                       <td width="10%" align="left" valign="top"></td>
                       <td width="80%" align="center" valign="top" style="padding-top: 8px;">
                         <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/logo/logo.png" alt="Mahalaya Logo" style="max-width: 120px; display: block; pointer-events:none;" /></a>
                         <p style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 1.5px; color: #6b6352; text-transform: uppercase; margin: 5px 0 3px;">IIIT Hyderabad Bangiya Samiti</p>
                         <h1 style="font-family: Georgia, serif; color: #7a1f1f; font-size: 28px; font-weight: normal; margin: 0 0 5px;">${eventName}</h1>
                       </td>
                       <td width="10%" align="right" valign="top"></td>
                     </tr>
                  </table>
      
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="table-layout: fixed; width: 100%; max-width: 580px; margin: 5px auto; background-color: #fdfbf7; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                     <tr>
                       <td align="center" style="padding: 12px 15px;" class="mobile-padding">
                          
                          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                            <tr><td align="center" valign="middle">
                              <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img 
                                src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/icons/tick.png" 
                                alt="Verified" 
                                width="70" 
                                height="70" 
                                style="display: block; border: none; width: 70px; height: 70px; pointer-events:none;"
                              ></a>
                            </td></tr>
                          </table>
                          
                          <h2 style="font-family: Georgia, serif; color: #2c4233; font-size: 24px; font-weight: normal; margin: 8px 0 5px; line-height: 1.25;">Registration Confirmed</h2>
                          
                          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 8px auto;">
                            <tr><td align="center" valign="middle">
                              <div style="width: 40px; height: 1px; background-color: #eaddcc; display: inline-block; vertical-align: middle;"></div>
                              <div style="display: inline-block; vertical-align: middle; margin: 0 8px; font-size: 0; line-height: 0;">
                                <div style="display: inline-block; width: 10px; height: 10px; background-color: #7a1f1f; border-radius: 50% 0 50% 0; transform: rotate(45deg);"></div>
                              </div>
                              <div style="width: 40px; height: 1px; background-color: #eaddcc; display: inline-block; vertical-align: middle;"></div>
                            </td></tr>
                          </table>
      
                          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #4a4a4a; line-height: 1.5; margin: 0 0 8px;">Dear <strong>${participantName}</strong>, your QR ${tokenArray.length > 1 ? 'passes are' : 'pass is'} ready. Please present ${tokenArray.length > 1 ? 'these' : 'this'} at the gate.</p>
                          
                          
                          <div class="qr-carousel">
                            ${carouselHtml}
                          </div>
      
                          <p style="margin: 8px 0 10px; font-family: Arial, sans-serif; font-size: 12px; color: #7a1f1f; font-weight: bold;">IMPORTANT: ${tokenArray.length > 1 ? 'These are' : 'This is'} strictly single-entry. Do not share.</p>
      
                          
                          <a href="mailto:bangiya.samiti.iiith@gmail.com" style="text-decoration: none; cursor: pointer; display: inline-block;">
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
      
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
                     <tr>
                       <td align="center" valign="middle">
                          <p style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #2c4233; margin: 0 0 3px 0;">IIIT Hyderabad Bangiya Samiti</p>
                          <p style="font-family: Arial, sans-serif; font-size: 9px; color: #8e806c; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px;">CULTURE | COMMUNITY | TOGETHER</p>
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
  `

  // sendMail reports failure in its result rather than throwing - it has
  // already tried every configured account by then - so the result has to be
  // read. Catching alone would see nothing and let the caller report a pass as
  // sent when none was, which is exactly what /api/pass/resend used to do.
  let result
  try {
    result = await sendMail({
      fromName: 'Utsav Pass',
      to: email,
      subject: `Your Digital Pass for ${eventName}`,
      // Every message carries a plain-text part beside the HTML. A message
      // that is HTML and nothing else is one of the oldest spam signals there
      // is, and these are the mails that must not be filed away unseen.
      text: [
        `Hello ${participantName},`,
        ``,
        `Your pass for ${eventName} is confirmed.`,
        ``,
        Array.isArray(tokens) && tokens.length > 1
          ? `Pass codes: ${tokens.join(', ')}`
          : `Pass code: ${Array.isArray(tokens) ? tokens[0] : tokens}`,
        ``,
        `The QR code is attached to this email. Show it at the gate, either on`,
        `your phone or printed. If the image does not load, the pass code above`,
        `is enough for the gate to find your registration.`,
        ``,
        `Bangiya Samiti, IIIT Hyderabad`,
      ].join('\n'),
      html,
      attachments
    });
  } catch (error: any) {
    console.error(`[email] Transporter error: ${error.message}`)
    throw error;
  }

  if (!result.ok) {
    console.error(`[email] Could not send a pass to ${email}: ${result.errors.join('; ')}`)
    throw new Error('The pass could not be emailed.')
  }
}

export async function sendRegistrationPendingEmail(
  email: string,
  participantName: string,
  eventName: string,
  utr: string,
  referenceNo: string,
) {
  if (!mailIsConfigured()) {
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
  
  <table border="0" cellpadding="0" cellspacing="0" class="master-canvas"
         style="background-color: #f3ece1; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/backgrounds/texture-bg.png'); background-position: 0 0; background-repeat: repeat; background-size: 680px auto;">
    <tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-hide" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/alpona-corner.png'); background-position: -40px bottom; background-repeat: no-repeat; background-size: 280px 292px;"><tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-banana" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/banana-leaf.png'); background-position: 460px bottom; background-repeat: no-repeat; background-size: 320px auto;"><tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-food" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png'); background-position: 490px bottom; background-repeat: no-repeat; background-size: 220px auto;"><tr><td valign="top">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-hide" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/sun.png'); background-position: 70px 17px; background-repeat: no-repeat; background-size: 110px 110px;"><tr><td valign="top" class="canvas-hide" style="background-image: linear-gradient(to bottom, rgba(243,236,225,0) 75%, rgba(243,236,225,1) 100%), url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png'); background-position: -30px 17px, -30px 17px; background-repeat: no-repeat, no-repeat; background-size: 173px 315px, 173px 315px;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" class="canvas-hide" style="background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/cloud-motif.png'); background-position: 20px 66px; background-repeat: no-repeat; background-size: 179px 86px;"><tr><td valign="top">
      
      
      <table border="0" cellpadding="0" cellspacing="0" class="main-layout">
        <tr>
          
          <td width="82" valign="top" class="desktop-spacer" style="width: 82px;"></td>

          
          <td width="516" valign="top" class="center-column" style="width: 516px;">
            
            
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height" style="table-layout: fixed;">
              <tr>
                <td valign="top" class="mobile-auto-height">
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="6" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="96" align="center" valign="middle">
                    <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="cid:mahalaya-logo" width="126" height="96" class="hero-logo" style="display:block; border:none; pointer-events:none;" alt="Logo"></a>
                  </td></tr></table>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="3" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="17" align="center" valign="middle">
                    <p style="font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 2px; color: #6b6352; text-transform: uppercase; margin: 0; line-height: 1;">IIIT Hyderabad<br/>Bangiya Samiti</p>
                  </td></tr></table>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="4" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="50" align="center" valign="middle">
                    <h1 class="event-title" style="font-family: Georgia, serif; color: #7a1f1f; font-size: 44px; font-weight: bold; margin: 0; line-height: 1;">${eventName}</h1>
                  </td></tr></table>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="5" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                  
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
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height"><tr><td height="5" class="mobile-gap-small" style="line-height:0; font-size:0;">&nbsp;</td></tr></table>
                </td>
              </tr>
            </table>

            
            <table border="0" cellpadding="0" cellspacing="0" class="main-card" style="background-color: #fdfbf7; background-image: linear-gradient(#fdfbf7, #fdfbf7); box-shadow: 0 4px 15px rgba(0,0,0,0.03);" bgcolor="#fdfbf7">
              <tr><td valign="top" class="mobile-auto-height" style="padding: 0; overflow: hidden; border-radius: 16px;">
                
                
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="alpona-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/alpona-corner.png'); background-position: -122px calc(100% + 46px); background-repeat: no-repeat; background-size: 280px 292px;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="banana-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/banana-leaf.png'); background-position: 378px calc(100% + 46px); background-repeat: no-repeat; background-size: 320px auto;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">

                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="food-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/food-bowl.png'); background-position: 408px calc(100% + 46px); background-repeat: no-repeat; background-size: 220px auto;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" class="kash-layer mobile-auto-height" style="border-radius: 16px; overflow: hidden; background-image: linear-gradient(to bottom, rgba(253,251,247,0) 75%, rgba(253,251,247,1) 100%), url('https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/kash-left.png'); background-position: -112px -205px, -112px -205px; background-repeat: no-repeat, no-repeat; background-size: 173px 315px, 173px 315px;"><tr><td valign="top" style="border-radius: 16px; overflow: hidden;" class="mobile-auto-height">
                
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  
                  
                  <tr><td height="8" class="mobile-auto-height mobile-gap-medium" style="height: 8px; max-height: 8px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr><td align="center" valign="middle" class="hourglass-circle" style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 120px; height: 120px;" bgcolor="#f4ebd8">
                        <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/icons/hourglass-icon.png" class="hourglass-icon" style="width: 93px; height: auto; display:block; pointer-events:none;"></a>
                      </td></tr>
                    </table>
                  </td></tr>
                  
                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <h2 class="card-heading" style="font-family: Georgia, serif; color: #2c4233; font-size: 26px; font-weight: normal; margin: 0; line-height: 1.25; width: 322px;">Registration Pending<br/>Verification</h2>
                  </td></tr>

                  
                  <tr><td height="6" class="mobile-auto-height mobile-gap-small" style="height: 6px; max-height: 6px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="https://cdn.jsdelivr.net/gh/bangiyasamiti/mahalaya-email-assets/decorative/divider-lotus.png" style="width: 169px; height: auto; display:block; pointer-events:none;"></a>
                  </td></tr>

                  
                  <tr><td height="8" class="mobile-auto-height mobile-gap-medium" style="height: 8px; max-height: 8px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Dear <strong>${participantName}</strong>,</p>
                  </td></tr>

                  
                  <tr><td height="4" class="mobile-auto-height" style="height: 4px; max-height: 4px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">We have received your registration and the UPI transaction reference (<strong>${utr}</strong>).</p>
                  </td></tr>

                  
                  <tr><td height="7" class="mobile-auto-height" style="height: 7px; max-height: 7px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
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
                          <p class="reference-number" style="font-family: monospace; font-size: 21px; font-weight: bold; color: #7a1f1f; margin: 0; letter-spacing: 1px;"><span style="-webkit-user-select: all; user-select: all; cursor: pointer;" title="Click to select all">${referenceNo}</span></p>
                        </td>
                      </tr>
                    </table>
                  </td></tr>

                  
                  <tr><td height="6" class="mobile-auto-height" style="height: 6px; max-height: 6px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Please use this reference number along with your phone number to track your payment status on <a href="${appUrl}" style="color: #7a1f1f; text-decoration: none; font-weight: bold;">our portal</a>.</p>
                  </td></tr>

                  
                  <tr><td height="10" class="mobile-auto-height" style="height: 10px; max-height: 10px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Our team is currently verifying the payment.<br/><strong>Once your payment is confirmed, you will receive another email containing your digital QR pass.</strong></p>
                  </td></tr>

                  
                  <tr><td height="23" class="mobile-auto-height" style="height: 23px; max-height: 23px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="left" valign="middle" class="content-padding mobile-auto-height" style="padding-left: 44px; padding-right: 44px;">
                    <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">If you have any questions, please contact the organizers.</p>
                  </td></tr>

                  
                  <tr><td height="6" class="mobile-auto-height mobile-gap-medium" style="height: 6px; max-height: 6px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <div style="width: 40px; border-top: 1px solid #c4b5a3;"></div>
                  </td></tr>

                  
                  <tr><td height="8" class="mobile-auto-height mobile-gap-small" style="height: 8px; max-height: 8px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <a href="mailto:bangiya.samiti.iiith@gmail.com" style="text-decoration: none; cursor: pointer;">
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
                            <p class="body-copy contact-text" style="font-family: Arial, sans-serif; font-size: 13px; color: #6b6352; margin: 0; line-height: 1.5;">For any queries, click here to<br/><span style="text-decoration: underline;">reach out to us .</span></p>
                         </td>
                      </tr>
                   </table>
                    </a>
                  </td></tr>

                  
                  <tr><td height="20" class="mobile-auto-height mobile-gap-large" style="height: 20px; max-height: 20px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <p class="footer-title" style="font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 2px; color: #6b6352; text-transform: uppercase; margin: 0; line-height: 1;">IIIT Hyderabad Bangiya Samiti</p>
                  </td></tr>

                  
                  <tr><td height="5" class="mobile-auto-height mobile-gap-small" style="height: 5px; max-height: 5px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                  
                  <tr><td align="center" valign="middle" class="mobile-auto-height">
                    <p class="footer-tagline" style="font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 3px; color: #8e806c; text-transform: uppercase; margin: 0; line-height: 1;">CULTURE | COMMUNITY | TOGETHER</p>
                  </td></tr>

                  
                  <tr><td height="8" class="mobile-auto-height mobile-gap-large" style="height: 8px; max-height: 8px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>

                </table>
                
                
                </td></tr></table>
                </td></tr></table>
                </td></tr></table>
                </td></tr></table>
              </td></tr>
            </table>

            
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="mobile-auto-height">
              <tr><td class="mobile-auto-height" style="height: 46px; max-height: 46px; overflow: hidden; line-height: 0; font-size: 0;">&nbsp;</td></tr>
            </table>

          </td>

          
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

  const result = await sendMail({
    fromName: 'Utsav Pass',
    to: email,
    subject: `Registration Pending Verification for ${eventName}`,
    text: [
      `Hello ${participantName},`,
      ``,
      `We have your registration for ${eventName} and are checking the payment.`,
      ``,
      `Reference number: ${referenceNo}`,
      utr ? `Transaction (UTR): ${utr}` : ``,
      ``,
      `Your pass will be emailed as soon as a volunteer has confirmed the`,
      `payment. Nothing further is needed from you.`,
      ``,
      `Bangiya Samiti, IIIT Hyderabad`,
    ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n'),
    html,
    attachments
  })

  if (!result.ok) {
    console.error(`[email] Could not send the pending notice to ${email}: ${result.errors.join('; ')}`)
    throw new Error('The registration notice could not be emailed.')
  }
}

export async function sendPaymentRejectedEmail(
  email: string,
  participantName: string,
  eventName: string,
) {
  if (!mailIsConfigured()) {
    console.warn('SMTP credentials missing. Skipping rejection email send to:', email)
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Rejected</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #ffffff; color: #333; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fcfcfc; padding: 30px; border-radius: 8px; border: 1px solid #eee; }
    h1 { color: #d32f2f; margin-bottom: 20px; }
    p { line-height: 1.6; margin-bottom: 15px; }
    .footer { margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Payment Verification Failed</h1>
    <p>Dear <strong>${participantName}</strong>,</p>
    <p>We regret to inform you that we could not verify your payment for <strong>${eventName}</strong>.</p>
    <p>This typically happens if the UTR / transaction reference number is incorrect, or the payment did not successfully reach our account.</p>
    <p>If you believe this is an error, or if you have any questions, please contact the organizers immediately.</p>
    <p><a href="mailto:bangiya.samiti.iiith@gmail.com" style="color: #d32f2f; font-weight: bold; text-decoration: none;">Click here to email our support team</a></p>
    <p>You can also check your status on our portal: <a href="${appUrl}/pass" style="color: #1976d2;">Verify Status</a></p>
    <div class="footer">
      IIIT Hyderabad Bangiya Samiti<br/>
      Culture | Community | Together
    </div>
  </div>
</body>
</html>
  `;

  const result = await sendMail({
    fromName: 'Utsav Admin',
    to: email,
    subject: `Action Required: Payment Verification Failed for ${eventName}`,
    text: [
      `Hello ${participantName},`,
      ``,
      `We could not verify the payment for your ${eventName} registration, so`,
      `no pass has been issued.`,
      ``,
      `This is usually a transaction id that does not match the receipt, or a`,
      `payment made to the wrong UPI id. If you believe the payment went`,
      `through, reply to this email with the transaction id and we will look`,
      `again.`,
      ``,
      `Bangiya Samiti, IIIT Hyderabad`,
    ].join('\n'),
    html,
  })

  if (!result.ok) {
    console.error(`[email] Could not send the rejection notice to ${email}: ${result.errors.join('; ')}`)
    throw new Error('The rejection notice could not be emailed.')
  }
}

/**
 * Sends the one-time code that proves the address is real.
 *
 * Unlike the other senders in this file, this one reports failure instead of
 * warning and returning. The others are courtesies - a pass that does not
 * arrive by mail can still be looked up - but this message *is* the check. If
 * it cannot be sent, the caller must refuse the verification rather than let a
 * registration through unproved.
 */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  minutesValid: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!mailIsConfigured()) {
    console.error('[verify] SMTP credentials missing; cannot send a verification code to:', email)
    return { ok: false, reason: 'mail-not-configured' }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background:#fdf6e9;font-family:Georgia,'Times New Roman',serif;color:#2b1d12;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6e9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffaf2;border:1px solid #e6d3b3;border-radius:12px;padding:32px;">
          <tr><td style="font-size:20px;font-weight:bold;padding-bottom:8px;">Confirm your email</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px;color:#5b4632;">
            Enter this code on the registration form to confirm this address is yours.
          </td></tr>
          <tr><td align="center" style="padding-bottom:24px;">
            <div style="display:inline-block;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;font-weight:bold;color:#8c2d19;background:#f6e7cd;border:1px solid #e0c79b;border-radius:10px;padding:14px 20px 14px 30px;">${code}</div>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#6b5b4c;">
            The code is good for ${minutesValid} minutes. If you did not ask to register
            for a Bangiya Samiti event, no action is needed - someone may have
            mistyped their address, and nothing has been created in your name.
          </td></tr>
        </table>
        <div style="font-size:12px;color:#8a7861;padding-top:16px;">বঙ্গীয় সমিতি &middot; IIIT Hyderabad</div>
      </td>
    </tr>
  </table>
</body>
</html>`

  // sendMail reports failure in its result rather than throwing, because it has
  // already tried every configured account by the time it gives up. Checking
  // `result.ok` is therefore the whole check - a try/catch here would see
  // nothing and wave an undelivered code through as sent, which would let an
  // unverifiable address register.
  let result
  try {
    result = await sendMail({
      fromName: 'Utsav Pass',
      to: email,
      subject: `${code} is your Bangiya Samiti verification code`,
      text: `Your verification code is ${code}. It is good for ${minutesValid} minutes.`,
      html,
    })
  } catch (e) {
    console.error('[verify] Could not send a verification code:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'send-failed' }
  }

  if (!result.ok) {
    // A rejected recipient lands here too, which is itself a useful signal that
    // the address does not exist.
    console.error('[verify] Could not send a verification code:', result.errors.join('; '))
    return { ok: false, reason: 'send-failed' }
  }

  return { ok: true }
}

/**
 * A manager's periodic summary of their own takings.
 *
 * Only sent when there is something in it - see worthSending() in
 * utils/digest.ts. Reports failure rather than throwing, because a digest is
 * a courtesy and one that does not arrive must not stop the rest of a run.
 */
export async function sendManagerDigestEmail(
  email: string,
  managerName: string,
  upiId: string,
  counts: { total: number; verified: number; pending: number; rejected: number; reallocated: number },
  subject: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!mailIsConfigured()) {
    console.warn('[digest] No SMTP account configured; skipping digest to:', email)
    return { ok: false, reason: 'mail-not-configured' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const row = (label: string, value: number, accent?: string) => `
    <tr>
      <td style="padding:7px 0;font-size:14px;color:#5b4632;">${label}</td>
      <td style="padding:7px 0;font-size:16px;font-weight:bold;text-align:right;color:${accent || '#2b1d12'};">${value}</td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your payments</title></head>
<body style="margin:0;padding:0;background:#fdf6e9;font-family:Georgia,'Times New Roman',serif;color:#2b1d12;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6e9;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffaf2;border:1px solid #e6d3b3;border-radius:12px;padding:28px;">
        <tr><td style="font-size:19px;font-weight:bold;padding-bottom:4px;">Hello ${managerName},</td></tr>
        <tr><td style="font-size:14px;color:#6b5b4c;padding-bottom:18px;">
          Payments collected at <strong>${upiId}</strong>.
        </td></tr>
        ${counts.reallocated > 0 ? `
        <tr><td style="padding:10px 12px;margin-bottom:14px;background:#f6e7cd;border-left:3px solid #b65a3c;font-size:14px;color:#5b4632;">
          <strong>${counts.reallocated}</strong> payment${counts.reallocated === 1 ? ' has' : 's have'} been assigned to you
          by an administrator. ${counts.reallocated === 1 ? 'It was' : 'They were'} originally paid to someone else&rsquo;s ID.
        </td></tr><tr><td style="height:14px;"></td></tr>` : ''}
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #efe1c9;">
            ${row('Payments in total', counts.total)}
            ${row('Verified', counts.verified, '#2f7d4f')}
            ${row('Still to verify', counts.pending, counts.pending > 0 ? '#8F321F' : '#2b1d12')}
            ${counts.rejected > 0 ? row('Rejected', counts.rejected) : ''}
          </table>
        </td></tr>
        ${counts.pending > 0 ? `
        <tr><td style="padding-top:22px;">
          <a href="${appUrl}/admin/payments" style="display:inline-block;padding:11px 20px;background:#8F321F;color:#fffaf2;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;">Verify them now</a>
        </td></tr>` : `
        <tr><td style="padding-top:18px;font-size:14px;color:#2f7d4f;">Nothing is waiting on you. Thank you.</td></tr>`}
      </table>
      <div style="font-size:12px;color:#8a7861;padding-top:14px;">বঙ্গীয় সমিতি &middot; IIIT Hyderabad</div>
    </td></tr>
  </table>
</body></html>`

  const text = [
    `Hello ${managerName},`,
    ``,
    `Payments collected at ${upiId}:`,
    ``,
    `  In total:        ${counts.total}`,
    `  Verified:        ${counts.verified}`,
    `  Still to verify: ${counts.pending}`,
    counts.rejected > 0 ? `  Rejected:        ${counts.rejected}` : '',
    counts.reallocated > 0
      ? `\n${counts.reallocated} payment(s) were assigned to you by an administrator.`
      : '',
    ``,
    counts.pending > 0 ? `Verify them at ${appUrl}/admin/payments` : 'Nothing is waiting on you.',
    ``,
    `Bangiya Samiti, IIIT Hyderabad`,
  ].filter((l) => l !== '').join('\n')

  const result = await sendMail({ fromName: 'Utsav Admin', to: email, subject, text, html })
  if (!result.ok) {
    console.error(`[digest] Could not send to ${email}: ${result.errors.join('; ')}`)
    return { ok: false, reason: 'send-failed' }
  }
  return { ok: true }
}
