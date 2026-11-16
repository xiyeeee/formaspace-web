import { Box, Grid2X2, Layers3 } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { env } from '@/lib/env'

const navigation = [
  { to: '/studio', label: '生成工作台', icon: Box },
  { to: '/works', label: '我的作品', icon: Grid2X2 },
  { to: '/login', label: '登录' },
  { to: '/register', label: '注册' },
]

export const AppLayout = () => (
  <div className="min-h-svh bg-background text-foreground">
    <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-3" href="#main-content">跳至主要内容</a>
    <header className="border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <NavLink to="/studio" className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
          <Layers3 className="size-7" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">{env.appName}<span className="ml-2 text-sm font-normal text-muted-foreground">形境</span></span>
        </NavLink>
        <Badge variant="outline">基础工程 · 阶段 01</Badge>
        <nav aria-label="主导航" className="flex w-full flex-wrap gap-1 sm:w-auto">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {Icon && <Icon className="size-4" aria-hidden="true" />}{label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
    <main id="main-content" className="mx-auto w-full max-w-[1600px] p-5 lg:p-8"><Outlet /></main>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-xs text-muted-foreground lg:px-8">
      <p>形境 · 让想象拥有形状</p>
      <Button variant="ghost" size="sm" onClick={() => toast.info('通知组件已就绪', { description: '当前为基础工程占位，尚未接入业务服务。' })}>测试通知</Button>
    </footer>
  </div>
)
