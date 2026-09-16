const fs = require('fs');
const emailFile = 'utils/email.ts';
let content = fs.readFileSync(emailFile, 'utf8');

// Find sendQRPassEmail section
const startQR = content.indexOf('export async function sendQRPassEmail');
const endQR = content.indexOf('export async function sendRegistrationPendingEmail');
let qrContent = content.substring(startQR, endQR);

// Add table-layout: fixed to the main outer tables so they don't expand with the carousel content
qrContent = qrContent.replace(
  /<table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #ebdccc; margin: 0; padding: 0;">/,
  '<table width="100%" border="0" cellpadding="0" cellspacing="0" style="table-layout: fixed; width: 100%; background-color: #ebdccc; margin: 0; padding: 0;">'
);

qrContent = qrContent.replace(
  /<table width="100%" border="0" cellpadding="0" cellspacing="0" class="master-canvas" style="max-width: 680px;/,
  '<table width="100%" border="0" cellpadding="0" cellspacing="0" class="master-canvas" style="table-layout: fixed; width: 100%; max-width: 680px;'
);

qrContent = qrContent.replace(
  /<table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 5px auto; background-color: #fdfbf7; border-radius: 16px;/,
  '<table width="100%" border="0" cellpadding="0" cellspacing="0" style="table-layout: fixed; width: 100%; max-width: 580px; margin: 5px auto; background-color: #fdfbf7; border-radius: 16px;'
);

qrContent = qrContent.replace(
  /<div style="width: 100%; max-width: 550px;/,
  '<div style="width: 100%; max-width: 100%;'
);

content = content.substring(0, startQR) + qrContent + content.substring(endQR);
fs.writeFileSync(emailFile, content, 'utf8');
console.log('Viewport fix applied to sendQRPassEmail');
