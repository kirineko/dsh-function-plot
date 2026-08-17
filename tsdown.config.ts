import { defineConfig } from 'tsdown'

/** Self-contained Host build: transpile src/ with no project references. */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: false,
  clean: true,
  fixedExtension: false,
  external: [/^@deepseek-ai\//, /^node:/],
})
