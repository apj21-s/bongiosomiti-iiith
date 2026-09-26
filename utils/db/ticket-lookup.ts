import { escapeLikePattern } from './filters'

// Columns an attendee may identify their booking by, in the order the old
// .or() filter listed them. Probing them one at a time keeps the exact same
// matching semantics (case-insensitive, no wildcards) without ever building a
// filter string out of user input.
const LOOKUP_COLUMNS = ['token', 'college_id', 'email', 'phone'] as const

// The client is deliberately loosely typed: createServiceRoleClient() returns
// either a real SupabaseClient or the DUMMY_DB mock, which share no interface.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function findTicketByIdentifier(
  supabase: any,
  identifier: string,
  select: string
): Promise<any | null> {
  const pattern = escapeLikePattern(identifier)

  for (const column of LOOKUP_COLUMNS) {
    const { data, error } = await supabase
      .from('tickets')
      .select(select)
      .ilike(column, pattern)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) continue
    if (data && data.length > 0) return data[0]
  }

  return null
}
