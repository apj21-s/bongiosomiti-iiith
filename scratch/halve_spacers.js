const fs = require('fs');
const emailFile = 'utils/email.ts';
let content = fs.readFileSync(emailFile, 'utf8');

// Find the start of sendRegistrationPendingEmail
const startIndex = content.indexOf('export async function sendRegistrationPendingEmail');
const before = content.substring(0, startIndex);
let pendingContent = content.substring(startIndex);

// Regex to find <tr><td height="XX" ... style="height: XXpx; max-height: XXpx;...
// Actually, it's easier to just match all `<table ...><tr><td height="XX"` and `<tr><td height="XX"` inside pendingContent where it acts as a spacer.

// Spacer replacements
const replacements = [
  // Hero Region Spacers
  [/height="13"/g, 'height="6"'], // Spacer to Logo
  [/height="7"/g, 'height="4"'],  // Spacer to Title
  [/height="11" class="mobile-gap-small"/g, 'height="5" class="mobile-gap-small"'], // Spacer to Card
  
  // Card Spacers
  [/height="16" class="mobile-auto-height mobile-gap-medium" style="height: 16px; max-height: 16px;/g, 'height="8" class="mobile-auto-height mobile-gap-medium" style="height: 8px; max-height: 8px;'],
  [/height="11" class="mobile-auto-height mobile-gap-small" style="height: 11px; max-height: 11px;/g, 'height="6" class="mobile-auto-height mobile-gap-small" style="height: 6px; max-height: 6px;'],
  [/height="6" class="mobile-auto-height" style="height: 6px; max-height: 6px;/g, 'height="4" class="mobile-auto-height" style="height: 4px; max-height: 4px;'],
  [/height="14" class="mobile-auto-height" style="height: 14px; max-height: 14px;/g, 'height="7" class="mobile-auto-height" style="height: 7px; max-height: 7px;'],
  [/height="11" class="mobile-auto-height" style="height: 11px; max-height: 11px;/g, 'height="6" class="mobile-auto-height" style="height: 6px; max-height: 6px;'],
  [/height="20" class="mobile-auto-height" style="height: 20px; max-height: 20px;/g, 'height="10" class="mobile-auto-height" style="height: 10px; max-height: 10px;'],
  [/height="12" class="mobile-auto-height mobile-gap-medium" style="height: 12px; max-height: 12px;/g, 'height="6" class="mobile-auto-height mobile-gap-medium" style="height: 6px; max-height: 6px;'],
  [/height="17" class="mobile-auto-height mobile-gap-small" style="height: 17px; max-height: 17px;/g, 'height="8" class="mobile-auto-height mobile-gap-small" style="height: 8px; max-height: 8px;'],
  [/height="45" class="mobile-auto-height mobile-gap-large" style="height: 45px; max-height: 45px;/g, 'height="20" class="mobile-auto-height mobile-gap-large" style="height: 20px; max-height: 20px;'],
  [/height="9" class="mobile-auto-height mobile-gap-small" style="height: 9px; max-height: 9px;/g, 'height="5" class="mobile-auto-height mobile-gap-small" style="height: 5px; max-height: 5px;'],
  [/height="17" class="mobile-auto-height mobile-gap-large" style="height: 17px; max-height: 17px;/g, 'height="8" class="mobile-auto-height mobile-gap-large" style="height: 8px; max-height: 8px;']
];

for (const [regex, replacement] of replacements) {
  pendingContent = pendingContent.replace(regex, replacement);
}

// Write it back
content = before + pendingContent;
fs.writeFileSync(emailFile, content, 'utf8');
console.log('Spacers halved in pending email');
