import {
  Color, HalfFloatType, Mesh, NearestFilter, NoBlending, NoColorSpace,
  NormalBlending, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene,
  ShaderMaterial, Vector2, WebGLRenderTarget,
} from 'three'
import type { WebGLRenderer } from 'three'
import type { FluidCursorOptions, FluidSplat } from './types'
import { lightPalette } from './types'
import {
  advectionShader, curlShader, divergenceShader, fullscreenVertex,
  pressureShader, projectionShader, splatShader, vorticityShader,
} from './shaders/simulation'
import { displayShader } from './shaders/display'

const gridSize = (width: number, height: number, longest: number): [number, number] => {
  const scale = longest / Math.max(width, height)
  return [Math.max(16, Math.round(width * scale)), Math.max(16, Math.round(height * scale))]
}

const createTarget = (width: number, height: number) => new WebGLRenderTarget(width, height, {
  type: HalfFloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter,
  depthBuffer: false, stencilBuffer: false, generateMipmaps: false, colorSpace: NoColorSpace,
})

const createPair = (width: number, height: number) => {
  const pair = { read: createTarget(width, height), write: createTarget(width, height) }
  return {
    get read() { return pair.read },
    get write() { return pair.write },
    swap: () => { [pair.read, pair.write] = [pair.write, pair.read] },
    dispose: () => { pair.read.dispose(); pair.write.dispose() },
  }
}

type FluidEngineOptions = Omit<FluidCursorOptions, 'enabled'> & { width: number; height: number }

