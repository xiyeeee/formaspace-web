import { useDropzone } from 'react-dropzone'
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GenerationSettings } from './generation-settings'
import { formatBytes } from '../lib/generation-settings'
import { generationErrorMessage } from '../lib/generation-errors'
import type { GenerationCapabilities } from '../lib/generation-settings'
import type { GenerationDraft } from '../types'
import type { useImageUpload } from '../hooks/use-image-upload'
import type { useTaskSubmission } from '../hooks/use-task-submission'

type Props = {
  upload: ReturnType<typeof useImageUpload>; submission: ReturnType<typeof useTaskSubmission>
  capabilities?: GenerationCapabilities; capabilityError: unknown; capabilityLoading: boolean
  onRetryCapabilities: () => void; draft: GenerationDraft; onDraftChange: (draft: GenerationDraft) => void
  onSelectFile: (file: File) => void; onGenerate: () => void; draftError: string | null; running: boolean
}
export const UploadPanel = ({ upload, submission, capabilities, capabilityError, capabilityLoading, onRetryCapabilities, draft, onDraftChange, onSelectFile, onGenerate, draftError, running }: Props) => {
  const { selection } = upload
  const locked = Boolean(submission.pending || submission.submitting)
  const disabled = !capabilities || locked
  const dropzone = useDropzone({
    accept: capabilities?.accept, maxFiles: 1, multiple: false, disabled,
    onDrop: (files) => { if (files[0]) onSelectFile(files[0]) },
    onDropRejected: () => { upload.remove() },
  })
  const generateDisabled = disabled || !capabilities?.canGenerate || !capabilities.qualities.length || selection?.status !== 'ready' || running
  return (
    <aside className="upload-panel" aria-labelledby="studio-title">
      <div className="panel-scroll">
        <div className="panel-heading"><p className="eyebrow">IMAGE TO 3D</p><h1 id="studio-title">图片转模型</h1><p>从一张图片，开始你的创作。</p></div>
        <fieldset disabled={locked}>
          <div className="input-mode"><ImagePlus size={16}/><span>单图生成</span><small>01 IMAGE</small></div>
          {selection ? <div className="source-selection"><div className="source-image"><img src={selection.preview} alt="待生成的源图片"/><div className="source-actions"><Button type="button" variant="secondary" size="icon-sm" onClick={dropzone.open} disabled={disabled} aria-label="替换图片"><RefreshCw size={15}/></Button><Button type="button" variant="secondary" size="icon-sm" onClick={upload.remove} aria-label="移除图片"><Trash2 size={15}/></Button></div></div><div className="source-filename" title={selection.file.name}>{selection.file.name}</div><div className={`upload-state ${selection.status}`} role="status">{selection.status === 'uploading' ? <><LoaderCircle className="animate-spin" size={13}/>正在上传</> : selection.status === 'ready' ? <><Check size={13}/>上传完成 · {formatBytes(selection.file.size)}</> : <><span>{selection.error}</span><button type="button" onClick={() => onSelectFile(selection.file)}>重试上传</button></>}</div></div>
            : <div {...dropzone.getRootProps()} className={`upload-dropzone ${dropzone.isDragActive ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}><Upload size={25}/><strong>拖拽图片到这里</strong><span>或点击选择图片</span>{capabilities && <small>{capabilities.uploadConstraints.formats.join(' / ')} · 最大 {formatBytes(capabilities.uploadConstraints.maximumBytes)}<br/>不超过 {(capabilities.uploadConstraints.maximumPixels / 1_000_000).toFixed(0)} 百万像素</small>}</div>}
          <input {...dropzone.getInputProps()} aria-label="上传源图片"/>
          {dropzone.fileRejections.length > 0 && <p className="inline-error" role="alert">请选择一张当前支持格式的图片。</p>}
          {upload.error && <p className="inline-error" role="alert">{upload.error}</p>}
          {capabilities && <GenerationSettings capabilities={capabilities} draft={draft} onChange={onDraftChange}/>}
        </fieldset>
        {capabilityLoading && <p className="panel-notice"><LoaderCircle size={14} className="animate-spin"/>正在读取生成能力…</p>}
        {Boolean(capabilityError) && <div className="panel-error" role="alert"><p>暂时无法读取生成配置</p><small>{generationErrorMessage(capabilityError)}</small><Button variant="outline" size="sm" onClick={onRetryCapabilities}>重新获取</Button></div>}
        {capabilities?.mode === 'MOCK' && <div className="mode-notice"><strong>演示模式</strong><p>{capabilities.simulationNotice || '仅模拟任务链路，结果为演示模型。'}</p></div>}
        {capabilities?.mode === 'DISABLED' && <p className="panel-notice">生成服务暂未启用，仍可上传图片和查看历史任务。</p>}
      </div>
      <div className="generate-footer">
        {submission.pending && !submission.submitting && <div className="pending-notice"><strong>有一笔提交等待确认</strong><p>已锁定原图与参数。请先重试确认，避免重复创建任务。</p><Button variant="outline" onClick={submission.retry}>重试确认</Button><details><summary>核对历史后重新编辑</summary><p>原任务可能已创建，请先在右侧核对。放弃确认不会取消服务端任务。</p><Button variant="ghost" size="sm" onClick={submission.discard}>已核对，放弃此确认记录</Button></details></div>}
        {(draftError || submission.error) && <p role="alert" className="inline-error">{draftError || submission.error}</p>}
        <Button type="button" className="generate-button" disabled={generateDisabled} onClick={onGenerate}>{submission.submitting ? <><LoaderCircle className="animate-spin"/>提交中</> : <><span>{running ? '任务处理中' : '生成模型'}</span><ArrowUpRight size={20}/></>}</Button>
        <p>{capabilities?.mode === 'MOCK' ? '演示结果与上传图片内容无关' : '让平面的灵感，拥有立体的可能'}</p>
      </div>
    </aside>
  )
}
