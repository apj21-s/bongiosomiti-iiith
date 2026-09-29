'use client'

import { logoutAction } from './login/actions'

/**
 * Sign out, styled as the header's action control.
 *
 * The header used to link straight to /admin/login, which never ended the
 * session - it only moved to the form while the previous admin's cookie was
 * still set. Signing in as somebody else then replaced the cookie under a
 * browser still holding the old admin's pages, which is the other half of why
 * /admin came back showing the wrong landing.
 *
 * LogoutButton does the same job in the sidebar with its own inline styling;
 * this one wears the strip's class instead.
 */
export default function SignOutAction({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => logoutAction()}
      className={className}
      style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer' }}
    >
      SIGN OUT
    </button>
  )
}
