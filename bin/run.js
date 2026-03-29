#!/usr/bin/env node

import {execute} from '@oclif/core'
import {existsSync} from 'node:fs'
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
    // Already set up — launch Gemini directly
    console.log('  Starting Gemini CLI with Astra...\n')
    try {
      execSync('gemini', {stdio: 'inherit'})
    } catch {
      // Normal exit from Gemini (Ctrl+C) throws — that's fine
    }
  }
} else {
  // Has a command — let oclif handle it normally
  await execute({dir: import.meta.url})
}
