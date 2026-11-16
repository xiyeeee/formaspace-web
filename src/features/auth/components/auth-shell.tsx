import type { ReactNode } from 'react'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthVisual } from '@/features/auth/components/auth-visual'
import '@/features/auth/auth.css'

type AuthShellProps = { children: ReactNode; mode: 'login' | 'register' }

export const AuthShell = ({ children, mode }: AuthShellProps) => (
  <div className={`auth-page ${mode === 'register' ? 'auth-page-register' : ''}`}>
    <AuthVisual />
    <header className="auth-header"><AuthBrand /></header>
    <main className="auth-main">
      <section className="auth-panel" data-auth-panel aria-label={mode === 'login' ? '登录' : '注册'}>
        <p className="auth-subtitle">{mode === 'login' ? '登录形境，让灵感拥有形状。' : '加入形境，让想象从这里发生。'}</p>
        {children}
      </section>
    </main>
    <footer className="auth-footer"><small>© 2026 FormaSpace</small></footer>
  </div>
)
