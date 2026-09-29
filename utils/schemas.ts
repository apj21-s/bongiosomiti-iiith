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
  numPasses: z.number().int().min(1).max(20).optional(),
  foodPref: z.string().max(200).optional(),
  passSelections: z.record(z.string(), z.number().int().min(0)).optional(),
  vegCount: z.number().int().min(0).optional(),
  nonVegCount: z.number().int().min(0).optional(),
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
