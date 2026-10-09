const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateBreakdown() {
  const { data: tickets, error: tErr } = await supabase.from('tickets').select('*');
  const { data: managers, error: mErr } = await supabase.from('manager_profiles').select('*');
  
  if (tErr) console.log("Ticket Error:", tErr);
  if (mErr) console.log("Manager Error:", mErr);
  
  const upiBreakdown = {};
  
  // Initialize all managers with 0
  if (managers) {
    for (const manager of managers) {
      upiBreakdown[manager.upi_id] = {
        managerName: manager.name,
        managerEmail: manager.email,
        totalAmount: 0,
        ticketCount: 0
      };
    }
  }

  // Calculate actuals
  if (tickets && tickets.length > 0) {
    for (const ticket of tickets) {
      // Only count approved payments
      if (ticket.payment_status !== 'APPROVED') continue;

      const upi = ticket.receiver_upi;
      if (!upi) continue;

      if (!upiBreakdown[upi]) {
        upiBreakdown[upi] = { managerName: 'Unknown/Missing Profile', managerEmail: '', totalAmount: 0, ticketCount: 0 };
      }
      upiBreakdown[upi].totalAmount += ticket.amount;
      upiBreakdown[upi].ticketCount += 1;
    }
  }
  
  console.log("=== MONEY BREAKDOWN PER MANAGER (UPI ID) ===\n");
  let totalSystemAmount = 0;

  for (const [upi, stats] of Object.entries(upiBreakdown)) {
    console.log(`Manager: ${stats.managerName} (${stats.managerEmail})`);
    console.log(`UPI ID:  ${upi}`);
    console.log(`Tickets: ${stats.ticketCount}`);
    console.log(`Amount:  ₹${stats.totalAmount}\n`);
    totalSystemAmount += stats.totalAmount;
  }
  
  console.log("=============================================");
  console.log(`TOTAL TICKETS FOUND IN DB: ${tickets ? tickets.length : 0}`);
  console.log(`TOTAL MONEY COLLECTED: ₹${totalSystemAmount}`);
  console.log("=============================================\n");
}

calculateBreakdown();
