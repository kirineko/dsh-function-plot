import type { Context } from '@deepseek-ai/cordis'
import { PlotRow } from './PlotRow.tsx'
import { SvgRow } from './SvgRow.tsx'

export const name = 'function-plot-client'
export const inject = ['slots']

/**
 * Own the plot_function and show_svg tool cards.
 * @param ctx - browser plugin context with the slot registry.
 */
export function apply(ctx: Context): void {
  const slots = (ctx as Context & {
    slots: {
      inject: (name: string, factory: () => unknown) => unknown
      register: (options: { name: string; key: string }, component: unknown) => unknown
    }
  }).slots
  slots.inject('tool.call.toolview', function* () {
    yield slots.register({ name: 'tool.call.toolview', key: 'plot_function' }, PlotRow)
    yield slots.register({ name: 'tool.call.toolview', key: 'show_svg' }, SvgRow)
  })
}
