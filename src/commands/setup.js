import {Command, Flags, run} from '@oclif/core'
import {confirm, input, select} from '@inquirer/prompts'
import {existsSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir, platform} from 'node:os'
import {execSync} from 'node:child_process'
import {deployComponent, mergeSettings, ensureDir} from '../../lib/file-ops.mjs'

const GEMINI_HOME = join(homedir(), '.gemini')
const isWin = platform() === 'win32'
const REQUIRED_GEMINI_VERSION = '0.36.0'
const GEMINI_NPM_PACKAGE = '@google/gemini-cli'
const GEMINI_INSTALL_TAG = 'preview'

function tryExec(cmd) {
  return execSync(cmd, {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']}).trim()
}

/**
 * Compare semver strings (ignoring prerelease tags for min version check).
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
function compareSemver(a, b) {
  const pa = a.replace(/-.*$/, '').split('.').map(Number)
  const pb = b.replace(/-.*$/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
  }
  return 0
}

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
    '<%= config.bin %> setup --force',
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

    // ── Step 1: Prerequisites ──────────────────
    this.log('Checking prerequisites...\n')

    // Node.js
    const nodeMajor = parseInt(process.version.slice(1))
    this.log(`  ${nodeMajor >= 20 ? '\u2713' : '\u2717'} Node.js: ${process.version}`)
    if (nodeMajor < 20) {
      this.error('Node.js 20+ is required. Install from https://nodejs.org', {exit: 1})
    }

    // ── Step 2: Gemini CLI check ───────────────
    await this.#ensureGeminiCli()

    // Python + uv (optional, for document MCPs)
    const pyCmd = isWin ? 'python --version' : 'python3 --version'
    try {
      const pyVer = tryExec(pyCmd)
      try {
        tryExec('uv --version')
        this.log(`  \u2713 ${pyVer} + uv installed`)
      } catch {
        this.log(`  \u26a0 ${pyVer} found, but uv missing (needed for document MCPs)`)
        this.log('    Install: curl -LsSf https://astral.sh/uv/install.sh | sh')
      }
    } catch {
      this.log('  \u26a0 Python not found (optional \u2014 needed for document MCPs)')
    }

    // ── Step 3: Existing config warning ────────
    const settingsPath = join(GEMINI_HOME, 'settings.json')
    const geminiMdPath = join(GEMINI_HOME, 'GEMINI.md')
    const hasExisting = existsSync(settingsPath) || existsSync(geminiMdPath)

    if (hasExisting && !flags.force) {
      this.log('')
      this.log('  Existing Gemini CLI configuration found — that\'s fine!')
      this.log('  Your authentication and personal settings will be preserved.')
      this.log('  Astra will add skills, hooks, agents, and themes alongside')
      this.log('  your existing setup.\n')

      const proceed = await confirm({
        message: 'Continue with setup?',
        default: true,
      })

      if (!proceed) {
        this.log('\nSetup cancelled.\n')
        return
      }
    }

    // ── Step 4: User profile ───────────────────
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

    // ── Step 5: Deploy components ──────────────
    this.log('Deploying Astra DevKit components...\n')
    for (const comp of ['skills', 'hooks', 'agents', 'standards', 'themes']) {
      const result = deployComponent(configDir, comp)
      this.log(`  \u2713 ${result.component}: ${result.deployed} items deployed`)
    }
    mergeSettings(configDir)
    this.log('  \u2713 settings.json: merged\n')

    // ── Step 6: MCP Configuration ──────────────
    this.log('Now let\'s configure your MCP servers.\n')
    this.log('  MCPs give Astra extra capabilities — document creation,')
    this.log('  image generation, live library docs, and browser automation.')
    this.log('  You can change these anytime with: astra-devkit mcps\n')

    const configureMcps = await confirm({
      message: 'Configure MCP servers now?',
      default: true,
    })

    if (configureMcps) {
      await run(['mcps'], this.config)
    } else {
      this.log('\n  Skipped. Run \'astra-devkit mcps\' anytime to configure.\n')
    }

    // ── Step 7: Summary ────────────────────────
    this.log(`\n  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557`)
    this.log(`  \u2551  Astra DevKit v${this.config.version} \u2014 Setup Complete!        \u2551`)
    this.log(`  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n`)
    this.log(`  Welcome aboard, ${name.trim()}.`)
    this.log(`  Run '${this.config.bin} doctor' to verify everything.`)
    this.log(`  Run '${this.config.bin} guide beginner' for the visual quick-start.\n`)

    const launchNow = await confirm({
      message: 'Launch Astra now?',
      default: true,
    })

    if (launchNow) {
      this.log('\n  Starting Gemini CLI with Astra...\n')
      try {
        execSync('gemini', {stdio: 'inherit'})
      } catch {
        // Normal exit (Ctrl+C) throws — that's fine
      }
    } else {
      this.log('\n  Ready when you are. Just type: gemini\n')
    }
  }

  /**
   * Check Gemini CLI: detect, version-check, install or upgrade.
   */
  async #ensureGeminiCli() {
    let installedVersion = null

    // Detect current installation
    try {
      installedVersion = tryExec('gemini --version')
      this.log(`  \u2713 Gemini CLI: ${installedVersion}`)
    } catch {
      this.log('  \u2717 Gemini CLI: not installed')
    }

    // Check latest available version from npm
    let latestVersion = null
    try {
      latestVersion = tryExec(`npm view ${GEMINI_NPM_PACKAGE}@${GEMINI_INSTALL_TAG} version`)
    } catch {
      // Can't reach npm registry — skip version check
    }

    // Case 1: Not installed at all
    if (!installedVersion) {
      this.log('')
      this.log('  Gemini CLI is required for Astra DevKit to work.')
      this.log(`  The DevKit requires Gemini CLI ${REQUIRED_GEMINI_VERSION}+ (preview channel)`)
      this.log(`  for agents, skills, and hooks support.\n`)

      const install = await confirm({
        message: `Install Gemini CLI${latestVersion ? ` (${latestVersion})` : ''}?`,
        default: true,
      })

      if (install) {
        this.#installGeminiCli()
      } else {
        this.warn('Gemini CLI is required. Install manually: npm install -g @google/gemini-cli@preview')
        this.warn('Then run this setup again.\n')
        this.exit(1)
      }
      return
    }

    // Case 2: Installed but below minimum version
    if (compareSemver(installedVersion, REQUIRED_GEMINI_VERSION) < 0) {
      this.log('')
      this.log(`  \u26a0  Gemini CLI ${installedVersion} is below the minimum required version (${REQUIRED_GEMINI_VERSION}).`)
      this.log('  Agents, skills, and hooks require the preview channel.\n')

      const upgrade = await confirm({
        message: `Upgrade to Gemini CLI ${latestVersion || GEMINI_INSTALL_TAG}?`,
        default: true,
      })

      if (upgrade) {
        this.#installGeminiCli()
      } else {
        this.warn('Some features may not work with an older Gemini CLI version.')
      }
      return
    }

    // Case 3: Installed and meets minimum, but newer version available
    if (latestVersion && compareSemver(installedVersion, latestVersion) < 0) {
      this.log(`    Latest available: ${latestVersion}`)

      const upgrade = await confirm({
        message: `Update Gemini CLI to ${latestVersion}?`,
        default: false,
      })

      if (upgrade) {
        this.#installGeminiCli()
      }
    }
  }

  /**
   * Install or upgrade Gemini CLI via npm.
   */
  #installGeminiCli() {
    this.log(`\n  Installing ${GEMINI_NPM_PACKAGE}@${GEMINI_INSTALL_TAG}...\n`)
    try {
      execSync(`npm install -g ${GEMINI_NPM_PACKAGE}@${GEMINI_INSTALL_TAG}`, {stdio: 'inherit'})
      const newVersion = tryExec('gemini --version')
      this.log(`\n  \u2713 Gemini CLI ${newVersion} installed.\n`)
    } catch {
      this.warn('Failed to install Gemini CLI automatically.')
      this.warn(`Install manually: npm install -g ${GEMINI_NPM_PACKAGE}@${GEMINI_INSTALL_TAG}`)
    }
  }
}
