import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { ParameterCapability } from '../types'

type Props = {
  id: string; label: string; value: string; defaultValue: number; capability: ParameterCapability
  step?: number | 'any'; slider?: boolean; resetValue?: string; emptyHint?: string; onChange: (value: string) => void
}
export const ParameterControl = ({ id, label, value, defaultValue, capability, step = 1, slider = true, resetValue = '', emptyHint, onChange }: Props) => {
  const allowedValues = capability.allowedValues?.length ? capability.allowedValues : null
  const minimum = capability.minimum ?? (allowedValues ? Math.min(...allowedValues) : undefined)
  const maximum = capability.maximum ?? (allowedValues ? Math.max(...allowedValues) : undefined)
  const fixed = minimum !== undefined && minimum === maximum
  const inputValue = value.trim() ? Number(value) : defaultValue
  const previewValue = Number.isFinite(inputValue) ? inputValue : defaultValue
  const rangeValue = allowedValues
    ? allowedValues.reduce((closest, candidate, index) => Math.abs(candidate - previewValue) < Math.abs(allowedValues[closest] - previewValue) ? index : closest, 0)
    : Math.min(maximum ?? previewValue, Math.max(minimum ?? previewValue, previewValue))
  return <div className="parameter-control">
    <div className="parameter-control-heading">
      <Label htmlFor={id}>{label}</Label>
      <div className="parameter-control-value">
        <Input id={id} type="number" min={capability.rangeAdvisory ? undefined : minimum} max={capability.rangeAdvisory ? undefined : maximum} step={step} value={value} onChange={(event) => onChange(event.target.value)} placeholder={String(defaultValue)} aria-describedby={`${id}-hint`}/>
        <Button variant="ghost" size="icon-xs" type="button" aria-label={`恢复${label}预设`} title={`恢复预设 ${defaultValue}`} onClick={() => onChange(resetValue)}><RotateCcw size={12}/></Button>
      </div>
    </div>
    {slider && minimum !== undefined && maximum !== undefined && !fixed && <div className="parameter-control-slider">
      <span>{minimum}</span>
      <Slider aria-label={`${label}滑条`} min={allowedValues ? 0 : minimum} max={allowedValues ? allowedValues.length - 1 : maximum} step={allowedValues ? 1 : step === 'any' ? 0.1 : step} value={[rangeValue]} onValueChange={([next]) => onChange(String(allowedValues ? allowedValues[next] : next))}/>
      <span>{maximum}</span>
    </div>}
    <small id={`${id}-hint`} className="parameter-control-hint">{capability.rangeAdvisory ? `参考范围 ${minimum ?? '—'} ～ ${maximum ?? '—'}，可手动输入` : fixed ? `参考值 ${minimum}` : value === '' ? emptyHint ?? `使用预设 ${defaultValue}` : '已自定义'}{label === '几何分辨率' ? ' · 数值越高，几何采样越精细' : ''}</small>
  </div>
}