// 原创的二维不可压缩流体求解；数值纹理不参与显示色彩转换。
export const createFluidEngine = (renderer: WebGLRenderer, options: FluidEngineOptions) => {
  const context = renderer.getContext()
  if (!context.getExtension('EXT_color_buffer_float') && !context.getExtension('EXT_color_buffer_half_float')) return null
  const probe = createTarget(4, 4)
  const previousTarget = renderer.getRenderTarget()
  renderer.setRenderTarget(probe)
  const supported = context.checkFramebufferStatus(context.FRAMEBUFFER) === context.FRAMEBUFFER_COMPLETE
  renderer.setRenderTarget(previousTarget)
  probe.dispose()
  if (!supported) return null

  const { width, height, backgroundColor, intensity = 1 } = options
  const palette = (options.palette?.length ? options.palette : lightPalette).map((color) => new Color(color))
  const [gridWidth, gridHeight] = gridSize(width, height, 192)
  const [dyeWidth, dyeHeight] = gridSize(width, height, 768)
  const velocity = createPair(gridWidth, gridHeight)
  const pressure = createPair(gridWidth, gridHeight)
  const dye = createPair(dyeWidth, dyeHeight)
  const curl = createTarget(gridWidth, gridHeight)
  const divergence = createTarget(gridWidth, gridHeight)
  const gridTexel = new Vector2(1 / gridWidth, 1 / gridHeight)
  const dyeTexel = new Vector2(1 / dyeWidth, 1 / dyeHeight)
  const aspect = new Vector2(width / Math.min(width, height), height / Math.min(width, height))
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geometry = new PlaneGeometry(2, 2)
  const materials: ShaderMaterial[] = []
  const material = (fragmentShader: string, uniforms: ShaderMaterial['uniforms']) => {
    const result = new ShaderMaterial({
      vertexShader: fullscreenVertex, fragmentShader, uniforms: { uTexel: { value: gridTexel }, ...uniforms },
      depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: false,
    })
    materials.push(result)
    return result
  }
  const advection = material(advectionShader, {
    uVelocity: { value: velocity.read.texture }, uSource: { value: velocity.read.texture },
    uSourceTexel: { value: gridTexel }, uDt: { value: 0 }, uDecay: { value: 1.5 },
  })
  const splat = material(splatShader, {
    uSource: { value: velocity.read.texture }, uFrom: { value: new Vector2() }, uTo: { value: new Vector2() },
    uVelocity: { value: new Vector2() }, uAspect: { value: aspect }, uColor: { value: new Color() },
    uRadius: { value: 0.025 }, uAmount: { value: 0.4 }, uMode: { value: 0 },
  })
  const curlPass = material(curlShader, { uVelocity: { value: velocity.read.texture } })
  const vorticity = material(vorticityShader, {
    uVelocity: { value: velocity.read.texture }, uCurl: { value: curl.texture }, uDt: { value: 0 },
  })
  const divergencePass = material(divergenceShader, { uVelocity: { value: velocity.read.texture } })
  const pressurePass = material(pressureShader, {
    uPressure: { value: pressure.read.texture }, uDivergence: { value: divergence.texture },
  })
  const projection = material(projectionShader, {
    uVelocity: { value: velocity.read.texture }, uPressure: { value: pressure.read.texture },
  })
  const display = material(displayShader, {
    uDye: { value: dye.read.texture }, uTexel: { value: dyeTexel },
    uPixel: { value: new Vector2(1 / width, 1 / height) },
    uBackground: { value: new Color(backgroundColor || '#f1f2fa') }, uOpaque: { value: backgroundColor ? 1 : 0 },
  })
  display.transparent = true
  display.blending = NormalBlending
  const quad = new Mesh(geometry, advection)
  quad.frustumCulled = false
  scene.add(quad)
  const pending: FluidSplat[] = []
  let lifetime = 0
  let distance = 0

  const run = (pass: ShaderMaterial, target: WebGLRenderTarget | null) => {
    quad.material = pass
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
  }

  const clear = (targets: WebGLRenderTarget[]) => {
    const color = renderer.getClearColor(new Color())
    const alpha = renderer.getClearAlpha()
    const target = renderer.getRenderTarget()
    renderer.setClearColor(0, 0)
    targets.forEach((buffer) => { renderer.setRenderTarget(buffer); renderer.clear(true, false, false) })
    renderer.setClearColor(color, alpha)
    renderer.setRenderTarget(target)
  }
  const buffers = [velocity.read, velocity.write, pressure.read, pressure.write, dye.read, dye.write, curl, divergence]
  clear(buffers)

  const inject = (input: FluidSplat) => {
    const travel = Math.hypot((input.to[0] - input.from[0]) * aspect.x, (input.to[1] - input.from[1]) * aspect.y)
    distance += travel
    const radius = 0.02 + Math.min(input.speed, 2) * 0.006
    splat.uniforms.uFrom.value.set(...input.from)
    splat.uniforms.uTo.value.set(...input.to)
    splat.uniforms.uVelocity.value.set(input.velocity[0] * 0.14, input.velocity[1] * 0.14)
    splat.uniforms.uRadius.value = radius
    const colorPosition = distance * 1.7
    const colorIndex = Math.floor(colorPosition) % palette.length
    splat.uniforms.uColor.value.copy(palette[colorIndex]).lerp(palette[(colorIndex + 1) % palette.length], colorPosition % 1)
    splat.uniforms.uAmount.value = Math.min(travel / (radius * 0.8), 1.5) * 0.46 * Math.max(0, Math.min(intensity, 2))
    splat.uniforms.uMode.value = 0
    splat.uniforms.uSource.value = velocity.read.texture
    run(splat, velocity.write)
    velocity.swap()
    splat.uniforms.uMode.value = 1
    splat.uniforms.uSource.value = dye.read.texture
    run(splat, dye.write)
    dye.swap()
  }

  const step = (delta: number) => {
    if (lifetime <= 0 && !pending.length) return
    const dt = Math.min(Math.max(delta, 0), 1 / 30)
    const target = renderer.getRenderTarget()
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    try {
      advection.uniforms.uDt.value = dt
      advection.uniforms.uDecay.value = 1.8
      advection.uniforms.uVelocity.value = velocity.read.texture
      advection.uniforms.uSource.value = velocity.read.texture
      advection.uniforms.uSourceTexel.value = gridTexel
      run(advection, velocity.write)
      velocity.swap()
      pending.splice(0).forEach(inject)
      curlPass.uniforms.uVelocity.value = velocity.read.texture
      run(curlPass, curl)
      vorticity.uniforms.uVelocity.value = velocity.read.texture
      vorticity.uniforms.uDt.value = dt
      run(vorticity, velocity.write)
      velocity.swap()
      divergencePass.uniforms.uVelocity.value = velocity.read.texture
      run(divergencePass, divergence)
      clear([pressure.read, pressure.write])
      // Jacobi 压力求解按次序交换缓冲，后一次迭代依赖前一次结果。
      for (let iteration = 0; iteration < 14; iteration += 1) {
        pressurePass.uniforms.uPressure.value = pressure.read.texture
        run(pressurePass, pressure.write)
        pressure.swap()
      }
      projection.uniforms.uPressure.value = pressure.read.texture
      projection.uniforms.uVelocity.value = velocity.read.texture
      run(projection, velocity.write)
      velocity.swap()
      advection.uniforms.uDecay.value = 1.65
      advection.uniforms.uSourceTexel.value = dyeTexel
      advection.uniforms.uVelocity.value = velocity.read.texture
      advection.uniforms.uSource.value = dye.read.texture
      run(advection, dye.write)
      dye.swap()
      lifetime -= dt
      if (lifetime <= 0) clear(buffers)
      display.uniforms.uDye.value = dye.read.texture
    } finally {
      renderer.setRenderTarget(target)
      renderer.autoClear = autoClear
    }
  }

  return {
    step,
    addSplat: (input: FluidSplat) => {
      if (pending.length >= 12) pending.shift()
      pending.push(input)
      lifetime = 4
    },
    render: () => {
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      try { run(display, null) } finally { renderer.autoClear = autoClear }
    },
    reset: () => { pending.length = 0; lifetime = 0; clear(buffers) },
    dispose: () => {
      pending.length = 0
      velocity.dispose(); pressure.dispose(); dye.dispose(); curl.dispose(); divergence.dispose()
      materials.forEach((pass) => pass.dispose())
      geometry.dispose()
      scene.clear()
    },
  }
}

export type FluidEngine = NonNullable<ReturnType<typeof createFluidEngine>>
