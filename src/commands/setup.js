import {Command, Flags, run} from '@oclif/core'
import {confirm, input, select} from '@inquirer/prompts'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir, platform} from 'node:os'
import {execSync} from 'node:child_process'
import {deployComponent, mergeSettings, ensureDir, assemblePersona} from '../../lib/file-ops.mjs'
import {configureUserNpmPrefix, npmGlobalStatus} from '../../lib/npm-prefix.mjs'

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

    // ── Step 0: Ensure HOME is set (Windows) ───
    if (isWin && !process.env.HOME) {
      const userProfile = process.env.USERPROFILE
      if (userProfile) {
        try {
          execSync(`powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('HOME', '${userProfile}', 'User')"`, {stdio: ['pipe', 'pipe', 'pipe']})
          process.env.HOME = userProfile
          this.log('  \u2713 Set HOME environment variable for cross-platform compatibility.\n')
        } catch {
          this.warn('Could not set HOME environment variable. Hooks may not work correctly.')
          this.log(`  Set it manually: [Environment]::SetEnvironmentVariable('HOME', $env:USERPROFILE, 'User')\n`)
        }
      }
    }

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

    // ── Mode selection (FIRST question after name) ──
    const mode = await select({
      message: 'How will you use Astra?',
      choices: [
        {name: 'Office Mode \u2014 documents, spreadsheets, research, presentations', value: 'office'},
        {name: 'Code Mode  \u2014 software engineering, debugging, architecture', value: 'code'},
      ],
    })

    let experience = 'beginner'
    let focus = 'everything'
    const baseWorkspace = join(homedir(), 'AstraProjects')

    if (mode === 'code') {
      // Code path — ask experience level
      experience = await select({
        message: 'How would you describe yourself?',
        choices: [
          {name: 'New to coding \u2014 I want to learn, explain everything', value: 'beginner'},
          {name: 'I know some coding \u2014 balanced guidance', value: 'intermediate'},
          {name: 'Experienced developer \u2014 keep it concise', value: 'senior'},
        ],
      })

      focus = await select({
        message: 'What will you mainly build?',
        choices: [
          {name: 'Fullstack \u2014 end-to-end applications', value: 'fullstack'},
          {name: 'Backend \u2014 APIs, services, CLI tools', value: 'backend'},
          {name: 'Frontend \u2014 React, Vue, web apps', value: 'frontend'},
          {name: 'Data \u2014 databases, analysis, pipelines, ML', value: 'data'},
          {name: 'Everything \u2014 all of the above', value: 'everything'},
        ],
      })
    } else {
      // Office path — skip experience level (always detailed)
      this.log('\n  Office Mode selected \u2014 Astra will be your digital assistant.')
      this.log('  No coding experience needed. She handles the technical side.\n')
      experience = 'beginner'
      focus = 'documents'
    }

    const explanationMap = {beginner: 'detailed', intermediate: 'balanced', senior: 'concise'}

    const userProfile = {
      name: name.trim(),
      mode,
      preferences: {
        experience,
        explanations: explanationMap[experience],
        focus,
        primary_language: 'en',
      },
      workspace: mode === 'office' ? join(baseWorkspace, 'Office') : baseWorkspace,
      created: new Date().toISOString(),
      devkit_version: this.config.version,
    }

    ensureDir(GEMINI_HOME)
    writeFileSync(join(GEMINI_HOME, 'user.json'), JSON.stringify(userProfile, null, 2) + '\n')
    this.log(`\n  \u2713 Profile saved for ${name.trim()} (${mode === 'office' ? 'Office' : 'Code'} Mode).\n`)

    // ── Step 5: Deploy components ──────────────
    this.log('Deploying Astra DevKit components...\n')
    for (const comp of ['skills', 'hooks', 'agents', 'standards', 'themes']) {
      const result = deployComponent(configDir, comp)
      if (result.error) {
        this.log(`  \u2717 ${result.component}: ${result.error}`)
      } else if (result.errors) {
        this.log(`  \u26a0 ${result.component}: ${result.deployed} deployed, ${result.errors.length} failed`)
        for (const err of result.errors) {
          this.log(`      ${err}`)
        }
      } else {
        this.log(`  \u2713 ${result.component}: ${result.deployed} items deployed`)
      }
    }
    mergeSettings(configDir)
    this.log('  \u2713 settings.json: merged')

    // ── Step 5b: Assemble persona for mode ──────
    const personaResult = assemblePersona(configDir, mode)
    if (personaResult.ok) {
      this.log(`  \u2713 Persona assembled: ${mode === 'office' ? 'Office' : 'Code'} Mode`)
    } else {
      this.log(`  \u26a0 Persona assembly: ${personaResult.error}`)
    }

    // ── Step 5c: Create workspace folder ──────
    const workspace = userProfile.workspace
    if (!existsSync(workspace)) {
      ensureDir(workspace)
    }
    this.log(`  \u2713 Workspace: ${workspace}\n`)

    // ── Step 6: MCP Configuration ──────────────
    if (mode === 'office') {
      this.log('Setting up your tools...\n')
      this.log('  Astra needs a few tools to create documents, spreadsheets,')
      this.log('  and presentations for you. These are being enabled now.\n')
      this.log('  You can change these anytime with: astra-devkit mcps\n')
    } else {
      this.log('Now let\'s configure your MCP servers.\n')
      this.log('  MCPs give Astra extra capabilities — document creation,')
      this.log('  image generation, live library docs, and browser automation.\n')
      this.log('  \u26a0  Tip: Only enable the MCPs you actually need.')
      this.log('  Each active MCP uses context tokens. Running all of them at')
      this.log('  once can slow things down. You can turn them on and off')
      this.log('  anytime with: astra-devkit mcps\n')
    }

    if (mode === 'office') {
      // Office mode — auto-enable doc MCPs, ask about optional ones
      this.log('  \u2713 Document tools enabled (Word, Excel, PowerPoint, PDF)\n')
      // Still run the MCP selector so they can customize
      const customizeMcps = await confirm({
        message: 'Customize which tools are enabled?',
        default: false,
      })
      if (customizeMcps) {
        await run(['mcps'], this.config)
      }
    } else {
      // Code mode — full MCP selector
      const configureMcps = await confirm({
        message: 'Configure MCP servers now?',
        default: true,
      })
      if (configureMcps) {
        await run(['mcps'], this.config)
      } else {
        this.log('\n  Skipped. Run \'astra-devkit mcps\' anytime to configure.\n')
      }
    }

    // ── Step 7: Summary ────────────────────────
    this.log(`\n  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557`)
    this.log(`  \u2551  Astra DevKit v${this.config.version} \u2014 Setup Complete!        \u2551`)
    this.log(`  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n`)
    this.log(`  Welcome aboard, ${name.trim()}.`)
    this.log(`  Run '${this.config.bin} doctor' to verify everything.`)
    this.log(`  Run '${this.config.bin} guide beginner' for the visual quick-start.\n`)

    // ── Step 8: Desktop shortcut (Windows only) ──
    if (isWin) {
      await this.#offerDesktopShortcut()
    }

    // ── Step 9: Launch ─────────────────────────
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
      this.log('\n  Ready when you are. Just type: astra-devkit\n')
    }
  }

  /**
   * Offer to create a desktop shortcut on Windows.
   * Uses Windows Terminal (wt) to launch gemini in a proper terminal window.
   */
  async #offerDesktopShortcut() {
    const createShortcut = await confirm({
      message: 'Create a desktop shortcut for Astra?',
      default: true,
    })

    if (!createShortcut) return

    // Copy icon to a permanent location
    const iconSrc = join(this.config.root, 'docs', 'images', 'astra-icon.ico')
    const iconDest = join(homedir(), '.gemini', 'astra-icon.ico')

    try {
      if (existsSync(iconSrc)) {
        const {copyFileSync: cpFile} = await import('node:fs')
        cpFile(iconSrc, iconDest)
        this.log(`  \u2713 Icon copied to ${iconDest}`)
      } else {
        this.log(`  \u26a0 Icon not found at ${iconSrc}`)
      }
    } catch (err) {
      this.log(`  \u26a0 Could not copy icon: ${err.message}`)
    }

    // Build PowerShell command to create a .lnk shortcut
    // Uses PowerShell 5.1 compatible syntax (no ?. or ?? operators)
    const desktopPath = join(homedir(), 'Desktop')
    const shortcutPath = join(desktopPath, 'Astra.lnk')

    // Read workspace from user.json
    let workspacePath = join(homedir(), 'AstraProjects')
    try {
      const ud = JSON.parse(readFileSync(join(GEMINI_HOME, 'user.json'), 'utf-8'))
      if (ud.workspace) workspacePath = ud.workspace
    } catch {}

    const ps = `
$ws = New-Object -ComObject WScript.Shell;
$sc = $ws.CreateShortcut('${shortcutPath.replace(/\\/g, '\\\\').replace(/'/g, "''")}');
$wtCmd = Get-Command wt -ErrorAction SilentlyContinue;
if ($wtCmd) { $sc.TargetPath = $wtCmd.Source; $sc.Arguments = 'cmd /k astra-devkit' }
else { $sc.TargetPath = 'cmd.exe'; $sc.Arguments = '/k astra-devkit' };
$sc.WorkingDirectory = '${workspacePath.replace(/\\/g, '\\\\').replace(/'/g, "''")}';
$iconFile = '${iconDest.replace(/\\/g, '\\\\').replace(/'/g, "''")}';
if (Test-Path $iconFile) { $sc.IconLocation = $iconFile };
$sc.Description = 'Astra DevKit - AI Engineering Partner';
$sc.Save();
$wkPath = '${workspacePath.replace(/'/g, "''")}';
if (!(Test-Path $wkPath)) { New-Item -ItemType Directory -Path $wkPath -Force | Out-Null };
$sc2 = $ws.CreateShortcut('${join(desktopPath, 'Astra Workspace.lnk').replace(/'/g, "''")}');
$sc2.TargetPath = $wkPath;
$sc2.Description = 'Astra workspace folder';
$sc2.Save()
`.trim().replace(/\n/g, ' ')

    try {
      execSync(`powershell -NoProfile -Command "${ps}"`, {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']})
      this.log(`  \u2713 Desktop shortcuts created!`)
      this.log(`    "Astra" \u2014 launches Astra DevKit`)
      this.log(`    "Astra Workspace" \u2014 opens your project folder\n`)
    } catch (err) {
      const stderr = err.stderr || err.message || 'unknown error'
      this.warn(`Could not create desktop shortcut: ${stderr.trim()}`)
      this.log('  You can create one manually: right-click Desktop \u2192 New \u2192 Shortcut')
      this.log('  Target: wt -p "Command Prompt" cmd /k gemini')
      this.log(`  Icon: ${iconDest}\n`)
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
        await this.#installGeminiCli()
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
        await this.#installGeminiCli()
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
        await this.#installGeminiCli()
      }
    }
  }

  /**
   * Install or upgrade Gemini CLI via npm. Pre-flights the npm global
   * prefix: if it isn't writable by the current user (the common case
   * on Debian/Ubuntu where system node points at /usr/local), prompt
   * with three options before attempting the install.
   */
  async #installGeminiCli() {
    const pkg = `${GEMINI_NPM_PACKAGE}@${GEMINI_INSTALL_TAG}`

    // Windows manages global installs per-user by default; skip the check.
    if (!isWin) {
      const status = npmGlobalStatus()
      if (status.prefix && !status.writable) {
        this.log('')
        this.log(`  \u26a0  npm global prefix (${status.prefix}) isn't writable by this user.`)
        this.log('     This is common when node was installed system-wide (apt/brew).')
        this.log('')

        const choice = await select({
          message: 'How would you like to proceed?',
          default: 'user-prefix',
          choices: [
            {
              name: 'Configure user-local prefix (~/.npm-global) — recommended, no sudo',
              value: 'user-prefix',
              description: 'Writes ~/.npmrc and appends a PATH line to your shell rc.',
            },
            {
              name: 'Use sudo for this one install',
              value: 'sudo',
              description: 'Runs `sudo npm install -g ...` — you will be prompted for your password.',
            },
            {
              name: 'Skip — I\'ll install Gemini CLI manually',
              value: 'skip',
            },
          ],
        })

        if (choice === 'user-prefix') {
          try {
            const {prefix, prefixBin, rcPath} = configureUserNpmPrefix()
            this.log(`  \u2713 Set npm prefix to ${prefix}`)
            this.log(`  \u2713 Added ${prefixBin} to PATH in ${rcPath}`)
            this.log('    (already active for this install; new shells will pick it up automatically)\n')
          } catch (err) {
            this.warn(`Could not configure user-local prefix: ${err.message}`)
            this.warn(`Install manually: npm install -g ${pkg}`)
            return
          }
        } else if (choice === 'sudo') {
          this.log(`\n  Installing ${pkg} with sudo...\n`)
          try {
            execSync(`sudo npm install -g ${pkg}`, {stdio: 'inherit'})
            const newVersion = tryExec('gemini --version')
            this.log(`\n  \u2713 Gemini CLI ${newVersion} installed.\n`)
          } catch {
            this.warn('sudo install failed.')
            this.warn(`Install manually: sudo npm install -g ${pkg}`)
          }
          return
        } else {
          this.warn(`Install manually when ready: npm install -g ${pkg}`)
          return
        }
      }
    }

    this.log(`\n  Installing ${pkg}...\n`)
    try {
      execSync(`npm install -g ${pkg}`, {stdio: 'inherit'})
      const newVersion = tryExec('gemini --version')
      this.log(`\n  \u2713 Gemini CLI ${newVersion} installed.\n`)
    } catch {
      this.warn('Failed to install Gemini CLI automatically.')
      this.warn(`Install manually: npm install -g ${pkg}`)
    }
  }
}
