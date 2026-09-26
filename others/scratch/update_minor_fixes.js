const fs = require('fs');

const emailFile = 'utils/email.ts';
let content = fs.readFileSync(emailFile, 'utf8');

// 1. Update the background canvas in both emails
const oldBgStr1 = `style="max-width: 680px; margin: 0 auto; background-color: #f3ece1; background-image: radial-gradient(ellipse at 15% 25%, rgba(255,255,255,0.7) 0%, rgba(243,236,225,0) 60%), radial-gradient(ellipse at 85% 65%, rgba(255,255,255,0.5) 0%, rgba(243,236,225,0) 50%); background-position: center; background-repeat: no-repeat;"`;
const newBgStr1 = `style="max-width: 680px; margin: 0 auto; background-color: #ebdccc; background-image: radial-gradient(ellipse at 20% 20%, rgba(255,253,247,0.8) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 80% 80%, rgba(255,253,247,0.7) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 50% 120%, rgba(219,199,178,0.5) 0%, transparent 60%), radial-gradient(ellipse at -20% 50%, rgba(219,199,178,0.4) 0%, transparent 50%), repeating-radial-gradient(circle at 50% 50%, rgba(219,199,178,0.05) 0px, rgba(219,199,178,0.05) 2px, transparent 2px, transparent 4px); background-position: center; background-repeat: no-repeat;"`;

const oldBgStr2 = `style="width: 100%; max-width: 500px; margin: 0 auto; background-color: #f3ece1; background-image: radial-gradient(ellipse at 15% 25%, rgba(255,255,255,0.7) 0%, rgba(243,236,225,0) 60%), radial-gradient(ellipse at 85% 65%, rgba(255,255,255,0.5) 0%, rgba(243,236,225,0) 50%); background-position: center; background-repeat: no-repeat;"`;
const newBgStr2 = `style="width: 100%; max-width: 500px; margin: 0 auto; background-color: #ebdccc; background-image: radial-gradient(ellipse at 20% 20%, rgba(255,253,247,0.8) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 80% 80%, rgba(255,253,247,0.7) 0%, rgba(226,211,195,0) 70%), radial-gradient(ellipse at 50% 120%, rgba(219,199,178,0.5) 0%, transparent 60%), radial-gradient(ellipse at -20% 50%, rgba(219,199,178,0.4) 0%, transparent 50%), repeating-radial-gradient(circle at 50% 50%, rgba(219,199,178,0.05) 0px, rgba(219,199,178,0.05) 2px, transparent 2px, transparent 4px); background-position: center; background-repeat: no-repeat;"`;

content = content.replace(oldBgStr1, newBgStr1);
content = content.replace(oldBgStr2, newBgStr2);

// 2. Update the green tick in QR pass to SVG tick
const oldTick = `<table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
  <tr><td align="center" valign="middle" class="hourglass-circle" style="background-color: #e5efe7; background-image: linear-gradient(#e5efe7, #e5efe7); border-radius: 50%; width: 100px; height: 100px; border: 4px solid #fdfbf7; box-shadow: 0 8px 20px rgba(0,0,0,0.05);" bgcolor="#e5efe7">
    <div style="width: 25px; height: 45px; border-bottom: 5px solid #2c4233; border-right: 5px solid #2c4233; transform: rotate(45deg); margin-top: -10px; margin-left: -5px; border-radius: 2px;"></div>
  </td></tr>
</table>`;

