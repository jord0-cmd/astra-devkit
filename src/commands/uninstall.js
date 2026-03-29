import {Command} from '@oclif/core'
import {confirm} from '@inquirer/prompts'
import {countInstalled, removeAll} from '../../lib/file-ops.mjs'

export default class Uninstall extends Command {
  static description = 'Clean removal of all Astra components'
  static summary = 'Remove all DevKit components from ~/.gemini/'

  async run() {
    const counts = countInstalled()

    this.log('\nThis will remove all Astra DevKit components from ~/.gemini/')
    this.log('Your Gemini CLI installation will remain intact.\n')
    this.log(`Will remove: ${counts.skills} skills, ${counts.hooks} hooks, ${counts.agents || 0} agents`)
    this.log(`  ${counts.standards || 0} standards, ${counts.themes || 0} themes\n`)

    const yes = await confirm({message: 'Are you sure?', default: false})

    if (!yes) {
      this.log('Cancelled.')
      return
    }

    const removed = removeAll()
    this.log(`\nRemoved: ${removed.join(', ')}`)
    this.log('Astra DevKit uninstalled. Gemini CLI still works without it.\n')
  }
}
