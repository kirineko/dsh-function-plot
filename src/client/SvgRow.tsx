import { useState } from 'react'
import { DisclosureRow, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { downloadSvg, payloadOf, SvgFrame, titleOf } from './svg-view.tsx'
import type { ToolBlock } from './svg-view.tsx'

/**
 * Generic SVG card for show_svg.
 */
export function SvgRow({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(true)
  const settled = block.kind !== undefined
  const state = !settled ? 'ongoing' : block.isError === true ? 'error' : 'done'
  const payload = payloadOf(block)
  const svg = payload?.kind === 'svg' ? payload.svg : ''
  const title = titleOf(block, 'SVG')
  if (settled && block.isError !== true && svg === '') return null
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
      {svg === '' ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                downloadSvg(`${title || 'figure'}.svg`, svg)
              }}
              style={{
                border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-base)',
                color: 'var(--dsw-alias-label-secondary)',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 8,
                padding: '2px 10px',
                cursor: 'pointer',
              }}
            >
              下载 SVG
            </button>
          </div>
          <SvgFrame svg={svg} />
        </div>
      )}
    </DisclosureRow>
  )
}
