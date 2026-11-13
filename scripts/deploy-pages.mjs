// Builds the web app for GitHub Pages and publishes it to the gh-pages branch.
//
//   node scripts/deploy-pages.mjs --build-only   build into dist-pages/ and stop
//   node scripts/deploy-pages.mjs                build, then push dist-pages/ to gh-pages
//
// GitHub Pages serves a project from a folder named after the repository, so the build sets the
// address prefix (WEB_BASE_URL, read in app.config.js). The local build in dist/ has no prefix.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
const read = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

const remote = read('git', ['remote', 'get-url', 'origin'])
const repo = remote.replace(/\.git$/, '').split('/').pop()
const base = `/${repo}`
const out = 'dist-pages'

rmSync(out, { recursive: true, force: true })
run('pnpm', ['exec', 'expo', 'export', '-p', 'web', '--output-dir', out], { env: { ...process.env, WEB_BASE_URL: base } })

// every address in the pages has to start with the folder, or the site loads without its scripts
const home = readFileSync(join(out, 'index.html'), 'utf8')
if (!home.includes(`${base}/_expo/`)) throw new Error(`${out}/index.html does not load its scripts from ${base}/_expo/`)

// GitHub Pages skips folders that start with an underscore unless this file is there
writeFileSync(join(out, '.nojekyll'), '')
// and it shows 404.html for an address that has no page
if (existsSync(join(out, '+not-found.html'))) cpSync(join(out, '+not-found.html'), join(out, '404.html'))
console.log(`Built ${out}/ for ${base}/`)

if (process.argv.includes('--build-only')) process.exit(0)

// one commit that holds the whole site replaces the gh-pages branch
const sha = read('git', ['rev-parse', '--short', 'HEAD'])
const dirty = read('git', ['status', '--porcelain']) !== ''
const work = mkdtempSync(join(tmpdir(), 'pages-'))
cpSync(out, work, { recursive: true })
const git = (...args) => run('git', args, { cwd: work })
git('init', '--quiet', '--initial-branch=gh-pages')
git('add', '--all')
git('commit', '--quiet', '-m', `Deploy ${sha}${dirty ? ' with uncommitted changes' : ''}`)
git('push', '--force', remote, 'gh-pages')
rmSync(work, { recursive: true, force: true })
console.log(`Published ${sha} to the gh-pages branch of ${remote}`)
