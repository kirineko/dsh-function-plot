import { describe, expect, it } from 'vitest'
import { claimDisplay } from '../src/display-claim.ts'
import {
  assertSvgBudget,
  decodeUiPayload,
  encodeUiPayload,
  looksLikeSvg,
  payloadFromBlock,
} from '../src/ui-payload.ts'

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'

describe('ui payload', () => {
  it('round-trips a standalone SVG card', () => {
    const encoded = encodeUiPayload({ v: 1, kind: 'svg', title: 'Logo', path: 'a.svg', svg })
    expect(decodeUiPayload(`title: Logo\n${encoded}`)).toEqual({
      v: 1,
      kind: 'svg',
      title: 'Logo',
      path: 'a.svg',
      svg,
    })
  })

  it('reads native plot presentationMeta without a kind tag', () => {
    const payload = payloadFromBlock({
      meta: { title: 'ReLU', svg, svgFar: svg, svgNear: svg, series: [] },
    })
    expect(payload?.kind).toBe('plot')
    expect(payload?.title).toBe('ReLU')
  })

  it('reads a nested Code Mode content block when meta is absent', () => {
    const encoded = encodeUiPayload({
      v: 1,
      kind: 'plot',
      title: 'exp',
      path: '.dsh-plots/y-e-x.svg',
      svg,
      svgFar: svg,
      svgNear: '',
      series: [],
    })
    const payload = payloadFromBlock({
      content: [
        { type: 'text', text: 'title: exp\nfile: .dsh-plots/y-e-x.svg' },
        { type: 'text', text: encoded },
      ],
    })
    expect(payload?.kind).toBe('plot')
    expect(payload?.title).toBe('exp')
    if (payload?.kind !== 'plot') throw new Error('expected plot')
    expect(payload.svgFar).toContain('<svg')
  })

  it('accepts XML-wrapped SVG and rejects other files', () => {
    expect(looksLikeSvg(`<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>`)).toBe(true)
    expect(looksLikeSvg('<svg viewBox="0 0 1 1"/>')).toBe(true)
    expect(looksLikeSvg('<html></html>')).toBe(false)
    expect(looksLikeSvg('not a figure')).toBe(false)
  })

  it('rejects an oversized SVG', () => {
    expect(() => assertSvgBudget('x'.repeat(1_500_001))).toThrow(/larger/)
    expect(assertSvgBudget(svg)).toBe(svg)
  })

  it('does not treat a standalone SVG payload as a plot', () => {
    const payload = payloadFromBlock({
      meta: { v: 1, kind: 'svg', title: 'Logo', path: 'a.svg', svg },
    })
    expect(payload?.kind).toBe('svg')
  })

  it('claims a path only once per Code Mode parent', () => {
    const parent = Symbol('run_code')
    expect(claimDisplay(parent, '/tmp/a.svg')).toBe(true)
    expect(claimDisplay(parent, '/tmp/a.svg')).toBe(false)
    expect(claimDisplay(parent, '/tmp/b.svg')).toBe(true)
    expect(claimDisplay(Symbol('other'), '/tmp/a.svg')).toBe(true)
    expect(claimDisplay(undefined, '/tmp/a.svg')).toBe(true)
  })
})
