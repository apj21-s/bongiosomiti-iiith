import QRCode from 'qrcode'
import path from 'path'
import { mailIsConfigured, sendMail } from './mail-transport'

/**
 * Text made safe to put inside the HTML of a mail.
 *
 * Names and plate captions come from what a visitor typed - food_pref is free
 * text for an event with no configured plates - and a mail that pasted them in
 * raw would let anyone register as `<a href=...>` and have the festival's own
 * address deliver their link.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createEmailLayout(contentHtml: string, title: string) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
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
      .text-primary { color: #54251F !important; }
      .text-secondary { color: #745F4B !important; }
      .text-otp { color: #8C3026 !important; }
      .border-gold { border-color: #C5A66B !important; }
    }
    
    u + #body a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
  </style>
</head>
<body id="body" style="margin: 0 !important; padding: 0 !important; ">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="" class="bg-parchment">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!--[if mso]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560">
        <tr>
        <td align="center" valign="top">
        <![endif]-->
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; border: 2px solid #C5A66B; border-radius: 8px;" class="bg-parchment border-gold">
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
                
                ${contentHtml}

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
</html>`;
}

function getLogoAttachment() {
  return {
    filename: 'mahalaya-logo.png',
    path: path.join(process.cwd(), 'public', 'assets', 'logo.png'),
    cid: 'mahalaya-logo'
  }
}

/**
 * "Plate 2 of 3" for each pass, where its plate was booked more than once.
 *
 * Three lunch thalis arrive as three QR codes that look identical and say the
 * same thing, so there is no way to tell whether they are three plates or the
 * same one pasted three times. Numbering them says both: which one this is,
 * and how many there should be. A plate booked once needs none of that and
 * gets an empty string.
 *
 * Order follows the tokens, so a pass keeps the same number every time the
 * mail is sent as long as the caller passes the tickets in a stable order.
 */
export function plateOrdinals(labels: readonly string[]): string[] {
  const total = new Map<string, number>()
  for (const label of labels) {
    if (label) total.set(label, (total.get(label) ?? 0) + 1)
  }

  const seen = new Map<string, number>()
  return labels.map((label) => {
    if (!label) return ''
    const of = total.get(label) ?? 0
    if (of < 2) return ''
    const n = (seen.get(label) ?? 0) + 1
    seen.set(label, n)
    return `Plate ${n} of ${of}`
  })
}

/**
 * The QR passes, one per plate.
 *
 * `labels` says what each token admits its holder to - "Breakfast · Veg" -
 * in the same order as `tokens`. A pass that does not say which meal it is
 * for is one the person on the counter has to ask about, and the holder has
 * to remember. Optional, so a caller with nothing to say still works.
 */
