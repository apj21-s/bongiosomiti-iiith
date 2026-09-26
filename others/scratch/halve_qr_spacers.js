const fs = require('fs');
const emailFile = 'utils/email.ts';
let content = fs.readFileSync(emailFile, 'utf8');

// Find sendQRPassEmail section
const startQR = content.indexOf('export async function sendQRPassEmail');
const endQR = content.indexOf('export async function sendRegistrationPendingEmail');
let qrContent = content.substring(startQR, endQR);

const replacements = [
  // QR Cards Loop
  [/padding: 15px;/g, 'padding: 10px;'],
  [/margin: 0 0 10px;"([^>]*>PASS)/g, 'margin: 0 0 5px;"$1'],
  [/margin: 8px 0 0;/g, 'margin: 4px 0 0;'],
  [/margin: 10px 0 0;/g, 'margin: 5px 0 0;'],
  
  // Carousel container
  [/margin: 0 0 15px 0;/g, 'margin: 0 0 8px 0;'],
  [/padding-bottom: 15px;/g, 'padding-bottom: 8px;'],
  
  // Layout Master
  [/<td align="center" style="padding: 10px;">/g, '<td align="center" style="padding: 5px;">'],
  [/padding-top: 15px;/g, 'padding-top: 8px;'],
  [/margin: 10px 0 5px;/g, 'margin: 5px 0 3px;'],
  [/margin: 0 0 10px;"([^>]*>\$\{eventName\})/g, 'margin: 0 0 5px;"$1'],
  [/margin: 10px auto;/g, 'margin: 5px auto;'],
  [/padding: 25px 15px;/g, 'padding: 12px 15px;'],
  [/margin: 15px 0 10px;/g, 'margin: 8px 0 5px;'],
  [/margin: 0 auto 15px auto;/g, 'margin: 0 auto 8px auto;'],
  [/margin: 0 0 15px;"([^>]*>Dear)/g, 'margin: 0 0 8px;"$1'],
  [/margin: 15px 0 20px;/g, 'margin: 8px 0 10px;'],
  [/margin-top: 15px;/g, 'margin-top: 8px;'],
  [/margin: 0 0 6px 0;/g, 'margin: 0 0 3px 0;'],
  [/margin: 0 0 15px;"([^>]*>CULTURE)/g, 'margin: 0 0 8px;"$1']
];

for (const [regex, replacement] of replacements) {
  qrContent = qrContent.replace(regex, replacement);
}

content = content.substring(0, startQR) + qrContent + content.substring(endQR);
fs.writeFileSync(emailFile, content, 'utf8');
console.log('Halved spacers in sendQRPassEmail');
