export type ParticleSeed = readonly [number, number, number, number]
export type ParticlePosition = [number, number, number]

export type CameraPose = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  fov: number
}
export type CameraShot = { start: CameraPose; end: CameraPose }

export type ParticleFormDefinition = {
  id: string
  label: string
  holdSeconds: number
  entryPoint: string
  shader: string
  camera: CameraShot
  presentation?: { scale: number; offset: readonly [number, number]; brightness: number }
}

export type InitialParticleFormDefinition = ParticleFormDefinition & {
  sampleInitialPosition: (seed: ParticleSeed) => ParticlePosition
}
