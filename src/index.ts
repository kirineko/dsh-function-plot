import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-fs'
import { registerPlotTool } from './tool.ts'
import type { PlotConfig } from './plot/types.ts'

export const name = 'function-plot'
export const inject = ['tools', 'fs']

export interface Config {
  width: number
  height: number
  samples: number
  outputDir: string
  theme: 'light' | 'dark'
}

export const Config: Schema<Config> = Schema.object({
  width: Schema.number().default(960),
  height: Schema.number().default(540),
  samples: Schema.number().default(400),
  outputDir: Schema.string().default('.dsh-plots'),
  theme: Schema.union(['light', 'dark']).default('light'),
})

/**
 * Register the plot_function tool.
 * @param ctx - loader context; tools and fs are ready.
 * @param config - validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved: PlotConfig = {
    width: config.width,
    height: config.height,
    samples: config.samples,
    outputDir: config.outputDir,
    theme: config.theme,
  }
  registerPlotTool(ctx, resolved)
}
