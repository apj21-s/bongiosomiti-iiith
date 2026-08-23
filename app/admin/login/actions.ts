'use server'

import { login, logout } from '@/utils/auth/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const { error } = await login(formData)

  if (error) {
    return { error: typeof error === 'string' ? error : (error as any).message }
  }

  redirect('/admin')
}

export async function logoutAction() {
  await logout()
  redirect('/')
}
