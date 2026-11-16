import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'

export const ErrorPage = () => {
  const error = useRouteError()
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404)

  return (
    <section className="flex min-h-[60svh] flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="text-sm text-muted-foreground">{notFound ? '404 / NOT FOUND' : 'FORMASPACE / ERROR'}</p>
      <h1 className="text-3xl font-semibold">{notFound ? '这个空间还不存在' : '页面暂时无法显示'}</h1>
      <p className="text-sm text-muted-foreground">{notFound ? '请检查地址，或返回工作台继续探索。' : '请重新打开工作台，或稍后再试。'}</p>
      <Button asChild><Link to="/studio" reloadDocument={!notFound}>返回工作台</Link></Button>
    </section>
  )
}
