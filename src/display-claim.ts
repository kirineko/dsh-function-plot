/** One figure per path inside a single `run_code` parent. Native calls do not share a parent. */

const claimed = new WeakMap<WeakKey, Set<string>>()

/**
 * Reserve a workspace path for one Web card under a Code Mode parent.
 * @param parent - the outer `run_code` token; omit for a native top-level call.
 * @param path - workspace display path.
 * @returns false when this parent already showed that path.
 */
export function claimDisplay(parent: WeakKey | undefined, path: string): boolean {
  if (parent === undefined || path === '') return true
  let paths = claimed.get(parent)
  if (paths === undefined) {
    paths = new Set()
    claimed.set(parent, paths)
  }
  if (paths.has(path)) return false
  paths.add(path)
  return true
}
