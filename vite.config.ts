import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * `import report from './x.json?summary'` loads a generated result file without its per-case arrays
 * (`cases`). Those arrays are almost all of `simulation/external_validation_aex*.json` (about 1.2 MB
 * together), and the demo shows only summaries, verdicts and medians, which are kept as they are.
 * Every number the demo shows still comes from the generated JSON.
 */
function jsonSummary(): Plugin {
  const query = '?summary'
  const dropCaseArrays = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(dropCaseArrays)
    if (node === null || typeof node !== 'object') return node
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key, value]) => !(key === 'cases' && Array.isArray(value)))
        .map(([key, value]) => [key, dropCaseArrays(value)]),
    )
  }
  return {
    name: 'pfas-json-summary',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith(`.json${query}`)) return null
      const file = id.slice(0, -query.length)
      this.addWatchFile(file)
      // Returned as JSON text, so Vite's own JSON plugin turns it into a module as usual.
      return JSON.stringify(dropCaseArrays(JSON.parse(readFileSync(file, 'utf-8'))))
    },
  }
}

export default defineConfig({
  plugins: [jsonSummary(), react()],
  base: './',
})
