import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type EmptyPanelProps = {
  title: string
  description: string
  icon: LucideIcon
  className?: string
}

export const EmptyPanel = ({ title, description, icon: Icon, className }: EmptyPanelProps) => (
  <Card className={cn('min-w-0', className)}>
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="flex min-h-64 flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="rounded-2xl border border-border bg-muted/50 p-5"><Icon className="size-8 text-muted-foreground" aria-hidden="true" /></div>
      <CardDescription className="max-w-64 leading-relaxed">{description}</CardDescription>
    </CardContent>
  </Card>
)
