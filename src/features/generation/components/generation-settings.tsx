import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ParameterControl } from './parameter-control'
import { getBackgroundSetting, getDraftPreview } from '../lib/generation-settings'
import type { GenerationCapabilities } from '../lib/generation-settings'
import type { GenerationDraft } from '../types'

type Props = { capabilities: GenerationCapabilities; draft: GenerationDraft; onChange: (draft: GenerationDraft) => void }
export const GenerationSettings = ({ capabilities, draft, onChange }: Props) => {
  const { quality, preset } = getDraftPreview(capabilities, draft)
  const background = getBackgroundSetting(capabilities, draft)
  const seedCapability = capabilities.advancedParameters.seed
  const patch = (value: Partial<GenerationDraft>) => onChange({ ...draft, ...value })
  const numericFields = [
    { key: 'inferenceSteps', label: '推理步数', step: 1 },
    { key: 'guidanceScale', label: '引导强度', step: 'any' },
  ] as const
  return (
    <div className="generation-settings">
      <div className="setting-section"><Label>模型质量</Label><div className="quality-options" role="group" aria-label="模型质量">{capabilities.qualities.map((value) => <button type="button" key={value} aria-pressed={quality === value} disabled={!capabilities.qualities.includes(value)} onClick={() => patch({ quality: value })}><span>{value === 'STANDARD' ? '标准' : '精细'}</span><small>{value === 'STANDARD' ? 'STANDARD' : 'HIGH'}</small></button>)}</div></div>
      <div className="setting-toggle"><div><Label htmlFor="generate-texture">生成贴图</Label>{!capabilities.textureSupported && <small>当前环境未启用</small>}</div><Switch id="generate-texture" checked={capabilities.textureSupported && draft.generateTexture} disabled={!capabilities.textureSupported} onCheckedChange={(generateTexture) => patch({ generateTexture })}/></div>
      <details className="advanced-settings"><summary><span><SlidersHorizontal size={15}/>高级设置</span><ChevronDown size={16}/></summary>
        <div className="advanced-content">
          <div className="setting-toggle"><div><Label htmlFor="remove-background">去除背景</Label>{!background.supported && <small>由当前服务固定处理</small>}</div><Switch id="remove-background" checked={background.value} disabled={!background.supported} onCheckedChange={(removeBackground) => patch({ removeBackground })}/></div>
          {seedCapability?.supported && <>
            <div className="setting-toggle"><Label htmlFor="random-seed">随机种子</Label><Switch id="random-seed" checked={draft.randomSeed} onCheckedChange={(randomSeed) => patch({ randomSeed, seed: !randomSeed && !draft.seed ? '0' : draft.seed })}/></div>
            {!draft.randomSeed && <ParameterControl id="generation-seed" label="指定种子" value={draft.seed} defaultValue={0} resetValue="0" emptyHint="请输入种子，或开启随机种子" capability={seedCapability} onChange={(seed) => patch({ seed })}/>}
          </>}
          {numericFields.filter(({ key }) => capabilities.advancedParameters[key]?.supported).map(({ key, label, step }) => (
            <ParameterControl key={key} id={`generation-${key}`} label={label} value={draft[key]} defaultValue={preset?.[key] ?? Number(capabilities.advancedParameters[key].defaultValue ?? 0)} capability={capabilities.advancedParameters[key]} step={step} slider={key === 'inferenceSteps'} onChange={(value) => patch({ [key]: value })}/>
          ))}
          {capabilities.advancedParameters.octreeResolution?.supported && <ParameterControl id="generation-resolution" label="几何分辨率" value={draft.octreeResolution} defaultValue={preset?.octreeResolution ?? Number(capabilities.advancedParameters.octreeResolution.defaultValue ?? 128)} capability={capabilities.advancedParameters.octreeResolution} onChange={(octreeResolution) => patch({ octreeResolution })}/>}
          <Button type="button" variant="ghost" size="sm" className="restore-settings" onClick={() => patch({ seed: '', randomSeed: true, inferenceSteps: '', guidanceScale: '', octreeResolution: '' })}>恢复预设</Button>
        </div>
      </details>
      {preset && <div className="preset-summary"><span>预览参数</span><p>{draft.inferenceSteps || preset.inferenceSteps} 步 · 引导 {draft.guidanceScale || preset.guidanceScale} · 分辨率 {draft.octreeResolution || preset.octreeResolution}</p><small>最终参数以任务实际结果为准</small></div>}
    </div>
  )
}
