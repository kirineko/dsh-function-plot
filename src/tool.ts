/** Model-facing plot_function tool. */

import { posix } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import { buildPlot, formatPlotText } from './plot/build.ts'
import { CATALOG_IDS } from './plot/types.ts'
import type { PlotConfig, PlotRequest, SeriesInput } from './plot/types.ts'

const CATALOG_HELP = CATALOG_IDS.join(', ')

function asParams(value: unknown): Record<string, number> | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('params must be an object of numbers')
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      throw new Error(`params.${key} must be a finite number`)
    }
    out[key] = raw
  }
  return out
}

function asSeries(raw: unknown): SeriesInput {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('each series entry must be an object')
  const row = raw as Record<string, unknown>
  return {
    ...typeof row.fn === 'string' ? { fn: row.fn } : {},
    ...typeof row.expr === 'string' ? { expr: row.expr } : {},
    ...row.params !== undefined ? { params: asParams(row.params) } : {},
    ...row.derivative === true ? { derivative: true } : {},
    ...typeof row.label === 'string' ? { label: row.label } : {},
  }
}

/**
 * Register plot_function.
 * @param ctx - plugin context; execute uses tools + fs.
 * @param config - canvas and output defaults.
 */
export function registerPlotTool(ctx: Context, config: PlotConfig): void {
  ctx.tools.register(defineTool({
    name: 'plot_function',
    description: [
      'Draw a 2D graph of one or more real functions for teaching or explanation.',
      'Prefer a named catalog function (fn) when it matches the topic; use expr for a custom formula.',
      `Catalog: ${CATALOG_HELP}.`,
      'Plot exactly what the user asked for. Set derivative=true only when they ask for a slope, marginal, gradient, or derivative.',
      'Do not add a derivative by default.',
      'The Web UI already shows the figure on this tool\'s result card. Do not call read_image on the SVG or any converted PNG; DeepSeek models reject image input.',
    ].join(' '),
    parameters: {
      series: {
        type: 'array',
        required: true,
        description: 'One to six curves to draw on the same axes. Each entry sets exactly one of fn or expr.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            fn: { type: 'string', enum: [...CATALOG_IDS], description: 'Named teaching function.' },
            expr: { type: 'string', description: 'Restricted expression in x, e.g. 1/(1+exp(-x)) or x^2/2.' },
            params: { type: 'object', additionalProperties: true, description: 'Numeric parameters for fn (mu, sigma, alpha, …).' },
            derivative: { type: 'boolean', description: 'If true, overlay this curve\'s derivative. Default false.' },
            label: { type: 'string', description: 'Legend label.' },
          },
        },
      },
      xMin: { type: 'number', description: 'Left x bound. Omit to use the catalog default window.' },
      xMax: { type: 'number', description: 'Right x bound.' },
      samples: { type: 'integer', description: 'Sample count, 50–2000.' },
      title: { type: 'string', description: 'Figure title.' },
      xLabel: { type: 'string', description: 'Horizontal axis label (default x).' },
      yLabel: { type: 'string', description: 'Vertical axis label (default y).' },
      path: { type: 'string', description: 'Workspace-relative SVG path. Default .dsh-plots/<title>.svg.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', required: true },
          path: { type: 'string', required: true },
          domain: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              xMin: { type: 'number', required: true },
              xMax: { type: 'number', required: true },
              yMin: { type: 'number', required: true },
              yMax: { type: 'number', required: true },
            },
          },
          series: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                formula: { type: 'string', required: true },
                derivativeFormula: { type: 'string' },
                points: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      x: { type: 'number', required: true },
                      y: { type: 'number', required: true },
                      kind: { type: 'string', required: true },
                    },
                  },
                },
                asymptotes: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      kind: { type: 'string', required: true },
                      value: { type: 'number', required: true },
                      label: { type: 'string', required: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatPlotText(value) }],
      presentationMeta: (_args, value) => ({
        title: value.title,
        domain: value.domain,
        svg: svgByPath.get(value.path) ?? '',
      }),
    },
    presentCall(args): GenericCallView {
      const names = args.series.map((row) => {
        if (typeof row.fn === 'string') return row.fn
        if (typeof row.expr === 'string') return row.expr
        return 'curve'
      })
      return {
        card: 'generic',
        title: `Plot ${names.join(', ')}`,
        ...args.path !== undefined ? { locations: [{ path: args.path }] } : {},
      }
    },
    async execute(args, exec) {
      const request: PlotRequest = {
        series: args.series.map(asSeries),
        ...args.xMin !== undefined ? { xMin: args.xMin } : {},
        ...args.xMax !== undefined ? { xMax: args.xMax } : {},
        ...args.samples !== undefined ? { samples: args.samples } : {},
        ...args.title !== undefined ? { title: args.title } : {},
        ...args.xLabel !== undefined ? { xLabel: args.xLabel } : {},
        ...args.yLabel !== undefined ? { yLabel: args.yLabel } : {},
        ...args.path !== undefined ? { path: args.path } : {},
      }
      const built = buildPlot(request, config)
      const relative = args.path?.trim() || posix.join(config.outputDir, built.suggestedName)
      if (relative.length === 0) throw new Error('path must be a non-empty string')
      const cwd = exec.agent?.session.header.cwd
      const target = await ctx.fs.resolve(relative, {
        ...cwd !== undefined ? { cwd } : {},
        signal: exec.signal,
      })
      const intent = await ctx.waterfall('fs/write-intent', target, exec, () => undefined)
      // The sandboxed backend falls back to the deployment workspace root when
      // the per-call policy is omitted. Resolve against the calling session so
      // a workspace-write session can write its own .dsh-plots/.
      const sandbox = ctx.get('sandboxPolicy') as {
        resolve: (request?: { session?: object }) => object
      } | undefined
      const policy = sandbox?.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
      await ctx.fs.writeText(target, built.svg, intent, exec.signal, policy)
      svgByPath.set(target.displayPath, built.svg)
      return {
        ...built.value,
        path: target.displayPath,
      }
    },
  }))
}

/** Replayable SVG keyed by the written path; presentationMeta reads this after execute. */
const svgByPath = new Map<string, string>()
