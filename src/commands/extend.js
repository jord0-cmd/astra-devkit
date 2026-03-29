import {Command} from '@oclif/core'
import {existsSync, mkdirSync, readdirSync, copyFileSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {execSync} from 'node:child_process'
import {confirm} from '@inquirer/prompts'

const INTERNAL_REPO = 'github:jord0-cmd/astra-devkit-internal'
const GEMINI_SKILLS = join(homedir(), '.gemini', 'skills')

function copyDir(src, dest) {
  mkdirSync(dest, {recursive: true})
  for (const entry of readdirSync(src, {withFileTypes: true})) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

export default class Extend extends Command {
  static description = 'Install the internal skill pack'
  static summary = 'Add team-specific skills from the private repository (requires GitHub access)'

  static examples = [
    '<%= config.bin %> extend',
  ]

  async run() {
    this.log('')
    this.log('  Astra DevKit \u2014 Internal Skill Pack')
    this.log('')
    this.log('  This installs additional team-specific skills from a private')
    this.log('  GitHub repository. You need GitHub access to the repo.')
    this.log('')

    const proceed = await confirm({
      message: 'Install internal skill pack? (requires GitHub access)',
      default: true,
    })

    if (!proceed) {
      this.log('\nCancelled.\n')
      return
    }

    this.log(`\n  Downloading from ${INTERNAL_REPO}...\n`)

    try {
      // Install without postinstall — we do the deployment ourselves
      execSync(`npm install -g --ignore-scripts ${INTERNAL_REPO}`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        cwd: homedir(),
      })
    } catch (err) {
      this.log('')
      this.warn('Download failed. This usually means one of:')
      this.log('  1. You don\'t have access to the private repository')
      this.log('  2. Your GitHub credentials aren\'t configured for npm')
      this.log('')
      this.log('  Ask your team lead for access to:')
      this.log('  https://github.com/jord0-cmd/astra-devkit-internal')
      this.log('')
      return
    }

    // Find where npm installed the package
    let pkgRoot = null
    try {
      const npmRoot = execSync('npm root -g', {encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']}).trim()
      pkgRoot = join(npmRoot, 'astra-devkit-internal')
    } catch {
      this.warn('Could not locate installed package.')
      return
    }

    const skillsDir = join(pkgRoot, 'skills')
    if (!existsSync(skillsDir)) {
      this.warn('Internal package has no skills directory.')
      return
    }

    // Deploy skills to ~/.gemini/skills/
    if (!existsSync(GEMINI_SKILLS)) {
      this.warn('~/.gemini/skills/ not found. Run astra-devkit setup first.')
      return
    }

    const skills = readdirSync(skillsDir).filter(
      f => !f.startsWith('.') && statSync(join(skillsDir, f)).isDirectory()
    )

    this.log('  Deploying internal skills...\n')
    for (const skill of skills) {
      copyDir(join(skillsDir, skill), join(GEMINI_SKILLS, skill))
      this.log(`  \u2713 ${skill}`)
    }

    this.log(`\n  ${skills.length} internal skills installed.`)
    this.log('  Restart Gemini CLI to activate.\n')
  }
}
