'use server'

import { login, logout } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Throws away everything the browser is holding for the signed-in person.
 *
 * Every admin page already says `revalidate = 0`, but that governs the server:
 * it stops Next serving a cached *render*. It says nothing about the router
 * cache, which lives in the browser and keeps the RSC payload of each route
 * already visited. Sign out and back in as somebody else and the next
 * navigation to /admin was answered from that cache - the previous admin's
 * landing page, drawn from their tier and their figures, with the new session
 * underneath it. The data was never wrong; the page had simply not been asked
 * for again.
 *
 * '/' with 'layout' covers everything below the root layout, which is the
 * right scope: the sidebar, the header and the tier gate on every admin page
 * are all drawn for whoever is signed in.
 *
 * Called before redirect(), which throws to perform the navigation.
 */
function forgetTheSignedInView() {
  revalidatePath('/', 'layout')
}

export async function loginAction(formData: FormData) {
  const { error } = await login(formData)

  if (error) {
    return { error: typeof error === 'string' ? error : (error as any).message }
  }

  forgetTheSignedInView()
  redirect('/admin')
}

export async function logoutAction() {
  await logout()
  forgetTheSignedInView()
  redirect('/')
}
