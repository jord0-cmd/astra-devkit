import {Command} from '@oclif/core'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {homedir, platform} from 'node:os'
import {execSync} from 'node:child_process'

const GEMINI_HOME = join(homedir(), '.gemini')
const isWin = platform() === 'win32'

function tryExec(cmd) {
  return execSync(cmd, {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']}).trim()
}

export default class Doctor extends Command {
  static description = 'Check installation health'
  static summary = 'Verify all Astra DevKit components are installed and working'

  async run() {
    this.log('\nAstra DevKit \u2014 Health Check\n')
    let passed = 0
    let total = 0

    const check = (label, fn) => {
      total++
      try {
        const result = fn()
        const icon = result.ok ? '\u2713' : '\u2717'
        this.log(`  ${icon} ${label}: ${result.detail}`)
        if (result.ok) passed++
      } catch (err) {
        this.log(`  \u2717 ${label}: ${err.message}`)
      }
    }

    check('Node.js', () => {
      const major = parseInt(process.version.slice(1))
      return {ok: major >= 20, detail: `${process.version} ${major >= 20 ? '(OK)' : '(need 20+)'}`}
    })

    check('Gemini CLI', () => {
      try {
        const version = tryExec('gemini --version')
        return {ok: true, detail: version}
      } catch {
        return {ok: false, detail: 'not found \u2014 run: npm install -g @google/gemini-cli'}
      }
    })

    check('Python + uv', () => {
      const pyCmd = isWin ? 'python --version' : 'python3 --version'
      try {
        const pyVersion = tryExec(pyCmd)
        try {
          tryExec('uv --version')
          return {ok: true, detail: `${pyVersion} + uv installed`}
        } catch {
          return {ok: false, detail: `${pyVersion} found, but uv missing`}
        }
      } catch {
        return {ok: false, detail: 'not found \u2014 needed for document MCPs'}
      }
    })

    for (const [name, ext, min] of [
      ['Skills', null, 20], ['Hooks', '.mjs', 15], ['Agents', '.md', 8], ['Standards', '.md', 3],
    ]) {
      check(name, () => {
        const dir = join(GEMINI_HOME, name.toLowerCase())
        if (!existsSync(dir)) return {ok: false, detail: 'directory missing'}
        const entries = readdirSync(dir).filter(f => !f.startsWith('.') && (ext ? f.endsWith(ext) : true))
        return {ok: entries.length >= min, detail: `${entries.length} installed ${entries.length >= min ? '(OK)' : `(expected ${min}+)`}`}
      })
    }

    check('Settings + MCPs', () => {
      const p = join(GEMINI_HOME, 'settings.json')
      if (!existsSync(p)) return {ok: false, detail: 'settings.json missing'}
      const s = JSON.parse(readFileSync(p, 'utf-8'))
      const mcps = s.mcpServers ? Object.keys(s.mcpServers).length : 0
      const hooks = s.hooksConfig?.enabled !== false
      const skills = s.skills?.enabled !== false
      return {ok: mcps >= 5 && hooks && skills, detail: `${mcps} MCPs, hooks ${hooks ? 'ON' : 'OFF'}, skills ${skills ? 'ON' : 'OFF'}`}
    })

    check('Themes', () => {
      const dir = join(GEMINI_HOME, 'themes')
      if (!existsSync(dir)) return {ok: false, detail: 'directory missing'}
      const count = readdirSync(dir).filter(f => f.endsWith('.json')).length
      return {ok: count >= 3, detail: `${count} available ${count >= 3 ? '(OK)' : '(expected 3)'}`}
    })

    check('ast-grep', () => {
      try {
        const version = tryExec('sg --version')
        return {ok: true, detail: version}
      } catch {
        return {ok: false, detail: 'not found \u2014 needed for AAG engine and mutation testing'}
      }
    })

    check('Pandoc', () => {
      try {
        const raw = tryExec('pandoc --version')
        return {ok: true, detail: raw.split('\n')[0]}
      } catch {
        return {ok: false, detail: 'not found \u2014 optional, needed for PDF reports'}
      }
    })

    this.log(`\n${passed}/${total} checks passed.\n`)
    if (passed === total) {
      this.log('All systems operational. You\'re good to go.\n')
    } else {
      this.log(`Some checks failed. Run '${this.config.bin} setup' to fix.\n`)
    }
  }
}
