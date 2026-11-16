import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import type { getMorphFrame } from './particle-morph'
import { particleForms } from './particle-forms'

const ease = (value: number) => {
  const progress = Math.max(0, Math.min(value, 1))
  return progress ** 3 * (progress * (progress * 6 - 15) + 10)
}

export const createParticleCameraTrack = () => {
  const position = new Vector3()
  const target = new Vector3()
  const endPosition = new Vector3()
  const endTarget = new Vector3()
  const anchor = new Vector3()

  return {
    update: (
      camera: PerspectiveCamera,
      frame: ReturnType<typeof getMorphFrame>,
      layout: { horizontal: number; vertical: number },
      viewportHeight: number,
      width: number,
      height: number,
    ) => {
      const shot = particleForms[frame.from].camera
      const transitioning = frame.progress > 0
      const from = transitioning ? shot.end : shot.start
      const to = transitioning ? particleForms[frame.to].camera.start : shot.end
      const progress = ease(transitioning ? frame.progress : frame.holdProgress)
      position.fromArray(from.position).lerp(endPosition.fromArray(to.position), progress)
      target.fromArray(from.target).lerp(endTarget.fromArray(to.target), progress)
      if (transitioning) {
        // 形态切换时走小幅上拱弧线，避免直线推进穿过粒子主体。
        position.y += Math.sin(progress * Math.PI) * 0.5
        position.z += Math.sin(progress * Math.PI) * 0.3
      }
      camera.position.copy(position)
      camera.fov = from.fov + (to.fov - from.fov) * progress
      camera.lookAt(target)
      camera.clearViewOffset()
      camera.updateMatrixWorld()
      anchor.set(layout.horizontal, layout.vertical, 0).project(camera)
      // 镜头换角度时，主体中心仍落在原构图位置，表单附近不产生横向漂移。
      const anchorX = layout.horizontal * 2 / (viewportHeight * width / height)
      const anchorY = layout.vertical * 2 / viewportHeight
      camera.setViewOffset(width, height, (anchor.x - anchorX) * width / 2, (anchorY - anchor.y) * height / 2, width, height)
    },
  }
}
