import { particleForms } from '../particle-forms'
import { particleFormCommonShader } from './particle-form-common'

const dispatch = particleForms.map((form, index) => {
  const call = `${form.entryPoint}(seed, time, age)`
  if (index === particleForms.length - 1) return `return ${call};`
  return `if (kind < ${index + 0.5}) return ${call};`
}).join('\n')

export const particleFormsShader = [
  particleFormCommonShader,
  ...particleForms.map((form) => form.shader),
  `ParticleForm getForm(float kind, vec4 seed, float time, float age) {
    ${dispatch}
  }`,
].join('\n')
