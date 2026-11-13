// The repo's own structure checks (scripts/lib/repo.mjs), run against small made-up repos in a
// temp folder. Each rule has a case that must fail with its code and a case that must pass. The
// last group runs the real docs/ownership.json through the import rules.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import {
  codeOnly,
  importProblem,
  importsOf,
  INDEX_END,
  INDEX_START,
  openRepo,
  ownerOf,
  resolveImport,
  ROOT_AGENTS_LINES,
  runAll,
  SCOPE_AGENTS_LINES,
  scopeChain,
  who,
  writeDecisionIndex,
} from '../scripts/lib/repo.mjs'

type Files = Record<string, string | null>
type Problem = { code: string; file: string; line?: number; message: string }
const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

const FILE_LIST = '- `solve.ts`: the solver\n- `elements.ts`: element facts'
const scopeFile = (files: string, extra = '') =>
  `# A scope\n\n## Files\n${files}\n\n## Read first\n- the doc\n\n## Rules\n- X1 a rule\n\n## Check your work\n- a command\n\n## Update when you change this\n- a doc\n${extra}`

const decision = (id: string, status: string, more = '') =>
  `# ${id}: The engine is plain TypeScript\n\n- Status: ${status}\n- Date: 2026-11-12\n- Decided by: Sam\n- Teams: chem\n${more}\n## Context\nWhy.\n\n## Decision\nWhat.\n\n## Consequences\nSo.\n`

const CONFIG = {
  teams: {
    lead: { name: 'Lead', does: 'Leads.', docs: ['docs/roadmap.md'], check: 'pnpm check:repo' },
    chem: { name: 'Chemistry engine', does: 'Chemistry.', docs: ['docs/roadmap.md'], check: 'pnpm exec vitest run solve' },
    shell: { name: 'App shell', does: 'Screens.', docs: [], check: 'pnpm typecheck' },
  },
  scopes: [
    { dir: '', files: false },
    { dir: 'src/chem', files: true },
  ],
  owners: [
    { path: 'AGENTS.md', team: 'lead' },
    { path: 'CLAUDE.md', team: 'lead' },
    { path: 'HANDOFF.md', team: 'lead' },
    { path: 'docs/', team: 'lead' },
    { path: 'src/chem/', team: 'chem' },
    { path: 'src/chem/solve.ts', team: 'chem', review: ['lead'] },
    { path: 'src/shell/', team: 'shell' },
  ],
  reviewByContent: [{ team: 'chem', when: 'it states a chemistry fact' }],
  imports: [
    { from: 'src/chem/', internal: ['src/chem/'], packages: [] },
    { from: 'src/modules/*/', internal: ['{self}', 'src/chem/'], packages: 'any' },
    { from: 'src/shell/', internal: ['src/shell/', 'src/chem/', 'src/modules/registry.ts'], packages: 'any' },
  ],
  importExceptions: [],
}
const config = (change: (c: typeof CONFIG & Record<string, unknown>) => void) => {
  const copy = JSON.parse(JSON.stringify(CONFIG))
  change(copy)
  return JSON.stringify(copy)
}

const BASE: Files = {
  'docs/ownership.json': JSON.stringify(CONFIG),
  'AGENTS.md': '# Root\n\n## Rules\n- R1 a rule\n',
  'CLAUDE.md': '@AGENTS.md\n',
  'HANDOFF.md': '# Handoff\n\n## 2026-11-13 (lead) Set up the repo\n\nDone.\n\n## 2026-11-12 (chem) Wrote the solver\n\nDone.\n',
  'docs/README.md': '# Docs\n\n- [Decisions](decisions/README.md)\n- [Roadmap](roadmap.md)\n- [Mistakes](mistakes.md)\n',
  'docs/roadmap.md': '# Roadmap\n\n| ID | Team | Item |\n|---|---|---|\n| W-001 | chem | Retune the model |\n',
  'docs/mistakes.md': '# Mistakes\n\n## M-0001 A wrong angle was printed\n',
  'docs/decisions/README.md': `# Decisions\n\n${INDEX_START}\n${INDEX_END}\n`,
  'docs/decisions/0001-plain-engine.md': decision('D-0001', 'accepted'),
  'src/chem/AGENTS.md': scopeFile(FILE_LIST),
  'src/chem/CLAUDE.md': '@AGENTS.md\n',
  'src/chem/elements.ts': 'export const H = 1\n',
  'src/chem/solve.ts': "import { H } from './elements'\nexport const solve = () => H\n",
  'src/shell/Card.tsx': "import { solve } from '@/chem/solve'\nimport { View } from 'react-native'\nexport const card = [solve, View]\n",
}

