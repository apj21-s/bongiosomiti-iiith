// Helpers for building PostgREST filters from user input.
//
// Two separate hazards are handled here:
//
// 1. Pattern wildcards. PostgREST hands like/ilike patterns straight to SQL
//    LIKE, where "%" and "_" are wildcards ("*" is PostgREST's own alias for
//    "%"). An unescaped value therefore lets a caller send "%" and match every
//    row in the table.
// 2. Filter-string injection. The .or() builder takes a raw filter string, so a
//    value containing a comma, quote or parenthesis can add or reshape filters.
//    Prefer the typed builders (.eq/.ilike) over .or() with interpolated input;
//    where .or() is unavoidable, the value must be quoted and escaped.

const LIKE_METACHARACTERS = /([\\%_*])/g

// Escapes a value for safe use inside a like/ilike pattern. SQL LIKE treats a
// backslash as the default escape character, so "\%" matches a literal percent.
export function escapeLikePattern(value: string): string {
  return value.replace(LIKE_METACHARACTERS, '\\$1')
}

// Escapes a value for use inside a double-quoted PostgREST filter value.
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// Identifiers that attendees type into lookup forms: pass tokens, roll numbers,
// emails, phone numbers. Anything longer than this is not a real identifier.
export const MAX_IDENTIFIER_LENGTH = 64

export function normaliseIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) return null
  // Control characters have no place in an identifier and only serve to confuse
  // downstream parsing.
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null
  return trimmed
}
