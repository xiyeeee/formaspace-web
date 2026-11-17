import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProtectedImage } from '../hooks/use-protected-image'
import { GenerationSettings } from './generation-settings'
import { formatBytes } from '../lib/generation-settings'
import { generationErrorMessage } from '../lib/generation-errors'
import type { GenerationCapabilities } from '../lib/generation-settings'
import type { GenerationDraft, PendingSubmission } from '../types'
import type { useImageUpload } from '../hooks/use-image-upload'
import type { useTaskSubmission } from '../hooks/use-task-submission'

const PendingSource = ({ pending }: { pending: PendingSubmission }) => {
  const image = useProtectedImage(pending.request.sourceFileId)
  const options = pending.request.advancedOptions
  return <div className="pending-source" aria-label="待确认提交快照">
    {image ? <div className="source-image"><img src={image} alt="待确认提交的源图片"/></div> : <p className="panel-notice">源图片 #{pending.request.sourceFileId}</p>}
    <p>待确认参数 · {pending.request.quality === 'HIGH' ? '精细' : '标准'} · {options.seed === null ? '随机种子' : `种子 ${options.seed}`}</p>
    <small>{options.inferenceSteps === null ? '预设步数' : `${options.inferenceSteps} 步`} · {options.octreeResolution === null ? '预设分辨率' : `分辨率 ${options.octreeResolution}`}</small>
  </div>
}

type Props = {
  upload: ReturnType<typeof useImageUpload>; submission: ReturnType<typeof useTaskSubmission>
  capabilities?: GenerationCapabilities; capabilityError: unknown; capabilityLoading: boolean
  onRetryCapabilities: () => void; draft: GenerationDraft; onDraftChange: (draft: GenerationDraft) => void
  onSelectFile: (file: File) => void; onGenerate: () => void; running: boolean
}
export const UploadPanel = ({ upload, submission, capabilities, capabilityError, capabilityLoading, onRetryCapabilities, draft, onDraftChange, onSelectFile, onGenerate, running }: Props) => {
  const { selection } = upload
  const locked = Boolean(submission.pending || submission.submitting)
  const disabled = !capabilities || locked
  const dropzone = useDropzone({
    accept: capabilities?.accept, maxFiles: 1, multiple: false, disabled,
    onDrop: (files) => { if (files[0]) onSelectFile(files[0]) },
  })
  const handleGenerate = () => {
    if (submission.submitting) return
    const reason = [
      { blocked: Boolean(submission.pending), message: '请先重试确认上一笔提交，避免重复创建任务。' },
      { blocked: capabilityLoading, message: '正在读取生成配置，请稍候再试。' },
      { blocked: Boolean(capabilityError) || !capabilities, message: '生成配置读取失败，请重新获取配置。' },
      { blocked: capabilities?.mode === 'DISABLED', message: '生成服务暂未启用，请先开启后端生成服务。' },
      { blocked: !capabilities?.generationAvailable, message: '生成服务暂未就绪，请稍后重试或重新检查服务。' },
      { blocked: !capabilities?.canGenerate || !capabilities?.qualities.length, message: '当前服务不支持单图生成，请重新检查配置。' },
      { blocked: running, message: '当前任务正在处理中，请等待完成后再生成。' },
      { blocked: selection?.status === 'uploading', message: '图片正在上传，请等待上传完成。' },
      { blocked: selection?.status === 'failed', message: '图片上传失败，请先重试上传。' },
      { blocked: selection?.status !== 'ready' || !selection?.uploaded, message: '请先选择图片并完成上传。' },
    ].find(({ blocked }) => blocked)?.message
    if (reason) { toast.info(reason, { id: 'generation-validation' }); return }
    onGenerate()
  }
  return (
    <aside className="upload-panel" aria-labelledby="studio-title">
      <div className="panel-scroll">
        <div className="panel-heading"><p className="eyebrow">IMAGE TO 3D</p><h1 id="studio-title">图片转模型</h1><p>从一张图片，开始你的创作。</p></div>
        <fieldset disabled={locked}>
          <div className="input-mode"><ImagePlus size={16}/><span>单图生成</span><small>01 IMAGE</small></div>
          {submission.pending && !selection ? <PendingSource pending={submission.pending}/> : selection ? <div className="source-selection"><div className="source-image"><img src={selection.preview} alt="待生成的源图片"/><div className="source-actions"><Button type="button" variant="secondary" size="icon-sm" onClick={dropzone.open} disabled={disabled} aria-label="替换图片"><RefreshCw size={15}/></Button><Button type="button" variant="secondary" size="icon-sm" onClick={upload.remove} aria-label="移除图片"><Trash2 size={15}/></Button></div></div><div className="source-filename" title={selection.file.name}>{selection.file.name}</div><div className={`upload-state ${selection.status}`} role="status">{selection.status === 'uploading' ? <><LoaderCircle className="animate-spin" size={13}/>正在上传</> : selection.status === 'ready' ? <><Check size={13}/>上传完成 · {formatBytes(selection.file.size)}</> : <><span>{selection.error}</span><button type="button" onClick={() => onSelectFile(selection.file)}>重试上传</button></>}</div></div>
            : <div {...dropzone.getRootProps()} className={`upload-dropzone ${dropzone.isDragActive ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}><Upload size={25}/><strong>拖拽图片到这里</strong><span>或点击选择图片</span>{capabilities && <small>{capabilities.uploadConstraints.formats.join(' / ')} · 最大 {formatBytes(capabilities.uploadConstraints.maximumBytes)}<br/>不超过 {(capabilities.uploadConstraints.maximumPixels / 1_000_000).toFixed(0)} 百万像素</small>}</div>}
          <input {...dropzone.getInputProps()} aria-label="上传源图片"/>
          {dropzone.fileRejections.length > 0 && <p className="inline-error" role="alert">请选择一张当前支持格式的图片。</p>}
          {upload.error && <p className="inline-error" role="alert">{upload.error}</p>}
          {capabilities && !submission.pending && <GenerationSettings capabilities={capabilities} draft={draft} onChange={onDraftChange}/>}
        </fieldset>
        {capabilityLoading && <p className="panel-notice"><LoaderCircle size={14} className="animate-spin"/>正在读取生成能力…</p>}
        {Boolean(capabilityError) && <div className="panel-error" role="alert"><p>暂时无法读取生成配置</p><small>{generationErrorMessage(capabilityError)}</small><Button variant="outline" size="sm" onClick={onRetryCapabilities}>重新获取</Button></div>}
        {capabilities?.mode === 'MOCK' && <div className="mode-notice"><strong>演示模式</strong><p>{capabilities.simulationNotice || '仅模拟任务链路，结果为演示模型。'}</p></div>}
        {capabilities?.mode === 'DISABLED' && <p className="panel-notice">生成服务暂未启用，仍可上传图片和查看历史任务。</p>}
        {capabilities?.mode === 'HUNYUAN_LOCAL' && <div className="service-notice" role="status"><strong>{capabilities.generationAvailable ? '本地生成服务已就绪' : '本地生成服务暂未就绪'}</strong><p>{capabilities.generationAvailable ? '参数以当前部署能力为准，生成期间可在历史中查看任务。' : '仍可上传图片和查看历史任务，稍后可重新检查服务。'}</p><Button variant="outline" size="sm" onClick={onRetryCapabilities}>重新检查服务</Button></div>}
        {capabilities && (!capabilities.supportedInputModes.includes('SINGLE_IMAGE') || !capabilities.qualities.length) && <p className="inline-error">当前部署没有可用的单图生成档位，请刷新配置或稍后重试。</p>}
      </div>
      <div className="generate-footer">
        {submission.pending && !submission.submitting && <div className="pending-notice"><strong>有一笔提交等待确认</strong><p>已锁定原图与参数。请先重试确认，避免重复创建任务。</p><Button variant="outline" onClick={submission.retry}>重试确认</Button><details><summary>核对历史后重新编辑</summary><p>原任务可能已创建，请先在右侧核对。放弃确认不会取消服务端任务。</p><Button variant="ghost" size="sm" onClick={submission.discard}>已核对，放弃此确认记录</Button></details></div>}
        {submission.error && <p role="alert" className="inline-error">{submission.error}</p>}
        <Button type="button" className="generate-button" disabled={submission.submitting} onClick={handleGenerate}>{submission.submitting ? <><LoaderCircle className="animate-spin"/>提交中</> : <><span>{running ? '任务处理中' : '生成模型'}</span><ArrowUpRight size={20}/></>}</Button>
        <p>{capabilities?.mode === 'MOCK' ? '演示结果与上传图片内容无关' : '让平面的灵感，拥有立体的可能'}</p>
      </div>
    </aside>
  )
}
