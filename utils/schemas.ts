import { z } from 'zod'

export const registerSchema = z.object({
  eventSlug: z.string().min(1),
  participantName: z.string().min(1),
  collegeId: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  utr: z.string().optional(),
  numPasses: z.number().int().min(1).max(6).optional(),
  foodPref: z.string().optional(),
  isIiit: z.boolean().optional(),
  couponCode: z.string().optional(),
  discountAmount: z.number().int().min(0).optional(),
})

export const lookupSchema = z.object({
  query: z.string().min(1),
})

export const scannerLookupSchema = z.object({
  token: z.string().min(1),
  eventSlug: z.string().optional(),
})

export const scannerCheckinSchema = z.object({
  token: z.string().min(1),
  gate: z.string().min(1),
})
