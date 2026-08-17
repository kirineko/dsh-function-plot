/** Named teaching functions: evaluate, optional closed-form derivative, window, annotations. */

import {
  betaPdf, finite, formatNum, gelu, mish, normalCdf, normalPdf, sigmoid, silu, softplus,
} from './math.ts'
import type { Asymptote, CatalogId, ParamMap, PlotPoint } from './types.ts'

export interface Window {
  xMin: number
  xMax: number
}

export interface FunctionDef {
  id: CatalogId
  formula: (p: ParamMap) => string
  evaluate: (x: number, p: ParamMap) => number
  derivative?: (x: number, p: ParamMap) => number
  derivativeFormula?: (p: ParamMap) => string
  domain: (p: ParamMap) => Window
  defined?: (x: number, p: ParamMap) => boolean
  discontinuities?: (window: Window, p: ParamMap) => number[]
  annotate: (p: ParamMap, window: Window) => { points: PlotPoint[]; asymptotes: Asymptote[] }
}

function num(p: ParamMap, key: string, fallback: number): number {
  const value = p[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function requirePositive(name: string, value: number): number {
  if (!(value > 0)) throw new Error(`${name} must be > 0`)
  return value
}

function pt(x: number, y: number, kind: PlotPoint['kind'], label: string): PlotPoint {
  return { x, y, kind, label }
}

function horiz(value: number, label: string): Asymptote {
  return { kind: 'horizontal', value, label }
}

function vert(value: number, label: string): Asymptote {
  return { kind: 'vertical', value, label }
}

function tanPoles(window: Window): number[] {
  const xs: number[] = []
  const start = Math.ceil(window.xMin / Math.PI - 0.5)
  const end = Math.floor(window.xMax / Math.PI - 0.5)
  for (let k = start; k <= end; k++) xs.push((k + 0.5) * Math.PI)
  return xs
}

const DEFS: FunctionDef[] = [
  {
    id: 'sigmoid',
    formula: () => 'σ(x) = 1/(1+e^{-x})',
    evaluate: (x) => sigmoid(x),
    derivative: (x) => { const s = sigmoid(x); return s * (1 - s) },
    derivativeFormula: () => "σ'(x) = σ(x)(1-σ(x))",
    domain: () => ({ xMin: -6, xMax: 6 }),
    annotate: () => ({
      points: [pt(0, 0.5, 'inflection', '(0, 0.5)')],
      asymptotes: [horiz(0, 'y=0'), horiz(1, 'y=1')],
    }),
  },
  {
    id: 'tanh',
    formula: () => 'tanh(x)',
    evaluate: (x) => Math.tanh(x),
    derivative: (x) => {
      const t = Math.tanh(x)
      return 1 - t * t
    },
    derivativeFormula: () => "sech²(x)",
    domain: () => ({ xMin: -4, xMax: 4 }),
    annotate: () => ({
      points: [pt(0, 0, 'inflection', '(0, 0)')],
      asymptotes: [horiz(-1, 'y=-1'), horiz(1, 'y=1')],
    }),
  },
  {
    id: 'relu',
    formula: () => 'ReLU(x) = max(0, x)',
    evaluate: (x) => Math.max(0, x),
    derivative: (x) => (x > 0 ? 1 : 0),
    derivativeFormula: () => "1_{x>0}",
    domain: () => ({ xMin: -3, xMax: 5 }),
    discontinuities: () => [0],
    annotate: () => ({ points: [pt(0, 0, 'kink', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'leaky_relu',
    formula: (p) => `LeakyReLU(x; α=${formatNum(num(p, 'alpha', 0.01))})`,
    evaluate: (x, p) => {
      const a = num(p, 'alpha', 0.01)
      return x >= 0 ? x : a * x
    },
    derivative: (x, p) => (x > 0 ? 1 : num(p, 'alpha', 0.01)),
    domain: () => ({ xMin: -3, xMax: 5 }),
    discontinuities: () => [0],
    annotate: () => ({ points: [pt(0, 0, 'kink', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'elu',
    formula: (p) => `ELU(x; α=${formatNum(num(p, 'alpha', 1))})`,
    evaluate: (x, p) => {
      const a = num(p, 'alpha', 1)
      return x >= 0 ? x : a * (Math.exp(x) - 1)
    },
    derivative: (x, p) => (x >= 0 ? 1 : num(p, 'alpha', 1) * Math.exp(x)),
    domain: () => ({ xMin: -3, xMax: 5 }),
    annotate: (p) => ({
      points: [pt(0, 0, 'kink', '(0, 0)')],
      asymptotes: [horiz(-num(p, 'alpha', 1), `y=-α`)],
    }),
  },
  {
    id: 'softplus',
    formula: () => 'softplus(x) = ln(1+e^x)',
    evaluate: (x) => softplus(x),
    derivative: (x) => sigmoid(x),
    derivativeFormula: () => 'σ(x)',
    domain: () => ({ xMin: -5, xMax: 5 }),
    annotate: () => ({ points: [pt(0, Math.LN2, 'intercept', `(0, ln2)`)], asymptotes: [] }),
  },
  {
    id: 'gelu',
    formula: () => 'GELU(x)',
    evaluate: (x) => gelu(x),
    domain: () => ({ xMin: -4, xMax: 4 }),
    annotate: () => ({ points: [pt(0, 0, 'intercept', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'silu',
    formula: () => 'SiLU(x) = x·σ(x)',
    evaluate: (x) => silu(x),
    derivative: (x) => {
      const s = sigmoid(x)
      return s + x * s * (1 - s)
    },
    domain: () => ({ xMin: -6, xMax: 6 }),
    annotate: () => ({ points: [pt(0, 0, 'intercept', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'mish',
    formula: () => 'Mish(x) = x·tanh(softplus(x))',
    evaluate: (x) => mish(x),
    domain: () => ({ xMin: -5, xMax: 5 }),
    annotate: () => ({ points: [pt(0, 0, 'intercept', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'softmax_pair',
    formula: (p) => `e^x / (e^x + e^{${formatNum(num(p, 'c', 0))}})`,
    evaluate: (x, p) => sigmoid(x - num(p, 'c', 0)),
    derivative: (x, p) => {
      const s = sigmoid(x - num(p, 'c', 0))
      return s * (1 - s)
    },
    domain: (p) => {
      const c = num(p, 'c', 0)
      return { xMin: c - 6, xMax: c + 6 }
    },
    annotate: (p) => {
      const c = num(p, 'c', 0)
      return {
        points: [pt(c, 0.5, 'inflection', `(c, 0.5)`)],
        asymptotes: [horiz(0, 'y=0'), horiz(1, 'y=1')],
      }
    },
  },
  {
    id: 'mse',
    formula: () => 'MSE(e) = e²',
    evaluate: (x) => x * x,
    derivative: (x) => 2 * x,
    domain: () => ({ xMin: -2, xMax: 2 }),
    annotate: () => ({ points: [pt(0, 0, 'extremum', 'min (0, 0)')], asymptotes: [] }),
  },
  {
    id: 'mae',
    formula: () => 'MAE(e) = |e|',
    evaluate: (x) => Math.abs(x),
    derivative: (x) => (x > 0 ? 1 : x < 0 ? -1 : 0),
    domain: () => ({ xMin: -2, xMax: 2 }),
    discontinuities: () => [0],
    annotate: () => ({ points: [pt(0, 0, 'kink', 'min (0, 0)')], asymptotes: [] }),
  },
  {
    id: 'huber',
    formula: (p) => `Huber(e; δ=${formatNum(num(p, 'delta', 1))})`,
    evaluate: (x, p) => {
      const d = requirePositive('delta', num(p, 'delta', 1))
      const a = Math.abs(x)
      return a <= d ? 0.5 * x * x : d * (a - 0.5 * d)
    },
    domain: (p) => {
      const d = num(p, 'delta', 1)
      return { xMin: -3 * d, xMax: 3 * d }
    },
    discontinuities: (window, p) => {
      const d = num(p, 'delta', 1)
      return [-d, d].filter(x => x > window.xMin && x < window.xMax)
    },
    annotate: (p) => {
      const d = num(p, 'delta', 1)
      return {
        points: [
          pt(0, 0, 'extremum', 'min (0, 0)'),
          pt(d, 0.5 * d * d, 'kink', `δ=${formatNum(d)}`),
          pt(-d, 0.5 * d * d, 'kink', `-δ`),
        ],
        asymptotes: [],
      }
    },
  },
  {
    id: 'bce',
    formula: () => 'BCE(z) = softplus(-z)  (y=1)',
    evaluate: (x) => softplus(-x),
    derivative: (x) => -sigmoid(-x),
    domain: () => ({ xMin: -6, xMax: 6 }),
    annotate: () => ({ points: [], asymptotes: [] }),
  },
  {
    id: 'normal_pdf',
    formula: (p) => `N(${formatNum(num(p, 'mu', 0))}, ${formatNum(num(p, 'sigma', 1))}²) pdf`,
    evaluate: (x, p) => normalPdf(x, num(p, 'mu', 0), requirePositive('sigma', num(p, 'sigma', 1))),
    domain: (p) => {
      const mu = num(p, 'mu', 0)
      const sigma = requirePositive('sigma', num(p, 'sigma', 1))
      return { xMin: mu - 4 * sigma, xMax: mu + 4 * sigma }
    },
    annotate: (p) => {
      const mu = num(p, 'mu', 0)
      const sigma = requirePositive('sigma', num(p, 'sigma', 1))
      const peak = normalPdf(mu, mu, sigma)
      return {
        points: [
          pt(mu, peak, 'mean', `μ=${formatNum(mu)}`),
          pt(mu - sigma, normalPdf(mu - sigma, mu, sigma), 'intercept', 'μ−σ'),
          pt(mu + sigma, normalPdf(mu + sigma, mu, sigma), 'intercept', 'μ+σ'),
        ],
        asymptotes: [horiz(0, 'y=0')],
      }
    },
  },
  {
    id: 'normal_cdf',
    formula: (p) => `N(${formatNum(num(p, 'mu', 0))}, ${formatNum(num(p, 'sigma', 1))}²) cdf`,
    evaluate: (x, p) => normalCdf(x, num(p, 'mu', 0), requirePositive('sigma', num(p, 'sigma', 1))),
    domain: (p) => {
      const mu = num(p, 'mu', 0)
      const sigma = requirePositive('sigma', num(p, 'sigma', 1))
      return { xMin: mu - 4 * sigma, xMax: mu + 4 * sigma }
    },
    annotate: (p) => {
      const mu = num(p, 'mu', 0)
      return {
        points: [pt(mu, 0.5, 'mean', `(μ, 0.5)`)],
        asymptotes: [horiz(0, 'y=0'), horiz(1, 'y=1')],
      }
    },
  },
  {
    id: 'uniform_pdf',
    formula: (p) => `U(${formatNum(num(p, 'a', 0))}, ${formatNum(num(p, 'b', 1))}) pdf`,
    evaluate: (x, p) => {
      const a = num(p, 'a', 0)
      const b = num(p, 'b', 1)
      if (!(b > a)) throw new Error('uniform b must be > a')
      return x >= a && x <= b ? 1 / (b - a) : 0
    },
    domain: (p) => {
      const a = num(p, 'a', 0)
      const b = num(p, 'b', 1)
      const pad = 0.5 * (b - a)
      return { xMin: a - pad, xMax: b + pad }
    },
    discontinuities: (_w, p) => [num(p, 'a', 0), num(p, 'b', 1)],
    annotate: (p) => {
      const a = num(p, 'a', 0)
      const b = num(p, 'b', 1)
      const h = 1 / (b - a)
      return {
        points: [pt((a + b) / 2, h, 'mean', `1/(b-a)=${formatNum(h)}`)],
        asymptotes: [],
      }
    },
  },
  {
    id: 'uniform_cdf',
    formula: (p) => `U(${formatNum(num(p, 'a', 0))}, ${formatNum(num(p, 'b', 1))}) cdf`,
    evaluate: (x, p) => {
      const a = num(p, 'a', 0)
      const b = num(p, 'b', 1)
      if (!(b > a)) throw new Error('uniform b must be > a')
      if (x <= a) return 0
      if (x >= b) return 1
      return (x - a) / (b - a)
    },
    domain: (p) => {
      const a = num(p, 'a', 0)
      const b = num(p, 'b', 1)
      const pad = 0.5 * (b - a)
      return { xMin: a - pad, xMax: b + pad }
    },
    discontinuities: (_w, p) => [num(p, 'a', 0), num(p, 'b', 1)],
    annotate: (p) => ({
      points: [
        pt(num(p, 'a', 0), 0, 'kink', `a=${formatNum(num(p, 'a', 0))}`),
        pt(num(p, 'b', 1), 1, 'kink', `b=${formatNum(num(p, 'b', 1))}`),
      ],
      asymptotes: [],
    }),
  },
  {
    id: 'exponential_pdf',
    formula: (p) => `Exp(λ=${formatNum(num(p, 'lambda', 1))}) pdf`,
    evaluate: (x, p) => {
      const lambda = requirePositive('lambda', num(p, 'lambda', 1))
      return x < 0 ? 0 : lambda * Math.exp(-lambda * x)
    },
    domain: (p) => ({ xMin: -0.5 / num(p, 'lambda', 1), xMax: 5 / requirePositive('lambda', num(p, 'lambda', 1)) }),
    discontinuities: () => [0],
    annotate: (p) => {
      const lambda = requirePositive('lambda', num(p, 'lambda', 1))
      return {
        points: [pt(0, lambda, 'intercept', `λ=${formatNum(lambda)}`)],
        asymptotes: [horiz(0, 'y=0')],
      }
    },
  },
  {
    id: 'exponential_cdf',
    formula: (p) => `Exp(λ=${formatNum(num(p, 'lambda', 1))}) cdf`,
    evaluate: (x, p) => {
      const lambda = requirePositive('lambda', num(p, 'lambda', 1))
      return x < 0 ? 0 : 1 - Math.exp(-lambda * x)
    },
    domain: (p) => ({ xMin: -0.5 / num(p, 'lambda', 1), xMax: 5 / requirePositive('lambda', num(p, 'lambda', 1)) }),
    discontinuities: () => [0],
    annotate: () => ({
      points: [pt(0, 0, 'kink', '(0, 0)')],
      asymptotes: [horiz(1, 'y=1')],
    }),
  },
  {
    id: 'lognormal_pdf',
    formula: (p) => `Lognormal(μ=${formatNum(num(p, 'mu', 0))}, σ=${formatNum(num(p, 'sigma', 1))})`,
    evaluate: (x, p) => {
      if (x <= 0) return 0
      const mu = num(p, 'mu', 0)
      const sigma = requirePositive('sigma', num(p, 'sigma', 1))
      return normalPdf(Math.log(x), mu, sigma) / x
    },
    defined: (x) => x > 0,
    domain: (p) => {
      const mu = num(p, 'mu', 0)
      const sigma = requirePositive('sigma', num(p, 'sigma', 1))
      const mode = Math.exp(mu - sigma * sigma)
      return { xMin: mode * 0.05, xMax: Math.exp(mu + 3 * sigma) }
    },
    annotate: (p) => {
      const mu = num(p, 'mu', 0)
      const sigma = requirePositive('sigma', num(p, 'sigma', 1))
      const mode = Math.exp(mu - sigma * sigma)
      return {
        points: [pt(mode, normalPdf(Math.log(mode), mu, sigma) / mode, 'extremum', `mode=${formatNum(mode)}`)],
        asymptotes: [vert(0, 'x=0')],
      }
    },
  },
  {
    id: 'beta_pdf',
    formula: (p) => `Beta(α=${formatNum(num(p, 'alpha', 2))}, β=${formatNum(num(p, 'beta', 2))})`,
    evaluate: (x, p) => betaPdf(x, requirePositive('alpha', num(p, 'alpha', 2)), requirePositive('beta', num(p, 'beta', 2))),
    defined: (x) => x > 0 && x < 1,
    domain: () => ({ xMin: 0.001, xMax: 0.999 }),
    annotate: (p) => {
      const a = requirePositive('alpha', num(p, 'alpha', 2))
      const b = requirePositive('beta', num(p, 'beta', 2))
      if (a > 1 && b > 1) {
        const mode = (a - 1) / (a + b - 2)
        return { points: [pt(mode, betaPdf(mode, a, b), 'extremum', `mode=${formatNum(mode)}`)], asymptotes: [] }
      }
      return { points: [], asymptotes: [] }
    },
  },
  {
    id: 'exp',
    formula: (p) => {
      const base = num(p, 'base', Math.E)
      return Math.abs(base - Math.E) < 1e-12 ? 'e^x' : `${formatNum(base)}^x`
    },
    evaluate: (x, p) => {
      const base = num(p, 'base', Math.E)
      if (!(base > 0) || base === 1) throw new Error('exp base must be > 0 and ≠ 1')
      return base === Math.E ? Math.exp(x) : base ** x
    },
    derivative: (x, p) => {
      const base = num(p, 'base', Math.E)
      const y = base === Math.E ? Math.exp(x) : base ** x
      return y * Math.log(base)
    },
    domain: () => ({ xMin: -3, xMax: 3 }),
    annotate: (p) => {
      const base = num(p, 'base', Math.E)
      const y0 = base === Math.E ? 1 : 1
      return { points: [pt(0, y0, 'intercept', '(0, 1)')], asymptotes: [horiz(0, 'y=0')] }
    },
  },
  {
    id: 'log',
    formula: (p) => {
      const base = num(p, 'base', Math.E)
      return Math.abs(base - Math.E) < 1e-12 ? 'ln(x)' : `log_${formatNum(base)}(x)`
    },
    evaluate: (x, p) => {
      if (x <= 0) return Number.NaN
      const base = num(p, 'base', Math.E)
      if (!(base > 0) || base === 1) throw new Error('log base must be > 0 and ≠ 1')
      return Math.log(x) / Math.log(base)
    },
    derivative: (x, p) => {
      if (x <= 0) return Number.NaN
      const base = num(p, 'base', Math.E)
      return 1 / (x * Math.log(base))
    },
    defined: (x) => x > 0,
    domain: () => ({ xMin: 0.05, xMax: 8 }),
    annotate: () => ({
      points: [pt(1, 0, 'intercept', '(1, 0)')],
      asymptotes: [vert(0, 'x=0')],
    }),
  },
  {
    id: 'pow',
    formula: (p) => `x^${formatNum(num(p, 'n', 2))}`,
    evaluate: (x, p) => x ** num(p, 'n', 2),
    derivative: (x, p) => {
      const n = num(p, 'n', 2)
      return n * x ** (n - 1)
    },
    domain: () => ({ xMin: -2, xMax: 2 }),
    annotate: () => ({ points: [pt(0, 0, 'intercept', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'sqrt',
    formula: () => '√x',
    evaluate: (x) => (x < 0 ? Number.NaN : Math.sqrt(x)),
    derivative: (x) => (x <= 0 ? Number.NaN : 0.5 / Math.sqrt(x)),
    defined: (x) => x >= 0,
    domain: () => ({ xMin: 0, xMax: 9 }),
    annotate: () => ({ points: [pt(0, 0, 'intercept', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'abs',
    formula: () => '|x|',
    evaluate: (x) => Math.abs(x),
    derivative: (x) => (x > 0 ? 1 : x < 0 ? -1 : 0),
    domain: () => ({ xMin: -3, xMax: 3 }),
    discontinuities: () => [0],
    annotate: () => ({ points: [pt(0, 0, 'kink', '(0, 0)')], asymptotes: [] }),
  },
  {
    id: 'step',
    formula: () => '1_{x≥0}',
    evaluate: (x) => (x >= 0 ? 1 : 0),
    derivative: () => 0,
    domain: () => ({ xMin: -3, xMax: 3 }),
    discontinuities: () => [0],
    annotate: () => ({ points: [pt(0, 1, 'kink', '(0, 1)')], asymptotes: [] }),
  },
  {
    id: 'sin',
    formula: () => 'sin(x)',
    evaluate: (x) => Math.sin(x),
    derivative: (x) => Math.cos(x),
    domain: () => ({ xMin: -2 * Math.PI, xMax: 2 * Math.PI }),
    annotate: () => ({
      points: [
        pt(0, 0, 'intercept', '(0, 0)'),
        pt(Math.PI / 2, 1, 'extremum', 'π/2'),
        pt(-Math.PI / 2, -1, 'extremum', '−π/2'),
      ],
      asymptotes: [],
    }),
  },
  {
    id: 'cos',
    formula: () => 'cos(x)',
    evaluate: (x) => Math.cos(x),
    derivative: (x) => -Math.sin(x),
    domain: () => ({ xMin: -2 * Math.PI, xMax: 2 * Math.PI }),
    annotate: () => ({
      points: [
        pt(0, 1, 'extremum', '(0, 1)'),
        pt(Math.PI, -1, 'extremum', 'π'),
      ],
      asymptotes: [],
    }),
  },
  {
    id: 'tan',
    formula: () => 'tan(x)',
    evaluate: (x) => Math.tan(x),
    derivative: (x) => {
      const c = Math.cos(x)
      return 1 / (c * c)
    },
    defined: (x) => Math.abs(Math.cos(x)) > 1e-8,
    domain: () => ({ xMin: -Math.PI + 0.15, xMax: Math.PI - 0.15 }),
    discontinuities: tanPoles,
    annotate: (_p, window) => ({
      points: [pt(0, 0, 'intercept', '(0, 0)')].filter(pt0 => pt0.x >= window.xMin && pt0.x <= window.xMax),
      asymptotes: tanPoles(window).map(x => vert(x, `x=${formatNum(x)}`)),
    }),
  },
  {
    id: 'quadratic',
    formula: (p) => {
      const a = num(p, 'a', 1)
      const b = num(p, 'b', 0)
      const c = num(p, 'c', 0)
      return `${formatNum(a)}x² + ${formatNum(b)}x + ${formatNum(c)}`
    },
    evaluate: (x, p) => num(p, 'a', 1) * x * x + num(p, 'b', 0) * x + num(p, 'c', 0),
    derivative: (x, p) => 2 * num(p, 'a', 1) * x + num(p, 'b', 0),
    domain: (p) => {
      const a = num(p, 'a', 1)
      const b = num(p, 'b', 0)
      const vertex = a === 0 ? 0 : -b / (2 * a)
      return { xMin: vertex - 3, xMax: vertex + 3 }
    },
    annotate: (p) => {
      const a = num(p, 'a', 1)
      const b = num(p, 'b', 0)
      const c = num(p, 'c', 0)
      if (a === 0) return { points: [], asymptotes: [] }
      const vx = -b / (2 * a)
      const vy = a * vx * vx + b * vx + c
      return { points: [pt(vx, vy, 'extremum', `vertex (${formatNum(vx)}, ${formatNum(vy)})`)], asymptotes: [] }
    },
  },
  {
    id: 'logistic',
    formula: (p) => {
      const L = num(p, 'L', 1)
      const k = num(p, 'k', 1)
      const x0 = num(p, 'x0', 0)
      return `${formatNum(L)} / (1 + e^{${formatNum(-k)}(x-${formatNum(x0)})})`
    },
    evaluate: (x, p) => num(p, 'L', 1) * sigmoid(num(p, 'k', 1) * (x - num(p, 'x0', 0))),
    derivative: (x, p) => {
      const L = num(p, 'L', 1)
      const k = num(p, 'k', 1)
      const s = sigmoid(k * (x - num(p, 'x0', 0)))
      return L * k * s * (1 - s)
    },
    domain: (p) => {
      const x0 = num(p, 'x0', 0)
      const k = num(p, 'k', 1)
      const span = 6 / Math.max(Math.abs(k), 0.1)
      return { xMin: x0 - span, xMax: x0 + span }
    },
    annotate: (p) => {
      const L = num(p, 'L', 1)
      const x0 = num(p, 'x0', 0)
      return {
        points: [pt(x0, L / 2, 'inflection', `(x₀, L/2)`)],
        asymptotes: [horiz(0, 'y=0'), horiz(L, `y=${formatNum(L)}`)],
      }
    },
  },
  {
    id: 'linear_demand',
    formula: (p) => `P = ${formatNum(num(p, 'intercept', 10))} ${num(p, 'slope', -1) >= 0 ? '+' : '−'} ${formatNum(Math.abs(num(p, 'slope', -1)))} Q`,
    evaluate: (x, p) => num(p, 'intercept', 10) + num(p, 'slope', -1) * x,
    derivative: (_x, p) => num(p, 'slope', -1),
    domain: (p) => {
      const intercept = num(p, 'intercept', 10)
      const slope = num(p, 'slope', -1)
      const zero = slope === 0 ? 10 : Math.max(intercept / Math.abs(slope), 1)
      return { xMin: 0, xMax: zero }
    },
    annotate: (p) => {
      const intercept = num(p, 'intercept', 10)
      const slope = num(p, 'slope', -1)
      const xInt = slope === 0 ? Number.NaN : -intercept / slope
      const points: PlotPoint[] = [pt(0, intercept, 'intercept', `P=${formatNum(intercept)}`)]
      if (finite(xInt) && xInt > 0) points.push(pt(xInt, 0, 'intercept', `Q=${formatNum(xInt)}`))
      return { points, asymptotes: [] }
    },
  },
  {
    id: 'linear_supply',
    formula: (p) => `P = ${formatNum(num(p, 'intercept', 0))} + ${formatNum(num(p, 'slope', 1))} Q`,
    evaluate: (x, p) => num(p, 'intercept', 0) + num(p, 'slope', 1) * x,
    derivative: (_x, p) => num(p, 'slope', 1),
    domain: (p) => {
      const intercept = num(p, 'intercept', 0)
      const slope = num(p, 'slope', 1)
      const span = slope === 0 ? 10 : Math.max((10 - intercept) / Math.abs(slope), 4)
      return { xMin: 0, xMax: span }
    },
    annotate: (p) => ({
      points: [pt(0, num(p, 'intercept', 0), 'intercept', `P=${formatNum(num(p, 'intercept', 0))}`)],
      asymptotes: [],
    }),
  },
  {
    id: 'isoelastic',
    formula: (p) => `${formatNum(num(p, 'A', 1))} x^{${formatNum(num(p, 'epsilon', -1))}}`,
    evaluate: (x, p) => {
      if (x <= 0) return Number.NaN
      return num(p, 'A', 1) * x ** num(p, 'epsilon', -1)
    },
    defined: (x) => x > 0,
    domain: () => ({ xMin: 0.2, xMax: 8 }),
    annotate: () => ({ points: [], asymptotes: [] }),
  },
  {
    id: 'cobb_douglas_slice',
    formula: (p) => `x^{${formatNum(num(p, 'a', 0.5))}} (1-x)^{${formatNum(1 - num(p, 'a', 0.5))}}`,
    evaluate: (x, p) => {
      if (x <= 0 || x >= 1) return 0
      const a = num(p, 'a', 0.5)
      return x ** a * (1 - x) ** (1 - a)
    },
    defined: (x) => x > 0 && x < 1,
    domain: () => ({ xMin: 0.01, xMax: 0.99 }),
    annotate: (p) => {
      const a = num(p, 'a', 0.5)
      const mode = a
      const y = mode ** a * (1 - mode) ** (1 - a)
      return { points: [pt(mode, y, 'extremum', `max at x=${formatNum(mode)}`)], asymptotes: [] }
    },
  },
  {
    id: 'crra_utility',
    formula: (p) => {
      const eta = num(p, 'eta', 2)
      return Math.abs(eta - 1) < 1e-9 ? 'ln(c)' : `(c^{1-η}−1)/(1-η), η=${formatNum(eta)}`
    },
    evaluate: (x, p) => {
      if (x <= 0) return Number.NaN
      const eta = num(p, 'eta', 2)
      if (Math.abs(eta - 1) < 1e-9) return Math.log(x)
      return (x ** (1 - eta) - 1) / (1 - eta)
    },
    defined: (x) => x > 0,
    domain: () => ({ xMin: 0.05, xMax: 4 }),
    annotate: () => ({ points: [], asymptotes: [] }),
  },
  {
    id: 'quadratic_cost',
    formula: (p) => {
      const a = num(p, 'a', 1)
      const b = num(p, 'b', 2)
      const c = num(p, 'c', 4)
      return `C(q)=${formatNum(a)}q²+${formatNum(b)}q+${formatNum(c)}`
    },
    evaluate: (x, p) => {
      if (x < 0) return Number.NaN
      return num(p, 'a', 1) * x * x + num(p, 'b', 2) * x + num(p, 'c', 4)
    },
    defined: (x) => x >= 0,
    domain: () => ({ xMin: 0, xMax: 6 }),
    annotate: (p) => {
      const a = num(p, 'a', 1)
      const c = num(p, 'c', 4)
      if (!(a > 0) || !(c > 0)) return { points: [pt(0, c, 'intercept', `FC=${formatNum(c)}`)], asymptotes: [] }
      const q = Math.sqrt(c / a)
      const ac = 2 * Math.sqrt(a * c) + num(p, 'b', 2)
      return {
        points: [
          pt(0, c, 'intercept', `FC=${formatNum(c)}`),
          pt(q, a * q * q + num(p, 'b', 2) * q + c, 'extremum', `min AC at q=${formatNum(q)}`),
        ],
        asymptotes: [],
      }
    },
  },
  {
    id: 'exponential_discount',
    formula: (p) => `e^{-${formatNum(num(p, 'r', 0.1))} t}`,
    evaluate: (x, p) => {
      if (x < 0) return Number.NaN
      return Math.exp(-num(p, 'r', 0.1) * x)
    },
    derivative: (x, p) => {
      const r = num(p, 'r', 0.1)
      return -r * Math.exp(-r * x)
    },
    defined: (x) => x >= 0,
    domain: (p) => ({ xMin: 0, xMax: 5 / Math.max(num(p, 'r', 0.1), 0.02) }),
    annotate: (p) => {
      const r = num(p, 'r', 0.1)
      const half = Math.LN2 / r
      return {
        points: [pt(half, 0.5, 'intercept', `half-life=${formatNum(half)}`)],
        asymptotes: [horiz(0, 'y=0')],
      }
    },
  },
]

const BY_ID = new Map(DEFS.map(def => [def.id, def]))

export function getFunction(id: CatalogId): FunctionDef {
  const def = BY_ID.get(id)
  if (def === undefined) throw new Error(`unknown function "${id}"`)
  return def
}

export { DEFS as CATALOG }
