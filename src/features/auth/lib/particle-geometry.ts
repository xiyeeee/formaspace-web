// 扭转环带的曲面采样由 WebGL 与静态降级共用。
export const sampleRibbon = (segments = 300, rows = 60) => {
  const count = segments * rows
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  Array.from({ length: count }).forEach((_, index) => {
    const angle = Math.floor(index / rows) / segments * Math.PI * 2
    const width = (index % rows) / (rows - 1) * 2 - 1
    const twist = angle * 1.5 + 0.3
    const radius = 2.65 + width * 1.35 * Math.cos(twist)
    const offset = index * 3
    positions[offset] = radius * Math.cos(angle)
    positions[offset + 1] = radius * Math.sin(angle) * 0.8
    positions[offset + 2] = width * 1.65 * Math.sin(twist) + 0.48 * Math.sin(angle * 2)
    const edge = Math.abs(width) > 0.94 && Math.sin(angle * 2 + 0.5) > 0.05
    const variation = 0.67 + (Math.sin(index * 127.1) * 43758.5453 % 1 + 1) * 0.16
    colors.set(edge ? [0.79, 0.96, 0.19] : [variation, variation * 0.94, variation * 0.82], offset)
    sizes[index] = 0.7 + Math.abs(Math.sin(index * 13.37)) * 0.65
  })
  return { positions, colors, sizes }
}

export const projectRibbon = (positions: Float32Array) => {
  const paths = ['', '', '']
  Array.from({ length: positions.length / 3 }).forEach((_, index) => {
    const offset = index * 3
    const x = positions[offset]
    const y = positions[offset + 1] * Math.cos(0.65) - positions[offset + 2] * Math.sin(0.65)
    const z = positions[offset + 1] * Math.sin(0.65) + positions[offset + 2] * Math.cos(0.65)
    const rotatedX = x * Math.cos(-0.35) + z * Math.sin(-0.35)
    const screenX = rotatedX * Math.cos(-0.45) - y * Math.sin(-0.45)
    const screenY = rotatedX * Math.sin(-0.45) + y * Math.cos(-0.45)
    const horizontal = (720 + screenX * 168).toFixed(1)
    const vertical = (450 - screenY * 168).toFixed(1)
    const group = index % 24 === 0 ? 2 : z > 0 ? 1 : 0
    paths[group] += `M${horizontal},${vertical}h1v1h-1z`
  })
  return paths
}
