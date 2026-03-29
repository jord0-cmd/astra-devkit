import {Command, Args, run} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {confirm} from '@inquirer/prompts'
import {assemblePersona} from '../../lib/file-ops.mjs'

const GEMINI_HOME = join(homedir(), '.gemini')

export default class Mode extends Command {
  static description = 'Switch between Code Mode and Office Mode'
  static summary = 'Change how Astra works — developer or office assistant'

  static args = {
    mode: Args.string({
      description: 'Which mode to switch to',
      required: false,
      options: ['code', 'office'],
    }),
  }

  static examples = [
    '<%= config.bin %> mode',
    '<%= config.bin %> mode office',
    '<%= config.bin %> mode code',
  ]

  async run() {
    const {args} = await this.parse(Mode)
    const userFile = join(GEMINI_HOME, 'user.json')

    // Show current mode if no argument
    if (!args.mode) {
      if (existsSync(userFile)) {
        const userData = JSON.parse(readFileSync(userFile, 'utf-8'))
        const current = userData.mode || 'code'
        this.log(`\n  Current mode: ${current === 'office' ? 'Office Mode' : 'Code Mode'}`)
        this.log(`  Switch with: ${this.config.bin} mode ${current === 'office' ? 'code' : 'office'}\n`)
      } else {
        this.log('\n  No profile found. Run setup first: astra-devkit setup\n')
      }
      return
    }

    if (!existsSync(userFile)) {
      this.error('No profile found. Run setup first: astra-devkit setup')
    }

    const userData = JSON.parse(readFileSync(userFile, 'utf-8'))
    const currentMode = userData.mode || 'code'

    if (currentMode === args.mode) {
      this.log(`\n  Already in ${args.mode === 'office' ? 'Office' : 'Code'} Mode.\n`)
      return
    }

    // Update mode in user.json
    userData.mode = args.mode

    // Update workspace
    const baseWorkspace = join(homedir(), 'AstraProjects')
    userData.workspace = args.mode === 'office' ? join(baseWorkspace, 'Office') : baseWorkspace

    // Update explanation depth
    if (args.mode === 'office') {
      userData.preferences = userData.preferences || {}
      userData.preferences.explanations = 'detailed'
    }

    writeFileSync(userFile, JSON.stringify(userData, null, 2) + '\n')

    // Assemble persona from base + overlay
    const result = assemblePersona(this.config.root, args.mode)

    if (!result.ok) {
      this.warn(`Could not assemble persona: ${result.error}`)
      this.warn('Mode updated in user.json but GEMINI.md was not changed.')
    } else {
      this.log('')
      if (args.mode === 'office') {
        this.log('  Switched to Office Mode.')
        this.log('  Astra is now your digital assistant — documents, research,')
        this.log('  data analysis, presentations, and productivity.')
        this.log('  Developer hooks are disabled. Focus is on results, not code.')
      } else {
        this.log('  Switched to Code Mode.')
        this.log('  Astra is your senior dev colleague — architecture, testing,')
        this.log('  quality gates, and engineering best practices.')
        this.log('  All hooks and developer tools are active.')
      }
      this.log('')

      // If switching TO code mode for the first time, offer MCP configuration
      if (args.mode === 'code' && currentMode === 'office') {
        this.log('  Code Mode has additional tools available (databases, Docker, Azure).')
        const configureMcps = await confirm({
          message: 'Configure MCP servers for Code Mode?',
          default: true,
        })
        if (configureMcps) {
          await run(['mcps'], this.config)
        }
      }

      this.log('  Restart Gemini CLI to apply the change.\n')
    }
  }
}