const newTick = `<table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
  <tr><td align="center" valign="middle" class="hourglass-circle" style="background-color: #e5efe7; background-image: linear-gradient(#e5efe7, #e5efe7); border-radius: 50%; width: 70px; height: 70px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);" bgcolor="#e5efe7">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" color="#2c4233" fill="none" stroke="#2c4233" stroke-width="1.5" style="filter: drop-shadow(0 2px 4px rgba(44, 66, 51, 0.2));">
      <path d="M18.9905 19H19M18.9905 19C18.3678 19.6175 17.2393 19.4637 16.4479 19.4637C15.4765 19.4637 15.0087 19.6537 14.3154 20.347C13.7251 20.9374 12.9337 22 12 22C11.0663 22 10.2749 20.9374 9.68457 20.347C8.99128 19.6537 8.52349 19.4637 7.55206 19.4637C6.76068 19.4637 5.63218 19.6175 5.00949 19C4.38181 18.3776 4.53628 17.2444 4.53628 16.4479C4.53628 15.4414 4.31616 14.9786 3.59938 14.2618C2.53314 13.1956 2.00002 12.6624 2 12C2.00001 11.3375 2.53312 10.8044 3.59935 9.73817C4.2392 9.09832 4.53628 8.46428 4.53628 7.55206C4.53628 6.76065 4.38249 5.63214 5 5.00944C5.62243 4.38178 6.7556 4.53626 7.55208 4.53626C8.46427 4.53626 9.09832 4.2392 9.73815 3.59937C10.8044 2.53312 11.3375 2 12 2C12.6625 2 13.1956 2.53312 14.2618 3.59937C14.9015 4.23907 15.5355 4.53626 16.4479 4.53626C17.2393 4.53626 18.3679 4.38247 18.9906 5C19.6182 5.62243 19.4637 6.75559 19.4637 7.55206C19.4637 8.55858 19.6839 9.02137 20.4006 9.73817C21.4669 10.8044 22 11.3375 22 12C22 12.6624 21.4669 13.1956 20.4006 14.2618C19.6838 14.9786 19.4637 15.4414 19.4637 16.4479C19.4637 17.2444 19.6182 18.3776 18.9905 19Z"></path>
      <path d="M9 12.8929C9 12.8929 10.2 13.5447 10.8 14.5C10.8 14.5 12.6 10.75 15 9.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  </td></tr>
</table>`;
content = content.replace(oldTick, newTick);

// 3. Update Contact Section in QR Pass
const oldQRContact = `                              <!-- Contact Section -->
                              <tr><td align="left" valign="middle" class="content-padding" style="padding-left: 44px; padding-right: 44px;">
                                <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 10px 0;">Need help or have questions?</p>
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td width="36" valign="middle">
                                      <div style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 36px; height: 36px; text-align: center; line-height: 36px; color: #8e806c; font-weight: bold; font-family: sans-serif;">@</div>
                                    </td>
                                    <td valign="middle" style="padding-left: 12px;">
                                      <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; margin: 0;"><a href="mailto:bongiosomiti.iiith@gmail.com" style="color: #7a1f1f; text-decoration: none; font-weight: bold;">bongiosomiti.iiith@gmail.com</a></p>
                                    </td>
                                  </tr>
                                </table>
                              </td></tr>`;
const newContactHtml = `                              <!-- Contact Section -->
                              <tr><td align="center" valign="middle" class="content-padding" style="padding-left: 20px; padding-right: 20px;">
                                <a href="mailto:bangiya.samiti.iith@gmail.com" style="text-decoration: none; cursor: pointer; display: inline-block;">
                                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                                    <tr>
                                      <td width="40" valign="middle" align="center">
                                        <div style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 40px; height: 40px; text-align: center; line-height: 40px; display: inline-block;">
                                          <div style="width: 16px; height: 10px; border: 1.5px solid #8e806c; border-radius: 2px; position: relative; overflow: hidden; margin: 15px auto 0; box-sizing: border-box;">
                                           <div style="position: absolute; top: 0; left: -1px; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 6px solid #8e806c;"></div>
                                           <div style="position: absolute; top: 0; left: 1px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 5px solid #f4ebd8;"></div>
                                         </div>
                                        </div>
                                      </td>
                                      <td align="left" valign="middle" style="padding-left: 15px;">
                                        <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 13px; color: #6b6352; line-height: 1.4; margin: 0;">For any queries, click here to<br/><span style="text-decoration: underline;">reach out to us .</span></p>
                                      </td>
                                    </tr>
                                  </table>
                                </a>
                              </td></tr>`;
content = content.replace(oldQRContact, newContactHtml);

// 4. Update Contact Section in Pending Verification Email
const oldPendingContact = `                         <td align="left" valign="middle">
                            <p class="body-copy contact-text" style="font-family: Arial, sans-serif; font-size: 13px; color: #6b6352; margin: 0; line-height: 1.5;">For any queries, reach out to us at<br/>the official contacts.</p>
                         </td>`;
const newPendingContactHtml = `                         <td align="left" valign="middle">
                            <p class="body-copy contact-text" style="font-family: Arial, sans-serif; font-size: 13px; color: #6b6352; margin: 0; line-height: 1.5;">For any queries, click here to<br/><span style="text-decoration: underline;">reach out to us .</span></p>
                         </td>`;
content = content.replace(oldPendingContact, newPendingContactHtml);

// 5. Hugeicons CDN link
const oldHead = `<title>Your Digital Pass is Ready</title>`;
const newHead = `<title>Your Digital Pass is Ready</title>\n      <link href="https://cdn.hugeicons.com/font/hgi-stroke-rounded.css" rel="stylesheet">`;
content = content.replace(oldHead, newHead);

fs.writeFileSync(emailFile, content, 'utf8');
console.log('Update complete');
