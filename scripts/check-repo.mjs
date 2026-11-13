// Checks that the repo follows its own structure rules: every path has a team, every scope has
// its rule file, imports stay inside the allowed boundaries, docs link to real files, decision
// records are complete and indexed, and a change in progress carries a HANDOFF.md entry.
// docs/platform/verify.md lists every rule code and what fixes it.
//
// Usage: node scripts/check-repo.mjs                 check the repo this script is in
//        node scripts/check-repo.mjs --write-index   rewrite the index in docs/decisions/README.md
//        node scripts/check-repo.mjs --root <dir>    check another checkout with its own docs/ownership.json
//        node scripts/check-repo.mjs --base <ref>    compare the change in progress with <ref> (default origin/main, then main)
//        node scripts/check-repo.mjs --no-change     skip the checks on the change in progress
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openRepo, runAll, writeDecisionIndex } from './lib/repo.mjs'

const args = process.argv.slice(2)
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
const root = resolve(valueOf('--root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'))

if (args.includes('--write-index')) {
  const repo = openRepo(root)
  if (repo.configError) {
    console.error(repo.configError)
    process.exit(1)
  }
  console.log(writeDecisionIndex(repo) ? 'docs/decisions/README.md: index rewritten' : 'docs/decisions/README.md: index already matches')
  process.exit(0)
}

const problems = runAll(root, { base: valueOf('--base'), change: !args.includes('--no-change') })
for (const p of problems) console.error(`${p.code}  ${p.file}${p.line ? `:${p.line}` : ''}  ${p.message}`)
if (problems.length > 0) {
  console.error(`\ncheck-repo: ${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}`)
  process.exit(1)
}
console.log('check-repo: ok')
