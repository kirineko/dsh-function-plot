import { useEffect, useMemo } from 'react'
import { payloadFromBlock } from '../ui-payload.ts'
import type { UiPayload } from '../ui-payload.ts'

export interface ToolBlock {
  kind?: string
  isError?: boolean
  meta?: unknown
  content?: ReadonlyArray<{ type?: string; text?: string }>
  argsRaw?: string
  call?: { argsRaw?: string }
}

/**
 * Recover the card payload from native meta or nested-dispatch content.
 * @param block - running or settled tool node.
 * @returns the payload when the figure is available.
 */
export function payloadOf(block: ToolBlock): UiPayload | undefined {
  return payloadFromBlock(block)
}

/**
 * Title for a running or settled SVG card.
 * @param block - tool node.
 * @param fallback - used when args and payload have no title.
 * @returns a short card title.
 */
export function titleOf(block: ToolBlock, fallback: string): string {
  const payload = payloadOf(block)
  if (payload !== undefined && payload.title !== '') return payload.title
  const argsRaw = (block.kind === undefined ? block.argsRaw : block.call?.argsRaw) ?? ''
  try {
    const parsed = JSON.parse(argsRaw) as { title?: string; path?: string; series?: Array<{ fn?: string; expr?: string }> }
    if (typeof parsed.title === 'string' && parsed.title !== '') return parsed.title
    const names = (parsed.series ?? []).map(row => row.fn ?? row.expr ?? 'curve')
    if (names.length > 0) return names.join(', ')
    if (typeof parsed.path === 'string' && parsed.path !== '') {
      return parsed.path.split('/').pop() || parsed.path
    }
  } catch {
    // Streaming or malformed args: fall back to the generic title.
  }
  return fallback
}

/**
 * Render one SVG as a safe image, not as live markup.
 * @param props.svg - SVG document text.
 */
export function SvgFrame({ svg }: { svg: string }) {
  const url = useMemo(
    () => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })),
    [svg],
  )
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div
      style={{
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
      }}
    >
      <img alt="" src={url} style={{ display: 'block', width: '100%', height: 'auto' }} />
    </div>
  )
}

/**
 * Download SVG markup as a file.
 * @param filename - suggested download name.
 * @param svg - SVG document text.
 */
export function downloadSvg(filename: string, svg: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