/** A made-up repo on disk: BASE with some files changed, added, or (with null) removed. */
function fixture(changes: Files = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'chem-review-repo-'))
  made.push(dir)
  write(dir, { ...BASE, ...changes })
  writeDecisionIndex(openRepo(dir))
  return dir
}

function write(dir: string, files: Files) {
  for (const [path, text] of Object.entries(files)) {
    if (text === null) {
      rmSync(join(dir, path), { force: true })
      continue
    }
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
}

const problems = (dir: string, options?: { base?: string; change?: boolean }): Problem[] => runAll(dir, options)
const codes = (dir: string, options?: { base?: string; change?: boolean }) => problems(dir, options).map((p) => `${p.code} ${p.file}`)
const lines = (count: number) => Array.from({ length: count }, (_, i) => `- line ${i + 1}`).join('\n')
const roadmap = (body: string) => `# Roadmap\n\n${body}\n\n| ID | Team | Item |\n|---|---|---|\n| W-001 | chem | Retune the model |\n`

describe('a repo that follows the rules', () => {
  it('has no problems', () => {
    expect(problems(fixture())).toEqual([])
  })
})

describe('the ownership file', () => {
  it('is reported alone when it is missing or is not JSON', () => {
    expect(codes(fixture({ 'docs/ownership.json': null }))).toEqual(['CONFIG docs/ownership.json'])
    expect(codes(fixture({ 'docs/ownership.json': '{ not json' }))).toEqual(['CONFIG docs/ownership.json'])
  })

  it('fails a missing top-level list with one line and no crash', () => {
    for (const key of ['teams', 'scopes', 'owners', 'imports'] as const) {
      const found = problems(fixture({ 'docs/ownership.json': config((c) => delete (c as Record<string, unknown>)[key]) }))
      expect(found.map((p) => p.code)).toEqual(['CONFIG'])
      expect(found[0]?.message).toContain(`"${key}"`)
    }
  })

  it('fails an entry with a missing field', () => {
    const noPath = config((c) => c.owners.push({ team: 'chem' } as never))
    expect(problems(fixture({ 'docs/ownership.json': noPath }))[0]?.message).toContain('needs a "path" and a "team"')
    const noDocs = config((c) => delete (c.teams.shell as Record<string, unknown>).docs)
    expect(problems(fixture({ 'docs/ownership.json': noDocs }))[0]?.message).toContain('"docs"')
    const noInternal = config((c) => c.imports.push({ from: 'src/data/', packages: 'any' } as never))
    expect(problems(fixture({ 'docs/ownership.json': noInternal }))[0]?.message).toContain('"internal"')
  })

  it('fails a team, reviewer, doc, path or scope folder that does not exist', () => {
    const cases: [string, string][] = [
      [config((c) => c.owners.push({ path: 'docs/roadmap.md', team: 'growth' })), '"growth", which is not a team'],
      [config((c) => c.owners.push({ path: 'docs/roadmap.md', team: 'chem', review: ['growth'] })), 'reviewer "growth"'],
      [config((c) => c.owners.push({ path: 'src/gone/', team: 'chem' })), '"src/gone/" has an owner but does not exist'],
      [config((c) => c.teams.chem.docs.push('docs/gone.md')), 'docs/gone.md, which does not exist'],
      [config((c) => c.scopes.push({ dir: 'src/gone', files: true })), 'scope "src/gone" does not exist'],
      [config((c) => c.reviewByContent.push({ team: 'growth', when: 'always' })), '"reviewByContent" names "growth"'],
    ]
    for (const [json, message] of cases) {
      const found = problems(fixture({ 'docs/ownership.json': json }))
      expect(found.map((p) => p.code)).toEqual(['CONFIG'])
      expect(found[0]?.message).toContain(message)
    }
  })
})

describe('installed packages', () => {
  it('fails a node_modules that is a link to another checkout', () => {
    const other = fixture()
    mkdirSync(join(other, 'node_modules'))
    expect(problems(other)).toEqual([])
    const dir = fixture()
    symlinkSync(join(other, 'node_modules'), join(dir, 'node_modules'))
    expect(codes(dir)).toEqual(['DEPS-LINK node_modules'])
  })
})

describe('ownership', () => {
  it('gives a path to the longest matching entry', () => {
    expect(ownerOf(CONFIG, 'src/chem/elements.ts')?.team).toBe('chem')
    expect(ownerOf(CONFIG, 'src/chem/solve.ts')?.review).toEqual(['lead'])
    expect(ownerOf(CONFIG, 'docs/decisions/0001-plain-engine.md')?.team).toBe('lead')
    expect(ownerOf(CONFIG, 'src/chemistry/x.ts')).toBeNull()
    expect(ownerOf(CONFIG, 'tools/build.sh')).toBeNull()
  })

  it('fails a file that no team owns', () => {
    expect(codes(fixture({ 'tools/build.sh': 'echo hi\n' }))).toEqual(['OWNER tools/build.sh'])
  })

  it('lists the rule files from the root down to the folder', () => {
    expect(scopeChain(CONFIG, 'src/chem/solve.ts')).toEqual(['AGENTS.md', 'src/chem/AGENTS.md'])
    expect(scopeChain(CONFIG, 'src/shell/Card.tsx')).toEqual(['AGENTS.md'])
  })

  it('tells a newcomer the team, the reviewers, what to read, the check and the decisions', () => {
    const found = who(openRepo(fixture()), 'src/chem/solve.ts')
    expect(found).toMatchObject({
      team: 'chem',
      name: 'Chemistry engine',
      review: ['lead'],
      also: [{ team: 'chem', when: 'it states a chemistry fact' }],
      rules: ['AGENTS.md', 'src/chem/AGENTS.md'],
      teamRules: [],
      docs: ['docs/roadmap.md'],
      check: 'pnpm exec vitest run solve',
    })
    expect(found?.decisions).toEqual([{ id: 'D-0001', status: 'accepted', title: 'The engine is plain TypeScript', file: 'docs/decisions/0001-plain-engine.md' }])
    expect(who(openRepo(fixture()), 'src/chem/')?.rules).toEqual(['AGENTS.md', 'src/chem/AGENTS.md'])
    expect(who(openRepo(fixture()), 'tools/build.sh')).toBeNull()
  })

  it("adds the owning team's rules for a file that sits outside that team's folders", () => {
    const json = config((c) => c.owners.push({ path: 'tests/', team: 'chem' }))
    const found = who(openRepo(fixture({ 'docs/ownership.json': json, 'tests/solve.test.ts': 'export {}\n' })), 'tests/solve.test.ts')
    expect(found?.rules).toEqual(['AGENTS.md'])
    expect(found?.teamRules).toEqual(['src/chem/AGENTS.md'])
  })
})

describe('scope rule files', () => {
  it('fails a scope with no AGENTS.md', () => {
    expect(codes(fixture({ 'src/chem/AGENTS.md': null }))).toEqual(['SCOPE src/chem/AGENTS.md'])
  })

  it('fails an AGENTS.md whose folder is not listed as a scope', () => {
    expect(codes(fixture({ 'src/shell/AGENTS.md': scopeFile('- `Card.tsx`: a card') }))).toEqual(['SCOPE src/shell/AGENTS.md'])
  })

  it('fails a CLAUDE.md that is missing or is anything but the one import line', () => {
    expect(codes(fixture({ 'src/chem/CLAUDE.md': '@AGENTS.md\n\nAlso be nice.\n' }))).toEqual(['AGENTS-PAIR src/chem/CLAUDE.md'])
    expect(codes(fixture({ 'src/chem/CLAUDE.md': null }))).toEqual(['AGENTS-PAIR src/chem/CLAUDE.md'])
  })

  it('fails a missing section', () => {
    expect(codes(fixture({ 'src/chem/AGENTS.md': scopeFile(FILE_LIST).replace('## Check your work', '## Checks') }))).toEqual(['SCOPE src/chem/AGENTS.md'])
    expect(codes(fixture({ 'src/chem/AGENTS.md': scopeFile(FILE_LIST).replace('## Files', '## What is here') }))).toEqual(['FILES src/chem/AGENTS.md'])
  })

  it('holds the root file to 80 lines and a scope file to 60', () => {
    const rootAt = (count: number) => `# Root\n\n## Rules\n${lines(count - 3)}\n`
    expect(codes(fixture({ 'AGENTS.md': rootAt(ROOT_AGENTS_LINES) }))).toEqual([])
    expect(codes(fixture({ 'AGENTS.md': rootAt(ROOT_AGENTS_LINES + 1) }))).toEqual(['AGENTS-SIZE AGENTS.md'])
    const used = scopeFile(FILE_LIST).replace(/\n+$/, '').split('\n').length
    expect(codes(fixture({ 'src/chem/AGENTS.md': scopeFile(FILE_LIST, lines(SCOPE_AGENTS_LINES - used)) }))).toEqual([])
    expect(codes(fixture({ 'src/chem/AGENTS.md': scopeFile(FILE_LIST, lines(SCOPE_AGENTS_LINES - used + 1)) }))).toEqual(['AGENTS-SIZE src/chem/AGENTS.md'])
  })

  it('fails a file that the folder holds and "## Files" does not list', () => {
    expect(codes(fixture({ 'src/chem/vsepr.ts': 'export const shapes = 13\n' }))).toEqual(['FILES src/chem/AGENTS.md'])
  })

  it('wants a file in a subfolder listed by its path from the scope folder', () => {
    const data = { 'src/chem/data/table.ts': 'export const table = 1\n' }
    expect(codes(fixture(data))).toEqual(['FILES src/chem/AGENTS.md'])
    expect(codes(fixture({ ...data, 'src/chem/AGENTS.md': scopeFile(`${FILE_LIST}\n- \`data/\`: tables`) }))).toEqual(['FILES src/chem/AGENTS.md'])
    expect(codes(fixture({ ...data, 'src/chem/AGENTS.md': scopeFile(`${FILE_LIST}\n- \`data/table.ts\`: the shape table`) }))).toEqual([])
  })

  it('counts only the names that start a bullet, so a name inside a description does not list a file', () => {
    const files = '- `solve.ts`: the solver, which reads `elements.ts`'
    expect(codes(fixture({ 'src/chem/AGENTS.md': scopeFile(files) }))).toEqual(['FILES src/chem/AGENTS.md'])
    const together = '- `solve.ts`, `elements.ts`: the solver and the element facts'
    expect(codes(fixture({ 'src/chem/AGENTS.md': scopeFile(together) }))).toEqual([])
  })

  it('fails any listed name whose file is gone, wherever it sits in the bullet', () => {
    const gone = { 'src/chem/elements.ts': null, 'src/chem/solve.ts': 'export const solve = 1\n' }
    expect(codes(fixture(gone))).toEqual(['FILES src/chem/AGENTS.md'])
    expect(codes(fixture({ ...gone, 'src/chem/AGENTS.md': scopeFile('- `solve.ts`, `elements.ts`: both') }))).toEqual(['FILES src/chem/AGENTS.md'])
  })
})

describe('import boundaries', () => {
  it('reads every way a file can import', () => {
    const text = [
      "import { a } from './a'",
      "import type { B } from '../b'",
      'import {',
      '  c, // the first one',
      '  d as e, /* renamed */',
      "} from '@/chem/c'",
      "/* a note */ import * as three from 'three'",
      "import './styles.css'",
      "export { f } from './f'",
      "export * from './g'",
      "const font = require('@fontsource-variable/nunito/files/x.woff2')",
      "const lazy = import('./lazy')",
      'const late = import(`./late`)',
      'export const from = 1',
    ].join('\n')
    expect(importsOf(text).sort()).toEqual(
      ['../b', './a', './f', './g', './late', './lazy', './styles.css', '@/chem/c', '@fontsource-variable/nunito/files/x.woff2', 'three'].sort(),
    )
  })

  it('does not read an import out of a comment or a multi-line template string', () => {
    const text = [
      "// import { a } from './commented'",
      "/* const x = require('react') */",
      '/*',
      "import { b } from './block'",
      '*/',
      'const html = `',
      "import { c } from './template'",
      '`',
      "// the numbers come from 'a textbook'",
      "import { real } from './real'",
    ].join('\n')
    expect(importsOf(text)).toEqual(['./real'])
    expect(codeOnly('a // b\nc /* d\ne */ f').split('\n')).toEqual(['a     ', 'c     ', '     f'])
  })

  it('turns an import into a repo path or a package name', () => {
    expect(resolveImport('src/modules/lewis/ui.ts', '../../chem/assess')).toEqual({ path: 'src/chem/assess' })
    expect(resolveImport('src/app/index.tsx', '@/shell/ModuleCard')).toEqual({ path: 'src/shell/ModuleCard' })
    expect(resolveImport('src/app/index.tsx', '@/assets/images/icon.png')).toEqual({ path: 'assets/images/icon.png' })
    expect(resolveImport('src/chem/solve.ts', '@/chem/../shell/progress')).toEqual({ path: 'src/shell/progress' })
    expect(resolveImport('src/chem/solve.ts', '.')).toEqual({ path: 'src/chem' })
    expect(resolveImport('src/modules/lewis/scene.ts', 'three/addons/environments/RoomEnvironment.js')).toEqual({ pkg: 'three' })
    expect(resolveImport('src/app/_layout.tsx', '@expo-google-fonts/nunito')).toEqual({ pkg: '@expo-google-fonts/nunito' })
  })

  it('fails the engine importing a package', () => {
    expect(codes(fixture({ 'src/chem/solve.ts': "import { useState } from 'react'\nexport const solve = useState\n" }))).toEqual(['IMPORT src/chem/solve.ts'])
  })

  it('fails the engine importing from another folder, even through a comment-split import', () => {
    const found = problems(fixture({ 'src/chem/solve.ts': "import {\n  card, // the card\n} from '../shell/Card'\nexport const solve = card\n" }))
    expect(found.map((p) => p.code)).toEqual(['IMPORT'])
    expect(found[0]?.message).toContain('src/shell/Card')
  })

  it('lets a module import its own folder and the engine, and no other module', () => {
    const files = {
      'docs/ownership.json': config((c) => c.owners.push({ path: 'src/modules/', team: 'shell' })),
      'src/modules/lewis/store.ts': "import { solve } from '../../chem/solve'\nimport { guide } from './guide'\nexport const store = [solve, guide]\n",
      'src/modules/lewis/guide.ts': 'export const guide = 1\n',
    }
    expect(codes(fixture(files))).toEqual([])
    const crossing = { ...files, 'src/modules/acid/ui.ts': "import { guide } from '../lewis/guide'\nexport const ui = guide\n" }
    expect(codes(fixture(crossing))).toEqual(['IMPORT src/modules/acid/ui.ts'])
  })

  it('lets the shell import one named file of the modules folder and nothing else in it', () => {
    const json = config((c) => {
      c.owners.push({ path: 'src/modules/', team: 'shell' })
      c.imports.push({ from: 'src/modules/registry.ts', internal: ['src/chem/'], packages: [] })
    })
    const files = {
      'docs/ownership.json': json,
      'src/modules/registry.ts': "import { solve } from '@/chem/solve'\nexport const MODULES = [solve]\n",
      'src/modules/lewis/palette.ts': 'export const BALL = 1\n',
      'src/shell/Card.tsx': "import { MODULES } from '@/modules/registry'\nexport const card = MODULES\n",
    }
    expect(codes(fixture(files))).toEqual([])
    const reaching = { ...files, 'src/shell/Atom.tsx': "import { BALL } from '@/modules/lewis/palette'\nexport const atom = BALL\n" }
    expect(codes(fixture(reaching))).toEqual(['IMPORT src/shell/Atom.tsx'])
    const excepted = JSON.parse(json)
    excepted.importExceptions = [{ from: 'src/shell/Atom.tsx', to: 'src/modules/lewis/palette', until: 'W-001' }]
    expect(codes(fixture({ ...reaching, 'docs/ownership.json': JSON.stringify(excepted) }))).toEqual([])
  })

  it('fails a source file under src/ that no import rule covers, and leaves other folders free', () => {
    const test = { 'tests/solve.test.ts': "import { solve } from '../src/chem/solve'\nexport const t = solve\n" }
    const withTests = config((c) => c.owners.push({ path: 'tests/', team: 'chem' }))
    expect(codes(fixture({ ...test, 'docs/ownership.json': withTests }))).toEqual([])
    const withData = config((c) => c.owners.push({ path: 'tests/', team: 'chem' }, { path: 'src/data/', team: 'chem' }))
    expect(codes(fixture({ ...test, 'docs/ownership.json': withData, 'src/data/load.ts': 'export const load = 1\n' }))).toEqual(['IMPORT src/data/load.ts'])
  })
})

describe('docs', () => {
  it('fails a link or a named path that does not exist', () => {
    const found = problems(fixture({ 'docs/roadmap.md': roadmap('See [the plan](plan.md "The plan") and `src/chem/gone.ts`.') }))
    expect(found.map((p) => `${p.code} ${p.line}`)).toEqual(['LINK 3', 'LINK 3'])
  })

  it('fails a path written in the wrong case, on every operating system', () => {
    expect(codes(fixture({ 'docs/roadmap.md': roadmap('See `docs/Mistakes.md`.') }))).toEqual(['LINK docs/roadmap.md'])
  })

  it('passes links to real files, titles, web links, anchors, code fences, placeholders and patterns', () => {
    const body = [
      'See [the map](README.md#top), [the log](mistakes.md "Mistakes"), [Expo](https://docs.expo.dev), `src/chem/solve.ts`, `src/chem/`,',
      '`src/modules/<id>/`, `docs/decisions/NNNN-short-name.md` and `src/chem/solve.ts:2`.',
      '',
      '```',
      'cat src/chem/gone.ts',
      '```',
    ].join('\n')
    expect(codes(fixture({ 'docs/roadmap.md': roadmap(body) }))).toEqual([])
  })

  it('leaves history alone: the handoff, the mistakes log and decision records may name files that are gone', () => {
    const handoff = '# Handoff\n\n## 2026-11-13 (lead) Removed the old solver\n\n`src/chem/old.ts` is gone.\n'
    const record = decision('D-0001', 'accepted').replace('Why.', 'It began in `src/chem/old.ts`.')
    expect(codes(fixture({ 'HANDOFF.md': handoff, 'docs/decisions/0001-plain-engine.md': record }))).toEqual([])
  })

  it('fails a doc the map does not link to, and a missing map', () => {
    expect(codes(fixture({ 'docs/chemistry/sources.md': '# Sources\n' }))).toEqual(['DOCMAP docs/chemistry/sources.md'])
    expect(codes(fixture({ 'docs/README.md': null }))).toEqual(['DOCMAP docs/README.md'])
  })

  it('fails an id that points at nothing or is malformed', () => {
    const text = '# Mistakes\n\n## M-0001 A wrong angle was printed\n\nSee D-0002, M-0007 and W-014. Also W-0011 and D-17. D-0001 and W-001 are real.\n'
    const found = problems(fixture({ 'docs/mistakes.md': text }))
    expect(found.map((p) => p.code)).toEqual(['REF', 'REF', 'REF', 'REF', 'REF'])
    expect(found.map((p) => p.message).join(' | ')).toContain('W-0011 is not a valid id: W- ids have 3 digits')
  })

  it('does not read an id out of code or a web address', () => {
    const body = 'An id looks like `W-999`. See https://example.com/issues/D-0099 for more.\n\n```\nD-0098\n```'
    expect(codes(fixture({ 'docs/roadmap.md': roadmap(body) }))).toEqual([])
  })

  it('fails an id that is defined twice', () => {
    const twice = '# Roadmap\n\n| ID | Team | Item |\n|---|---|---|\n| W-001 | chem | Retune the model |\n| W-001 | chem | Something else |\n'
    expect(codes(fixture({ 'docs/roadmap.md': twice }))).toEqual(['REF docs/roadmap.md'])
    expect(codes(fixture({ 'docs/mistakes.md': '# Mistakes\n\n## M-0001 One\n\n## M-0001 Two\n' }))).toEqual(['REF docs/mistakes.md'])
  })
})

describe('decision records', () => {
  const broken = (text: string) => problems(fixture({ 'docs/decisions/0001-plain-engine.md': text })).map((p) => `${p.code}: ${p.message}`)

  it('fails a record with a missing or unknown field', () => {
    expect(broken(decision('D-0001', 'done'))[0]).toContain('"- Status:" must be one of')
    expect(broken(decision('D-0001', 'accepted').replace('- Decided by: Sam\n', ''))[0]).toContain('Decided by')
    expect(broken(decision('D-0001', 'accepted').replace('Teams: chem', 'Teams: growth'))[0]).toContain('"growth"')
    expect(broken(decision('D-0001', 'accepted').replace('- Teams: chem\n', ''))[0]).toContain('missing "- Teams:"')
    expect(broken(decision('D-0001', 'accepted').replace('2026-11-12', 'last Tuesday'))[0]).toContain('must be a date')
    expect(broken(decision('D-0001', 'accepted').replace('## Consequences', '## Results'))[0]).toContain('## Consequences')
    expect(broken(decision('D-0002', 'accepted'))[0]).toContain('# D-0001: <title>')
  })

  it('wants a superseded record to name what replaced it', () => {
    expect(broken(decision('D-0001', 'superseded'))[0]).toContain('Superseded by: D-NNNN')
    const second = decision('D-0002', 'accepted').replace('The engine is plain TypeScript', 'The engine may use a solver library')
    const files = { 'docs/decisions/0001-plain-engine.md': decision('D-0001', 'superseded', '- Superseded by: D-0002\n'), 'docs/decisions/0002-solver-library.md': second }
    expect(codes(fixture(files))).toEqual([])
  })

  it('fails two records with the same number', () => {
    const found = problems(fixture({ 'docs/decisions/0001-solver-library.md': decision('D-0001', 'proposed') }))
    expect(found.map((p) => `${p.code} ${p.file}`)).toEqual(['DECISION docs/decisions/0001-solver-library.md'])
    expect(found[0]?.message).toContain('D-0001 is also docs/decisions/0001-plain-engine.md')
  })

  it('fails an index that is missing or does not match the records, and says how to fix it', () => {
    expect(codes(fixture({ 'docs/decisions/README.md': '# Decisions\n' }))).toEqual(['DECISION docs/decisions/README.md'])
    const dir = fixture()
    write(dir, { 'docs/decisions/0002-solver-library.md': decision('D-0002', 'proposed') })
    const found = problems(dir)
    expect(found.map((p) => p.code)).toEqual(['DECISION'])
    expect(found[0]?.message).toContain('pnpm docs:index')
    expect(writeDecisionIndex(openRepo(dir))).toBe(true)
    expect(problems(dir)).toEqual([])
    expect(writeDecisionIndex(openRepo(dir))).toBe(false)
  })
})

describe('the handoff', () => {
  const handoff = (body: string) => codes(fixture({ 'HANDOFF.md': `# Handoff\n\n${body}` }))

  it('fails a heading that is not "date (team) title", an unknown team, and a file with no entries', () => {
    expect(handoff('## Friday: set up the repo\n')).toEqual(['HANDOFF HANDOFF.md', 'HANDOFF HANDOFF.md'])
    expect(handoff('## 2026-11-13 (growth) Set up the repo\n')).toEqual(['HANDOFF HANDOFF.md'])
    expect(handoff('Nothing yet.\n')).toEqual(['HANDOFF HANDOFF.md'])
  })

  it('fails a missing file', () => {
    const json = config((c) => (c.owners = c.owners.filter((o) => o.path !== 'HANDOFF.md')))
    expect(codes(fixture({ 'docs/ownership.json': json, 'HANDOFF.md': null }))).toEqual(['HANDOFF HANDOFF.md'])
  })

  it('accepts entries in any order, because a merge of two branches keeps both sides as they come', () => {
    expect(handoff('## 2026-11-12 (lead) First\n\n## 2026-11-13 (chem) Second\n\n```\n## not a heading\n```\n')).toEqual([])
  })
})

describe('voice', () => {
  it('fails an em dash inside a sentence and a word on the banned list', () => {
    expect(codes(fixture({ 'docs/roadmap.md': roadmap('The model settles — slowly.') }))).toEqual(['VOICE-DASH docs/roadmap.md'])
    expect(codes(fixture({ 'docs/roadmap.md': roadmap('We leverage a robust solver.') }))).toEqual(['VOICE-WORD docs/roadmap.md'])
  })

  it('leaves quotes, code and headings alone', () => {
    expect(codes(fixture({ 'docs/roadmap.md': roadmap('> Sam: "make it robust — and lively"') }))).toEqual([])
    expect(codes(fixture({ 'docs/roadmap.md': roadmap('The function `unlocked` and the text `a — b` are code.') }))).toEqual([])
    expect(codes(fixture({ 'docs/roadmap.md': roadmap('## Next — after the first release') }))).toEqual([])
  })
})

describe('a change in progress', () => {
  // git exports GIT_DIR and friends inside a hook or `git rebase --exec`. Without clearing them,
  // these commands would act on the real repo instead of the made-up one.
  const env = { ...process.env }
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX']) delete env[name]
  const git = (dir: string, ...args: string[]) =>
    execFileSync('git', ['-C', dir, '-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { stdio: 'pipe', env })

  /** BASE committed on a first branch, with a work branch checked out on top of it. */
  function branch(first = 'main'): string {
    const dir = fixture()
    git(dir, 'init', '-q', '-b', first)
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'base')
    git(dir, 'checkout', '-q', '-b', 'chem/retune')
    return dir
  }
  const entry = '# Handoff\n\n## 2026-11-14 (chem) Retuned the model\n\nDone.\n\n## 2026-11-13 (lead) Set up the repo\n\nDone.\n\n## 2026-11-12 (chem) Wrote the solver\n\nDone.\n'
  const retuned = "import { H } from './elements'\nexport const solve = () => H + 1\n"

  it('passes when nothing differs from main', () => {
    expect(problems(branch())).toEqual([])
  })

  it('fails changed files with no new handoff entry, whether committed or not', () => {
    const dir = branch()
    write(dir, { 'src/chem/solve.ts': retuned })
    expect(codes(dir)).toEqual(['CHANGE-HANDOFF HANDOFF.md'])
    git(dir, 'commit', '-q', '-am', 'retune')
    expect(codes(dir)).toEqual(['CHANGE-HANDOFF HANDOFF.md'])
    write(dir, { 'HANDOFF.md': entry })
    expect(codes(dir)).toEqual([])
  })

  it('counts a new file that is not committed yet', () => {
    const dir = branch()
    write(dir, { 'docs/notes.md': '# Notes\n', 'docs/README.md': `${BASE['docs/README.md']}- [Notes](notes.md)\n` })
    expect(codes(dir)).toEqual(['CHANGE-HANDOFF HANDOFF.md'])
  })

  it('fails a rewrite of an accepted decision, committed or not, and lets its status change', () => {
    const dir = branch()
    write(dir, { 'HANDOFF.md': entry, 'docs/decisions/0001-plain-engine.md': decision('D-0001', 'accepted').replace('What.', 'Something else.') })
    expect(codes(dir)).toEqual(['DECISION-FROZEN docs/decisions/0001-plain-engine.md'])
    git(dir, 'commit', '-q', '-am', 'rewrite')
    expect(codes(dir)).toEqual(['DECISION-FROZEN docs/decisions/0001-plain-engine.md'])
    const second = decision('D-0002', 'accepted').replace('The engine is plain TypeScript', 'The engine may use a solver library')
    write(dir, {
      'docs/decisions/0001-plain-engine.md': decision('D-0001', 'superseded', '- Superseded by: D-0002\n'),
      'docs/decisions/0002-solver-library.md': second,
    })
    writeDecisionIndex(openRepo(dir))
    expect(codes(dir)).toEqual([])
  })

  it('fails an accepted decision that was renamed or deleted', () => {
    const renamed = branch()
    git(renamed, 'mv', 'docs/decisions/0001-plain-engine.md', 'docs/decisions/0001-engine.md')
    write(renamed, { 'HANDOFF.md': entry })
    writeDecisionIndex(openRepo(renamed))
    git(renamed, 'add', '-A')
    git(renamed, 'commit', '-q', '-m', 'rename')
    expect(codes(renamed)).toEqual(['DECISION-FROZEN docs/decisions/0001-plain-engine.md'])

    const deleted = branch()
    write(deleted, { 'HANDOFF.md': entry, 'docs/decisions/0001-plain-engine.md': null })
    writeDecisionIndex(openRepo(deleted))
    expect(codes(deleted)).toEqual(['DECISION-FROZEN docs/decisions/0001-plain-engine.md'])
  })

  it('says so when it cannot find the branch to compare with', () => {
    const typo = problems(branch(), { base: 'origin/mian' })
    expect(typo.map((p) => p.code)).toEqual(['CHANGE-BASE'])
    expect(typo[0]?.message).toContain('"origin/mian"')
    const noMain = problems(branch('trunk'))
    expect(noMain.map((p) => p.code)).toEqual(['CHANGE-BASE'])
    expect(noMain[0]?.message).toContain('looked for origin/main and main')
    expect(problems(branch('trunk'), { base: 'trunk' })).toEqual([])
  })

  it('can be told to skip the change checks', () => {
    const dir = branch()
    write(dir, { 'src/chem/solve.ts': retuned })
    expect(problems(dir, { change: false })).toEqual([])
  })
})

describe('the real docs/ownership.json', () => {
  const real = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'ownership.json'), 'utf8'))
  const allowed = (file: string, spec: string) => importProblem(real, file, spec) === null

  it('keeps the engine and the tokens free of packages and of other folders', () => {
    expect(allowed('src/chem/solve.ts', './elements')).toBe(true)
    expect(allowed('src/chem/solve.ts', '.')).toBe(true)
    expect(allowed('src/chem/solve.ts', 'react')).toBe(false)
    expect(allowed('src/chem/solve.ts', '@/chem/../shell/progress')).toBe(false)
    expect(allowed('src/theme/tokens.ts', 'react-native')).toBe(false)
  })

  it('lets a module reach the engine and the tokens, and nothing else in src/', () => {
    expect(allowed('src/modules/lewis/ui.ts', '../../chem/assess')).toBe(true)
    expect(allowed('src/modules/lewis/ui.ts', '../../theme/tokens')).toBe(true)
    expect(allowed('src/modules/lewis/ui.ts', 'three')).toBe(true)
    expect(allowed('src/modules/lewis/ui.ts', '../../shell/ModuleCard')).toBe(false)
    expect(allowed('src/modules/lewis/ui.ts', '../acid/guide')).toBe(false)
  })

  it('lets the shell read the registry file and no other file under src/modules/', () => {
    expect(allowed('src/shell/ModuleCard.tsx', '@/modules/registry')).toBe(true)
    expect(allowed('src/shell/ModuleCard.tsx', '@/modules/registry/extra')).toBe(false)
    expect(allowed('src/shell/ModuleCard.tsx', '@/modules/lewis/store')).toBe(false)
    expect(allowed('src/shell/Atom.tsx', '@/modules/lewis/palette')).toBe(true) // the one exception on file
  })

  it('lets routes and the shell use assets, keeps scripts out of src/, and leaves tests free', () => {
    expect(allowed('src/app/index.tsx', '@/assets/images/icon.png')).toBe(true)
    expect(allowed('src/shell/ModuleCard.tsx', '@/assets/images/icon.png')).toBe(true)
    expect(allowed('scripts/check-repo.mjs', './lib/repo.mjs')).toBe(true)
    expect(allowed('scripts/check-repo.mjs', '../src/chem/solve')).toBe(false)
    expect(allowed('tests/solve.test.ts', '../src/chem/solve')).toBe(true)
  })

  it('makes a new folder under src/ declare its owner and its import rule', () => {
    expect(ownerOf(real, 'src/modules/acid/ui.ts')).toBeNull()
    expect(importProblem(real, 'src/data/load.ts')).toBe('norule')
  })
})
