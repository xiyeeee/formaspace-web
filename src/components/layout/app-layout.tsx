import { Box, Grid2X2, LogOut, Sparkles } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '@/features/auth/lib/session-state'
import { logout } from '@/features/auth/lib/session-actions'
import { Button } from '@/components/ui/button'
import '@/features/generation/workbench.css'

export const AppLayout = () => {
  const session = useSession()
  const navigate = useNavigate()
  const signOut = () => { logout(); navigate('/login', { replace: true }) }
  return (
    <div className="workspace-shell">
      <a className="workspace-skip" href="#main-content">跳至主要内容</a>
      <header className="workspace-header">
        <NavLink to="/studio" className="workspace-brand" aria-label="形境 FormaSpace 工作台">
          <svg viewBox="0 0 56 48" width="34" height="30" fill="none" aria-hidden="true"><path d="M2 30 24 4h17L19 30H2Zm19 14 22-26h11L32 44H21Z" fill="currentColor"/><path d="m21 32 15-18v17L21 44V32Z" fill="currentColor" opacity=".6"/></svg>
          <strong>形境 <span>/ FormaSpace</span></strong>
        </NavLink>
        <nav aria-label="主导航" className="workspace-navigation">
          <NavLink to="/studio">工作台</NavLink><NavLink to="/works">我的作品</NavLink>
        </nav>
        <div className="workspace-account"><span className="workspace-avatar" aria-hidden="true">{session.user?.nickname.slice(0, 1).toUpperCase()}</span><span className="workspace-username">{session.user?.nickname}</span><Button variant="ghost" size="icon" aria-label="退出登录" title="退出登录" onClick={signOut}><LogOut /></Button></div>
      </header>
      <div className="workspace-body">
        <nav className="workspace-rail" aria-label="功能导航">
          <NavLink to="/studio"><Sparkles size={22}/><span>创作</span></NavLink>
          <NavLink to="/works"><Grid2X2 size={22}/><span>作品</span></NavLink>
          <div className="workspace-rail-mark" aria-hidden="true"><Box size={19}/><small>3D</small></div>
        </nav>
        <main id="main-content" className="workspace-main"><Outlet /></main>
      </div>
    </div>
  )
}
