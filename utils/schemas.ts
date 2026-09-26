import { z } from 'zod'

// Length caps are generous enough that no real submission hits them; they exist
// so a request body cannot carry megabytes of text into the database.
export const registerSchema = z.object({
  eventSlug: z.string().min(1).max(64),
  participantName: z.string().min(1).max(120),
  collegeId: z.string().max(64).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  utr: z.string().max(64).optional(),
  numPasses: z.number().int().min(1).max(6).optional(),
  foodPref: z.string().max(200).optional(),
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
