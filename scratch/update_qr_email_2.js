const fs = require('fs');

const cssLogo = `
<table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
  <tr><td align="center">
    <a href="#_" style="text-decoration:none; color:inherit; cursor:default; pointer-events:none; display:inline-block;"><img src="cid:mahalaya-logo" class="logo-image" style="max-width: 130px; height: auto; display:block; pointer-events:none;" alt="Mahalaya Logo"></a>
  </td></tr>
</table>
`;

const cssLotus = `
<table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
  <tr><td align="center" valign="middle">
    <div style="width: 60px; height: 1px; background-color: #eaddcc; display: inline-block; vertical-align: middle;"></div>
    <div style="display: inline-block; vertical-align: middle; margin: 0 10px; font-size: 0; line-height: 0;">
      <div style="display: inline-block; width: 14px; height: 14px; background-color: #7a1f1f; border-radius: 50% 0 50% 0; transform: rotate(45deg);"></div>
    </div>
    <div style="width: 60px; height: 1px; background-color: #eaddcc; display: inline-block; vertical-align: middle;"></div>
  </td></tr>
</table>
`;

const cssHourglass = `
<table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
  <tr><td align="center" valign="middle" class="hourglass-circle" style="background-color: #f4ebd8; background-image: linear-gradient(#f4ebd8, #f4ebd8); border-radius: 50%; width: 100px; height: 100px;" bgcolor="#f4ebd8">
    <div style="width: 24px; border-top: 2px solid #8e806c; border-bottom: 2px solid #8e806c; padding: 2px 0; margin: 0 auto;">
       <div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 12px solid #c4b5a3; margin: 0 auto;"></div>
       <div style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 12px solid #8e806c; margin: 2px auto 0;"></div>
    </div>
  </td></tr>
</table>
`;

