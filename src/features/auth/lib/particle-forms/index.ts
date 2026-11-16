import { tornadoForm } from './tornado'
import { jellyfishForm } from './jellyfish'
import { riverForm } from './river'
import { astronautForm } from './astronaut'
import type { ParticleFormDefinition } from './types'

export const initialParticleForm = tornadoForm

// 注册顺序同时决定时间线、Shader 分发索引和镜头顺序。
export const particleForms = [
  initialParticleForm,
  jellyfishForm,
  riverForm,
  astronautForm,
] as const satisfies readonly ParticleFormDefinition[]

export type ParticleFormId = typeof particleForms[number]['id']
