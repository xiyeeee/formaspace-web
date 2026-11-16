import { Box } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AuthPlaceholderProps = { mode: 'login' | 'register' }

export const AuthPlaceholder = ({ mode }: AuthPlaceholderProps) => {
  const isLogin = mode === 'login'
  const title = isLogin ? '欢迎回到形境' : '开启你的创作空间'

  return (
    <section aria-label={isLogin ? '登录页占位' : '注册页占位'} className="grid min-h-[65svh] gap-5 md:grid-cols-2">
      <div className="flex min-h-64 flex-col items-center justify-center gap-6 rounded-xl border border-border bg-muted/20 p-8 text-center">
        <Box className="size-16 text-muted-foreground" strokeWidth={1} aria-hidden="true" />
        <div className="space-y-2"><h2 className="text-2xl font-medium">让想象拥有形状</h2><p className="text-sm text-muted-foreground">视觉场景预留区域</p></div>
      </div>
      <Card className="justify-center">
        <CardHeader className="space-y-3"><CardTitle><h1 className="text-2xl">{title}</h1></CardTitle><CardDescription>{isLogin ? '登录表单将在下一阶段接入。' : '注册与邮箱验证将在下一阶段接入。'}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <p className="rounded-lg border border-dashed border-border p-5 text-sm leading-relaxed text-muted-foreground">当前为页面占位，暂不收集账号信息。你可以直接访问工作台，查看布局骨架。</p>
          <Button asChild className="w-full"><Link to="/studio">浏览工作台</Link></Button>
          <p className="text-center text-sm text-muted-foreground">{isLogin ? '还没有账号？' : '已有账号？'} <Link className="rounded-sm text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" to={isLogin ? '/register' : '/login'}>{isLogin ? '前往注册' : '前往登录'}</Link></p>
        </CardContent>
      </Card>
    </section>
  )
}
