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
    // Already set up — launch Gemini in the workspace folder
    let workspace = join(homedir(), 'AstraProjects')

    // Read user config for mode and workspace
    let mode = 'code'
    try {
      const userData = JSON.parse(readFileSync(join(GEMINI_HOME, 'user.json'), 'utf-8'))
      if (userData.workspace) workspace = userData.workspace
      if (userData.mode) mode = userData.mode
    } catch {}

    // Ensure workspace exists
    if (!existsSync(workspace)) {
      mkdirSync(workspace, {recursive: true})
    }

    // Change to workspace before launching Gemini
    process.chdir(workspace)
    const modeLabel = mode === 'office' ? 'Office Mode' : 'Code Mode'
    console.log(`  ${modeLabel} | Workspace: ${workspace}`)
    console.log('  Starting Gemini CLI with Astra...\n')
    try {
      execSync('gemini', {stdio: 'inherit', cwd: workspace})
    } catch {
      // Normal exit from Gemini (Ctrl+C) throws — that's fine
    }
  }
} else {
  // Has a command — let oclif handle it normally
  await execute({dir: import.meta.url})
}
