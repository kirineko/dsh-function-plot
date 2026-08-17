import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { PlotRow } from './PlotRow.tsx'

export const name = 'function-plot-client'
export const inject = ['slots']

/**
 * Own the plot_function tool card.
 * @param ctx - browser plugin context with the slot registry.
 */
export function apply(ctx: Context): void {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'plot_function' },
    PlotRow,
  ))
}
