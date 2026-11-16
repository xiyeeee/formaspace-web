import { FolderOpen } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyPanel } from '@/components/layout/empty-panel'

export const WorksPage = () => (
  <section aria-labelledby="works-title" className="space-y-6">
    <div className="space-y-2"><h1 id="works-title" className="text-3xl font-semibold tracking-tight">我的作品</h1><p className="text-sm text-muted-foreground">为你的创作留一席之地。</p></div>
    <EmptyPanel title="作品库" icon={FolderOpen} description="作品列表尚未接入。未来生成的模型将在这里统一管理。" className="min-h-[50svh]" />
    <Button asChild><Link to="/studio">前往生成工作台</Link></Button>
  </section>
)
