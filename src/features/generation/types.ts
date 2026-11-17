import { z } from 'zod'

export const generationModeSchema = z.enum(['DISABLED', 'MOCK', 'HUNYUAN_LOCAL'])
export type GenerationMode = z.infer<typeof generationModeSchema>

export const qualitySchema = z.enum(['STANDARD', 'HIGH'])
export type Quality = z.infer<typeof qualitySchema>
const nullableNumber = z.number().finite().nullable()
const parameterCapabilitySchema = z.object({
  supported: z.boolean(), defaultValue: z.union([z.number(), z.boolean()]).nullable(),
  minimum: nullableNumber, maximum: nullableNumber, allowedValues: z.array(z.number()).nullable(),
})
const presetSchema = z.object({ simulated: z.boolean(), inferenceSteps: z.number(), guidanceScale: z.number(), octreeResolution: z.number() })
export const capabilitiesSchema = z.object({
  mode: generationModeSchema, generationAvailable: z.boolean(), simulated: z.boolean(),
  modelId: z.string().nullable(), profileId: z.string(), simulationNotice: z.string().nullable(),
  supportedInputModes: z.array(z.string()), qualityPresets: z.partialRecord(qualitySchema, presetSchema),
  textureSupported: z.boolean(), removeBackgroundSupported: z.boolean(),
  advancedParameters: z.record(z.string(), parameterCapabilitySchema), maximumVoxelSteps: z.number().positive(),
  uploadConstraints: z.object({ formats: z.array(z.string()), maximumBytes: z.number().positive(), maximumPixels: z.number().positive() }),
})
export type Capabilities = z.infer<typeof capabilitiesSchema>
export type ParameterCapability = z.infer<typeof parameterCapabilitySchema>
export const advancedOptionsSchema = z.object({
  removeBackground: z.boolean(), seed: nullableNumber, inferenceSteps: nullableNumber,
  guidanceScale: nullableNumber, octreeResolution: nullableNumber,
})
export const createTaskSchema = z.object({
  sourceFileId: z.string().min(1), quality: qualitySchema, generateTexture: z.boolean(),
  advancedOptions: advancedOptionsSchema,
})
export type CreateTaskRequest = z.infer<typeof createTaskSchema>
const resolvedParametersSchema = z.object({
  schemaVersion: z.number(), profileId: z.string(), quality: qualitySchema, generateTexture: z.boolean(),
  removeBackground: z.boolean(), seed: z.number(), inferenceSteps: z.number(), guidanceScale: z.number(),
  octreeResolution: z.number(), numChunks: z.number(), format: z.string(),
})
export const taskStatusSchema = z.enum(['PENDING', 'SUBMITTING', 'PROCESSING', 'SUCCEEDED', 'FAILED'])
export type TaskStatus = z.infer<typeof taskStatusSchema>
export const taskSchema = z.object({
  id: z.string(), sourceFileId: z.string(), status: taskStatusSchema, progress: nullableNumber,
  simulated: z.boolean(), requestedParameters: createTaskSchema.nullable(), resolvedParameters: resolvedParametersSchema.nullable(),
  assetId: z.string().nullable(), errorCode: z.string().nullable(), errorMessage: z.string().nullable(),
  createdAt: z.string(), startedAt: z.string().nullable(), finishedAt: z.string().nullable(),
})
export type GenerationTask = z.infer<typeof taskSchema>
export const taskPageSchema = z.object({ records: z.array(taskSchema), total: z.number(), page: z.number(), size: z.number() })
export const fileSchema = z.object({ id: z.string(), originalName: z.string(), contentType: z.string(), sizeBytes: z.number(), previewUrl: z.string().nullable() })
export type UploadedFile = z.infer<typeof fileSchema>
export const assetSchema = z.object({
  id: z.string(), generationTaskId: z.string(), name: z.string(), format: z.string(), sizeBytes: z.number(),
  simulated: z.boolean(), modelUrl: z.string(), thumbnailUrl: z.string().nullable(), createdAt: z.string(),
})
export type ModelAsset = z.infer<typeof assetSchema>
export type GenerationDraft = {
  quality: Quality; generateTexture: boolean; removeBackground: boolean | null; randomSeed: boolean
  seed: string; inferenceSteps: string; guidanceScale: string; octreeResolution: string
}
export type PendingSubmission = { key: string; request: CreateTaskRequest }
