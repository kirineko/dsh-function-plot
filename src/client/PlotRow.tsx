import { useState } from 'react'
import { DisclosureRow, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

interface PlotMeta {
  title?: unknown
  svg?: unknown
}

function metaOf(block: ToolCallViewProps['block']): PlotMeta | undefined {
  if (!('kind' in block) || block.meta === undefined || typeof block.meta !== 'object' || block.meta === null) {
    return undefined
  }
  return block.meta as PlotMeta
}

function titleOf(block: ToolCallViewProps['block']): string {
  const meta = metaOf(block)
  if (typeof meta?.title === 'string' && meta.title !== '') return meta.title
  const argsRaw = ('kind' in block ? block.call?.argsRaw : block.argsRaw) ?? ''
  try {
    const parsed = JSON.parse(argsRaw) as { series?: Array<{ fn?: string; expr?: string }> }
    const names = (parsed.series ?? []).map(row => row.fn ?? row.expr ?? 'curve')
    if (names.length > 0) return `Plot ${names.join(', ')}`
  } catch {
    // Streaming or malformed args: fall back to the generic title.
  }
  return 'Plot'
}

/**
 * Dedicated plot card: collapsed title, expanded inline SVG from presentationMeta.
 */
export function PlotRow({ block }: ToolCallViewProps) {
  const [open, setOpen] = useState(true)
  const settled = 'kind' in block
  const state = !settled ? 'ongoing' : block.isError ? 'error' : 'done'
  const meta = metaOf(block)
  const svg = typeof meta?.svg === 'string' ? meta.svg : ''
  const title = titleOf(block)
  const expandable = svg !== '' || settled

  return (
    <DisclosureRow
      icon={<StateDot state={state} />}
      title={title}
      open={open}
      expandable={expandable}
      expandOnRowClick
      onToggle={() => {
        if (expandable) setOpen(value => !value)
      }}
    >
      {svg !== ''
        // The SVG is produced by this package's renderer, never by model text.
        ? <div dangerouslySetInnerHTML={{ __html: svg }} />
        : null}
    </DisclosureRow>
  )
}
