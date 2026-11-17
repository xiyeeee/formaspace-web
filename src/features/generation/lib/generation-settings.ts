import type { Capabilities, CreateTaskRequest, GenerationDraft, ParameterCapability } from '../types'

export const initialDraft: GenerationDraft = {
  quality: 'STANDARD', generateTexture: false, removeBackground: null, randomSeed: true,
  seed: '', inferenceSteps: '', guidanceScale: '', octreeResolution: '',
}
const imageFormats: Record<string, { mime: string; extensions: string[] }> = {
  JPEG: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] }, PNG: { mime: 'image/png', extensions: ['.png'] },
}
// 对已核对的本地 Gradio 参数提供参考范围；兼容旧服务仍返回单值的能力响应。
const localReferences: Record<string, { minimum: number; maximum: number }> = {
  inferenceSteps: { minimum: 1, maximum: 100 },
  guidanceScale: { minimum: 0, maximum: 10 },
  octreeResolution: { minimum: 16, maximum: 512 },
}
const adaptParameterRanges = (capabilities: Capabilities): Record<string, ParameterCapability> =>
  Object.fromEntries(Object.entries(capabilities.advancedParameters).map(([key, parameter]) => {
    const reference = localReferences[key]
    if (!reference || capabilities.mode !== 'HUNYUAN_LOCAL') return [key, parameter]
    const singleValue = parameter.allowedValues?.length === 1 || (parameter.minimum !== null && parameter.minimum === parameter.maximum)
    return [key, {
      ...parameter, rangeAdvisory: true,
      minimum: singleValue ? reference.minimum : parameter.minimum,
      maximum: singleValue ? reference.maximum : parameter.maximum,
      allowedValues: singleValue ? null : parameter.allowedValues,
    }]
  }))
export const adaptCapabilities = (capabilities: Capabilities) => ({
  ...capabilities,
  advancedParameters: adaptParameterRanges(capabilities),
  qualities: (['STANDARD', 'HIGH'] as const).filter((quality) => capabilities.qualityPresets[quality]),
  accept: Object.fromEntries(capabilities.uploadConstraints.formats.filter((format) => imageFormats[format]).map((format) => [imageFormats[format].mime, imageFormats[format].extensions])),
  canGenerate: capabilities.mode !== 'DISABLED' && capabilities.generationAvailable
    && capabilities.supportedInputModes.includes('SINGLE_IMAGE')
    && Object.keys(capabilities.qualityPresets).length > 0,
})
export type GenerationCapabilities = ReturnType<typeof adaptCapabilities>
export const getDraftPreview = (capabilities: GenerationCapabilities, draft: GenerationDraft) => {
  const quality = capabilities.qualities.includes(draft.quality) ? draft.quality : capabilities.qualities[0]
  const preset = quality ? capabilities.qualityPresets[quality] : undefined
  return { quality, preset }
}
export const getBackgroundSetting = (capabilities: GenerationCapabilities, draft: GenerationDraft) => {
  const parameter = capabilities.advancedParameters.removeBackground
  const supported = capabilities.removeBackgroundSupported && Boolean(parameter?.supported)
  const defaultValue = typeof parameter?.defaultValue === 'boolean' ? parameter.defaultValue : true
  return { supported, value: supported ? draft.removeBackground ?? defaultValue : defaultValue }
}
export const buildTaskRequest = (capabilities: GenerationCapabilities, draft: GenerationDraft, sourceFileId: string): CreateTaskRequest => {
  const { quality, preset } = getDraftPreview(capabilities, draft)
  if (!quality || !preset) throw new Error('当前没有可用质量档位')
  const readOverride = (key: 'seed' | 'inferenceSteps' | 'guidanceScale' | 'octreeResolution', label: string, integer: boolean) => {
    const capability = capabilities.advancedParameters[key]
    if (!capability?.supported || (key === 'seed' && draft.randomSeed)) return null
    const raw = draft[key].trim()
    if (!raw) {
      if (key === 'seed') throw new Error('请输入随机种子，或开启随机种子开关')
      return null
    }
    const value = Number(raw)
    if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) throw new Error(`${label}必须是${integer ? '整数' : '有限数值'}`)
    if (capability.rangeAdvisory) {
      if (integer && value <= 0) throw new Error(`${label}必须是正整数`)
      return value
    }
    if ((capability.minimum !== null && value < capability.minimum) || (capability.maximum !== null && value > capability.maximum)) {
      if (capability.minimum !== null && capability.minimum === capability.maximum) throw new Error(`${label}当前仅支持 ${capability.minimum}，请使用该值或留空使用预设`)
      throw new Error(`${label}须在 ${capability.minimum ?? '无下限'} ～ ${capability.maximum ?? '无上限'} 范围内`)
    }
    if (capability.allowedValues && !capability.allowedValues.includes(value)) throw new Error(`${label}不在允许选项内`)
    return value
  }
  const inferenceSteps = readOverride('inferenceSteps', '推理步数', true)
  const guidanceScale = readOverride('guidanceScale', '引导强度', false)
  const octreeResolution = readOverride('octreeResolution', '几何分辨率', true)
  if (capabilities.mode !== 'HUNYUAN_LOCAL' && (inferenceSteps ?? preset.inferenceSteps) * (octreeResolution ?? preset.octreeResolution) ** 3 > capabilities.maximumVoxelSteps) throw new Error('步数与几何分辨率的组合超出当前资源上限，请降低其中一项')
  return {
    sourceFileId, quality, generateTexture: capabilities.textureSupported && draft.generateTexture,
    advancedOptions: {
      removeBackground: getBackgroundSetting(capabilities, draft).value,
      seed: readOverride('seed', '随机种子', true), inferenceSteps, guidanceScale, octreeResolution,
    },
  }
}
export const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
