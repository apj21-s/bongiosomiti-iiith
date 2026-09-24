import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const DB_FILE = path.join(process.cwd(), 'local_db.json')

interface DummyDB {
  events: any[]
  tickets: any[]
  checkins: any[]
  admin_profiles: any[]
}

const INITIAL_DATA: DummyDB = {
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
      event_date: "2027-02-11T09:00:00Z",
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
      email: "demo@bangiya.samiti.iiith.local",
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
      email: process.env.ADMIN_EMAIL || "admin@bangiya.samiti.iiith.local",
      role: "organiser",
      created_at: new Date().toISOString()
    }
  ]
}

function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2))
  }
}

// Ensure init on import
initDB()

export function readDB(): DummyDB {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    return INITIAL_DATA
  }
}

export function writeDB(data: DummyDB) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

export function resetDB() {
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE)
  }
  initDB()
}

// Utility to generate a token like the Postgres function
export function generateToken(slug: string): string {
  const prefix = slug.substring(0, 3).toUpperCase()
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  const randomNums = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}-${randomChars}-${randomNums}`
}

// Atomic check-in operation for dummy mode (Node.js is single-threaded, so this is naturally synchronous/atomic)
export function atomicCheckin(token: string, gate: string, adminId: string): { success: boolean, ticket?: any } {
  const db = readDB()
  const ticketIndex = db.tickets.findIndex(t => t.token === token)
  
  if (ticketIndex === -1) {
    return { success: false }
  }

  const ticket = db.tickets[ticketIndex]
  if (ticket.status !== 'UNUSED') {
    return { success: false, ticket }
  }

  // Atomic update
  db.tickets[ticketIndex] = {
    ...ticket,
    status: 'USED',
    redeemed_at: new Date().toISOString(),
    redeemed_gate: gate,
    redeemed_by: adminId
  }

  // Insert checkin record
  db.checkins.push({
    id: uuidv4(),
    ticket_id: ticket.id,
    gate: gate,
    scanned_by: adminId,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString()
  })

  writeDB(db)
  return { success: true, ticket: db.tickets[ticketIndex] }
}