const qrEmailHtml = `
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
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #ffffff; }
        .outer-table { background-color: #ffffff; }
        table { border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        
        @media (prefers-color-scheme: dark) {
          body, .outer-table { background-color: #1c1c1c !important; }
        }
        
        @media only screen and (max-width: 600px) {
          .main-layout { width: 100% !important; max-width: 100% !important; }
          .master-canvas { background-size: cover !important; }
          .main-card { width: 90% !important; max-width: 90% !important; margin: 0 auto !important; }
          .content-padding { padding-left: 20px !important; padding-right: 20px !important; }
          .mobile-fluid { width: 100% !important; max-width: 100% !important; display: block !important; }
          .mobile-gap-small { height: 10px !important; max-height: 10px !important; }
          .mobile-gap-medium { height: 20px !important; max-height: 20px !important; }
          .mobile-gap-large { height: 30px !important; max-height: 30px !important; }
          .mobile-auto-height { height: auto !important; max-height: none !important; }
          .desktop-only { display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important; float: left !important; }
          .mobile-alpona { background-position: -40px 100% !important; }
          .mobile-banana { background-position: calc(100% + 40px) 100% !important; }
          .event-title { font-size: 36px !important; line-height: 1.1 !important; }
          .card-heading { font-size: 24px !important; width: auto !important; padding: 0 10px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #ffffff;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" class="outer-table" style="background-color: #ffffff; margin: 0; padding: 0;">
        <tr>
          <td align="center" valign="top">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" class="master-canvas mobile-alpona mobile-banana" style="max-width: 680px; margin: 0 auto; background-color: #f3ece1; background-image: radial-gradient(ellipse at 15% 25%, rgba(255,255,255,0.7) 0%, rgba(243,236,225,0) 60%), radial-gradient(ellipse at 85% 65%, rgba(255,255,255,0.5) 0%, rgba(243,236,225,0) 50%); background-position: center; background-repeat: no-repeat;">
              <tr>
                <td align="center" valign="top">
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td class="desktop-only" width="82" valign="bottom" style="width: 82px; max-width: 82px;">
                        <!-- Desktop Alpona CSS Art -->
                        <div style="width: 82px; height: 200px; position: relative; overflow: hidden;">
                           <div style="position: absolute; bottom: 0; left: -20px; width: 80px; height: 80px; border-right: 3px solid #eaddcc; border-top: 3px solid #eaddcc; border-radius: 0 50% 0 0;"></div>
                           <div style="position: absolute; bottom: 0; left: -40px; width: 120px; height: 120px; border-right: 2px dotted #eaddcc; border-top: 2px dotted #eaddcc; border-radius: 0 50% 0 0;"></div>
                           <div style="position: absolute; bottom: 20px; left: 30px; width: 6px; height: 6px; background-color: #d1bfae; border-radius: 50%;"></div>
                        </div>
                      </td>

                      <td align="center" valign="top" class="center-column mobile-fluid" width="516" style="width: 516px; max-width: 516px;">
                        
                        <table width="100%" border="0" cellpadding="0" cellspacing="0">
                          <tr><td height="55" class="mobile-gap-large" style="height: 55px; line-height:0; font-size:0;">&nbsp;</td></tr>
                          <tr><td align="center" valign="middle">
                            ${cssLogo}
                          </td></tr>
                          <tr><td height="40" class="mobile-gap-medium" style="height: 40px; line-height:0; font-size:0;">&nbsp;</td></tr>
                          <tr><td align="center" valign="middle">
                            <h1 class="event-title" style="font-family: Georgia, serif; color: #7a1f1f; font-size: 44px; font-weight: bold; margin: 0; line-height: 1;">\${eventName}</h1>
                          </td></tr>
                          <tr><td height="5" style="line-height:0; font-size:0;">&nbsp;</td></tr>
                          <tr><td align="center" valign="middle">
                            <p class="tagline" style="font-family: Arial, sans-serif; font-size: 15px; color: #8e806c; letter-spacing: 4px; text-transform: uppercase; margin: 0;">A TASTE OF HOME</p>
                          </td></tr>
                          <tr><td height="40" class="mobile-gap-medium" style="height: 40px; line-height:0; font-size:0;">&nbsp;</td></tr>
                        </table>

                        <table border="0" cellpadding="0" cellspacing="0" class="main-card" style="width: 100%; max-width: 516px; background-color: #fdfbf7; background-image: linear-gradient(#fdfbf7, #fdfbf7); border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);" bgcolor="#fdfbf7">
                          <tr><td align="center" valign="top" style="padding-top: 40px; padding-bottom: 40px;">
                            
                            <table width="100%" border="0" cellpadding="0" cellspacing="0">
                              <tr><td align="center" valign="middle">
                                ${cssHourglass}
                              </td></tr>
                              <tr><td height="25" class="mobile-gap-small" style="height: 25px; line-height:0; font-size:0;">&nbsp;</td></tr>
                              <tr><td align="center" valign="middle">
                                <h2 class="card-heading" style="font-family: Georgia, serif; color: #2c4233; font-size: 26px; font-weight: normal; margin: 0; line-height: 1.25;">Registration Confirmed<br/>Digital Pass Active</h2>
                              </td></tr>
                              <tr><td height="16" class="mobile-gap-small" style="height: 16px; line-height:0; font-size:0;">&nbsp;</td></tr>
                              <tr><td align="center" valign="middle">
                                ${cssLotus}
                              </td></tr>
                              <tr><td height="20" class="mobile-gap-medium" style="height: 20px; line-height:0; font-size:0;">&nbsp;</td></tr>

                              <tr><td align="left" valign="middle" class="content-padding" style="padding-left: 44px; padding-right: 44px;">
                                <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Dear <strong>\${participantName}</strong>,</p>
                              </td></tr>
                              <tr><td height="6" style="height: 6px; line-height:0; font-size:0;">&nbsp;</td></tr>
                              <tr><td align="left" valign="middle" class="content-padding" style="padding-left: 44px; padding-right: 44px;">
                                <p class="body-copy" style="font-family: Arial, sans-serif; font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0;">Your registration has been verified and your digital QR pass has been generated. Please present ${tokenArray.length > 1 ? 'these passes' : 'this pass'} at the entry gate.</p>
                              </td></tr>
                              <tr><td height="24" style="height: 24px; line-height:0; font-size:0;">&nbsp;</td></tr>

                              <!-- QR Passes Loop Placeholder -->
                              <tr><td align="center" valign="middle" class="content-padding" style="padding-left: 44px; padding-right: 44px;">
                                \${qrImagesHtml}
                              </td></tr>

                              <tr><td height="20" style="height: 20px; line-height:0; font-size:0;">&nbsp;</td></tr>
                              <tr><td align="center" valign="middle" class="content-padding" style="padding-left: 44px; padding-right: 44px;">
                                <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #7a1f1f; font-weight: bold;">IMPORTANT: Do not share or forward ${tokenArray.length > 1 ? 'these QR codes' : 'this QR code'}. ${tokenArray.length > 1 ? 'They are strictly single-entry' : 'It is strictly single-entry'}.</p>
                              </td></tr>
                              
                              <tr><td height="40" style="height: 40px; line-height:0; font-size:0;">&nbsp;</td></tr>
                              <tr><td align="center" valign="middle">
                                ${cssLotus}
                              </td></tr>
                              <tr><td height="30" style="height: 30px; line-height:0; font-size:0;">&nbsp;</td></tr>

                              <!-- Contact Section -->
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
                              </td></tr>

                            </table>

                          </td></tr>
                        </table>

                        <table width="100%" border="0" cellpadding="0" cellspacing="0">
                          <tr><td height="30" style="height: 30px; line-height:0; font-size:0;">&nbsp;</td></tr>
                          <tr><td align="center" valign="middle">
                            <p style="font-family: Arial, sans-serif; font-size: 11px; color: #8e806c; letter-spacing: 2px; text-transform: uppercase; margin: 0;">CULTURE | COMMUNITY | TOGETHER</p>
                          </td></tr>
                          <tr><td height="40" class="mobile-gap-large" style="height: 40px; line-height:0; font-size:0;">&nbsp;</td></tr>
                        </table>

                      </td>
                      
                      <td class="desktop-only" width="82" valign="bottom" style="width: 82px; max-width: 82px;">
                        <!-- Desktop Banana Leaf / Food CSS Art -->
                        <div style="width: 82px; height: 200px; position: relative; overflow: hidden;">
                          <div style="position: absolute; bottom: 30px; right: -20px; width: 90px; height: 40px; background-color: #4a5c43; border-radius: 50% 50% 0 50%; transform: rotate(-10deg);"></div>
                          <div style="position: absolute; bottom: 30px; right: -5px; width: 50px; height: 25px; background-color: #d1bfae; border-radius: 0 0 25px 25px; border-top: 2px solid #f4ebd8;"></div>
                          <div style="position: absolute; bottom: 45px; right: 0px; width: 30px; height: 10px; background-color: #fcf9f2; border-radius: 10px 10px 0 0;"></div>
                        </div>
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
`;

const emailFile = 'utils/email.ts';
let content = fs.readFileSync(emailFile, 'utf8');

const startMarker = 'const html = `';
const startIndex = content.indexOf(startMarker, 0); 

if (startIndex !== -1) {
    const stringStartIndex = startIndex + startMarker.length;
    let endIndex = stringStartIndex;
    let found = false;
    while(endIndex < content.length) {
        if (content[endIndex] === '`') {
             if (content.substring(stringStartIndex, endIndex).includes('</html>')) {
                 found = true;
                 break;
             }
        }
        endIndex++;
    }

    if (found) {
        const newContent = content.substring(0, stringStartIndex) + "\n" + qrEmailHtml.replace(/\$\{/g, "\\${") + "\n  " + content.substring(endIndex);
        fs.writeFileSync(emailFile, newContent, 'utf8');
        console.log("Successfully updated utils/email.ts HTML block");
    } else {
        console.error("Could not find end of html block");
    }
} else {
    console.error("Could not find start marker");
}
