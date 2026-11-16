import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getDraftPreview } from '../lib/generation-settings'
import type { GenerationCapabilities } from '../lib/generation-settings'
import type { GenerationDraft } from '../types'

type Props = { capabilities: GenerationCapabilities; draft: GenerationDraft; onChange: (draft: GenerationDraft) => void }
export const GenerationSettings = ({ capabilities, draft, onChange }: Props) => {
  const { quality, preset } = getDraftPreview(capabilities, draft)
  const patch = (value: Partial<GenerationDraft>) => onChange({ ...draft, ...value })
  const numericFields = [
    { key: 'inferenceSteps', label: '推理步数', step: 1 },
    { key: 'guidanceScale', label: '引导强度', step: 'any' },
  ] as const
  return (
    <div className="generation-settings">
      <div className="setting-section"><Label>模型质量</Label><div className="quality-options" role="group" aria-label="模型质量">{(['STANDARD', 'HIGH'] as const).map((value) => <button type="button" key={value} aria-pressed={quality === value} disabled={!capabilities.qualities.includes(value)} onClick={() => patch({ quality: value })}><span>{value === 'STANDARD' ? '标准' : '精细'}</span><small>{value === 'STANDARD' ? 'STANDARD' : 'HIGH'}</small></button>)}</div></div>
      <div className="setting-toggle"><div><Label htmlFor="generate-texture">生成贴图</Label>{!capabilities.textureSupported && <small>当前环境未启用</small>}</div><Switch id="generate-texture" checked={capabilities.textureSupported && draft.generateTexture} disabled={!capabilities.textureSupported} onCheckedChange={(generateTexture) => patch({ generateTexture })}/></div>
      <details className="advanced-settings"><summary><span><SlidersHorizontal size={15}/>高级设置</span><ChevronDown size={16}/></summary>
        <div className="advanced-content">
          <div className="setting-toggle"><div><Label htmlFor="remove-background">去除背景</Label>{!capabilities.removeBackgroundSupported && <small>当前环境未支持</small>}</div><Switch id="remove-background" checked={capabilities.removeBackgroundSupported && draft.removeBackground} disabled={!capabilities.removeBackgroundSupported || !capabilities.advancedParameters.removeBackground?.supported} onCheckedChange={(removeBackground) => patch({ removeBackground })}/></div>
          {capabilities.advancedParameters.seed?.supported && <><div className="setting-toggle"><Label htmlFor="random-seed">随机种子</Label><Switch id="random-seed" checked={draft.randomSeed} onCheckedChange={(randomSeed) => patch({ randomSeed })}/></div>{!draft.randomSeed && <div className="parameter-field"><Label htmlFor="generation-seed">指定种子</Label><Input id="generation-seed" type="number" min={capabilities.advancedParameters.seed.minimum ?? 0} max={capabilities.advancedParameters.seed.maximum ?? 2147483647} step={1} value={draft.seed} onChange={(event) => patch({ seed: event.target.value })} placeholder="0 ～ 2147483647"/></div>}</>}
          {numericFields.filter(({ key }) => capabilities.advancedParameters[key]?.supported).map(({ key, label, step }) => {
            const parameter = capabilities.advancedParameters[key]
            return <div key={key} className="parameter-field"><Label htmlFor={`generation-${key}`}>{label}<small>{parameter.minimum} – {parameter.maximum}</small></Label><Input id={`generation-${key}`} type="number" min={parameter.minimum ?? undefined} max={parameter.maximum ?? undefined} step={step} value={draft[key]} onChange={(event) => patch({ [key]: event.target.value })} placeholder={`预设 ${preset?.[key] ?? '—'}`}/></div>
          })}
          {capabilities.advancedParameters.octreeResolution?.supported && <div className="parameter-field"><Label htmlFor="generation-resolution">几何分辨率</Label><select id="generation-resolution" value={draft.octreeResolution} onChange={(event) => patch({ octreeResolution: event.target.value })}><option value="">使用预设（{preset?.octreeResolution}）</option>{capabilities.advancedParameters.octreeResolution.allowedValues?.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>}
          <Button type="button" variant="ghost" size="sm" className="restore-settings" onClick={() => patch({ seed: '', randomSeed: true, inferenceSteps: '', guidanceScale: '', octreeResolution: '' })}>恢复预设</Button>
        </div>
      </details>
      {preset && <div className="preset-summary"><span>预览参数</span><p>{draft.inferenceSteps || preset.inferenceSteps} 步 · 引导 {draft.guidanceScale || preset.guidanceScale} · 分辨率 {draft.octreeResolution || preset.octreeResolution}</p><small>最终参数以任务实际结果为准</small></div>}
    </div>
  )
}
