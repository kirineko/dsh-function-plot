import { describe, expect, it } from 'vitest'
import { getFunction } from '../src/plot/catalog.ts'
import { compileExpr } from '../src/plot/expr.ts'
import { buildPlot, formatPlotText } from '../src/plot/build.ts'
import type { PlotConfig } from '../src/plot/types.ts'

const config: PlotConfig = {
  width: 640,
  height: 360,
  samples: 80,
  outputDir: '.dsh-plots',
  theme: 'light',
}

describe('catalog', () => {
  it('evaluates sigmoid at the origin', () => {
    expect(getFunction('sigmoid').evaluate(0, {})).toBeCloseTo(0.5, 10)
  })

  it('breaks ReLU at the origin', () => {
    const relu = getFunction('relu')
    expect(relu.evaluate(-1, {})).toBe(0)
    expect(relu.evaluate(2, {})).toBe(2)
    expect(relu.discontinuities?.({ xMin: -3, xMax: 5 }, {})).toEqual([0])
  })

  it('rejects a non-positive gaussian width', () => {
    expect(() => getFunction('normal_pdf').evaluate(0, { sigma: 0 })).toThrow(/sigma/)
  })
})

describe('expr', () => {
  it('evaluates a restricted formula', () => {
    const f = compileExpr('1/(1+exp(-x))')
    expect(f(0)).toBeCloseTo(0.5, 8)
  })

  it('accepts log10 and log2', () => {
    expect(compileExpr('log10(x)')(100)).toBeCloseTo(2, 8)
    expect(compileExpr('log2(x)')(8)).toBeCloseTo(3, 8)
  })

  it('rejects unknown identifiers', () => {
    expect(() => compileExpr('process.env')).toThrow(/identifier|character/)
    expect(() => compileExpr('foo(x)')).toThrow(/unknown function/)
  })

  it('rejects assignment-like junk', () => {
    expect(() => compileExpr('x = 1')).toThrow()
  })
})

describe('buildPlot', () => {
  it('does not add a derivative unless asked', () => {
    const built = buildPlot({ series: [{ fn: 'sigmoid' }] }, config)
    expect(built.spec.series).toHaveLength(1)
    expect(built.value.series[0]?.derivativeFormula).toBeUndefined()
    expect(built.svg).toContain('<svg')
    expect(built.svg).toContain('σ(x)')
  })

  it('adds a dashed derivative only when requested', () => {
    const built = buildPlot({ series: [{ fn: 'sigmoid', derivative: true }] }, config)
    expect(built.spec.series).toHaveLength(2)
    expect(built.spec.series[1]?.dashed).toBe(true)
    expect(built.value.series[0]?.derivativeFormula).toMatch(/σ/)
  })

  it('marks a demand-supply equilibrium', () => {
    const built = buildPlot({ series: [{ fn: 'linear_demand' }, { fn: 'linear_supply' }] }, config)
    expect(built.value.series[0]?.points.some(p => p.kind === 'mean' && p.x === 5 && p.y === 5)).toBe(true)
  })

  it('overlays two activations', () => {
    const built = buildPlot({ series: [{ fn: 'relu' }, { fn: 'gelu' }] }, config)
    expect(built.spec.series.map(s => s.id)).toEqual(['relu', 'gelu'])
  })

  it('accepts a custom expression', () => {
    const built = buildPlot({ series: [{ expr: 'x^2 / 2' }], xMin: -2, xMax: 2 }, config)
    expect(built.value.series[0]?.formula).toBe('x^2 / 2')
    expect(built.svg.includes('<path')).toBe(true)
  })

  it('formatPlotText stays text-only', () => {
    const built = buildPlot({ series: [{ fn: 'tanh' }] }, config)
    const text = formatPlotText({ ...built.value, path: '.dsh-plots/tanh.svg' })
    expect(text).toContain('tanh(x)')
    expect(text).not.toContain('type: \'image\'')
    expect(text).not.toContain('<image')
  })
})
