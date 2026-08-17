/** Numerically stable helpers used by the catalog. */

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}

export function softplus(x: number): number {
  if (x > 20) return x
  if (x < -20) return Math.exp(x)
  return Math.log1p(Math.exp(x))
}

export function tanh(x: number): number {
  return Math.tanh(x)
}

/** Abramowitz and Stegun 7.1.26. */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-a * a)
  return sign * y
}

export function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
}

export function normalCdf(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)))
}

/** Lanczos approximation of ln Γ(z) for z > 0. */
export function lnGamma(z: number): number {
  const g = 7
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  }
  const x = z - 1
  let a = p[0]
  for (let i = 1; i < p.length; i++) a += p[i] / (x + i)
  const t = x + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

export function betaPdf(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0
  const logB = lnGamma(alpha) + lnGamma(beta) - lnGamma(alpha + beta)
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB)
}

export function gelu(x: number): number {
  const inner = Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)
  return 0.5 * x * (1 + Math.tanh(inner))
}

export function silu(x: number): number {
  return x * sigmoid(x)
}

export function mish(x: number): number {
  return x * Math.tanh(softplus(x))
}

export function finite(value: number): boolean {
  return Number.isFinite(value)
}

/** Central-difference derivative; returns NaN when either side is not finite. */
export function numericalDerivative(f: (x: number) => number, x: number, h = 1e-4): number {
  const left = f(x - h)
  const right = f(x + h)
  if (!finite(left) || !finite(right)) return Number.NaN
  return (right - left) / (2 * h)
}

export function formatNum(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Number(value.toPrecision(digits))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}
