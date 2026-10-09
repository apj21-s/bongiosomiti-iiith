import { sendMail } from './utils/mail-transport';

async function main() {
  console.log('Sending email...');
  const result = await sendMail({
    fromName: 'Test',
    to: 'arkaprava.jana@research.iiit.ac.in',
    subject: 'Test',
    text: 'Test',
    html: 'Test',
  });
  console.log(result);
}

main().catch(console.error);
