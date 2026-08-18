import { useState } from 'react'
import { DisclosureRow, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { downloadSvg, payloadOf, SvgFrame, titleOf } from './svg-view.tsx'
import type { ToolBlock } from './svg-view.tsx'
import type { UiSeriesInfo } from '../ui-payload.ts'

type ViewMode = 'far' | 'near' | 'both'

function Tab({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      style={{
        border: '1px solid var(--dsw-alias-border-l2)',
        background: active ? 'var(--dsw-alias-interactive-bg-hover-solid)' : 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontWeight: 700,
        fontSize: 12,
        lineHeight: '20px',
        borderRadius: 999,
        padding: '2px 10px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function Legend({ series }: { series: UiSeriesInfo[] }) {
  if (series.length === 0) return null
  return (
    <div
      style={{
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dsw-alias-label-caption)' }}>函数信息</div>
      {series.map(item => (
        <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span
            style={{
              width: 18,
              height: 0,
              borderTop: item.dashed ? '3px dashed' : '3px solid',
              borderColor: item.color,
              marginTop: 7,
              flex: 'none',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--dsw-alias-label-primary)' }}>{item.label}</div>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }}>{item.formula}</div>
            {item.derivativeFormula !== undefined
              ? <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary)' }}>导数 {item.derivativeFormula}</div>
              : null}
            {item.points.length > 0 || item.asymptotes.length > 0
              ? (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-tertiary)' }}>
                  {[
                    ...item.points.map(point => point.label ?? `${point.kind} (${point.x}, ${point.y})`),
                    ...item.asymptotes.map(line => line.label),
                  ].join(' · ')}
                </div>
              )
              : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Teaching plot card: far/near views, full legend, download.
 */
export function PlotRow({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(true)
  const [view, setView] = useState<ViewMode>('both')
  const settled = block.kind !== undefined
  const state = !settled ? 'ongoing' : block.isError === true ? 'error' : 'done'
  const payload = payloadOf(block)
  const svgFar = payload?.kind === 'plot' ? (payload.svgFar || payload.svg) : ''
  const svgNear = payload?.kind === 'plot' ? payload.svgNear : ''
  const series = payload?.kind === 'plot' ? payload.series : []
  const title = titleOf(block, 'Plot')
  const expandable = svgFar !== '' || settled

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
      {svgFar === '' ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Tab active={view === 'far'} label="远景" onClick={() => setView('far')} />
            {svgNear !== '' ? <Tab active={view === 'near'} label="近景" onClick={() => setView('near')} /> : null}
            {svgNear !== '' ? <Tab active={view === 'both'} label="对照" onClick={() => setView('both')} /> : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                downloadSvg(`${title || 'plot'}.svg`, view === 'near' ? svgNear || svgFar : svgFar)
              }}
              style={{
                marginLeft: 'auto',
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
          {view === 'both' && svgNear !== ''
            ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <SvgFrame svg={svgFar} />
                <SvgFrame svg={svgNear} />
              </div>
            )
            : <SvgFrame svg={view === 'near' && svgNear !== '' ? svgNear : svgFar} />}
          <Legend series={series} />
        </div>
      )}
    </DisclosureRow>
  )
}
