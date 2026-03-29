import {Command, Flags} from '@oclif/core'
import {input, select} from '@inquirer/prompts'
import {existsSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {execSync} from 'node:child_process'
import {deployComponent, mergeSettings, ensureDir} from '../../lib/file-ops.mjs'

const GEMINI_HOME = join(homedir(), '.gemini')

const BANNER = `
  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
  \u2551    \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2557   \u2551
  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557  \u2551
  \u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551  \u2551
  \u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u255a\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551  \u2551
  \u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551  \u2551
  \u2551   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d  \u2551
  \u2551            DevKit v4.0                        \u2551
  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d
`

export default class Setup extends Command {
  static description = 'Interactive first-time setup'
  static summary = 'Configure Astra DevKit for first use'

  static examples = [
    '<%= config.bin %> setup',
  ]

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing configuration',
      default: false,
    }),
  }

  async run() {
    const {flags} = await this.parse(Setup)
    const configDir = this.config.root

    this.log(BANNER)
    this.log('  AI Engineering Partner \u2014 First-Time Setup\n')

    // Check prerequisites
    this.log('Checking prerequisites...\n')
    this.#checkPrereqs()

    // User profile
    this.log('\nLet\'s set up your profile.\n')

    const name = await input({message: 'What\'s your name?'})

    const experience = await select({
      message: 'Experience level?',
      choices: [
        {name: 'Beginner \u2014 detailed explanations', value: 'beginner'},
        {name: 'Intermediate \u2014 balanced guidance', value: 'intermediate'},
        {name: 'Senior \u2014 concise, direct', value: 'senior'},
      ],
    })

    const focus = await select({
      message: 'What do you mainly build?',
      choices: [
        {name: 'Backend (APIs, services, CLI tools)', value: 'backend'},
        {name: 'Frontend (React, Vue, web apps)', value: 'frontend'},
        {name: 'Fullstack (end-to-end applications)', value: 'fullstack'},
        {name: 'Data (pipelines, analysis, ML)', value: 'data'},
        {name: 'Libraries (packages, SDKs, tools)', value: 'library'},
      ],
    })

    const explanationMap = {beginner: 'detailed', intermediate: 'balanced', senior: 'concise'}

    const userProfile = {
      name: name.trim(),
      preferences: {
        experience,
        explanations: explanationMap[experience],
        focus,
        primary_language: 'en',
      },
      created: new Date().toISOString(),
      devkit_version: this.config.version,
    }

    ensureDir(GEMINI_HOME)
    writeFileSync(join(GEMINI_HOME, 'user.json'), JSON.stringify(userProfile, null, 2) + '\n')
    this.log(`\n  \u2713 Profile saved for ${name.trim()}.\n`)

    // Deploy components
    this.log('Deploying Astra DevKit components...\n')
    for (const comp of ['skills', 'hooks', 'agents', 'standards', 'themes']) {
      const result = deployComponent(configDir, comp)
      this.log(`  \u2713 ${result.component}: ${result.deployed} items deployed`)
    }
    mergeSettings(configDir)
    this.log('  \u2713 settings.json: merged\n')

    // Summary
    this.log(`\n  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557`)
    this.log(`  \u2551  Astra DevKit v${this.config.version} \u2014 Setup Complete!        \u2551`)
    this.log(`  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n`)
    this.log(`  Welcome aboard, ${name.trim()}.`)
    this.log(`  Run 'gemini' to start your first session.`)
    this.log(`  Run '${this.config.bin} doctor' to verify everything.\n`)
  }

  #checkPrereqs() {
    const major = parseInt(process.version.slice(1))
    this.log(`  ${major >= 20 ? '\u2713' : '\u2717'} Node.js: ${process.version}`)

    try {
      execSync('gemini --version', {stdio: ['pipe', 'pipe', 'pipe']})
      this.log('  \u2713 Gemini CLI: installed')
    } catch {
      this.log('  \u2717 Gemini CLI: not found \u2014 run: npm install -g @google/gemini-cli')
    }
  }
}
