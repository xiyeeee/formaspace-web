import { useState } from 'react'
import { Box, ChevronLeft, ChevronRight, FolderOpen, LoaderCircle, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useTaskAsset, useTaskHistory } from '@/features/generation/hooks/use-task-query'
import { isSimulatedResult } from '@/features/generation/lib/generation-presentation'
import { useProtectedImage } from '@/features/generation/hooks/use-protected-image'
import { generationErrorMessage } from '@/features/generation/lib/generation-errors'
import type { GenerationTask } from '@/features/generation/types'

const WorkCard = ({ task }: { task: GenerationTask }) => {
  const image = useProtectedImage(task.sourceFileId)
  const { data: asset } = useTaskAsset(task)
  return <Link className="work-link" to={`/studio?taskId=${encodeURIComponent(task.id)}`}><div className="work-image">{image ? <img src={image} alt="作品对应的源图片" loading="lazy"/> : <Box size={35}/>}<span>源图片{isSimulatedResult(task, asset) ? ' · 演示结果' : ''}</span></div><h2>{asset?.name || `创作 ${task.id.slice(-6)}`}</h2><p>{new Date(task.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></Link>
}
export const WorksPage = () => {
  const [page, setPage] = useState(1)
  const history = useTaskHistory(page, 'SUCCEEDED')
  return <section className="works-page" aria-labelledby="works-title"><div className="works-heading"><div><p className="eyebrow">YOUR CREATIVE SPACE</p><h1 id="works-title">我的作品</h1><p>已完成的创作记录，点击进入模型预览。<br/>卡片展示源图片，演示结果会单独标记。</p></div><Button asChild><Link to="/studio"><Plus size={16}/>开始创作</Link></Button></div>
    {history.isPending && <div className="works-empty"><LoaderCircle className="animate-spin"/>正在读取创作记录…</div>}
    {history.isError && <div className="works-empty" role="alert"><p>{generationErrorMessage(history.error)}</p><Button variant="outline" onClick={() => void history.refetch()}>重试</Button></div>}
    {history.data?.records.length === 0 && <div className="works-empty"><FolderOpen size={36}/><p>还没有完成的作品，从一张图片开始吧。</p><Button asChild variant="outline"><Link to="/studio">前往工作台</Link></Button></div>}
    <div className="works-grid">{history.data?.records.map((task) => <WorkCard key={task.id} task={task}/>)}</div>
    {history.data && (page > 1 || history.data.total > history.data.size) && <div className="works-pagination"><Button variant="outline" disabled={page === 1 || history.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/>上一页</Button><span>{page} / {Math.max(1, Math.ceil(history.data.total / history.data.size))}</span><Button variant="outline" disabled={page * history.data.size >= history.data.total || history.isFetching} onClick={() => setPage(page + 1)}>下一页<ChevronRight size={15}/></Button></div>}
  </section>
}
