type Node = { index: number; axis: number; parent: Node | null; left: Node | null; right: Node | null; remaining: number; used: boolean }
export const POINT_CLOUD_MOVE_SECONDS = 0.75
export type CloudTransition = { from: Float32Array; target: Float32Array; retainedCount: number }

// Greedy one-to-one nearest targets. Build/query once per complete version, never per frame.
export const matchPointCloud = (source: Float32Array, target: Float32Array): CloudTransition => {
  const targetCount = target.length / 3
  const retainedCount = Math.min(source.length / 3, targetCount)
  const build = (indices: number[], depth: number, parent: Node | null): Node | null => {
    if (!indices.length) return null
    const axis = depth % 3
    indices.sort((first, second) => target[first * 3 + axis] - target[second * 3 + axis] || first - second)
    const middle = Math.floor(indices.length / 2)
    const node: Node = { index: indices[middle], axis, parent, left: null, right: null, remaining: indices.length, used: false }
    node.left = build(indices.slice(0, middle), depth + 1, node)
    node.right = build(indices.slice(middle + 1), depth + 1, node)
    return node
  }
  const tree = build(Array.from({ length: targetCount }, (_, index) => index), 0, null)
  const used = new Uint8Array(targetCount)
  const from = new Float32Array(target.length)
  const ordered = new Float32Array(target.length)
  for (let sourceIndex = 0; sourceIndex < retainedCount; sourceIndex++) {
    let nearest: Node | null = null
    let distance = Infinity
    const search = (node: Node | null) => {
      if (!node?.remaining || distance === 0) return
      const offset = node.index * 3
      if (!node.used) {
        const squared = [0, 1, 2].reduce((sum, axis) => sum + (source[sourceIndex * 3 + axis] - target[offset + axis]) ** 2, 0)
        if (squared < distance) { distance = squared; nearest = node }
      }
      const difference = source[sourceIndex * 3 + node.axis] - target[offset + node.axis]
      search(difference <= 0 ? node.left : node.right)
      if (difference * difference <= distance) search(difference <= 0 ? node.right : node.left)
    }
    search(tree)
    // The tree has at least retainedCount available targets, including duplicate coordinates.
    const selected = nearest as Node | null
    if (!selected) throw new Error('点云目标匹配失败')
    selected.used = true
    used[selected.index] = 1
    let ancestor: Node | null = selected
    while (ancestor) { ancestor.remaining--; ancestor = ancestor.parent }
    from.set(source.subarray(sourceIndex * 3, sourceIndex * 3 + 3), sourceIndex * 3)
    ordered.set(target.subarray(selected.index * 3, selected.index * 3 + 3), sourceIndex * 3)
  }
  let cursor = retainedCount
  used.forEach((matched, index) => {
    if (matched) return
    ordered.set(target.subarray(index * 3, index * 3 + 3), cursor * 3)
    cursor++
  })
  from.set(ordered.subarray(retainedCount * 3), retainedCount * 3)
  return { from, target: ordered, retainedCount }
}
