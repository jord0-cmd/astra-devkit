import {Command} from '@oclif/core'
import {execSync} from 'node:child_process'
import {confirm} from '@inquirer/prompts'

const INTERNAL_REPO = 'github:jord0-cmd/astra-devkit-internal'

export default class Extend extends Command {
  static description = 'Install the internal skill pack'
  static summary = 'Add team-specific skills from the private repository (requires GitHub access)'

  static examples = [
    '<%= config.bin %> extend',
  ]

  async run() {
    this.log('')
    this.log('  Astra DevKit — Internal Skill Pack')
    this.log('')
    this.log('  This installs additional team-specific skills from a private')
    this.log('  GitHub repository. You need GitHub access to the repo.')
    this.log('')

    // Check if already installed
    try {
      const result = execSync('npm list -g astra-devkit-internal', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      if (result.includes('astra-devkit-internal')) {
        this.log('  Internal skill pack is already installed.')
        const update = await confirm({
          message: 'Update to latest version?',
          default: true,
        })
        if (!update) {
          this.log('\nNo changes made.\n')
          return
        }
      }
    } catch {
      // Not installed — continue with fresh install
    }

    const proceed = await confirm({
      message: 'Install internal skill pack? (requires GitHub access)',
      default: true,
    })

    if (!proceed) {
      this.log('\nCancelled.\n')
      return
    }

    this.log(`\n  Installing from ${INTERNAL_REPO}...\n`)

    try {
      execSync(`npm install -g ${INTERNAL_REPO}`, {stdio: 'inherit'})
      this.log('\n  \u2713 Internal skill pack installed.\n')
      this.log('  Run \'astra-devkit doctor\' to verify.')
      this.log('  Restart Gemini CLI to activate new skills.\n')
    } catch {
      this.log('')
      this.warn('Installation failed. This usually means one of:')
      this.log('  1. You don\'t have access to the private repository')
      this.log('  2. Your GitHub credentials aren\'t configured for npm')
      this.log('')
      this.log('  Ask your team lead for access to:')
      this.log('  https://github.com/jord0-cmd/astra-devkit-internal')
      this.log('')
    }
  }
}
