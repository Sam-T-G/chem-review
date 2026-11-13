// Who owns a path, and what to read before changing it.
//
// Usage: node scripts/who.mjs <path> [<path> ...]   the team, its reviewers, the rule files, the docs, the fast check
//        node scripts/who.mjs --teams               every team and what it does
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openRepo, who } from './lib/repo.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = openRepo(root)
if (repo.configError) {
  console.error(repo.configError)
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: pnpm who <path> [<path> ...]   or   pnpm who --teams')
  process.exit(1)
}

if (args.includes('--teams')) {
  for (const [id, team] of Object.entries(repo.config.teams)) console.log(`${id.padEnd(9)} ${team.name}: ${team.does}`)
  process.exit(0)
}

const row = (label, text) => console.log(`  ${label.padEnd(11)}${text}`)
let missing = 0
for (const path of args) {
  const found = who(repo, path)
  if (!found) {
    console.error(`${path}: no team owns this path. Add it to "owners" in docs/ownership.json`)
    missing += 1
    continue
  }
  console.log(found.path)
  row('team', `${found.team} (${found.name})`)
  if (found.review.length > 0) row('reviewers', found.review.join(', '))
  found.also.forEach((r, index) => row(index === 0 ? 'also ask' : '', `${r.team}, if ${r.when}`))
  row('rules', found.rules.join(' > '))
  if (found.teamRules.length > 0) row('', `and the owning team's rules: ${found.teamRules.join(', ')}`)
  row('docs', found.docs.join(', ') || 'none')
  row('check', found.check)
  found.decisions.forEach((d, index) => row(index === 0 ? 'decisions' : '', `${d.id} ${d.status}: ${d.title} (${d.file})`))
}
process.exit(missing > 0 ? 1 : 0)
