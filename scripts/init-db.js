const fs = require('fs')
const path = require('path')

const DB_FILE = path.join(process.cwd(), 'local_db.json')

const INITIAL_DATA = {
  events: [
    {
      id: "evt-001",
      slug: "mahalaya-bhoj",
      name: "Mahalaya Bhoj 2026",
      description: "Annual community feast and cultural gathering.",
      event_date: "2026-10-10T12:00:00Z",
      venue: "Community Courtyard",
      capacity: 300,
      price: 150,
      category: "Food & Dining",
      image_url: "assets/mahalaya-bhoj.webp",
      status: "OPEN",
      created_at: new Date().toISOString()
    },
    {
      id: "evt-002",
      slug: "saraswati-puja",
      name: "Saraswati Puja 2027",
      description: "Spring festival of learning and arts.",
      event_date: "2027-02-14T09:00:00Z",
      venue: "Main Auditorium",
      capacity: 500,
      price: 0,
      category: "Religious",
      image_url: "assets/saraswati-puja.webp",
      status: "OPEN",
      created_at: new Date().toISOString()
    }
  ],
  tickets: [
    {
      id: "tkt-001",
      event_id: "evt-001",
      participant_name: "Demo User",
      college_id: "202401042",
      phone: "9876543210",
      email: "demo@utsavpass.local",
      amount: 150,
      utr: "UPI123456789",
      payment_status: "APPROVED",
      status: "UNUSED",
      token: "MBH-DEMO-001",
      num_passes: 1,
      food_pref: "Non-Veg (Authentic Bhoj)",
      is_iiit: true,
      coupon_code: null,
      discount_amount: 0,
      created_at: new Date().toISOString()
    }
  ],
  checkins: [],
  admin_profiles: [
    {
      id: "dummy-admin",
      name: "Demo Admin",
      email: "admin@utsavpass.local",
      role: "organiser",
      created_at: new Date().toISOString()
    }
  ]
}

fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2))
console.log('Created local_db.json successfully')
