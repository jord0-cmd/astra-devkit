import {Command} from '@oclif/core'
import {deployComponent, mergeSettings, countInstalled} from '../../lib/file-ops.mjs'

export default class Update extends Command {
  static description = 'Update all components to latest'
  static summary = 'Re-deploy skills, hooks, agents, standards, themes, and settings'

  async run() {
    const configDir = this.config.root
    this.log('\nUpdating Astra DevKit components...\n')

    for (const comp of ['skills', 'hooks', 'agents', 'standards', 'themes']) {
      const result = deployComponent(configDir, comp)
      this.log(`  \u2713 ${result.component}: ${result.deployed} items`)
    }
    mergeSettings(configDir)
    this.log('  \u2713 settings.json: merged')

    const counts = countInstalled()
    this.log(`\nTotal: ${counts.skills} skills \u00b7 ${counts.hooks} hooks \u00b7 ${counts.mcps} MCPs`)
    this.log('Update complete.\n')
  }
}
