/** Replayable Web-card payload. Nested Code Mode calls cannot carry presentationMeta. */

export const UI_PAYLOAD_MARKER = 'DSH_UI_V1:'

export interface UiSeriesInfo {
  id: string
  label: string
  formula: string
  color: string
  dashed: boolean
  derivativeFormula?: string
  points: Array<{ x: number; y: number; kind: string; label?: string }>
  asymptotes: Array<{ kind: string; value: number; label: string }>
}

export interface UiSvgPayload {
  v: 1
  kind: 'svg'
  title: string
  path: string
  svg: string
}

export interface UiPlotPayload {
  v: 1
  kind: 'plot'
  title: string
  path: string
  svg: string
  svgFar: string
  svgNear: string
  series: UiSeriesInfo[]
}

export type UiPayload = UiSvgPayload | UiPlotPayload

const MAX_SVG_CHARS = 1_500_000

/**
 * Encode a card payload as one text block the Web client can find later.
 * @param payload - plot or standalone SVG card data.
 * @returns a single text-block body.
 */
export function encodeUiPayload(payload: UiPayload): string {
  return UI_PAYLOAD_MARKER + JSON.stringify(payload)
}

/**
 * Parse a card payload from one text-block body.
 * @param text - a tool content text block.
 * @returns the payload, or undefined when this block is ordinary prose.
 */
export function decodeUiPayload(text: string): UiPayload | undefined {
  const index = text.indexOf(UI_PAYLOAD_MARKER)
  if (index < 0) return undefined
  try {
    return asPayload(JSON.parse(text.slice(index + UI_PAYLOAD_MARKER.length)) as unknown)
  } catch {
    // Truncated or non-JSON residue after the marker is not a card payload.
    return undefined
  }
}

/**
 * Recover a card payload from native `meta` or from nested-dispatch content.
 * @param block - settled tool node fields the Web card can see.
 * @returns the payload, or undefined while the call is still running.
 */
export function payloadFromBlock(block: {
  meta?: unknown
  content?: ReadonlyArray<{ type?: string; text?: string }>
}): UiPayload | undefined {
  const fromMeta = asPayload(block.meta)
  if (fromMeta !== undefined) return fromMeta
  for (const part of block.content ?? []) {
    if (part.type !== 'text' || typeof part.text !== 'string') continue
    const decoded = decodeUiPayload(part.text)
    if (decoded !== undefined) return decoded
  }
  return undefined
}

/**
 * Accept a generated or on-disk SVG and reject anything else.
 * @param text - file contents.
 * @returns whether the text looks like an SVG document.
 */
export function looksLikeSvg(text: string): boolean {
  const start = text.trimStart().slice(0, 256).toLowerCase()
  return start.startsWith('<svg')
    || start.startsWith('<?xml') && start.includes('<svg')
    || start.startsWith('<!doctype svg')
}

/**
 * Reject oversized SVG bodies before they enter the session log.
 * @param text - SVG markup.
 * @returns the same text when it is within the card budget.
 */
export function assertSvgBudget(text: string): string {
  if (text.length > MAX_SVG_CHARS) {
    throw new Error(`SVG is larger than ${MAX_SVG_CHARS} characters`)
  }
  return text
}

function asPayload(value: unknown): UiPayload | undefined {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const row = value as Record<string, unknown>
  if (row.kind === 'svg' && typeof row.svg === 'string') {
    return {
      v: 1,
      kind: 'svg',
      title: stringField(row.title),
      path: stringField(row.path),
      svg: row.svg,
    }
  }
  if (typeof row.svgFar === 'string' || typeof row.svg === 'string') {
    const svg = typeof row.svg === 'string' ? row.svg : ''
    const svgFar = typeof row.svgFar === 'string' ? row.svgFar : svg
    if (svgFar === '' && svg === '') return undefined
    return {
      v: 1,
      kind: 'plot',
      title: stringField(row.title),
      path: stringField(row.path),
      svg,
      svgFar,
      svgNear: typeof row.svgNear === 'string' ? row.svgNear : '',
      series: Array.isArray(row.series) ? row.series as UiPlotPayload['series'] : [],
    }
  }
  return undefined
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
