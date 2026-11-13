// The repo's structure rules as functions: who owns a path, which rule files apply to it, and
// every check that scripts/check-repo.mjs runs. The team map, the scopes and the import rules
// are read from docs/ownership.json. Nothing here writes a file except writeDecisionIndex().
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'

export const ROOT_AGENTS_LINES = 80
export const SCOPE_AGENTS_LINES = 60
export const STATUSES = ['proposed', 'provisional', 'accepted', 'superseded', 'rejected']
export const SCOPE_HEADINGS = ['## Read first', '## Rules', '## Check your work', '## Update when you change this']
export const INDEX_START = '<!-- index:start -->'
export const INDEX_END = '<!-- index:end -->'

// Words Sam's voice rules rule out in any prose (his global CLAUDE.md).
const BANNED = /\b(seamless(ly)?|comprehensive(ly)?|robust(ly|ness)?|leverag(e|es|ed|ing)|delv(e|es|ed|ing)|showcas(e|es|ed|ing)|elevat(e|es|ed|ing)|unlock(s|ed|ing)?)\b/i
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.expo', 'shots', 'web-build', 'ios', 'android'])
const DECISION_FILE = /^docs\/decisions\/(\d{4})-[a-z0-9-]+\.md$/
const CODE_FILE = /\.(ts|tsx|mts|mjs|js|jsx)$/
const EXTENSION = /\.(ts|tsx|mts|mjs|js|jsx|json|css)$/
const REPO_PATH = /^(src|tests|scripts|docs|assets|\.github)\/[A-Za-z0-9_.\/@-]+$/
const PLACEHOLDER = /NNNN|YYYY/
const ID_WIDTH = { D: 4, M: 4, W: 3 }
const ID_HOME = { D: 'docs/decisions/', M: 'docs/mistakes.md', W: 'docs/roadmap.md' }

// ---------------------------------------------------------------------------------------------
// reading the repo

/** Runs git in `root`. A hook or `git rebase --exec` exports GIT_DIR and friends: they are dropped
 *  here so a call can never act on a different repo than the one it names. */
function git(root, args) {
  const env = { ...process.env }
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX']) delete env[name]
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
}

function walk(root, dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    if (SKIP_DIRS.has(name)) continue
    const rel = dir ? `${dir}/${name}` : name
    if (statSync(join(root, rel)).isDirectory()) walk(root, rel, out)
    else out.push(rel)
  }
  return out
}

/** Every file git tracks or would track (not ignored), as paths from the repo root. Outside a git repo, every file. */
export function listFiles(root) {
  const inside = git(root, ['rev-parse', '--show-toplevel'])
  const listed = inside === null ? null : git(root, ['ls-files', '-co', '--exclude-standard', '-z'])
  const files = listed === null ? walk(root, '') : listed.split('\0').filter(Boolean)
  return files.filter((f) => existsSync(join(root, f)) && !statSync(join(root, f)).isDirectory()).sort()
}

/** The repo as the checks see it: the config, the file list, a cached reader, and `has`. */
export function openRepo(root) {
  const cache = new Map()
  const read = (path) => {
    if (!cache.has(path)) cache.set(path, existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null)
    return cache.get(path)
  }
  const raw = read('docs/ownership.json')
  let config = null
  let configError = null
  if (raw === null) configError = 'docs/ownership.json is missing'
  else {
    try {
      config = JSON.parse(raw)
    } catch (error) {
      configError = `docs/ownership.json is not valid JSON: ${error.message}`
    }
  }
  const files = listFiles(root)
  const fileSet = new Set(files)
  /** True for a listed file, or for a folder that holds one. Exact case, on every operating system. */
  const has = (path) => {
    const clean = path.replace(/\/$/, '')
    return clean === '' || fileSet.has(clean) || files.some((f) => f.startsWith(`${clean}/`))
  }
  return { root, config, configError, files, read, has }
}

