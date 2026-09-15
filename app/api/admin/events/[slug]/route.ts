import { getCurrentUser } from '@/utils/auth/server'
import { NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/utils/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { data: authData } = await getCurrentUser()
  const user = authData?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ error: 'Deleting events is disabled' }, { status: 403 })
}
