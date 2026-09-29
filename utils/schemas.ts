import { z } from 'zod'

// Length caps are generous enough that no real submission hits them; they exist
// so a request body cannot carry megabytes of text into the database.
export const registerSchema = z.object({
  eventSlug: z.string().min(1).max(64),
  participantName: z.string().min(1).max(120),
  collegeId: z.string().max(64).optional(),
  // Required now, and required to be reachable: the route spends an emailProof
  // against it. Affiliation is decided by the verified domain, so this field
  // is what the institute rate rests on rather than a roll number.
  email: z.string().email().max(200),
  // Issued by /api/verify-email once a mailed code comes back. Signed, so it
  // cannot be minted or edited onto a different address by the client.
  emailProof: z.string().max(400).optional(),
  phone: z.string().max(20).optional().or(z.literal('')),
  utr: z.string().max(64).optional(),
  // Which UPI id the money was sent to, read off the receipt by OCR or
  // typed by the visitor. It routes the payment to the right manager, and the
  // route checks it against the ids the festival actually collects at.
  receiverUpi: z.string().max(80).optional(),
  // Where /api/receipts stored the uploaded receipt. Its shape is checked
  // again on arrival; a client-supplied path is not filed as-is.
  receiptPath: z.string().max(200).optional(),
  numPasses: z.number().int().min(1).max(6).optional(),
  foodPref: z.string().max(200).optional(),
  // How many of each configured pass type. The form used to send only a
  // joined summary of this ("1 Breakfast Veg, 2 Lunch Non-Veg"), which is
  // unreadable to the pricing code - so the route priced every pass at one
  // flat rate and charged a different total from the one on screen. The
  // counts arrive structured now. They are still only a request: the route
  // prices them against the event's own table and ignores any amount.
  passSelections: z.record(z.string().max(120), z.number().int().min(0).max(10)).optional(),
  isIiit: z.boolean().optional(),
  couponCode: z.string().max(40).optional(),
  // NOTE: the discount is resolved from the event's own coupon list on the
  // server. A client-supplied amount is not trusted and is not read.
})

export const lookupSchema = z.object({
  query: z.string().min(1).max(64),
})

export const scannerLookupSchema = z.object({
  token: z.string().min(1).max(64),
  eventSlug: z.string().max(64).optional(),
})

export const scannerCheckinSchema = z.object({
  token: z.string().min(1).max(64),
  gate: z.string().min(1).max(64),
})
