/** Sample a scalar function over a window, splitting at gaps and poles. */

import type { Window } from './catalog.ts'
import { finite } from './math.ts'
import type { SamplePoint, SampleSegment } from './types.ts'

export interface Sampler {
  evaluate: (x: number) => number
  defined?: (x: number) => boolean
  discontinuities?: (window: Window) => number[]
}

const JUMP_FACTOR = 12

/**
 * Sample `fn` on `[xMin, xMax]` with `count` points, breaking the polyline
 * at NaN/Inf, explicit poles, and sudden jumps.
 */
export function sampleFunction(fn: Sampler, window: Window, count: number): SampleSegment[] {
  const n = Math.max(8, count)
  const span = window.xMax - window.xMin
  if (!(span > 0) || !Number.isFinite(span)) throw new Error('xMax must be greater than xMin')
  const poles = new Set((fn.discontinuities?.(window) ?? []).filter(x => x > window.xMin && x < window.xMax))
  const xs: number[] = []
  for (let i = 0; i < n; i++) xs.push(window.xMin + (span * i) / (n - 1))
  for (const pole of poles) {
    const eps = span / (n * 4)
    xs.push(pole - eps, pole + eps)
  }
  xs.sort((a, b) => a - b)

  const segments: SampleSegment[] = []
  let current: SamplePoint[] = []
  let prev: SamplePoint | undefined
  const jump = JUMP_FACTOR * (span / n)

  const flush = (): void => {
    if (current.length >= 2) segments.push({ points: current })
    current = []
    prev = undefined
  }

  for (const x of xs) {
    if (fn.defined !== undefined && !fn.defined(x)) {
      flush()
      continue
    }
    const y = fn.evaluate(x)
    if (!finite(y)) {
      flush()
      continue
    }
    const point = { x, y }
    if (prev !== undefined && Math.abs(y - prev.y) > jump + Math.abs(prev.y) * 8) {
      flush()
    }
    current.push(point)
    prev = point
  }
  flush()
  return segments
}

/** Union of recommended windows, falling back to [-5, 5]. */
export function unionWindows(windows: Window[]): Window {
  if (windows.length === 0) return { xMin: -5, xMax: 5 }
  return {
    xMin: Math.min(...windows.map(w => w.xMin)),
    xMax: Math.max(...windows.map(w => w.xMax)),
  }
}
