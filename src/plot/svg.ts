/** Publication-style SVG renderer for a resolved plot spec. */

import { formatNum } from './math.ts'
import type { PlotSpec, SamplePoint } from './types.ts'

interface Theme {
  bg: string
  grid: string
  axis: string
  tick: string
  text: string
  muted: string
}

const THEMES: Record<'light' | 'dark', Theme> = {
  light: {
    bg: '#fbfaf7',
    grid: '#e6e1d6',
    axis: '#2a2a28',
    tick: '#6b6560',
    text: '#1f1d1a',
    muted: '#8a847c',
  },
  dark: {
    bg: '#161513',
    grid: '#2e2c28',
    axis: '#ece8df',
    tick: '#a39e94',
    text: '#f4f0e8',
    muted: '#8d877c',
  },
}

const PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf']

export function seriesColor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

function niceStep(span: number, target = 6): number {
  const raw = span / target
  const exp = Math.floor(Math.log10(raw))
  const base = 10 ** exp
  const err = raw / base
  const mult = err >= 5 ? 10 : err >= 2 ? 5 : err >= 1 ? 2 : 1
  return mult * base
}

function ticks(min: number, max: number): number[] {
  const step = niceStep(max - min)
  const start = Math.ceil((min + step * 0.05) / step) * step
  const out: number[] = []
  for (let v = start; v < max - step * 0.05; v += step) {
    const n = Number(v.toPrecision(10))
    if (n > min && n < max) out.push(n)
  }
  return out
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Render a resolved plot as an SVG document.
 * @param spec - sampled series, annotations, and canvas settings.
 * @returns a standalone SVG string.
 */
export function renderSvg(spec: PlotSpec): string {
  const theme = THEMES[spec.theme]
  const { width, height, domain } = spec
  const pad = { l: 64, r: 28, t: spec.title ? 44 : 24, b: 48 }
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const xSpan = domain.xMax - domain.xMin
  const ySpan = domain.yMax - domain.yMin
  const sx = (x: number): number => pad.l + ((x - domain.xMin) / xSpan) * iw
  const sy = (y: number): number => pad.t + ((domain.yMax - y) / ySpan) * ih

  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`)
  parts.push(`<rect width="100%" height="100%" fill="${theme.bg}"/>`)
  if (spec.title) {
    parts.push(`<text x="${width / 2}" y="28" text-anchor="middle" font-family="ui-serif, Georgia, serif" font-size="18" fill="${theme.text}">${escapeXml(spec.title)}</text>`)
  }

  for (const x of ticks(domain.xMin, domain.xMax)) {
    parts.push(`<line x1="${sx(x)}" y1="${pad.t}" x2="${sx(x)}" y2="${pad.t + ih}" stroke="${theme.grid}" stroke-width="1"/>`)
    parts.push(`<text x="${sx(x)}" y="${pad.t + ih + 16}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${theme.tick}">${formatNum(x)}</text>`)
  }
  for (const y of ticks(domain.yMin, domain.yMax)) {
    parts.push(`<line x1="${pad.l}" y1="${sy(y)}" x2="${pad.l + iw}" y2="${sy(y)}" stroke="${theme.grid}" stroke-width="1"/>`)
    parts.push(`<text x="${pad.l - 8}" y="${sy(y) + 4}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${theme.tick}">${formatNum(y)}</text>`)
  }

  const x0 = domain.xMin <= 0 && domain.xMax >= 0 ? sx(0) : pad.l
  const y0 = domain.yMin <= 0 && domain.yMax >= 0 ? sy(0) : pad.t + ih
  parts.push(`<line x1="${pad.l}" y1="${y0}" x2="${pad.l + iw}" y2="${y0}" stroke="${theme.axis}" stroke-width="1.4"/>`)
  parts.push(`<line x1="${x0}" y1="${pad.t}" x2="${x0}" y2="${pad.t + ih}" stroke="${theme.axis}" stroke-width="1.4"/>`)
  parts.push(`<polygon points="${pad.l + iw},${y0} ${pad.l + iw - 7},${y0 - 4} ${pad.l + iw - 7},${y0 + 4}" fill="${theme.axis}"/>`)
  parts.push(`<polygon points="${x0},${pad.t} ${x0 - 4},${pad.t + 7} ${x0 + 4},${pad.t + 7}" fill="${theme.axis}"/>`)
  parts.push(`<text x="${pad.l + iw}" y="${y0 + 18}" text-anchor="end" font-family="ui-serif, Georgia, serif" font-size="13" fill="${theme.text}">${escapeXml(spec.xLabel)}</text>`)
  parts.push(`<text x="${x0 + 10}" y="${pad.t + 14}" font-family="ui-serif, Georgia, serif" font-size="13" fill="${theme.text}">${escapeXml(spec.yLabel)}</text>`)

  for (const series of spec.series) {
    for (const line of series.asymptotes) {
      if (line.kind === 'horizontal' && line.value >= domain.yMin && line.value <= domain.yMax) {
        parts.push(`<line x1="${pad.l}" y1="${sy(line.value)}" x2="${pad.l + iw}" y2="${sy(line.value)}" stroke="${series.color}" stroke-width="1" stroke-dasharray="3 5" opacity="0.55"/>`)
      }
      if (line.kind === 'vertical' && line.value >= domain.xMin && line.value <= domain.xMax) {
        parts.push(`<line x1="${sx(line.value)}" y1="${pad.t}" x2="${sx(line.value)}" y2="${pad.t + ih}" stroke="${series.color}" stroke-width="1" stroke-dasharray="3 5" opacity="0.55"/>`)
      }
    }
    for (const segment of series.segments) {
      const d = polyline(segment.points, sx, sy)
      if (d === '') continue
      parts.push(`<path d="${d}" fill="none" stroke="${series.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"${series.dashed ? ' stroke-dasharray="7 5"' : ''}/>`)
    }
  }

  const used = new Set<string>()
  for (const series of spec.series) {
    for (const point of series.points) {
      if (point.x < domain.xMin || point.x > domain.xMax || point.y < domain.yMin || point.y > domain.yMax) continue
      const cx = sx(point.x)
      const cy = sy(point.y)
      parts.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="${theme.bg}" stroke="${series.color}" stroke-width="1.8"/>`)
      const key = `${point.label}@${Math.round(cx)}`
      if (used.has(key)) continue
      used.add(key)
      const nearTop = cy - pad.t < 36
      const nearRight = (pad.l + iw) - cx < 80
      const labelX = nearRight ? cx - 8 : cx + 8
      const anchor = nearRight ? 'end' : 'start'
      const labelY = nearTop ? cy + 16 : cy - 8
      parts.push(`<text x="${labelX}" y="${labelY}" text-anchor="${anchor}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${theme.text}">${escapeXml(point.label)}</text>`)
    }
  }

  const legendX = pad.l + iw - 8
  let legendY = pad.t + 16
  for (const series of spec.series) {
    parts.push(`<line x1="${legendX - 18}" y1="${legendY}" x2="${legendX}" y2="${legendY}" stroke="${series.color}" stroke-width="2.2"${series.dashed ? ' stroke-dasharray="7 5"' : ''}/>`)
    parts.push(`<text x="${legendX - 24}" y="${legendY + 4}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="${theme.text}">${escapeXml(series.label)}</text>`)
    legendY += 18
  }

  parts.push('</svg>')
  return parts.join('')
}

function polyline(points: SamplePoint[], sx: (x: number) => number, sy: (y: number) => number): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`)
    .join(' ')
}
