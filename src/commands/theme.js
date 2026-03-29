import {Command} from '@oclif/core'
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {select} from '@inquirer/prompts'

const GEMINI_HOME = join(homedir(), '.gemini')

export default class Theme extends Command {
  static description = 'Switch between themes'
  static summary = 'Choose from Astra, Retro Green, Retro Amber, or built-in themes'

  async run() {
    const themesDir = join(GEMINI_HOME, 'themes')
    const settingsPath = join(GEMINI_HOME, 'settings.json')

    const customThemes = existsSync(themesDir)
      ? readdirSync(themesDir).filter(f => f.endsWith('.json')).map(f => {
        const data = JSON.parse(readFileSync(join(themesDir, f), 'utf-8'))
        return {name: `${data.name} (Astra)`, value: data.name}
      })
      : []

    const builtIn = [{name: 'Default', value: 'Default'}, {name: 'Dracula', value: 'Dracula'}]
    const allThemes = [...customThemes, ...builtIn]

    const selected = await select({
      message: 'Choose theme',
      choices: allThemes,
    })

    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      settings.ui = settings.ui || {}
      settings.ui.theme = selected
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
      this.log(`\n\u2713 Theme set to: ${selected}. Restart Gemini CLI to apply.\n`)
    } else {
      this.error('settings.json not found. Run setup first.')
    }
  }
}
