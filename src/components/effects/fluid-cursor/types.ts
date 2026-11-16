export type FluidCursorOptions = {
  enabled?: boolean
  backgroundColor?: string
  palette?: readonly string[]
  intensity?: number
}

export type FluidCursorBackgroundProps = FluidCursorOptions & { className?: string }
export type FluidSplat = {
  from: [number, number]
  to: [number, number]
  velocity: [number, number]
  speed: number
}

export const lightPalette = ['#a8c5f5', '#c4b1ed', '#efbbd4'] as const
export const loginPalette = ['#b8cae8', '#d1bce3', '#e5d5a1'] as const
