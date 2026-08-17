/** Turn a plot request into a resolved spec, SVG, and model-facing value. */

import { getFunction } from './catalog.ts'
import { compileExpr } from './expr.ts'
import { finite, formatNum, numericalDerivative } from './math.ts'
import { sampleFunction, unionWindows } from './sample.ts'
import { renderSvg, seriesColor } from './svg.ts'
import { isCatalogId } from './types.ts'
import type {
  ParamMap, PlotConfig, PlotDomain, PlotMeta, PlotRequest, PlotSpec, PlotValue,
  ResolvedSeries, SeriesInput,
} from './types.ts'

const MAX_SERIES = 6

function param(input: SeriesInput | undefined, key: string, fallback: number): number {
  const value = input?.params?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** If demand and supply are both present, mark their intersection. */
function markMarketClearing(series: ResolvedSeries[], inputs: SeriesInput[]): void {
  const demand = series.find(item => item.id === 'linear_demand')
  const supply = series.find(item => item.id === 'linear_supply')
  if (demand === undefined || supply === undefined) return
  const dIn = inputs.find(item => item.fn === 'linear_demand')
  const sIn = inputs.find(item => item.fn === 'linear_supply')
  const iD = param(dIn, 'intercept', 10)
  const slD = param(dIn, 'slope', -1)
  const iS = param(sIn, 'intercept', 0)
  const slS = param(sIn, 'slope', 1)
  if (slD === slS) return
  const q = (iD - iS) / (slS - slD)
  const p = iD + slD * q
  if (!Number.isFinite(q) || !Number.isFinite(p)) return
  demand.points.push({
    x: q,
    y: p,
    kind: 'mean',
    label: `eq (${formatNum(q)}, ${formatNum(p)})`,
  })
}

function slug(text: string): string {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return s.slice(0, 48) || 'plot'
}

function paramsOf(input: SeriesInput): ParamMap {
  const raw = input.params ?? {}
  const out: ParamMap = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

function resolveEvaluator(input: SeriesInput): {
  id: string
  label: string
  formula: string
  evaluate: (x: number) => number
  derivative?: (x: number) => number
  derivativeFormula?: string
  domain: { xMin: number; xMax: number }
  defined?: (x: number) => boolean
  discontinuities?: (window: { xMin: number; xMax: number }) => number[]
  annotate: () => { points: ResolvedSeries['points']; asymptotes: ResolvedSeries['asymptotes'] }
} {
  const hasFn = input.fn !== undefined && input.fn.trim() !== ''
  const hasExpr = input.expr !== undefined && input.expr.trim() !== ''
  if (hasFn === hasExpr) throw new Error('each series must set exactly one of fn or expr')

  if (hasFn) {
    const id = input.fn!.trim()
    if (!isCatalogId(id)) throw new Error(`unknown function "${id}"`)
    const def = getFunction(id)
    const p = paramsOf(input)
    return {
      id,
      label: input.label?.trim() || def.formula(p),
      formula: def.formula(p),
      evaluate: (x) => def.evaluate(x, p),
      ...def.derivative !== undefined ? { derivative: (x: number) => def.derivative!(x, p) } : {},
      ...def.derivativeFormula !== undefined ? { derivativeFormula: def.derivativeFormula(p) } : {},
      domain: def.domain(p),
      ...def.defined !== undefined ? { defined: (x: number) => def.defined!(x, p) } : {},
      ...def.discontinuities !== undefined ? { discontinuities: (w: { xMin: number; xMax: number }) => def.discontinuities!(w, p) } : {},
      annotate: () => def.annotate(p, def.domain(p)),
    }
  }

  const source = input.expr!.trim()
  const compiled = compileExpr(source)
  return {
    id: `expr:${source}`,
    label: input.label?.trim() || source,
    formula: source,
    evaluate: compiled,
    domain: { xMin: -5, xMax: 5 },
    annotate: () => ({ points: [], asymptotes: [] }),
  }
}

function yBounds(series: ResolvedSeries[]): { yMin: number; yMax: number } {
  const ys: number[] = []
  for (const item of series) {
    for (const segment of item.segments) {
      for (const point of segment.points) ys.push(point.y)
    }
    for (const point of item.points) if (finite(point.y)) ys.push(point.y)
  }
  if (ys.length === 0) return { yMin: -1, yMax: 1 }
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  if (yMin === yMax) {
    yMin -= 1
    yMax += 1
  }
  const pad = (yMax - yMin) * 0.08
  return { yMin: yMin - pad, yMax: yMax + pad }
}

/**
 * Resolve a request into a plot spec (for SVG / UI) and a model-facing value.
 * @param request - tool arguments.
 * @param config - plugin defaults.
 * @returns spec, svg, value, and the replay meta payload.
 */
export function buildPlot(request: PlotRequest, config: PlotConfig): {
  spec: PlotSpec
  svg: string
  value: Omit<PlotValue, 'path'>
  meta: Omit<PlotMeta, 'svg'> & { svg: string }
  suggestedName: string
} {
  if (!Array.isArray(request.series) || request.series.length === 0) {
    throw new Error('series must contain at least one function')
  }
  if (request.series.length > MAX_SERIES) throw new Error(`at most ${MAX_SERIES} series`)

  const samples = request.samples ?? config.samples
  if (!Number.isFinite(samples) || samples < 50 || samples > 2000) {
    throw new Error('samples must be between 50 and 2000')
  }

  const resolved = request.series.map(resolveEvaluator)
  const window = (request.xMin !== undefined && request.xMax !== undefined)
    ? { xMin: request.xMin, xMax: request.xMax }
    : unionWindows(resolved.map(item => item.domain))
  if (!(window.xMax > window.xMin)) throw new Error('xMax must be greater than xMin')

  const series: ResolvedSeries[] = []
  let colorIndex = 0
  for (const [index, item] of resolved.entries()) {
    const color = seriesColor(colorIndex++)
    const segments = sampleFunction({
      evaluate: item.evaluate,
      ...item.defined !== undefined ? { defined: item.defined } : {},
      ...item.discontinuities !== undefined ? { discontinuities: item.discontinuities } : {},
    }, window, samples)
    if (segments.length === 0) throw new Error(`no finite samples for ${item.label} on [${window.xMin}, ${window.xMax}]`)
    const marks = item.annotate()
    const wantDerivative = request.series[index]?.derivative === true
    series.push({
      id: item.id,
      label: item.label,
      formula: item.formula,
      color,
      dashed: false,
      segments,
      points: marks.points,
      asymptotes: marks.asymptotes,
      ...wantDerivative && item.derivativeFormula !== undefined ? { derivativeFormula: item.derivativeFormula } : {},
    })

    if (!wantDerivative) continue
    const deriv = item.derivative ?? ((x: number) => numericalDerivative(item.evaluate, x))
    const dSegments = sampleFunction({
      evaluate: deriv,
      ...item.defined !== undefined ? { defined: item.defined } : {},
      ...item.discontinuities !== undefined ? { discontinuities: item.discontinuities } : {},
    }, window, samples)
    if (dSegments.length === 0) continue
    series.push({
      id: `${item.id}'`,
      label: `${item.label} ′`,
      formula: item.derivativeFormula ?? `d/dx [${item.formula}]`,
      color: seriesColor(colorIndex++),
      dashed: true,
      segments: dSegments,
      points: [],
      asymptotes: [],
    })
  }

  markMarketClearing(series, request.series)

  const y = yBounds(series)
  const domain: PlotDomain = { ...window, ...y }
  const title = request.title?.trim() || series.filter(s => !s.dashed).map(s => s.label).join(', ')
  const spec: PlotSpec = {
    title,
    xLabel: request.xLabel?.trim() || 'x',
    yLabel: request.yLabel?.trim() || 'y',
    width: config.width,
    height: config.height,
    theme: config.theme,
    domain,
    series,
  }
  const svg = renderSvg(spec)
  const value = {
    title,
    domain,
    series: series.filter(item => !item.dashed).map(item => ({
      id: item.id,
      formula: item.formula,
      ...item.derivativeFormula !== undefined ? { derivativeFormula: item.derivativeFormula } : {},
      points: item.points.map(({ x, y: py, kind }) => ({ x, y: py, kind })),
      asymptotes: item.asymptotes,
    })),
  }
  return {
    spec,
    svg,
    value,
    meta: { title, svg, domain },
    suggestedName: `${slug(title)}.svg`,
  }
}

export function formatPlotText(value: PlotValue): string {
  const lines = [
    `title: ${value.title}`,
    `file: ${value.path}`,
    `window: x ∈ [${formatNum(value.domain.xMin)}, ${formatNum(value.domain.xMax)}], y ∈ [${formatNum(value.domain.yMin)}, ${formatNum(value.domain.yMax)}]`,
  ]
  for (const item of value.series) {
    lines.push(`series ${item.id}: ${item.formula}`)
    if (item.derivativeFormula !== undefined) lines.push(`  derivative: ${item.derivativeFormula}`)
    for (const point of item.points) {
      lines.push(`  ${point.kind}: (${formatNum(point.x)}, ${formatNum(point.y)})`)
    }
    for (const line of item.asymptotes) {
      lines.push(`  ${line.kind} asymptote ${line.kind === 'horizontal' ? 'y' : 'x'}=${formatNum(line.value)} (${line.label})`)
    }
  }
  return lines.join('\n')
}
