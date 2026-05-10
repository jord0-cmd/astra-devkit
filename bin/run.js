#!/usr/bin/env node

import {execute} from '@oclif/core'
import {existsSync, readFileSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {execSync} from 'node:child_process'

const args = process.argv.slice(2)

// If no command given (just `astra-devkit` with no args), launch Gemini
if (args.length === 0) {
  const GEMINI_HOME = join(homedir(), '.gemini')
  const hasSetup = existsSync(join(GEMINI_HOME, 'user.json'))
  const hasSkills = existsSync(join(GEMINI_HOME, 'skills'))

  if (!hasSetup || !hasSkills) {
    // First time — run setup via oclif
    console.log('\n  First time? Let\'s get you set up.\n')
    await execute({dir: import.meta.url, args: ['setup']})
  } else {
    // Already set up — launch Gemini in the CURRENT directory.
    // (v4.0.5: removed forced chdir to ~/AstraProjects — astra-devkit no longer
    // imposes a working directory; Astra runs from wherever the user is.)
    let mode = 'code'
    try {
      const userData = JSON.parse(readFileSync(join(GEMINI_HOME, 'user.json'), 'utf-8'))
      if (userData.mode) mode = userData.mode
    } catch {}

    const workspace = process.cwd()
    const modeLabel = mode === 'office' ? 'Office Mode' : 'Code Mode'

    // Check for internal pack
    const hasInternal = existsSync(join(homedir(), '.gemini', 'skills', 'card-builder'))
    const versionLine = hasInternal
      ? '  \u2551       DevKit v4.0 IOPs                    \u2551'
      : '  \u2551            DevKit v4.0                        \u2551'

    console.log('')
    console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557')
    console.log('  \u2551    \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2557   \u2551')
    console.log('  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557  \u2551')
    console.log('  \u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551  \u2551')
    console.log('  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u255a\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551  \u2551')
    console.log('  \u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551  \u2551')
    console.log('  \u2551   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d  \u2551')
    console.log(versionLine)
    console.log('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d')
    console.log(`  ${modeLabel} \u00b7 ${workspace}`)
    console.log('')
    try {
      execSync('gemini', {stdio: 'inherit'})   // inherits current cwd, no override
    } catch {
      // Normal exit from Gemini (Ctrl+C) throws — that's fine
    }
  }
} else {
  // Has a command — let oclif handle it normally
  await execute({dir: import.meta.url})
}
