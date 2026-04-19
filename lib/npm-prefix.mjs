/**
 * npm global-prefix helpers.
 *
 * Shared between the oclif `setup` command and the standalone bash-style
 * installer. The problem these solve: on Linux/macOS, system node (apt,
 * some brew configs) points npm's global prefix at /usr/local, which is
 * root-owned — any non-sudo `npm install -g` then fails with EACCES.
 *
 * `configureUserNpmPrefix()` is the canonical fix: put globals under
 * ~/.npm-global, owned by the user, and add ~/.npm-global/bin to PATH
 * via the user's shell rc.
 */

import {accessSync, appendFileSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {homedir, platform} from 'node:os'
import {execSync} from 'node:child_process'

/**
 * Inspect npm's current global prefix and whether the current user can
 * write to its `lib/node_modules` subdirectory.
 *
 * @returns {{prefix: string|null, writable: boolean}}
 */
export function npmGlobalStatus() {
  let prefix = null
  try {
    prefix = execSync('npm config get prefix', {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']}).trim()
  } catch {
    return {prefix: null, writable: false}
  }
  const libDir = join(prefix, 'lib', 'node_modules')
  let target = libDir
  while (target && !existsSync(target)) {
    const parent = dirname(target)
    if (!parent || parent === target) break
    target = parent
  }
  try {
    accessSync(target, constants.W_OK)
    return {prefix, writable: true}
  } catch {
    return {prefix, writable: false}
  }
}

/**
 * Pick the shell rc file to extend PATH. Honours $SHELL.
 * Returns flavour so callers can format the export line correctly.
 *
 * @returns {{path: string, flavor: 'posix'|'fish'}}
 */
export function detectShellRc() {
  const shell = process.env.SHELL || ''
  const home = homedir()
  if (shell.includes('zsh')) return {path: join(home, '.zshrc'), flavor: 'posix'}
  if (shell.includes('fish')) return {path: join(home, '.config', 'fish', 'config.fish'), flavor: 'fish'}
  return {path: join(home, '.bashrc'), flavor: 'posix'}
}

/**
 * Configure ~/.npmrc to point at a user-owned prefix (~/.npm-global),
 * idempotently append the corresponding PATH export to the user's shell
 * rc, and update the current process's PATH so the subsequent install
 * succeeds without requiring a shell restart.
 *
 * @returns {{prefix: string, prefixBin: string, rcPath: string}}
 */
export function configureUserNpmPrefix() {
  const home = homedir()
  const prefix = join(home, '.npm-global')
  const prefixBin = join(prefix, 'bin')
  mkdirSync(prefixBin, {recursive: true})

  // Write user-level ~/.npmrc — preserve any unrelated settings.
  const userNpmrc = join(home, '.npmrc')
  let existing = ''
  if (existsSync(userNpmrc)) existing = readFileSync(userNpmrc, 'utf-8')
  const prefixLine = `prefix=${prefix}`
  if (!existing.split('\n').some((l) => l.trim() === prefixLine)) {
    const cleaned = existing
      .split('\n')
      .filter((l) => !/^\s*prefix\s*=/.test(l))
      .join('\n')
    const sep = cleaned && !cleaned.endsWith('\n') ? '\n' : ''
    writeFileSync(userNpmrc, `${cleaned}${sep}${prefixLine}\n`)
  }

  // Update the shell rc — idempotent via marker comment.
  const {path: rcPath, flavor} = detectShellRc()
  const marker = '# Added by astra-devkit setup — npm user-local globals'
  const exportLine =
    flavor === 'fish'
      ? `set -gx PATH ${prefixBin} $PATH`
      : `export PATH="${prefixBin}:$PATH"`
  let rcExisting = ''
  if (existsSync(rcPath)) rcExisting = readFileSync(rcPath, 'utf-8')
  if (!rcExisting.includes(marker)) {
    mkdirSync(dirname(rcPath), {recursive: true})
    appendFileSync(rcPath, `\n${marker}\n${exportLine}\n`)
  }

  // Propagate to the current process so subsequent installs work now.
  const sep = platform() === 'win32' ? ';' : ':'
  process.env.PATH = `${prefixBin}${sep}${process.env.PATH || ''}`

  return {prefix, prefixBin, rcPath}
}
