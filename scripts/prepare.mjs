#!/usr/bin/env node
/**
 * Build lib/ when missing (git installs). A packed tarball already contains
 * lib/index.js, so consumers skip the compiler and do not need allowBuilds.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, 'lib', 'index.js'))) process.exit(0)

const result = spawnSync('pnpm', ['exec', 'tsdown'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
