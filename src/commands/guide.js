import {Command, Args} from '@oclif/core'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
import {execSync} from 'node:child_process'
import {platform} from 'node:os'

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

function openFile(filePath) {
  if (isWin) {
    execSync(`start "" "${filePath}"`, {stdio: 'ignore', shell: true})
  } else if (isMac) {
    execSync(`open "${filePath}"`, {stdio: 'ignore'})
  } else {
    // Linux — try xdg-open, then common image viewers
    try {
      execSync(`xdg-open "${filePath}"`, {stdio: 'ignore'})
    } catch {
      try {
        execSync(`eog "${filePath}"`, {stdio: 'ignore'})
      } catch {
        try {
          execSync(`feh "${filePath}"`, {stdio: 'ignore'})
        } catch {
          return false
        }
      }
    }
  }
  return true
}

export default class Guide extends Command {
  static description = 'Open the visual quick-start guide'
  static summary = 'View the beginner or developer infographic guide'

  static args = {
    audience: Args.string({
      description: 'Which guide to open',
      required: true,
      options: ['beginner', 'developer'],
    }),
  }

  static examples = [
    '<%= config.bin %> guide beginner',
    '<%= config.bin %> guide developer',
  ]

  async run() {
    const {args} = await this.parse(Guide)

    const guides = {
      beginner: {
        file: 'astra-guide-beginners.png',
        desc: 'Visual guide for beginners — what Astra can do, how to talk to her, getting started',
      },
      developer: {
        file: 'astra-guide-developers.png',
        desc: 'Technical guide — Architect Pattern, quality gates, measured results, your stack',
      },
    }

    const guide = guides[args.audience]
    const filePath = join(this.config.root, 'docs', 'images', guide.file)

    if (!existsSync(filePath)) {
      this.error(`Guide image not found at ${filePath}. Try reinstalling: npm install -g github:jord0-cmd/astra-devkit`)
    }

    this.log(`\nOpening: ${guide.desc}\n`)

    const opened = openFile(filePath)
    if (!opened) {
      this.log(`Could not open image automatically. File is at:\n  ${filePath}\n`)
    }
  }
}
