const fs = require('fs');
const content = fs.readFileSync('utils/email.ts', 'utf8');

const startStr = "export async function sendRegistrationPendingEmail";

const startIndex = content.indexOf(startStr);

console.log(content.substring(startIndex));
