import { useMemo, useState } from 'react'
import { DisclosureRow, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'

interface PlotBlock {
  kind?: string
  isError?: boolean
  meta?: unknown
  argsRaw?: string
  call?: { argsRaw?: string }
}

interface PlotPoint {
  x: number
  y: number
  kind: string
  label?: string
}

interface Asymptote {
  kind: string
  value: number
  label: string
}

interface SeriesInfo {
  id: string
  label: string
  formula: string
  color: string
  dashed: boolean
  derivativeFormula?: string
  points: PlotPoint[]
  asymptotes: Asymptote[]
}

interface PlotMeta {
  title?: unknown
  svg?: unknown
  svgNear?: unknown
  svgFar?: unknown
  series?: SeriesInfo[]
}

type ViewMode = 'far' | 'near' | 'both'

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

function asSvg(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function download(filename: string, svg: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Frame({ svg }: { svg: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
      }}
    >
      <div
        dangerouslySetInnerHTML={{
          __html: svg.replace('<svg ', '<svg style="display:block;width:100%;height:auto;" '),
        }}
      />
    </div>
  )
}

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

/**
 * Teaching plot card: far/near views, full legend, download.
 */
export function PlotRow({ block }: { block: PlotBlock }) {
  const [open, setOpen] = useState(true)
  const [view, setView] = useState<ViewMode>('both')
  const settled = block.kind !== undefined
  const state = !settled ? 'ongoing' : block.isError === true ? 'error' : 'done'
  const meta = metaOf(block)
  const svgFar = asSvg(meta?.svgFar) || asSvg(meta?.svg)
  const svgNear = asSvg(meta?.svgNear)
  const series = Array.isArray(meta?.series) ? meta.series : []
  const title = titleOf(block)
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
                download(`${title || 'plot'}.svg`, view === 'near' ? svgNear || svgFar : svgFar)
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
                <Frame svg={svgFar} />
                <Frame svg={svgNear} />
              </div>
            )
            : <Frame svg={view === 'near' && svgNear !== '' ? svgNear : svgFar} />}
          {series.length > 0
            ? (
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
            : null}
        </div>
      )}
    </DisclosureRow>
  )
}
