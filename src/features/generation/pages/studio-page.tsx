import { Box, History, Upload } from 'lucide-react'
import { EmptyPanel } from '@/components/layout/empty-panel'
import { Badge } from '@/components/ui/badge'

export const StudioPage = () => (
  <section aria-labelledby="studio-title" className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2"><p className="text-xs tracking-[0.2em] text-muted-foreground">FORMASPACE / STUDIO</p><h1 id="studio-title" className="text-3xl font-semibold tracking-tight">生成工作台</h1><p className="text-sm text-muted-foreground">从一张图片开始，探索三维创作的可能。</p></div>
      <Badge variant="secondary">功能筹备中</Badge>
    </div>
    <div className="grid gap-4 lg:min-h-[58svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
      <EmptyPanel title="01 / 上传与参数" icon={Upload} description="图片上传、模型参数与生成操作将在下一阶段开放。" />
      <EmptyPanel title="02 / 模型预览" icon={Box} description="三维模型将在这里呈现。当前为预览区域占位。" className="bg-muted/20" />
      <EmptyPanel title="03 / 任务历史" icon={History} description="暂无任务。接入生成服务后，这里将展示任务状态与历史记录。" />
    </div>
  </section>
)
