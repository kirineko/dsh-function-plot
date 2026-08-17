import { useState } from 'react'
import { DisclosureRow, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'

interface PlotBlock {
  kind?: string
  isError?: boolean
  meta?: unknown
  argsRaw?: string
  call?: { argsRaw?: string }
}

interface PlotMeta {
  title?: unknown
  svg?: unknown
}

function metaOf(block: PlotBlock): PlotMeta | undefined {
  if (block.kind === undefined || block.meta === undefined || typeof block.meta !== 'object' || block.meta === null) {
    return undefined
  }
  return block.meta as PlotMeta
}

function titleOf(block: PlotBlock): string {
  const meta = metaOf(block)
  if (typeof meta?.title === 'string' && meta.title !== '') return meta.title
  const argsRaw = (block.kind === undefined ? block.argsRaw : block.call?.argsRaw) ?? ''
  try {
    const parsed = JSON.parse(argsRaw) as { series?: Array<{ fn?: string; expr?: string }> }
    const names = (parsed.series ?? []).map(row => row.fn ?? row.expr ?? 'curve')
    if (names.length > 0) return names.join(', ')
  } catch {
    // Streaming or malformed args: fall back to the generic title.
  }
  return 'Plot'
}

/**
 * Dedicated plot card: title row plus the SVG from presentationMeta.
 */
export function PlotRow({ block }: { block: PlotBlock }) {
  const [open, setOpen] = useState(true)
  const settled = block.kind !== undefined
  const state = !settled ? 'ongoing' : block.isError === true ? 'error' : 'done'
  const svg = typeof metaOf(block)?.svg === 'string' ? (metaOf(block) as { svg: string }).svg : ''
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
        ? (
          <div
            style={{
              marginTop: 8,
              border: '1px solid var(--dsw-alias-border-l1)',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--dsw-alias-bg-base)',
            }}
          >
            <div
              style={{ display: 'block', width: '100%' }}
              dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="display:block;width:100%;height:auto;" ') }}
            />
          </div>
        )
        : null}
    </DisclosureRow>
  )
}
