import { useEffect, useRef, useState } from 'react'
import { Download, FileBox, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAssetDownload } from '../lib/generation-api'
import { generationErrorMessage, taskFailureMessage, taskLabels } from '../lib/generation-errors'
import { assertGlbHeader } from '../lib/model-resources'
import { isSimulatedResult } from '../lib/generation-presentation'
import { formatBytes } from '../lib/generation-settings'
import type { GenerationTask, ModelAsset } from '../types'

const downloadFilename = (disposition: string | null, assetId: string) => {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = disposition?.match(/filename="([^"]+)"|filename=([^;]+)/i)
  let filename = plain?.[1] ?? plain?.[2] ?? `model-${assetId}.glb`
  try { if (encoded) filename = decodeURIComponent(encoded) } catch { /* 使用普通文件名回退。 */ }
  const safe = Array.from(filename).filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127).join('').replace(/[/\\<>:"|?*]/g, '_').trim().slice(0, 180) || `model-${assetId}.glb`
  return safe.toLowerCase().endsWith('.glb') ? safe : `model-${assetId}.glb`
}
export const AssetDetails = ({ task, asset, error, loading, onRetry }: { task?: GenerationTask; asset?: ModelAsset; error: unknown; loading: boolean; onRetry: () => void }) => {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [asset?.id])
  const download = async () => {
    if (!asset || request.current && !request.current.signal.aborted && downloading) return
    const controller = new AbortController()
    request.current = controller
    setDownloading(true)
    setDownloadError(null)
    try {
      const { blob, headers } = await getAssetDownload(asset.id, controller.signal)
      if (controller.signal.aborted) return
      assertGlbHeader(await blob.slice(0, 12).arrayBuffer(), blob.size)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadFilename(headers.get('Content-Disposition'), asset.id)
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) {
      if (!controller.signal.aborted) setDownloadError(generationErrorMessage(cause))
    } finally { if (!controller.signal.aborted) setDownloading(false) }
  }
  const parameters = task?.resolvedParameters
  return <section className="asset-details" aria-label="当前作品属性">
    <div className="details-heading"><FileBox size={16}/><h2>{asset?.name || (task ? `创作 ${task.id.slice(-6)}` : '作品信息')}</h2></div>
    {!task && <p className="muted-copy">选择历史任务，查看作品与生成参数。</p>}
    {task && <><div className="asset-meta"><span>{asset ? `${asset.format} · ${formatBytes(asset.sizeBytes)}` : taskLabels[task.status]}</span>{isSimulatedResult(task, asset) && <span className="demo-badge">演示结果</span>}</div>
      {task.status === 'FAILED' && <p className="inline-error" role="alert">{taskFailureMessage(task.errorCode, task.errorMessage)}</p>}
      {task.status === 'SUCCEEDED' && !task.assetId && <div className="panel-error"><p>任务已成功，但尚未返回作品 ID。</p><Button variant="outline" size="sm" onClick={onRetry}>重试读取任务</Button></div>}
      {loading && <p className="panel-notice"><LoaderCircle className="animate-spin" size={14}/>读取作品信息…</p>}
      {error && <div className="panel-error"><p>{generationErrorMessage(error)}</p><Button variant="outline" size="sm" onClick={onRetry}>重试读取作品</Button></div>}
      {asset && <><Button className="download-button" variant="outline" disabled={downloading} onClick={() => void download()}>{downloading ? <LoaderCircle className="animate-spin"/> : <Download/>}下载模型</Button>{downloadError && <p className="inline-error" role="alert">{downloadError}</p>}</>}
      <details className="task-parameters" open><summary>实际生成参数 <small>只读快照</small></summary>{parameters ? <dl><dt>质量</dt><dd>{parameters.quality === 'HIGH' ? '精细' : '标准'}</dd><dt>随机种子</dt><dd>{parameters.seed}</dd><dt>推理步数</dt><dd>{parameters.inferenceSteps}</dd><dt>引导强度</dt><dd>{parameters.guidanceScale}</dd><dt>几何分辨率</dt><dd>{parameters.octreeResolution}</dd><dt>去除背景</dt><dd>{parameters.removeBackground ? '是' : '否'}</dd><dt>生成贴图</dt><dd>{parameters.generateTexture ? '是' : '否'}</dd><dt>参数配置</dt><dd>{parameters.profileId}</dd></dl> : <p className="muted-copy">此历史任务没有参数快照。</p>}</details>
    </>}
  </section>
}
