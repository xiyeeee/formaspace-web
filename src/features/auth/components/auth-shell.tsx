import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { AuthBrand } from '@/features/auth/components/auth-brand'
import { AuthVisual } from '@/features/auth/components/auth-visual'
import '@/features/auth/auth.css'

type AuthShellProps = { children: ReactNode; mode: 'login' | 'register' }

export const AuthShell = ({ children, mode }: AuthShellProps) => (
  <div className={`auth-page ${mode === 'register' ? 'auth-page-register' : ''}`}>
    <AuthVisual />
    <header className="auth-header"><AuthBrand /><Link className="auth-home" to="/studio"><ArrowLeft size={17} aria-hidden="true" />返回工作台</Link></header>
    <main className="auth-main">
      <section className="auth-story" aria-label="形境三维创作">
        <p className="auth-story-eyebrow">A NEW DIMENSION OF CREATIVITY</p>
        <h2>把灵感，<br />变成立体<span>。</span></h2>
        <p className="auth-story-description">从一张图片，到可触碰的想象。</p>
      </section>
      <section className="auth-panel" data-auth-panel aria-labelledby="auth-title">
        <p className="auth-eyebrow">START CREATING</p>
        <h1 id="auth-title">{mode === 'login' ? '开始你的创作' : '创建你的空间'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? '登录形境，让灵感拥有形状。' : '加入形境，让想象从这里发生。'}</p>
        {children}
      </section>
    </main>
    <footer className="auth-footer"><p><span className="auth-process-line" />图片 <span>→</span> 点云 <span>→</span> 三维模型</p><small>© 2026 FormaSpace</small></footer>
  </div>
)
