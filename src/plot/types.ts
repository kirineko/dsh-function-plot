/** Shared plot-engine types. Cordis-free so Host and tests import the same module. */

export const CATALOG_IDS = [
  'sigmoid', 'tanh', 'relu', 'leaky_relu', 'elu',
  'softplus', 'gelu', 'silu', 'mish', 'softmax_pair',
  'mse', 'mae', 'huber', 'bce',
  'normal_pdf', 'normal_cdf',
  'uniform_pdf', 'uniform_cdf',
  'exponential_pdf', 'exponential_cdf',
  'lognormal_pdf', 'beta_pdf',
  'exp', 'log', 'pow', 'sqrt', 'abs', 'step',
  'sin', 'cos', 'tan',
  'quadratic', 'logistic',
  'linear_demand', 'linear_supply', 'isoelastic',
  'cobb_douglas_slice', 'crra_utility',
  'quadratic_cost', 'exponential_discount',
] as const

export type CatalogId = (typeof CATALOG_IDS)[number]

export function isCatalogId(value: string): value is CatalogId {
  return (CATALOG_IDS as readonly string[]).includes(value)
}

export type ParamMap = Record<string, number>

export interface SeriesInput {
  fn?: string
  expr?: string
  params?: ParamMap
  derivative?: boolean
  label?: string
}

export interface PlotRequest {
  series: SeriesInput[]
  xMin?: number
  xMax?: number
  samples?: number
  title?: string
  xLabel?: string
  yLabel?: string
  path?: string
}

export interface PlotConfig {
  width: number
  height: number
  samples: number
  outputDir: string
  theme: 'light' | 'dark'
}

export type PointKind = 'intercept' | 'extremum' | 'inflection' | 'kink' | 'mean'

export interface PlotPoint {
  x: number
  y: number
  kind: PointKind
  label: string
}

export interface Asymptote {
  kind: 'horizontal' | 'vertical'
  value: number
  label: string
}

export interface SamplePoint {
  x: number
  y: number
}

export interface SampleSegment {
  points: SamplePoint[]
}

export interface ResolvedSeries {
  id: string
  label: string
  formula: string
  derivativeFormula?: string
  color: string
  dashed: boolean
  segments: SampleSegment[]
  points: PlotPoint[]
  asymptotes: Asymptote[]
}

export interface PlotDomain {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface PlotSpec {
  title: string
  subtitle?: string
  xLabel: string
  yLabel: string
  width: number
  height: number
  theme: 'light' | 'dark'
  domain: PlotDomain
  series: ResolvedSeries[]
}

export interface PlotSeriesValue {
  id: string
  formula: string
  derivativeFormula?: string
  points: Array<{ x: number; y: number; kind: PointKind }>
  asymptotes: Asymptote[]
}

export interface PlotValue {
  title: string
  path: string
  domain: PlotDomain
  series: PlotSeriesValue[]
}

export interface PlotSeriesInfo {
  id: string
  label: string
  formula: string
  color: string
  dashed: boolean
  derivativeFormula?: string
  points: Array<{ x: number; y: number; kind: PointKind; label: string }>
  asymptotes: Asymptote[]
}

export interface PlotMeta {
  title: string
  svg: string
  svgNear: string
  svgFar: string
  domain: PlotDomain
  near: PlotDomain
  far: PlotDomain
  series: PlotSeriesInfo[]
}
