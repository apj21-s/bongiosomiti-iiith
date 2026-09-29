import dns from 'dns';
import { promisify } from 'util';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const resolveTxt = promisify(dns.resolveTxt);

async function checkDns() {
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
  if (!fromEmail || !fromEmail.includes('@')) {
    console.log('No valid FROM_EMAIL found in .env.local');
    return;
  }
  
  const domain = fromEmail.split('@')[1];
  console.log('Checking DNS for domain:', domain);
  
  try {
    const spfRecords = await resolveTxt(domain);
    console.log('SPF/TXT Records:', spfRecords);
  } catch (e) {
    console.log('Error fetching SPF:', e);
  }
  
  try {
    const dmarcRecords = await resolveTxt('_dmarc.' + domain);
    console.log('DMARC Records:', dmarcRecords);
  } catch (e) {
    console.log('Error fetching DMARC:', e);
  }
}

checkDns().catch(console.error);
