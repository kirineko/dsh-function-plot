/** Model-facing show_svg tool: display an existing workspace SVG on the Web card. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import { claimDisplay } from './display-claim.ts'
import { assertSvgBudget, encodeUiPayload, looksLikeSvg } from './ui-payload.ts'
import type { UiSvgPayload } from './ui-payload.ts'

const metaByPath = new Map<string, UiSvgPayload>()

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * Register show_svg.
 * @param ctx - plugin context; execute uses tools + fs.
 */
export function registerShowSvgTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'show_svg',
    description: [
      'Show an existing workspace SVG on this tool\'s own Web card, including under run_code.',
      'Use this only for a file that plot_function did not just write in this same program.',
      'Do not call this after plot_function. Do not call read_image.',
    ].join(' '),
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace path to an .svg file.' },
      title: { type: 'string', description: 'Card title. Defaults to the file name.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', required: true },
          path: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `title: ${value.title}\nfile: ${value.path}\nbytes: ${String(value.bytes)}`,
      }],
      presentationMeta: (_args, value) => metaByPath.get(value.path) ?? {
        v: 1,
        kind: 'svg',
        title: value.title,
        path: value.path,
        svg: '',
      },
    },
    presentCall(args): GenericCallView {
      return {
        card: 'generic',
        title: args.title?.trim() || 'SVG',
        locations: [{ path: args.path }],
      }
    },
    finalizeContent(exec, result) {
      if (exec.parent === undefined || result.isError) return undefined
      const row = asRecord(result.value)
      const path = typeof row?.path === 'string' ? row.path : ''
      const payload = metaByPath.get(path)
      if (payload === undefined) return undefined
      return [...result.content, { type: 'text', text: encodeUiPayload(payload) }]
    },
    async execute(args, exec) {
      const relative = args.path.trim()
      if (relative.length === 0) throw new Error('path must be a non-empty string')
      const cwd = exec.agent?.session.header.cwd
      const opts = {
        ...cwd !== undefined ? { cwd } : {},
        signal: exec.signal,
      }
      const target = await ctx.fs.resolve(relative, opts)
      const text = assertSvgBudget(await ctx.fs.readText(target, exec.signal))
      if (!looksLikeSvg(text)) throw new Error(`not an SVG file: ${target.displayPath}`)
      const title = args.title?.trim() || target.displayPath.split('/').pop() || 'SVG'
      const payload: UiSvgPayload = {
        v: 1,
        kind: 'svg',
        title,
        path: target.displayPath,
        svg: text,
      }
      if (claimDisplay(exec.parent, target.displayPath)) metaByPath.set(target.displayPath, payload)
      return { title, path: target.displayPath, bytes: text.length }
    },
  }))
}