// ---------------------------------------------------------------------------------------------
// markdown helpers

/** Each line with what it is: inside a code fence, a quote, a heading. */
function mdLines(text) {
  let fenced = false
  return text.split('\n').map((line, index) => {
    const fence = /^\s*(```|~~~)/.test(line)
    const row = { n: index + 1, text: line, code: fenced || fence, quote: /^\s*>/.test(line), heading: /^#{1,6}\s/.test(line) }
    if (fence) fenced = !fenced
    return row
  })
}
const withoutSpans = (line) => line.replace(/`[^`]*`/g, '')
const spansOf = (line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])
const lineCount = (text) => text.replace(/\n+$/, '').split('\n').length
const isHistory = (path) => path === 'HANDOFF.md' || path === 'docs/mistakes.md' || DECISION_FILE.test(path)
const mdFiles = (repo) => repo.files.filter((f) => f.endsWith('.md'))
const agentsPath = (dir) => (dir ? `${dir}/AGENTS.md` : 'AGENTS.md')
const under = (path, dir) => dir === '' || path === dir || path.startsWith(`${dir}/`)

/** The lines of one `## Heading` section, without the heading. */
function section(text, heading) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

// ---------------------------------------------------------------------------------------------
// ownership and scopes

/** The owners entry for a path: the longest matching one. A path ending in "/" matches everything under it. */
export function ownerOf(config, path) {
  let best = null
  for (const entry of config.owners) {
    const hit = entry.path.endsWith('/') ? path.startsWith(entry.path) : path === entry.path
    if (hit && (!best || entry.path.length > best.path.length)) best = entry
  }
  return best
}

/** The rule files that apply to a path, from the repo root down to its folder. */
export function scopeChain(config, path) {
  return config.scopes
    .map((scope) => scope.dir)
    .filter((dir) => under(path, dir))
    .sort((a, b) => a.length - b.length)
    .map(agentsPath)
}

/** Everything `pnpm who <path>` prints for one path, or null when no team owns it. */
export function who(repo, path) {
  const clean = path.replace(/^\.\//, '').replace(/\/$/, '')
  const isDir = repo.files.some((f) => f.startsWith(`${clean}/`))
  const entry = ownerOf(repo.config, isDir ? `${clean}/` : clean)
  if (!entry) return null
  const team = repo.config.teams[entry.team]
  // A file its team owns outside the team's own folders (a test, a script) follows that team's rules too.
  const teamDirs = repo.config.scopes.map((scope) => scope.dir).filter((dir) => dir !== '' && ownerOf(repo.config, `${dir}/`)?.team === entry.team)
  const teamRules = teamDirs.some((dir) => under(clean, dir)) ? [] : teamDirs.map(agentsPath)
  const decisions = readDecisions(repo)
    .filter((d) => d.teams.includes(entry.team) && d.status !== 'superseded' && d.status !== 'rejected')
    .map((d) => ({ id: d.id, status: d.status, title: d.title, file: d.file }))
  return {
    path: clean,
    team: entry.team,
    name: team.name,
    review: entry.review ?? [],
    also: repo.config.reviewByContent ?? [],
    rules: scopeChain(repo.config, isDir ? `${clean}/x` : clean),
    teamRules,
    docs: team.docs ?? [],
    check: team.check,
    decisions,
  }
}

/** The shape of docs/ownership.json, then that every team, doc and path it names exists. */
function checkConfig(repo) {
  const out = []
  const config = repo.config
  const bad = (message) => out.push({ code: 'CONFIG', file: 'docs/ownership.json', message })
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [{ code: 'CONFIG', file: 'docs/ownership.json', message: 'must be a JSON object' }]
  if (!config.teams || typeof config.teams !== 'object' || Array.isArray(config.teams)) bad('needs "teams": an object from team id to { name, does, docs, check }')
  for (const key of ['scopes', 'owners', 'imports']) if (!Array.isArray(config[key])) bad(`needs "${key}": a list`)
  for (const key of ['importExceptions', 'reviewByContent']) if (config[key] !== undefined && !Array.isArray(config[key])) bad(`"${key}" must be a list`)
  if (out.length > 0) return out

  const teams = Object.keys(config.teams)
  for (const [id, team] of Object.entries(config.teams)) {
    for (const key of ['name', 'does', 'check']) if (typeof team?.[key] !== 'string' || !team[key]) bad(`team "${id}" has no "${key}"`)
    if (!Array.isArray(team?.docs)) bad(`team "${id}" needs "docs": a list (it may be empty)`)
    else for (const doc of team.docs) if (!repo.has(doc)) bad(`team "${id}" lists ${doc}, which does not exist`)
  }
  for (const entry of config.owners) {
    if (typeof entry?.path !== 'string' || typeof entry?.team !== 'string') {
      bad('every "owners" entry needs a "path" and a "team"')
      continue
    }
    if (!teams.includes(entry.team)) bad(`"${entry.path}" is owned by "${entry.team}", which is not a team`)
    for (const reviewer of entry.review ?? []) if (!teams.includes(reviewer)) bad(`"${entry.path}" names reviewer "${reviewer}", which is not a team`)
    if (!repo.has(entry.path)) bad(`"${entry.path}" has an owner but does not exist. Remove the entry or fix the path`)
  }
  for (const scope of config.scopes) {
    if (typeof scope?.dir !== 'string') bad('every "scopes" entry needs a "dir"')
    else if (!repo.has(scope.dir)) bad(`scope "${scope.dir}" does not exist`)
  }
  for (const rule of config.imports) {
    if (typeof rule?.from !== 'string' || !Array.isArray(rule?.internal) || !(rule.packages === 'any' || Array.isArray(rule.packages)))
      bad('every "imports" entry needs "from", "internal" (a list) and "packages" ("any" or a list)')
  }
  for (const e of config.importExceptions ?? []) if (typeof e?.from !== 'string' || typeof e?.to !== 'string') bad('every "importExceptions" entry needs "from" and "to"')
  for (const r of config.reviewByContent ?? []) {
    if (typeof r?.team !== 'string' || typeof r?.when !== 'string') bad('every "reviewByContent" entry needs "team" and "when"')
    else if (!teams.includes(r.team)) bad(`"reviewByContent" names "${r.team}", which is not a team`)
  }
  return out
}

/** A linked node_modules lets pnpm in one checkout reinstall another checkout's packages (docs/mistakes.md, M-0003). */
function checkInstall(repo) {
  let linked = false
  try {
    linked = lstatSync(join(repo.root, 'node_modules')).isSymbolicLink()
  } catch {
    // no node_modules yet: nothing to check
  }
  return linked
    ? [{ code: 'DEPS-LINK', file: 'node_modules', message: 'is a link to another folder. Delete the link and run `CI=true pnpm install --frozen-lockfile < /dev/null` here' }]
    : []
}

function checkOwners(repo) {
  return repo.files
    .filter((file) => !ownerOf(repo.config, file))
    .map((file) => ({ code: 'OWNER', file, message: 'no team owns this path. Add it to "owners" in docs/ownership.json' }))
}

/** The names a "## Files" section lists: the backticked names that start each bullet, before its colon. */
function listedNames(text) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .flatMap((line) => spansOf(line.slice(2).split(/:(\s|$)/)[0]))
    .map((name) => name.replace(/\/$/, ''))
}

function checkScopes(repo) {
  const out = []
  const dirs = repo.config.scopes.map((scope) => scope.dir)
  const nearest = (file) => dirs.filter((dir) => under(file, dir)).sort((a, b) => b.length - a.length)[0]
  for (const scope of repo.config.scopes) {
    const file = agentsPath(scope.dir)
    const text = repo.read(file)
    if (text === null) {
      out.push({ code: 'SCOPE', file, message: 'this scope has no AGENTS.md. Write one from the template in docs/AGENTS.md' })
      continue
    }
    const pair = scope.dir ? `${scope.dir}/CLAUDE.md` : 'CLAUDE.md'
    if ((repo.read(pair) ?? '').trim() !== '@AGENTS.md')
      out.push({ code: 'AGENTS-PAIR', file: pair, message: 'must hold exactly "@AGENTS.md", so Claude Code loads the same rules every other tool reads' })
    const limit = scope.dir ? SCOPE_AGENTS_LINES : ROOT_AGENTS_LINES
    if (lineCount(text) > limit)
      out.push({ code: 'AGENTS-SIZE', file, message: `${lineCount(text)} lines, and the limit is ${limit}. Move detail into the area's doc and link it` })
    if (!scope.dir) continue
    for (const heading of SCOPE_HEADINGS)
      if (section(text, heading) === null) out.push({ code: 'SCOPE', file, message: `missing the "${heading}" section` })
    if (!scope.files) continue
    const listed = section(text, '## Files')
    if (listed === null) {
      out.push({ code: 'FILES', file, message: 'missing the "## Files" section that says what each file in this folder holds' })
      continue
    }
    const names = listedNames(listed)
    // every file under this folder, down to (and not into) a subfolder that is a scope of its own
    const here = repo.files.filter((f) => nearest(f) === scope.dir && f !== file && f !== pair).map((f) => f.slice(scope.dir.length + 1))
    for (const name of here)
      if (!names.includes(name))
        out.push({ code: 'FILES', file, message: `${scope.dir}/${name} is not listed under "## Files". Add a bullet that starts with \`${name}\` and says what it holds` })
    for (const name of names)
      if (!repo.has(`${scope.dir}/${name}`))
        out.push({ code: 'FILES', file, message: `"## Files" lists ${name}, which is not in ${scope.dir}/. Remove it or fix the name` })
  }
  for (const file of repo.files) {
    if (posix.basename(file) !== 'AGENTS.md') continue
    const dir = posix.dirname(file) === '.' ? '' : posix.dirname(file)
    if (!dirs.includes(dir)) out.push({ code: 'SCOPE', file, message: 'this AGENTS.md is not a scope. Add its folder to "scopes" in docs/ownership.json' })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// import boundaries

/** The source with comments blanked out and multi-line template strings emptied, so only real code is
 *  searched. Line breaks are kept. A template string nested inside another's `${}` can end the outer
 *  one early: imports sit at the top of a file, above any such string. */
export function codeOnly(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' '
        i += 1
      }
    } else if (c === '/' && next === '*') {
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' '
        i += 1
      }
      out += '  '
      i += 2
    } else if (c === "'" || c === '"') {
      out += c
      i += 1
      while (i < text.length && text[i] !== c && text[i] !== '\n') {
        if (text[i] === '\\') {
          out += text[i]
          i += 1
        }
        out += text[i] ?? ''
        i += 1
      }
      if (text[i] === c) {
        out += c
        i += 1
      }
    } else if (c === '`') {
      let end = i + 1
      while (end < text.length && text[end] !== '`') end += text[end] === '\\' ? 2 : 1
      const body = text.slice(i + 1, end)
      out += `\`${body.includes('\n') || body.includes('${') ? body.replace(/[^\n]/g, ' ') : body}\``
      i = end + 1
    } else {
      out += c
      i += 1
    }
  }
  return out
}

/** Every module a source file imports, as written in the file. */
export function importsOf(text) {
  const code = codeOnly(text)
  const found = new Set()
  const patterns = [
    /^\s*(?:import|export)\s+(?:type\s+)?[\w\s{},*$]*?\bfrom\s*['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\brequire\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\bimport\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ]
  for (const pattern of patterns) for (const match of code.matchAll(pattern)) found.add(match[1])
  return [...found]
}

/** Where an import points: a path from the repo root (extension as written), or a package name. */
export function resolveImport(file, spec) {
  if (spec.startsWith('.')) return { path: posix.normalize(posix.join(posix.dirname(file), spec)) }
  if (spec.startsWith('@/assets/')) return { path: posix.normalize(spec.slice(2)) }
  if (spec.startsWith('@/')) return { path: posix.normalize(`src/${spec.slice(2)}`) }
  const parts = spec.split('/')
  return { pkg: spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] }
}

/** A rule's "from" as a pattern: a folder ("src/chem/"), one file, or a folder with "*" for one name. */
function fromPattern(from) {
  const escaped = from.replace(/[.+?^$(){}|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')
  return new RegExp(`^${escaped}${from.endsWith('/') ? '' : '$'}`)
}

function ruleFor(config, file) {
  let best = null
  for (const rule of config.imports) {
    const match = fromPattern(rule.from).exec(file)
    if (match && (!best || rule.from.length > best.rule.from.length)) best = { rule, self: match[0] }
  }
  return best
}

const stem = (path) => path.replace(EXTENSION, '')
/** A folder entry ("src/chem/") allows everything under it and the folder itself. A file entry allows that one file. */
const reaches = (target, allowed) => (allowed.endsWith('/') ? target.startsWith(allowed) || target === allowed.slice(0, -1) : stem(target) === stem(allowed))

/** Why `file` may not import `spec`, or null when it may. "norule" when no rule covers a file under src/. */
export function importProblem(config, file, spec) {
  const found = ruleFor(config, file)
  if (!found) return file.startsWith('src/') ? 'norule' : null
  if (spec === undefined) return null
  const internal = found.rule.internal.map((entry) => (entry === '{self}' ? found.self : entry))
  const target = resolveImport(file, spec)
  if (target.pkg) {
    if (found.rule.packages === 'any' || found.rule.packages.includes(target.pkg)) return null
    return `imports the package "${target.pkg}", and ${found.rule.from} may not (docs/architecture.md)`
  }
  if (internal.some((allowed) => reaches(target.path, allowed))) return null
  if ((config.importExceptions ?? []).some((e) => e.from === file && reaches(target.path, e.to))) return null
  return `imports ${target.path}, and ${found.rule.from} may only import from ${internal.join(', ') || 'packages'} (docs/architecture.md)`
}

function checkImports(repo) {
  const out = []
  for (const file of repo.files) {
    if (!CODE_FILE.test(file)) continue
    if (importProblem(repo.config, file) === 'norule') {
      out.push({ code: 'IMPORT', file, message: 'no import rule covers this file. Add one to "imports" in docs/ownership.json and to docs/architecture.md' })
      continue
    }
    for (const spec of importsOf(repo.read(file))) {
      const message = importProblem(repo.config, file, spec)
      if (message) out.push({ code: 'IMPORT', file, message })
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// docs: links, the docs map, decisions, ids, the handoff, voice

function linkTargets(file, text) {
  const out = []
  for (const row of mdLines(text)) {
    if (row.code) continue
    for (const match of withoutSpans(row.text).matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const raw = match[1]
      if (/^(https?:|mailto:|#)/.test(raw)) continue
      out.push({ n: row.n, raw, path: posix.normalize(posix.join(posix.dirname(file), raw.replace(/#.*$/, ''))) })
    }
  }
  return out
}

function checkLinks(repo) {
  const out = []
  for (const file of mdFiles(repo)) {
    if (isHistory(file)) continue
    const text = repo.read(file)
    for (const link of linkTargets(file, text))
      if (!repo.has(link.path)) out.push({ code: 'LINK', file, line: link.n, message: `links to ${link.raw}, which does not exist` })
    for (const row of mdLines(text)) {
      if (row.code) continue
      for (const span of spansOf(row.text)) {
        if (!REPO_PATH.test(span) || PLACEHOLDER.test(span)) continue
        if (!repo.has(span)) out.push({ code: 'LINK', file, line: row.n, message: `names \`${span}\`, which does not exist` })
      }
    }
  }
  return out
}

function checkDocMap(repo) {
  const map = repo.read('docs/README.md')
  if (map === null) return [{ code: 'DOCMAP', file: 'docs/README.md', message: 'missing. It is the map of every doc and what goes where' }]
  const linked = new Set(linkTargets('docs/README.md', map).map((link) => link.path))
  return mdFiles(repo)
    .filter((f) => f.startsWith('docs/') && f !== 'docs/README.md' && !DECISION_FILE.test(f) && !/(^|\/)(AGENTS|CLAUDE)\.md$/.test(f))
    .filter((f) => !linked.has(f))
    .map((file) => ({ code: 'DOCMAP', file, message: 'docs/README.md does not link to this doc. Add it to the map, or delete the doc' }))
}

/** One decision record's fields, read from its text. */
export function parseDecision(file, text) {
  const head = /^# (D-\d{4}): (.+)$/m.exec(text)
  const field = (name) => new RegExp(`^- ${name}: (.+)$`, 'm').exec(text)?.[1].trim() ?? null
  return {
    file,
    number: DECISION_FILE.exec(file)?.[1] ?? null,
    id: head?.[1] ?? null,
    title: head?.[2].trim() ?? null,
    status: field('Status'),
    date: field('Date'),
    by: field('Decided by'),
    teams: (field('Teams') ?? '').split(',').map((team) => team.trim()).filter(Boolean),
    supersededBy: field('Superseded by'),
    text,
  }
}

export function readDecisions(repo) {
  return repo.files.filter((f) => DECISION_FILE.test(f)).map((f) => parseDecision(f, repo.read(f)))
}

/** The index table in docs/decisions/README.md, built from the records. */
export function buildDecisionIndex(decisions) {
  const rows = decisions
    .filter((d) => d.id)
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((d) => `| [${d.id}](${posix.basename(d.file)}) | ${d.title} | ${d.status} | ${d.by} | ${d.teams.join(', ')} |`)
  return ['| ID | Decision | Status | Decided by | Teams |', '|---|---|---|---|---|', ...rows].join('\n')
}

function indexParts(text) {
  const start = text.indexOf(INDEX_START)
  const end = text.indexOf(INDEX_END)
  if (start < 0 || end < start) return null
  return { before: text.slice(0, start + INDEX_START.length), table: text.slice(start + INDEX_START.length, end).trim(), after: text.slice(end) }
}

/** Rewrites the index table. Returns true when the file changed. */
export function writeDecisionIndex(repo) {
  const file = 'docs/decisions/README.md'
  const parts = indexParts(repo.read(file) ?? '')
  if (!parts) return false
  const next = `${parts.before}\n${buildDecisionIndex(readDecisions(repo))}\n${parts.after}`
  if (next === repo.read(file)) return false
  writeFileSync(join(repo.root, file), next)
  return true
}

function checkDecisions(repo) {
  const out = []
  const teams = Object.keys(repo.config.teams)
  const decisions = readDecisions(repo)
  const seen = new Map()
  for (const d of decisions) {
    const bad = (message) => out.push({ code: 'DECISION', file: d.file, message })
    if (seen.has(d.number)) bad(`D-${d.number} is also ${seen.get(d.number)}. Give this record the next free number`)
    seen.set(d.number, d.file)
    if (d.id !== `D-${d.number}`) bad(`the first line must be "# D-${d.number}: <title>"`)
    if (!STATUSES.includes(d.status)) bad(`"- Status:" must be one of ${STATUSES.join(', ')}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '')) bad('"- Date:" must be a date like 2026-11-13')
    if (!d.by) bad('missing "- Decided by:"')
    if (d.teams.length === 0) bad('missing "- Teams:" (the teams this decision binds)')
    for (const team of d.teams) if (!teams.includes(team)) bad(`"- Teams:" names "${team}", which is not a team in docs/ownership.json`)
    if (d.status === 'superseded' && !/^D-\d{4}$/.test(d.supersededBy ?? '')) bad('a superseded record needs "- Superseded by: D-NNNN"')
    for (const heading of ['## Context', '## Decision', '## Consequences']) if (section(d.text, heading) === null) bad(`missing the "${heading}" section`)
  }
  const index = repo.read('docs/decisions/README.md')
  const parts = index === null ? null : indexParts(index)
  if (!parts) out.push({ code: 'DECISION', file: 'docs/decisions/README.md', message: `needs an index between ${INDEX_START} and ${INDEX_END}` })
  else if (parts.table !== buildDecisionIndex(decisions))
    out.push({ code: 'DECISION', file: 'docs/decisions/README.md', message: 'the index does not match the records. Run `pnpm docs:index`' })
  return out
}

/** Every D-, M- and W- id that is used must be defined once: a decision file, a heading in the mistakes log, a roadmap row. */
function checkRefs(repo) {
  const out = []
  const defined = { D: readDecisions(repo).map((d) => d.id) }
  defined.M = [...(repo.read('docs/mistakes.md') ?? '').matchAll(/^## (M-\d{4})\b/gm)].map((m) => m[1])
  defined.W = [...(repo.read('docs/roadmap.md') ?? '').matchAll(/^\| (W-\d{3}) \|/gm)].map((m) => m[1])
  for (const kind of ['M', 'W']) {
    for (const id of new Set(defined[kind].filter((id, index, all) => all.indexOf(id) !== index)))
      out.push({ code: 'REF', file: ID_HOME[kind], message: `${id} is defined twice. Give the second one the next free id` })
  }
  const check = (file, n, text) => {
    for (const match of text.matchAll(/\b([DMW])-(\d+)\b/g)) {
      const [id, kind, digits] = match
      if (digits.length !== ID_WIDTH[kind]) out.push({ code: 'REF', file, line: n, message: `${id} is not a valid id: ${kind}- ids have ${ID_WIDTH[kind]} digits` })
      else if (!defined[kind].includes(id)) out.push({ code: 'REF', file, line: n, message: `${id} is not in ${ID_HOME[kind]}` })
    }
  }
  for (const file of mdFiles(repo)) for (const row of mdLines(repo.read(file))) if (!row.code) check(file, row.n, withoutSpans(row.text).replace(/https?:\S+/g, ''))
  ;(repo.read('docs/ownership.json') ?? '').split('\n').forEach((line, index) => check('docs/ownership.json', index + 1, line))
  return out
}

function checkHandoff(repo) {
  const text = repo.read('HANDOFF.md')
  if (text === null) return [{ code: 'HANDOFF', file: 'HANDOFF.md', message: 'missing' }]
  const out = []
  const teams = Object.keys(repo.config.teams)
  let entries = 0
  for (const row of mdLines(text)) {
    if (row.code || !/^## /.test(row.text)) continue
    const entry = /^## (\d{4}-\d{2}-\d{2}) \(([a-z]+)\) \S/.exec(row.text)
    if (!entry) {
      out.push({ code: 'HANDOFF', file: 'HANDOFF.md', line: row.n, message: 'an entry heading must look like "## 2026-11-13 (team) What changed"' })
      continue
    }
    entries += 1
    if (!teams.includes(entry[2])) out.push({ code: 'HANDOFF', file: 'HANDOFF.md', line: row.n, message: `"${entry[2]}" is not a team in docs/ownership.json` })
  }
  if (entries === 0) out.push({ code: 'HANDOFF', file: 'HANDOFF.md', message: 'has no entries' })
  return out
}

function checkVoice(repo) {
  const out = []
  for (const file of mdFiles(repo)) {
    for (const row of mdLines(repo.read(file))) {
      if (row.code || row.quote) continue
      const prose = withoutSpans(row.text)
      if (!row.heading && prose.includes('—'))
        out.push({ code: 'VOICE-DASH', file, line: row.n, message: 'an em dash inside a sentence. Use a period, a colon, parentheses or "and"' })
      const word = BANNED.exec(prose)
      if (word) out.push({ code: 'VOICE-WORD', file, line: row.n, message: `"${word[0]}" is on the list of words Sam's voice rules rule out. Say the plain thing` })
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// the change in progress: everything that differs from the base branch

const frozenPart = (text) => text.split('\n').filter((line) => !/^- (Status|Superseded by): /.test(line)).join('\n').trim()

function checkChange(repo, wanted) {
  if (git(repo.root, ['rev-parse', '--show-toplevel']) === null) return []
  const resolves = (ref) => git(repo.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null
  const stop = (message) => [{ code: 'CHANGE-BASE', file: 'HANDOFF.md', message }]
  const asked = wanted ?? process.env.CHECK_BASE
  if (asked && !resolves(asked)) return stop(`cannot find "${asked}" to compare this change with. Fix the name or fetch it`)
  const base = asked ?? ['origin/main', 'main'].find(resolves)
  if (!base) return stop('found no branch to compare this change with (looked for origin/main and main). Pass --base <ref>, or --no-change to skip')
  const mergeBase = git(repo.root, ['merge-base', 'HEAD', base])?.trim()
  if (!mergeBase) return stop(`cannot find where this branch left ${base}. Fetch the full history, or pass --no-change to skip`)

  const diff = git(repo.root, ['diff', '--name-only', '--no-renames', '-z', mergeBase]) ?? ''
  const untracked = git(repo.root, ['ls-files', '-o', '--exclude-standard', '-z']) ?? ''
  const changed = new Set([...diff.split('\0'), ...untracked.split('\0')].filter(Boolean))
  if (changed.size === 0) return []
  const out = []
  if (!changed.has('HANDOFF.md') || repo.read('HANDOFF.md') === null)
    out.push({ code: 'CHANGE-HANDOFF', file: 'HANDOFF.md', message: `${changed.size} files differ from ${base} and HANDOFF.md has no new entry. Add one at the top: team, what changed, what you checked, asks, next step` })
  for (const file of changed) {
    if (!DECISION_FILE.test(file)) continue
    const before = git(repo.root, ['show', `${mergeBase}:${file}`])
    if (before === null || parseDecision(file, before).status !== 'accepted') continue
    const now = repo.read(file)
    if (now === null || frozenPart(now) !== frozenPart(before))
      out.push({ code: 'DECISION-FROZEN', file, message: 'an accepted decision is never rewritten, renamed or deleted. Only its Status and "Superseded by" lines may change: restore it and write a new record that supersedes it' })
  }
  return out
}

// ---------------------------------------------------------------------------------------------

/** Each check by name, for the tests and for running one rule against another checkout. */
export const checks = {
  config: checkConfig,
  install: checkInstall,
  owners: checkOwners,
  scopes: checkScopes,
  imports: checkImports,
  links: checkLinks,
  docMap: checkDocMap,
  decisions: checkDecisions,
  refs: checkRefs,
  handoff: checkHandoff,
  voice: checkVoice,
  change: checkChange,
}

/** Every problem the checks find, in file order. An empty list means the repo follows its own rules.
 *  A problem in docs/ownership.json is reported alone: every other check reads that file. */
export function runAll(root, options = {}) {
  const repo = openRepo(root)
  if (repo.configError) return [{ code: 'CONFIG', file: 'docs/ownership.json', message: repo.configError }]
  const config = checkConfig(repo)
  if (config.length > 0) return config
  const problems = Object.values(checks)
    .filter((check) => check !== checkConfig && check !== checkChange)
    .flatMap((check) => check(repo))
  if (options.change !== false) problems.push(...checkChange(repo, options.base))
  return problems.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code))
}
