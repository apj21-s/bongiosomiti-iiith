import fs from 'fs';
import path from 'path';

const content = `import QRCode from 'qrcode'
import path from 'path'
import { mailIsConfigured, sendMail } from './mail-transport'

function createEmailLayout(contentHtml: string, title: string) {
  return \`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>\${title}</title>
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    @media (prefers-color-scheme: dark) {
      .bg-parchment { background-color: #F5EBD8 !important; }
      .bg-panel { background-color: #FFF8EA !important; }
      .text-primary { color: #54251F !important; }
      .text-secondary { color: #745F4B !important; }
      .text-otp { color: #8C3026 !important; }
      .border-gold { border-color: #C5A66B !important; }
    }
    
    u + #body a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
  </style>
</head>
<body id="body" style="margin: 0 !important; padding: 0 !important; background-color: #F5EBD8;" bgcolor="#F5EBD8">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F5EBD8;" bgcolor="#F5EBD8" class="bg-parchment">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!--[if mso]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560">
        <tr>
        <td align="center" valign="top">
        <![endif]-->
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #F5EBD8; border: 2px solid #C5A66B; border-radius: 8px;" bgcolor="#F5EBD8" class="bg-parchment border-gold">
          <tr>
            <td align="center" style="padding: 32px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <!-- Logo -->
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <img src="cid:mahalaya-logo" width="80" height="auto" style="display: block; width: 80px; max-width: 100%; height: auto;" alt="Bangiya Samiti Logo">
                    <div style="width: 40px; border-bottom: 2px solid #C5A66B; margin: 16px auto 0;" class="border-gold"></div>
                  </td>
                </tr>
                
                \${contentHtml}

              </table>
            </td>
          </tr>
        </table>
        
        <!--[if mso]>
        </td>
        </tr>
        <tr>
        <td align="center" valign="top">
        <![endif]-->
        
        <!-- Footer -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;">
          <tr>
            <td align="center" style="padding-top: 16px;">
              <div style="width: 40px; border-bottom: 1px solid #C5A66B; margin: 0 auto 16px;" class="border-gold"></div>
              <div style="font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 14px; font-weight: bold; color: #8C3026;" class="text-otp">
                বঙ্গীয় সমিতি &middot; IIIT Hyderabad
              </div>
            </td>
          </tr>
        </table>
        
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>\`;
}

function getLogoAttachment() {
  return {
    filename: 'mahalaya-logo.png',
    path: path.join(process.cwd(), 'public', 'assets', 'logo.png'),
    cid: 'mahalaya-logo'
  }
}

export async function sendQRPassEmail(email: string, participantName: string, eventName: string, tokens: string | string[]) {
  if (!mailIsConfigured()) {
    console.warn('SMTP credentials missing. Skipping email send to:', email)
    return
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [tokens]
  const attachments = [getLogoAttachment()]
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
      cid: cid,
      path: '' // required by nodemailer types if content is given
    })

    const passNumber = (i + 1).toString().padStart(2, '0')

    qrImagesHtml += \`
      <tr>
        <td align="center" style="padding-bottom: 16px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 320px; background-color: #FFF8EA; border: 1px solid #C5A66B; border-radius: 8px;" bgcolor="#FFF8EA" class="bg-panel border-gold">
            <tr>
              <td align="center" style="padding: 16px;">
                <div style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #8C3026; letter-spacing: 2px; margin-bottom: 12px;" class="text-otp">PASS \${passNumber}</div>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 4px; padding: 8px; margin-bottom: 12px;">
                  <tr>
                    <td align="center">
                      <img src="cid:\${cid}" alt="QR Pass \${passNumber}" width="200" height="200" style="display: block; width: 200px; height: 200px;">
                    </td>
                  </tr>
                </table>
                <div style="font-family: monospace; font-size: 16px; color: #54251F; font-weight: bold; margin-bottom: 8px;" class="text-primary">Code: \${passCode}</div>
                <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #745F4B; letter-spacing: 1px;" class="text-secondary">SINGLE ENTRY</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    \`
  }

  const contentHtml = \`
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Your Digital Pass Is Ready
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        \${eventName}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Dear <strong>\${participantName}</strong>, your QR \${tokenArray.length > 1 ? 'passes are' : 'pass is'} ready. Please present \${tokenArray.length > 1 ? 'these' : 'this'} at the gate.
      </td>
    </tr>
    \${qrImagesHtml}
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; line-height: 1.6; color: #8C3026; text-align: center;" class="text-otp">
        IMPORTANT: \${tokenArray.length > 1 ? 'These are' : 'This is'} strictly single-entry. Do not share.
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        For any queries, <a href="mailto:bangiya.samiti.iiith@gmail.com" style="color: #8C3026; text-decoration: underline; font-weight: bold;" class="text-otp">reach out to us</a>.
      </td>
    </tr>
  \`

  const html = createEmailLayout(contentHtml, 'Your Digital Pass is Ready')

  let result
  try {
    result = await sendMail({
      fromName: 'bangiya.samiti.iiith',
      to: email,
      subject: \`Your Digital Pass for \${eventName}\`,
      text: [
        \`Hello \${participantName},\`,
        \`\`,
        \`Your pass for \${eventName} is confirmed.\`,
        \`\`,
        Array.isArray(tokens) && tokens.length > 1
          ? \`Pass codes: \${tokens.join(', ')}\`
          : \`Pass code: \${Array.isArray(tokens) ? tokens[0] : tokens}\`,
        \`\`,
        \`The QR code is attached to this email. Show it at the gate, either on\`,
        \`your phone or printed. If the image does not load, the pass code above\`,
        \`is enough for the gate to find your registration.\`,
        \`\`,
        \`Bangiya Samiti, IIIT Hyderabad\`,
      ].join('\\n'),
      html,
      attachments: attachments as any
    });
  } catch (error: any) {
    console.error(\`[email] Transporter error: \${error.message}\`)
    throw error;
  }

  if (!result.ok) {
    console.error(\`[email] Could not send a pass to \${email}: \${result.errors.join('; ')}\`)
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

  const contentHtml = \`
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Registration Received &mdash; Payment Under Verification
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        আপনার নিবন্ধন যাচাইয়ের অপেক্ষায় রয়েছে
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Thank you for registering for <strong>\${eventName}</strong>. We have received your registration details. Your registration is currently awaiting verification by our team.
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 400px; background-color: #FFF8EA; border: 1px solid #C5A66B; border-radius: 8px;" bgcolor="#FFF8EA" class="bg-panel border-gold">
          <tr>
            <td align="left" style="padding: 16px 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #54251F;" class="text-primary">
              <strong>Name:</strong> \${participantName}<br/>
              <strong>Event:</strong> \${eventName}<br/>
              <strong>Registration Ref:</strong> \${referenceNo}<br/>
              <strong>Transaction (UTR):</strong> \${utr}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background-color: #FFF8EA; border: 1px solid #C5A66B; border-radius: 99px; padding: 6px 16px;" bgcolor="#FFF8EA" class="bg-panel border-gold">
              <span style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #8C3026; text-transform: uppercase;" class="text-otp">
                PENDING VERIFICATION
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        You will receive another email once your registration has been verified.
      </td>
    </tr>
  \`

  const html = createEmailLayout(contentHtml, 'Mahalaya Registration')
  const attachments = [getLogoAttachment()]

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: email,
    subject: \`Registration Pending Verification for \${eventName}\`,
    text: [
      \`Hello \${participantName},\`,
      \`\`,
      \`We have your registration for \${eventName} and are checking the payment.\`,
      \`\`,
      \`Reference number: \${referenceNo}\`,
      utr ? \`Transaction (UTR): \${utr}\` : \`\`,
      \`\`,
      \`Your pass will be emailed as soon as a volunteer has confirmed the\`,
      \`payment. Nothing further is needed from you.\`,
      \`\`,
      \`Bangiya Samiti, IIIT Hyderabad\`,
    ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\\n'),
    html,
    attachments
  })

  if (!result.ok) {
    console.error(\`[email] Could not send the pending notice to \${email}: \${result.errors.join('; ')}\`)
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

  const contentHtml = \`
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Payment Verification Unsuccessful
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        \${eventName}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Dear <strong>\${participantName}</strong>, we regret to inform you that we could not verify your payment.
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        This typically happens if the UTR / transaction reference number is incorrect, or the payment did not successfully reach our account.
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        If you believe this is an error, please <a href="mailto:bangiya.samiti.iiith@gmail.com" style="color: #8C3026; text-decoration: underline; font-weight: bold;" class="text-otp">contact the organizers immediately</a>.
      </td>
    </tr>
  \`

  const html = createEmailLayout(contentHtml, 'Payment Rejected')
  const attachments = [getLogoAttachment()]

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: email,
    subject: \`Action Required: Payment Verification Failed for \${eventName}\`,
    text: [
      \`Hello \${participantName},\`,
      \`\`,
      \`We could not verify the payment for your \${eventName} registration, so\`,
      \`no pass has been issued.\`,
      \`\`,
      \`This is usually a transaction id that does not match the receipt, or a\`,
      \`payment made to the wrong UPI id. If you believe the payment went\`,
      \`through, reply to this email with the transaction id and we will look\`,
      \`again.\`,
      \`\`,
      \`Bangiya Samiti, IIIT Hyderabad\`,
    ].join('\\n'),
    html,
    attachments
  })

  if (!result.ok) {
    console.error(\`[email] Could not send the rejection notice to \${email}: \${result.errors.join('; ')}\`)
    throw new Error('The rejection notice could not be emailed.')
  }
}

export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  minutesValid: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!mailIsConfigured()) {
    console.error('[verify] SMTP credentials missing; cannot send a verification code to:', email)
    return { ok: false, reason: 'mail-not-configured' }
  }

  const contentHtml = \`
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Confirm your email
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        আপনার ইমেইল যাচাই করুন
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Enter this code on the registration form to confirm this address is yours.
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 32px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background-color: #FFF8EA; border: 1px solid #C5A66B; border-radius: 8px; padding: 16px 24px 16px 32px;" bgcolor="#FFF8EA" class="bg-panel border-gold">
              <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; letter-spacing: 12px; font-weight: bold; color: #8C3026; margin: 0; padding: 0;" class="text-otp">
                \${code}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        The code is good for \${minutesValid} minutes. If you did not ask to register
        for a Bangiya Samiti event, no action is needed &mdash; someone may have
        mistyped their address, and nothing has been created in your name.
      </td>
    </tr>
  \`

  const html = createEmailLayout(contentHtml, 'Your verification code')
  const attachments = [getLogoAttachment()]

  let result
  try {
    result = await sendMail({
      fromName: 'bangiya.samiti.iiith',
      to: email,
      subject: \`\${code} is your Bangiya Samiti verification code\`,
      text: \`Your verification code is \${code}. It is good for \${minutesValid} minutes.\`,
      html,
      attachments
    })
  } catch (e) {
    console.error('[verify] Could not send a verification code:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'send-failed' }
  }

  if (!result.ok) {
    console.error('[verify] Could not send a verification code:', result.errors.join('; '))
    return { ok: false, reason: 'send-failed' }
  }

  return { ok: true }
}

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
  const row = (label: string, value: number, accent?: string) => \`
    <tr>
      <td style="padding: 7px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #54251F;" class="text-primary">\${label}</td>
      <td style="padding: 7px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: bold; text-align: right; color: \${accent || '#54251F'};">\${value}</td>
    </tr>\`

  const contentHtml = \`
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Your payments
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Hello <strong>\${managerName}</strong>,<br/>
        Payments collected at <strong>\${upiId}</strong>.
      </td>
    </tr>
    \${counts.reallocated > 0 ? \`
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFF8EA; border-left: 4px solid #8C3026; border-radius: 4px;" bgcolor="#FFF8EA" class="bg-panel">
          <tr>
            <td align="left" style="padding: 12px 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #54251F;" class="text-primary">
              <strong>\${counts.reallocated}</strong> payment\${counts.reallocated === 1 ? ' has' : 's have'} been assigned to you by an administrator. \${counts.reallocated === 1 ? 'It was' : 'They were'} originally paid to someone else's ID.
            </td>
          </tr>
        </table>
      </td>
    </tr>\` : ''}
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 320px; border-top: 1px solid #C5A66B;" class="border-gold">
          \${row('Payments in total', counts.total)}
          \${row('Verified', counts.verified, '#2f7d4f')}
          \${row('Still to verify', counts.pending, counts.pending > 0 ? '#8C3026' : '#745F4B')}
          \${counts.rejected > 0 ? row('Rejected', counts.rejected) : ''}
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        \${counts.pending > 0 ? \`<a href="\${appUrl}/admin/payments" style="color: #8C3026; text-decoration: underline; font-weight: bold;" class="text-otp">Verify them now</a>\` : \`Nothing is waiting on you. Thank you.\`}
      </td>
    </tr>
  \`

  const html = createEmailLayout(contentHtml, 'Your payments')
  const attachments = [getLogoAttachment()]

  const text = [
    \`Hello \${managerName},\`,
    \`\`,
    \`Payments collected at \${upiId}:\`,
    \`\`,
    \`  In total:        \${counts.total}\`,
    \`  Verified:        \${counts.verified}\`,
    \`  Still to verify: \${counts.pending}\`,
    counts.rejected > 0 ? \`  Rejected:        \${counts.rejected}\` : '',
    counts.reallocated > 0
      ? \`\\n\${counts.reallocated} payment(s) were assigned to you by an administrator.\`
      : '',
    \`\`,
    counts.pending > 0 ? \`Verify them at \${appUrl}/admin/payments\` : 'Nothing is waiting on you.',
    \`\`,
    \`Bangiya Samiti, IIIT Hyderabad\`,
  ].filter((l) => l !== '').join('\\n')

  const result = await sendMail({ fromName: 'bangiya.samiti.iiith', to: email, subject, text, html, attachments })
  if (!result.ok) {
    console.error(\`[digest] Could not send to \${email}: \${result.errors.join('; ')}\`)
    return { ok: false, reason: 'send-failed' }
  }
  return { ok: true }
}
`;

fs.writeFileSync('/run/media/arco/Windows/Users/arka2/mahalaya/bongiosomiti-iiith/utils/email.ts', content);
