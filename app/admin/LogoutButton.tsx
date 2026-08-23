'use client'

import { logoutAction } from './login/actions'

export default function LogoutButton() {
  return (
    <button 
      onClick={() => logoutAction()}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        font: 'inherit',
        cursor: 'pointer',
        color: 'var(--text)',
        fontWeight: 600,
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}
      className="home-strip__link"
    >
      LOGOUT
    </button>
  )
}