export async function sendQRPassEmail(email: string, participantName: string, eventName: string, tokens: string | string[], labels?: string[]) {
  if (!mailIsConfigured()) {
    console.warn('SMTP credentials missing. Skipping email send to:', email)
    return
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [tokens]
  // Index by index with the tokens: a caller that knows fewer labels than it
  // has tokens leaves the rest unlabelled rather than shifting them all up.
  const labelArray = tokenArray.map((_, i) => (labels && labels[i]) || '')
  const ordinals = plateOrdinals(labelArray)
  const attachments: any[] = [getLogoAttachment()]
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

    // A downloaded attachment keeps its name, so the name should say which
    // plate it is rather than leave four files called qr-pass-N.png.
    const slug = labelArray[i]
      ? '-' + labelArray[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : ''

    attachments.push({
      filename: `qr-pass-${i + 1}${slug}.png`,
      content: base64Data,
      encoding: 'base64',
      cid: cid,
      path: '' // required by nodemailer types if content is given
    })

    const passNumber = (i + 1).toString().padStart(2, '0')
    // Which plate this particular QR is good for, and which of them it is.
    const mealLabel = labelArray[i]
    const plateOrdinal = ordinals[i]
    const altText = escapeHtml([`QR Pass ${passNumber}`, mealLabel, plateOrdinal].filter(Boolean).join(' - '))

    qrImagesHtml += `
      <tr>
        <td align="center" style="padding-bottom: 16px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 320px; border: 1px solid #C5A66B; border-radius: 8px;" class="bg-panel border-gold">
            <tr>
              <td align="center" style="padding: 16px;">
                <div style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #8C3026; letter-spacing: 2px; margin-bottom: 4px;" class="text-otp">PASS ${passNumber}</div>
                ${mealLabel ? `<div style="font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: #281208; margin-bottom: ${plateOrdinal ? '2px' : '12px'};" class="text-body">${escapeHtml(mealLabel)}</div>` : '<div style="margin-bottom: 8px;"></div>'}
                ${plateOrdinal ? `<div style="font-family: Arial, sans-serif; font-size: 12px; color: #745F4B; margin-bottom: 12px;" class="text-secondary">${escapeHtml(plateOrdinal)}</div>` : ''}
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-radius: 4px; padding: 8px; margin-bottom: 12px;">
                  <tr>
                    <td align="center">
                      <img src="cid:${cid}" alt="${altText}" width="200" height="200" style="display: block; width: 200px; height: 200px;">
                    </td>
                  </tr>
                </table>
                <div style="font-family: monospace; font-size: 16px; color: #54251F; font-weight: bold; margin-bottom: 8px;" class="text-primary">Code: ${passCode}</div>
                <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #745F4B; letter-spacing: 1px;" class="text-secondary">SINGLE ENTRY</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
  }

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Your Digital Pass Is Ready
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        ${escapeHtml(eventName)}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Dear <strong>${escapeHtml(participantName)}</strong>, your QR ${tokenArray.length > 1 ? 'passes are' : 'pass is'} ready. Please present ${tokenArray.length > 1 ? 'these' : 'this'} at the gate.
      </td>
    </tr>
    ${qrImagesHtml}
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; line-height: 1.6; color: #8C3026; text-align: center;" class="text-otp">
        IMPORTANT: ${tokenArray.length > 1 ? 'These are' : 'This is'} strictly single-entry. Do not share.
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        For any queries, <a href="mailto:bangiya.samiti.iiith@gmail.com" style="color: #8C3026; text-decoration: underline; font-weight: bold;" class="text-otp">reach out to us</a>.
      </td>
    </tr>
  `

  const html = createEmailLayout(contentHtml, 'Your Digital Pass is Ready')

  let result
  try {
    result = await sendMail({
      fromName: 'bangiya.samiti.iiith',
      to: email,
      subject: `Your Digital Pass for ${eventName}`,
      text: [
        `Hello ${participantName},`,
        ``,
        `Your pass for ${eventName} is confirmed.`,
        ``,
        tokenArray.length > 1 ? `Your ${tokenArray.length} passes:` : `Pass code:`,
        ...tokenArray.map((t, i) => {
          const code = t.includes('_') ? t.split('_')[1] : t
          const said = [labelArray[i], ordinals[i]].filter(Boolean).join(' - ')
          return tokenArray.length > 1
            ? `  ${i + 1}. ${code}${said ? `  (${said})` : ''}`
            : `${code}${said ? `  (${said})` : ''}`
        }),
        ``,
        `The QR code is attached to this email. Show it at the gate, either on`,
        `your phone or printed. If the image does not load, the pass code above`,
        `is enough for the gate to find your registration.`,
        ``,
        `Bangiya Samiti, IIIT Hyderabad`,
      ].join('\n'),
      html,
      attachments: attachments as any
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bangiyasamiti-iiith.vercel.app';

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Registration Request Received
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        আপনার নিবন্ধনের অনুরোধ গৃহীত হয়েছে
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Thank you for registering for <strong>${escapeHtml(eventName)}</strong>. We have received your registration details. Your registration is currently being reviewed by our team.
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 400px; border: 1px solid #C5A66B; border-radius: 8px;" class="bg-panel border-gold">
          <tr>
            <td align="left" style="padding: 16px 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #54251F;" class="text-primary">
              <strong>Name:</strong> ${escapeHtml(participantName)}<br/>
              <strong>Event:</strong> ${escapeHtml(eventName)}<br/>
              <strong>Registration Ref:</strong> ${escapeHtml(referenceNo)}<br/>
              <strong>Reference (UTR):</strong> ${escapeHtml(utr)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="border: 1px solid #C5A66B; border-radius: 99px; padding: 6px 16px;" class="bg-panel border-gold">
              <span style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #8C3026; text-transform: uppercase;" class="text-otp">
                REVIEW IN PROGRESS
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
  `

  const html = createEmailLayout(contentHtml, 'Mahalaya Registration')
  const attachments = [getLogoAttachment()]

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: email,
    subject: `Registration Received for ${eventName}`,
    text: [
      `Hello ${participantName},`,
      ``,
      `We have received your registration for ${eventName} and it is currently under review.`,
      ``,
      `Reference number: ${referenceNo}`,
      utr ? `Reference (UTR): ${utr}` : ``,
      ``,
      `Your pass will be emailed as soon as a volunteer has reviewed your details.`,
      `Nothing further is needed from you.`,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bangiyasamiti-iiith.vercel.app';

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Payment Verification Unsuccessful
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: 'Tiro Bangla', 'Noto Serif Bengali', 'Bangla MN', Georgia, serif; font-size: 18px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        ${eventName}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Dear <strong>${participantName}</strong>, we regret to inform you that we could not verify your payment.
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
  `

  const html = createEmailLayout(contentHtml, 'Payment Rejected')
  const attachments = [getLogoAttachment()]

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
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
    attachments
  })

  if (!result.ok) {
    console.error(`[email] Could not send the rejection notice to ${email}: ${result.errors.join('; ')}`)
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

  const contentHtml = `
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
            <td align="center" style="border: 1px solid #C5A66B; border-radius: 8px; padding: 16px 24px 16px 32px;" class="bg-panel border-gold">
              <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; letter-spacing: 12px; font-weight: bold; color: #8C3026; margin: 0; padding: 0;" class="text-otp">
                ${code}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        The code is good for ${minutesValid} minutes. If you did not ask to register
        for a Bangiya Samiti event, no action is needed &mdash; someone may have
        mistyped their address, and nothing has been created in your name.
      </td>
    </tr>
  `

  const html = createEmailLayout(contentHtml, 'Your verification code')
  const attachments = [getLogoAttachment()]

  let result
  try {
    result = await sendMail({
      fromName: 'bangiya.samiti.iiith',
      to: email,
      subject: `${code} is your Bangiya Samiti verification code`,
      text: `Your verification code is ${code}. It is good for ${minutesValid} minutes.`,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bangiyasamiti-iiith.vercel.app'
  const row = (label: string, value: number, accent?: string) => `
    <tr>
      <td style="padding: 7px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #54251F;" class="text-primary">${label}</td>
      <td style="padding: 7px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: bold; text-align: right; color: ${accent || '#54251F'};">${value}</td>
    </tr>`

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Your payments
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Hello <strong>${managerName}</strong>,<br/>
        Payments collected at <strong>${upiId}</strong>.
      </td>
    </tr>
    ${counts.reallocated > 0 ? `
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-left: 4px solid #8C3026; border-radius: 4px;" class="bg-panel">
          <tr>
            <td align="left" style="padding: 12px 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #54251F;" class="text-primary">
              <strong>${counts.reallocated}</strong> payment${counts.reallocated === 1 ? ' has' : 's have'} been assigned to you by an administrator. ${counts.reallocated === 1 ? 'It was' : 'They were'} originally paid to someone else's ID.
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 320px; border-top: 1px solid #C5A66B;" class="border-gold">
          ${row('Payments in total', counts.total)}
          ${row('Verified', counts.verified, '#2f7d4f')}
          ${row('Still to verify', counts.pending, counts.pending > 0 ? '#8C3026' : '#745F4B')}
          ${counts.rejected > 0 ? row('Rejected', counts.rejected) : ''}
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        ${counts.pending > 0 ? `<a href="${appUrl}/admin/payments" style="color: #8C3026; text-decoration: underline; font-weight: bold;" class="text-otp">Verify them now</a>` : `Nothing is waiting on you. Thank you.`}
      </td>
    </tr>
  `

  const html = createEmailLayout(contentHtml, 'Your payments')
  const attachments = [getLogoAttachment()]

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

  const result = await sendMail({ fromName: 'bangiya.samiti.iiith', to: email, subject, text, html, attachments })
  if (!result.ok) {
    console.error(`[digest] Could not send to ${email}: ${result.errors.join('; ')}`)
    return { ok: false, reason: 'send-failed' }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * Changing a registration
 *
 * Three messages around one change, because three people have to agree
 * about money that moves outside the site. The participant and the
 * collector are told the same figures in the same words, and whichever
 * of them RECEIVES the money is the one asked for the receipt. A payer
 * can only say they sent it; the receiver can show it arrived, and it is
 * the receiver's own account that proves it.
 *
 * A change can move several plates at once - one booking rearranged is
 * one act, settled with one transfer - so `moves` is a list and the
 * amount is stated once for the lot.
 *
 * Nothing in these mails changes a booking. The passes in somebody's
 * inbox stay true until a super admin has seen the receipt and approved.
 * ------------------------------------------------------------------ */

export type PlateMove = { fromPlate: string; toPlate: string }

export type PlateChangeMail = {
  participantName: string
  participantEmail: string
  eventName: string
  moves: PlateMove[]
  /** Signed: positive means the participant owes it. */
  delta: number
  payer: 'PARTICIPANT' | 'COLLECTOR' | 'NOBODY'
  receiptFrom: 'PARTICIPANT' | 'COLLECTOR' | null
  collectorName: string
  collectorEmail?: string | null
  collectorUpi?: string | null
  /** The booking this is about, so a reply can be matched to it. */
  reference: string
  reason?: string | null
}

const inr = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

/** The money sentence, in the second person for whoever is being written to. */
function moneyLine(d: PlateChangeMail, reader: 'PARTICIPANT' | 'COLLECTOR'): string {
  if (d.payer === 'NOBODY' || d.delta === 0) {
    return 'There is nothing to send either way for this change.'
  }

  const participantPays = d.payer === 'PARTICIPANT'
  if (reader === 'PARTICIPANT') {
    return participantPays
      ? `${inr(d.delta)} is payable by you to ${d.collectorName}${d.collectorUpi ? ` at ${d.collectorUpi}` : ''}.`
      : `${inr(d.delta)} is refundable to you by ${d.collectorName}.`
  }
  return participantPays
    ? `${inr(d.delta)} is payable to you by ${d.participantName}${d.collectorUpi ? `, at ${d.collectorUpi}` : ''}.`
    : `${inr(d.delta)} is refundable by you to ${d.participantName}.`
}

/** What the reader has to do next, which depends on which side of it they are. */
function askLine(d: PlateChangeMail, reader: 'PARTICIPANT' | 'COLLECTOR'): string {
  if (d.payer === 'NOBODY' || d.delta === 0) {
    return 'Nothing needs to be sent. The change will be confirmed shortly.'
  }
  if (d.receiptFrom === reader) {
    return 'Once the money reaches you, please reply to this email with a screenshot of the UPI receipt showing it received. The change is applied once an organiser has checked it.'
  }
  return 'Please send it at your convenience. The other party will reply here with the receipt, and the change is applied once an organiser has checked it.'
}

function movesHtml(moves: PlateMove[]): string {
  return moves
    .map((m) => `<strong>${escapeHtml(m.fromPlate)}</strong> &rarr; <strong>${escapeHtml(m.toPlate)}</strong>`)
    .join('<br/>')
}

function movesText(moves: PlateMove[]): string[] {
  return moves.map((m) => `  ${m.fromPlate}  ->  ${m.toPlate}`)
}

function plateChangePanel(d: PlateChangeMail, reader: 'PARTICIPANT' | 'COLLECTOR'): string {
  return `
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 440px; border: 1px solid #C5A66B; border-radius: 8px;" class="bg-panel border-gold">
          <tr>
            <td align="left" style="padding: 16px 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.7; color: #54251F;" class="text-primary">
              <strong>Participant:</strong> ${escapeHtml(d.participantName)}<br/>
              <strong>Event:</strong> ${escapeHtml(d.eventName)}<br/>
              <strong>Registration:</strong> ${escapeHtml(d.reference)}
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(197,166,107,0.5);">
                ${movesHtml(d.moves)}
              </div>
              ${d.reason ? `<div style="margin-top: 10px;"><strong>Note:</strong> ${escapeHtml(d.reason)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: bold; line-height: 1.6; color: #8C3026; text-align: center;" class="text-otp">
        ${escapeHtml(moneyLine(d, reader))}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        ${escapeHtml(askLine(d, reader))}
      </td>
    </tr>`
}

function plateChangeText(d: PlateChangeMail, reader: 'PARTICIPANT' | 'COLLECTOR', greeting: string): string {
  return [
    greeting,
    ``,
    `A change has been raised to a registration for ${d.eventName}.`,
    ``,
    `  Participant:  ${d.participantName}`,
    `  Registration: ${d.reference}`,
    ``,
    ...movesText(d.moves),
    d.reason ? `` : ``,
    d.reason ? `  Note: ${d.reason}` : ``,
    ``,
    moneyLine(d, reader),
    ``,
    askLine(d, reader),
    ``,
    `Until then the passes you already hold are unchanged and still valid.`,
    ``,
    `Bangiya Samiti, IIIT Hyderabad`,
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n')
}

/** To the participant, with the collector copied in, so one thread holds it all. */
export async function sendPlateChangeRequestedEmail(d: PlateChangeMail) {
  if (!mailIsConfigured()) {
    console.warn('SMTP credentials missing. Skipping plate change notice to:', d.participantEmail)
    return
  }

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        A Change To Your Registration
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Dear <strong>${escapeHtml(d.participantName)}</strong>, an organiser has raised the change below on your
        registration for <strong>${escapeHtml(d.eventName)}</strong>.
      </td>
    </tr>
    ${plateChangePanel(d, 'PARTICIPANT')}
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Your existing passes stay valid until this is confirmed. If you did not expect this,
        <a href="mailto:bangiya.samiti.iiith@gmail.com" style="color: #8C3026; text-decoration: underline; font-weight: bold;" class="text-otp">tell us</a> and nothing will be changed.
      </td>
    </tr>
  `

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: d.participantEmail,
    cc: d.collectorEmail || undefined,
    subject: `Change to your registration for ${d.eventName}`,
    text: plateChangeText(d, 'PARTICIPANT', `Hello ${d.participantName},`),
    html: createEmailLayout(contentHtml, 'A Change To Your Registration'),
    attachments: [getLogoAttachment()],
  })

  if (!result.ok) {
    console.error(`[email] Could not send the plate change notice to ${d.participantEmail}: ${result.errors.join('; ')}`)
    throw new Error('The change notice could not be emailed to the participant.')
  }
}

/**
 * The collector's own copy.
 *
 * Separate from the carbon copy above on purpose: that one is written to the
 * participant and only shows the collector what was said to them. This one is
 * addressed to the collector, in their own terms, and is the message they can
 * act on and reply to.
 */
export async function sendPlateChangeCollectorEmail(d: PlateChangeMail) {
  if (!mailIsConfigured() || !d.collectorEmail) {
    if (!d.collectorEmail) console.warn('No collector address for plate change', d.reference)
    return
  }

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        A Change On A Payment You Collected
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        ${escapeHtml(d.collectorName)}, this registration was paid to your UPI id, so the difference runs through you.
      </td>
    </tr>
    ${plateChangePanel(d, 'COLLECTOR')}
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        The participant has been written to as well, with you copied in. Nothing on the passes
        changes until an organiser confirms the money moved.
      </td>
    </tr>
  `

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: d.collectorEmail,
    subject: `Action needed: registration change for ${d.participantName} (${d.eventName})`,
    text: plateChangeText(d, 'COLLECTOR', `Hello ${d.collectorName},`),
    html: createEmailLayout(contentHtml, 'Registration Change'),
    attachments: [getLogoAttachment()],
  })

  if (!result.ok) {
    console.error(`[email] Could not send the plate change notice to ${d.collectorEmail}: ${result.errors.join('; ')}`)
  }
}

/** Once a super admin has seen the receipt and applied the change. */
export async function sendPlateChangeApprovedEmail(d: PlateChangeMail & { settlementNote?: string | null }) {
  if (!mailIsConfigured()) return

  const settled = d.payer === 'NOBODY' || d.delta === 0
    ? 'No money needed to move for this one.'
    : d.payer === 'PARTICIPANT'
      ? `${inr(d.delta)} was received from you.`
      : `${inr(d.delta)} was refunded to you.`

  const contentHtml = `
    <tr>
      <td align="center" style="padding-bottom: 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: bold; color: #54251F; text-align: center;" class="text-primary">
        Your Registration Has Been Changed
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Dear <strong>${escapeHtml(d.participantName)}</strong>, your registration for
        <strong>${escapeHtml(d.eventName)}</strong> has been updated. ${escapeHtml(settled)}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 440px; border: 1px solid #C5A66B; border-radius: 8px;" class="bg-panel border-gold">
          <tr>
            <td align="left" style="padding: 16px 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.7; color: #54251F;" class="text-primary">
              ${movesHtml(d.moves)}
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(197,166,107,0.5);">
                <strong>Registration:</strong> ${escapeHtml(d.reference)}
              </div>
              ${d.settlementNote ? `<div style="margin-top: 10px;"><strong>Note:</strong> ${escapeHtml(d.settlementNote)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.6; color: #745F4B; text-align: center;" class="text-secondary">
        Your pass codes are unchanged. A fresh copy showing the new plates follows this email.
      </td>
    </tr>
  `

  const result = await sendMail({
    fromName: 'bangiya.samiti.iiith',
    to: d.participantEmail,
    cc: d.collectorEmail || undefined,
    subject: `Confirmed: your registration for ${d.eventName} has changed`,
    text: [
      `Hello ${d.participantName},`,
      ``,
      `Your registration for ${d.eventName} has been updated:`,
      ``,
      ...movesText(d.moves),
      ``,
      settled,
      d.settlementNote ? `Note: ${d.settlementNote}` : ``,
      ``,
      `Registration: ${d.reference}`,
      `Your pass codes are unchanged. A fresh copy showing the new plates follows this email.`,
      ``,
      `Bangiya Samiti, IIIT Hyderabad`,
    ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n'),
    html: createEmailLayout(contentHtml, 'Registration Changed'),
    attachments: [getLogoAttachment()],
  })

  if (!result.ok) {
    console.error(`[email] Could not send the plate change confirmation to ${d.participantEmail}: ${result.errors.join('; ')}`)
  }
}
