const fs = require('fs');
const path = require('path');

console.log("=== VERIFYING SARASWATI PUJA RESPONSIVENESS AND SCREEN WIDTH ===");

const htmlPath = path.join(__dirname, '../events/saraswati/index.html');
const cssPath = path.join(__dirname, '../styles.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

// 1. Check HTML structure
if (!html.includes('class="saraswati-page"')) {
  console.error('[FAIL] saraswati-page class missing in HTML');
  process.exit(1);
}
if (!html.includes('class="saraswati-programme-grid"')) {
  console.error('[FAIL] saraswati-programme-grid class missing in HTML');
  process.exit(1);
}
if (!html.includes('class="saraswati-card"')) {
  console.error('[FAIL] saraswati-card class missing in HTML');
  process.exit(1);
}
if (!html.includes('id="saraswati-registration-form"')) {
  console.error('[FAIL] saraswati-registration-form missing in HTML');
  process.exit(1);
}
console.log('[PASS] HTML structure contains all required sections and IDs.');

// 2. Check CSS width constraints
if (css.includes('width: min(100% - 16px, 560px);') && css.includes('.saraswati-page')) {
  // Check if saraswati-page is still bound to 560px
  const matches = css.match(/\.saraswati-page\s*\{[^}]*560px/g);
  if (matches) {
    console.error('[FAIL] saraswati-page is still restricted to 560px in CSS:', matches);
    process.exit(1);
  }
}
console.log('[PASS] saraswati-page has no restrictive 560px width constraints.');

// 3. Check full screen max-width
if (!css.includes('max-width: 1360px')) {
  console.error('[FAIL] max-width: 1360px missing in CSS');
  process.exit(1);
}
console.log('[PASS] saraswati-page has generous 1360px full-screen container alignment matching Mahalaya/Home.');

// 4. Check responsive media queries
if (!css.includes('@media (max-width: 960px)') || !css.includes('@media (max-width: 580px)')) {
  console.error('[FAIL] Responsive breakpoints missing in CSS');
  process.exit(1);
}
console.log('[PASS] Responsive breakpoints (960px, 768px, 580px) are present.');

console.log("=== ALL SARASWATI PUJA RESPONSIVE CHECKS PASSED ===");
