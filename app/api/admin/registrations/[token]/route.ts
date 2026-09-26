import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('token', token.toUpperCase())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
