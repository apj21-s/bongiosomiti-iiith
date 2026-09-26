// Re-send digital passes to specific attendees.
//
// Intended for use after supabase/rotate-leaked-tokens.sql, which changes the
// pass codes and therefore invalidates the QR images already sitting in
// attendees' inboxes.
//
// This drives the existing /api/pass/resend endpoint rather than rebuilding the
// email, so the message attendees receive is exactly the normal one, with their
// current tokens.
//
//   node scripts/resend-passes.js someone@example.com another@example.com
//   node scripts/resend-passes.js --url https://your-site.example someone@example.com
//
// Note: the endpoint is rate limited to 3 sends per address per 10 minutes.

require('dotenv').config({ path: '.env.local' });

const args = process.argv.slice(2);
let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const recipients = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') {
    baseUrl = args[++i];
  } else {
    recipients.push(args[i]);
  }
}

if (recipients.length === 0) {
  console.error('Usage: node scripts/resend-passes.js [--url https://host] <email> [more emails...]');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`Resending passes via ${baseUrl}\n`);
  let failures = 0;

  for (const email of recipients) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/pass/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: email }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        console.log(`  ok       ${email}  ${body.message || ''}`);
      } else {
        failures++;
        console.error(`  FAILED   ${email}  [${res.status}] ${body.error || 'unknown error'}`);
      }
    } catch (err) {
      failures++;
      console.error(`  FAILED   ${email}  ${err.message}`);
    }

    await sleep(1500);
  }

  console.log(`\nDone. ${recipients.length - failures} sent, ${failures} failed.`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
