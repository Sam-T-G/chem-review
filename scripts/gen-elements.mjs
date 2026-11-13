// Writes src/chem/elements.data.json from Valence's validated periodic-table data
// (PubChem-sourced Pauling electronegativity; see valence/data/PROVENANCE.md).
// Usage: node scripts/gen-elements.mjs [path/to/valence/data/elements.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = process.argv[2] ?? fileURLToPath(new URL('../../valence/data/elements.json', import.meta.url))
const out = fileURLToPath(new URL('../src/chem/elements.data.json', import.meta.url))
// Main-group elements that show up in first-year Lewis structure problems.
const WANT = ['H', 'Be', 'B', 'C', 'N', 'O', 'F', 'Al', 'Si', 'P', 'S', 'Cl', 'As', 'Se', 'Br', 'Kr', 'I', 'Xe']

const raw = JSON.parse(readFileSync(src, 'utf8'))
const all = Array.isArray(raw) ? raw : raw.elements
const rows = WANT.map((symbol) => {
  const e = all.find((x) => x.symbol === symbol)
  if (!e) throw new Error(`missing ${symbol}`)
  const valence = e.shellElectrons.at(-1)
  // Main group only: the outer shell count must agree with the group number.
  const fromGroup = e.group <= 2 ? e.group : e.group - 10
  if (valence !== fromGroup) throw new Error(`${symbol}: shell ${valence} vs group ${fromGroup}`)
  return { symbol, name: e.name === 'Aluminium' ? 'Aluminum' : e.name, z: e.atomicNumber, group: e.group, period: e.period, valence, en: e.electronegativity }
})
writeFileSync(out, JSON.stringify(rows, null, 2) + '\n')
console.log(`wrote ${rows.length} elements to ${out}`)
