import type { Capabilities, CreateTaskRequest, GenerationDraft } from '../types'

export const initialDraft: GenerationDraft = {
  quality: 'STANDARD', generateTexture: false, removeBackground: true, randomSeed: true,
  seed: '', inferenceSteps: '', guidanceScale: '', octreeResolution: '',
}
const imageFormats: Record<string, { mime: string; extensions: string[] }> = {
  JPEG: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] }, PNG: { mime: 'image/png', extensions: ['.png'] },
}
export const adaptCapabilities = (capabilities: Capabilities) => ({
  ...capabilities,
  qualities: (['STANDARD', 'HIGH'] as const).filter((quality) => capabilities.qualityPresets[quality]),
  accept: Object.fromEntries(capabilities.uploadConstraints.formats.filter((format) => imageFormats[format]).map((format) => [imageFormats[format].mime, imageFormats[format].extensions])),
  canGenerate: capabilities.mode === 'MOCK' && capabilities.generationAvailable && capabilities.supportedInputModes.includes('SINGLE_IMAGE'),
})
export type GenerationCapabilities = ReturnType<typeof adaptCapabilities>
export const getDraftPreview = (capabilities: GenerationCapabilities, draft: GenerationDraft) => {
  const quality = capabilities.qualities.includes(draft.quality) ? draft.quality : capabilities.qualities[0]
  const preset = capabilities.qualityPresets[quality]
  return { quality, preset }
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
    if ((capability.minimum !== null && value < capability.minimum) || (capability.maximum !== null && value > capability.maximum)) throw new Error(`${label}超出允许范围`)
    if (capability.allowedValues && !capability.allowedValues.includes(value)) throw new Error(`${label}不在允许选项内`)
    return value
  }
  const inferenceSteps = readOverride('inferenceSteps', '推理步数', true)
  const guidanceScale = readOverride('guidanceScale', '引导强度', false)
  const octreeResolution = readOverride('octreeResolution', '几何分辨率', true)
  if ((inferenceSteps ?? preset.inferenceSteps) * (octreeResolution ?? preset.octreeResolution) ** 3 > capabilities.maximumVoxelSteps) throw new Error('步数与几何分辨率的组合超出当前资源上限，请降低其中一项')
  return {
    sourceFileId, quality, generateTexture: capabilities.textureSupported && draft.generateTexture,
    advancedOptions: {
      removeBackground: capabilities.removeBackgroundSupported && capabilities.advancedParameters.removeBackground?.supported ? draft.removeBackground : false,
      seed: readOverride('seed', '随机种子', true), inferenceSteps, guidanceScale, octreeResolution,
    },
  }
}
export const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
