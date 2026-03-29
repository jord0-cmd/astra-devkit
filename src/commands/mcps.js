import {Command} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {checkbox} from '@inquirer/prompts'

const GEMINI_HOME = join(homedir(), '.gemini')

const MCP_CATALOG = [
  {key: 'context7', name: 'Context7', category: 'CODING', desc: 'Live docs for 9K+ libraries', config: {command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'], timeout: 30000}},
  {key: 'pandoc', name: 'Pandoc', category: 'DOCUMENTS', desc: 'Markdown \u2192 any format', config: {command: 'uvx', args: ['mcp-pandoc'], timeout: 15000}},
  {key: 'powerpoint', name: 'PowerPoint', category: 'DOCUMENTS', desc: 'Presentations (34 tools)', config: {command: 'uvx', args: ['--from', 'office-powerpoint-mcp-server', 'ppt_mcp_server'], timeout: 15000}},
  {key: 'excel', name: 'Excel', category: 'DOCUMENTS', desc: 'Spreadsheets (20 tools)', config: {command: 'uvx', args: ['excel-mcp-server'], timeout: 15000}},
  {key: 'word-docs', name: 'Word', category: 'DOCUMENTS', desc: 'Rich documents', config: {command: 'uvx', args: ['--from', 'office-word-mcp-server', 'word_mcp_server'], timeout: 15000}},
  {key: 'gemini-image', name: 'Gemini Imagen', category: 'IMAGES', desc: 'AI image generation', config: {command: 'npx', args: ['-y', 'mcp-image'], env: {GEMINI_API_KEY: '$GEMINI_API_KEY', IMAGE_OUTPUT_DIR: './generated-images', IMAGE_QUALITY: 'balanced'}, timeout: 60000}},
  {key: 'playwright', name: 'Playwright', category: 'CODING', desc: 'Browser automation', config: {command: 'npx', args: ['-y', '@anthropic-ai/mcp-playwright'], timeout: 30000}},
]

export default class Mcps extends Command {
  static description = 'Enable/disable MCP servers'
  static summary = 'Interactive MCP server configuration'

  async run() {
    const settingsPath = join(GEMINI_HOME, 'settings.json')
    let settings = {}
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    }
    const currentMcps = settings.mcpServers || {}

    const selected = await checkbox({
      message: 'Select MCP servers to enable',
      choices: MCP_CATALOG.map(srv => ({
        name: `${srv.name.padEnd(16)} \u2014 ${srv.desc} [${srv.category}]`,
        value: srv.key,
        checked: srv.key in currentMcps,
      })),
    })

    const newMcps = {}
    for (const key of selected) {
      const srv = MCP_CATALOG.find(s => s.key === key)
      if (srv) newMcps[key] = srv.config
    }

    settings.mcpServers = newMcps
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    this.log(`\n\u2713 ${selected.length} MCP servers enabled. Restart Gemini CLI to apply.\n`)
  }
}
