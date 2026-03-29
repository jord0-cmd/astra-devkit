import {Command} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir, platform} from 'node:os'
import {execSync} from 'node:child_process'
import {checkbox, confirm} from '@inquirer/prompts'

const GEMINI_HOME = join(homedir(), '.gemini')
const isWin = platform() === 'win32'

function tryExec(cmd) {
  return execSync(cmd, {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']}).trim()
}

const MCP_CATALOG = [
  // office: true = on by default in office mode, false = off, null = hidden
  // DOCUMENTS — core for office users
  {key: 'pandoc', name: 'Pandoc', category: 'DOCUMENTS', desc: 'Markdown \u2192 any format (PDF, DOCX, HTML)', requires: 'uvx+pandoc', setup: 'Needs Python + uv + pandoc installed', office: true, config: {command: 'uvx', args: ['mcp-pandoc'], timeout: 15000}},
  {key: 'powerpoint', name: 'PowerPoint', category: 'DOCUMENTS', desc: 'Presentations (34 tools)', requires: 'uvx', setup: 'Needs Python + uv installed', office: true, config: {command: 'uvx', args: ['--from', 'office-powerpoint-mcp-server', 'ppt_mcp_server'], timeout: 15000}},
  {key: 'excel', name: 'Excel', category: 'DOCUMENTS', desc: 'Spreadsheets (25 tools, charts, pivots)', requires: 'uvx', setup: 'Needs Python + uv installed', office: true, config: {command: 'uvx', args: ['excel-mcp-server', 'stdio'], timeout: 15000}},
  {key: 'word-docs', name: 'Word', category: 'DOCUMENTS', desc: 'Rich documents', requires: 'uvx', setup: 'Needs Python + uv installed', office: true, config: {command: 'uvx', args: ['--from', 'office-word-mcp-server', 'word_mcp_server'], timeout: 15000}},
  // CODING — dev tools
  {key: 'context7', name: 'Context7', category: 'CODING', desc: 'Live docs for 9K+ libraries', requires: 'npx', setup: 'Ready to use \u2014 no setup needed', office: false, config: {command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'], timeout: 30000}},
  {key: 'playwright', name: 'Playwright', category: 'CODING', desc: 'Browser automation \u2014 web research and testing', requires: 'npx', setup: 'Ready to use \u2014 auto-installs its own browser', office: false, config: {command: 'npx', args: ['-y', '@playwright/mcp@latest'], timeout: 60000}},
  // IMAGES
  {key: 'gemini-image', name: 'Gemini Imagen', category: 'IMAGES', desc: 'AI image generation', requires: 'npx', setup: 'Needs a Gemini API key from aistudio.google.com/apikey \u2014 set GEMINI_API_KEY env var', office: false, config: {command: 'npx', args: ['-y', 'mcp-image'], env: {GEMINI_API_KEY: '$GEMINI_API_KEY', IMAGE_OUTPUT_DIR: './generated-images', IMAGE_QUALITY: 'balanced'}, timeout: 60000}},
  // DATABASES
  {key: 'database', name: 'Database Toolbox', category: 'DATABASES', desc: '20+ databases: PostgreSQL, MySQL, SQL Server, SQLite, MongoDB, Redis', requires: 'npx', setup: 'Needs database credentials \u2014 edit env vars in ~/.gemini/settings.json', office: false, config: {command: 'npx', args: ['-y', '@toolbox-sdk/server', '--prebuilt', 'postgres', '--stdio'], env: {POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_DATABASE: 'mydb', POSTGRES_USER: 'myuser', POSTGRES_PASSWORD: 'mypassword'}, timeout: 60000}},
  // DEVOPS
  {key: 'docker', name: 'Docker', category: 'DEVOPS', desc: 'Manage containers, images, networks, volumes (19 tools)', requires: 'uvx', setup: 'Needs Docker Desktop or Docker Engine running', office: false, config: {command: 'uvx', args: ['mcp-server-docker'], timeout: 30000}},
  // CLOUD
  {key: 'azure', name: 'Azure', category: 'CLOUD', desc: 'Full Azure tenant: Cosmos DB, SQL, Key Vault, AKS, Monitor (40+ services)', requires: 'npx', setup: 'Needs Azure CLI installed and authenticated \u2014 run: az login', office: false, config: {command: 'npx', args: ['-y', '@azure/mcp@latest', 'server', 'start'], timeout: 60000}},
]

export default class Mcps extends Command {
  static description = 'Enable/disable MCP servers'
  static summary = 'Interactive MCP server configuration with dependency detection'

  async run() {
    const settingsPath = join(GEMINI_HOME, 'settings.json')
    let settings = {}
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    }
    const currentMcps = settings.mcpServers || {}

    // Detect what's available
    const deps = this.#detectDeps()

    this.log('')
    this.log('  Dependency status:')
    this.log(`    npx:    ${deps.npx ? '\u2713 available' : '\u2717 missing'}`)
    this.log(`    Python: ${deps.python ? '\u2713 available' : '\u2717 missing'}`)
    this.log(`    uv:     ${deps.uv ? '\u2713 available' : '\u2717 missing'}`)
    this.log(`    pandoc: ${deps.pandoc ? '\u2713 available' : '\u2717 missing'}`)
    this.log('')

    // Offer to install missing deps before showing MCP selection
    if (!deps.uv || !deps.python) {
      await this.#offerInstallPythonUv(deps)
    }
    if (!deps.pandoc && deps.uv) {
      await this.#offerInstallPandoc()
    }

    // Re-detect after potential installs (detectDeps refreshes PATH on Windows)
    const freshDeps = this.#detectDeps()

    // Read user mode for smart defaults
    let userMode = 'code'
    const userFile = join(GEMINI_HOME, 'user.json')
    if (existsSync(userFile)) {
      try { userMode = JSON.parse(readFileSync(userFile, 'utf-8')).mode || 'code' } catch {}
    }
    const isFirstRun = Object.keys(currentMcps).length === 0 || !existsSync(userFile)

    // Build choices with availability markers and mode-aware defaults
    const choices = MCP_CATALOG.map(srv => {
      const available = this.#checkRequirements(srv.requires, freshDeps)
      const status = available ? '' : ' \u26a0 (missing deps)'

      // Smart default: first run uses mode defaults, subsequent runs use current config
      let checked
      if (isFirstRun || !(srv.key in currentMcps)) {
        // First run or MCP not yet configured — use mode defaults
        checked = userMode === 'office' ? (srv.office === true) : true
      } else {
        checked = srv.key in currentMcps
      }

      return {
        name: `${srv.name.padEnd(16)} \u2014 ${srv.desc} [${srv.category}]${status}`,
        value: srv.key,
        checked,
        disabled: available ? false : this.#getMissingMessage(srv.requires, freshDeps),
      }
    })

    const selected = await checkbox({
      message: 'Select MCP servers to enable',
      choices,
    })

    const newMcps = {}
    for (const key of selected) {
      const srv = MCP_CATALOG.find(s => s.key === key)
      if (srv) newMcps[key] = srv.config
    }

    settings.mcpServers = newMcps
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    this.log(`\n\u2713 ${selected.length} MCP servers enabled.\n`)

    // Show setup instructions for MCPs that need configuration
    const needsSetup = selected
      .map(key => MCP_CATALOG.find(s => s.key === key))
      .filter(srv => srv && srv.setup && !srv.setup.startsWith('Ready'))

    if (needsSetup.length > 0) {
      this.log('  Some MCPs need additional setup to work:\n')
      for (const srv of needsSetup) {
        this.log(`  ${srv.name}:`)
        this.log(`    ${srv.setup}\n`)
      }
    }

    // Post-install: Playwright needs its own Chromium browser
    if (selected.includes('playwright')) {
      await this.#ensurePlaywrightBrowser()
    }

    this.log('Restart Gemini CLI to apply.\n')
  }

  #detectDeps() {
    // On Windows, refresh PATH from registry before every detection
    // winget/installer installs update the registry but not the current process
    if (isWin) {
      try {
        const freshPath = tryExec('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'Machine\') + \';\' + [Environment]::GetEnvironmentVariable(\'Path\', \'User\')"')
        process.env.PATH = freshPath
      } catch {}
    }

    const deps = {npx: false, python: false, uv: false, pandoc: false}

    try { tryExec('npx --version'); deps.npx = true } catch {}

    const pyCmd = isWin ? 'python --version' : 'python3 --version'
    try { tryExec(pyCmd); deps.python = true } catch {}

    try { tryExec('uv --version'); deps.uv = true } catch {}

    // Pandoc: try command first, then check common Windows install locations
    try {
      tryExec('pandoc --version')
      deps.pandoc = true
    } catch {
      if (isWin) {
        const home = process.env.USERPROFILE || process.env.HOME || ''
        const pandocPaths = [
          join(home, 'AppData', 'Local', 'Pandoc', 'pandoc.exe'),
          'C:\\Program Files\\Pandoc\\pandoc.exe',
          'C:\\Program Files (x86)\\Pandoc\\pandoc.exe',
        ]
        for (const p of pandocPaths) {
          if (existsSync(p)) {
            // Add to PATH for this session so MCPs can find it too
            const dir = p.replace(/\\pandoc\.exe$/, '')
            process.env.PATH = `${dir};${process.env.PATH}`
            deps.pandoc = true
            break
          }
        }
      }
    }

    return deps
  }

  #checkRequirements(requires, deps) {
    if (requires === 'npx') return deps.npx
    if (requires === 'uvx') return deps.python && deps.uv
    if (requires === 'uvx+pandoc') return deps.python && deps.uv && deps.pandoc
    if (requires === 'npx+GEMINI_API_KEY') return deps.npx // Can't check env var at config time
    return true
  }

  #getMissingMessage(requires, deps) {
    const missing = []
    if (requires.includes('uvx') && !deps.python) missing.push('Python')
    if (requires.includes('uvx') && !deps.uv) missing.push('uv')
    if (requires.includes('pandoc') && !deps.pandoc) missing.push('pandoc')
    return missing.length > 0 ? `needs: ${missing.join(', ')}` : false
  }

  async #offerInstallPythonUv(deps) {
    if (!deps.python) {
      this.log('  Python is required for document MCPs (Pandoc, PowerPoint, Excel, Word).')
      if (isWin) {
        this.log('  Install: winget install Python.Python.3.12')
      } else {
        this.log('  Install: sudo apt install python3  (or: brew install python@3.12)')
      }

      const install = await confirm({
        message: 'Attempt to install Python now?',
        default: false,
      })

      if (install) {
        try {
          if (isWin) {
            execSync('winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements', {stdio: 'inherit'})
          } else {
            // Try apt first (Debian/Ubuntu), fall back to brew
            try {
              execSync('sudo apt install -y python3', {stdio: 'inherit'})
            } catch {
              try {
                execSync('brew install python@3.12', {stdio: 'inherit'})
              } catch {
                this.warn('Could not install Python automatically. Please install manually.')
              }
            }
          }
        } catch {
          this.warn('Python installation failed. Install manually and try again.')
        }
      }
      this.log('')
    }

    if (!deps.uv) {
      this.log('  uv is required to run Python-based MCP servers (uvx command).')

      const install = await confirm({
        message: 'Install uv now?',
        default: true,
      })

      if (install) {
        try {
          if (isWin) {
            execSync('powershell -c "irm https://astral.sh/uv/install.ps1 | iex"', {stdio: 'inherit'})
          } else {
            execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {stdio: 'inherit'})
          }
          this.log('\n  \u2713 uv installed.\n')
        } catch {
          this.warn('uv installation failed. Install manually: https://docs.astral.sh/uv/')
        }
      }
      this.log('')
    }
  }

  async #ensurePlaywrightBrowser() {
    // Check if Playwright's Chromium is already installed by looking for browser dir
    let hasChromium = false
    try {
      // Playwright stores browsers in ~/.cache/ms-playwright/ (Linux/macOS)
      // or %USERPROFILE%\AppData\Local\ms-playwright\ (Windows)
      const home = process.env.USERPROFILE || process.env.HOME || homedir()
      const playwrightDirs = isWin
        ? [join(home, 'AppData', 'Local', 'ms-playwright')]
        : [join(home, '.cache', 'ms-playwright')]

      for (const dir of playwrightDirs) {
        if (existsSync(dir)) {
          // Check for any chromium directory inside
          const {readdirSync} = await import('node:fs')
          const entries = readdirSync(dir).filter(e => e.startsWith('chromium'))
          if (entries.length > 0) {
            hasChromium = true
            break
          }
        }
      }
    } catch {
      // Can't check — assume not installed
    }

    if (hasChromium) {
      this.log('\n  \u2713 Playwright Chromium browser already installed.\n')
      return
    }

    this.log('')
    this.log('  Playwright requires its own Chromium browser to be installed.')
    this.log('  This is separate from Chrome/Edge on your system — it is a')
    this.log('  dedicated browser that Playwright controls for automation.')
    this.log('')

    const install = await confirm({
      message: 'Install Playwright Chromium browser now? (about 150MB download)',
      default: true,
    })

    if (install) {
      this.log('\n  Installing Playwright Chromium...\n')
      try {
        execSync('npx playwright install chromium', {stdio: 'inherit'})
        this.log('\n  \u2713 Playwright Chromium installed.\n')
      } catch {
        this.warn('Playwright Chromium installation failed.')
        this.warn('Install manually: npx playwright install chromium')
      }
    } else {
      this.log('')
      this.log('  Playwright MCP is enabled but won\'t work without its browser.')
      this.log('  Install later: npx playwright install chromium')
      this.log('')
    }
  }

  async #offerInstallPandoc() {
    this.log('  pandoc is required for the Pandoc MCP (document conversion, PDF generation).')

    const install = await confirm({
      message: 'Install pandoc now?',
      default: true,
    })

    if (install) {
      try {
        if (isWin) {
          execSync('winget install JohnMacFarlane.Pandoc --accept-package-agreements --accept-source-agreements', {stdio: 'inherit'})
        } else {
          try {
            execSync('sudo apt install -y pandoc', {stdio: 'inherit'})
          } catch {
            try {
              execSync('brew install pandoc', {stdio: 'inherit'})
            } catch {
              this.warn('Could not install pandoc automatically. Install from https://pandoc.org')
            }
          }
        }
        this.log('\n  \u2713 pandoc installed.\n')
      } catch {
        this.warn('pandoc installation failed. Install from https://pandoc.org')
      }
    }
    this.log('')
  }
}
