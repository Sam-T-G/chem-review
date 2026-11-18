// Real-input check of the 3D board's own controls in headless Chromium: the four tabs and the back
// button in the top bar, the switch between the electron geometry and the molecular geometry on the
// lifted model, and the 3D model of a molecule of two atoms. Every action is a real pointer, touch or
// key event sent through the browser, aimed at a point where document.elementFromPoint finds the
// control. Nothing is clicked or focused from script. Reads what is on the page.
//
// Usage: node scripts/check-board.mjs [desktop|phone]
// Needs the built site served on port 5210 (pnpm web:serve), or MB_URL pointing at one.
// MB_SHOTS=1 saves screenshots to shots/.
import { chromium } from 'playwright'

const [size = 'desktop'] = process.argv.slice(2)
const base = (process.env.MB_URL ?? 'http://localhost:5210').replace(/\/$/, '')
const folder = new URL(base).pathname.replace(/\/$/, '')
const phone = size === 'phone'
const viewport = phone ? { width: 390, height: 844 } : { width: 1360, height: 840 }
const SHOTS = process.env.MB_SHOTS === '1'

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
// a headless page that is not in front freezes its animations
await cdp.send('Page.bringToFront')
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`${base}/lewis`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })
await page.waitForTimeout(800)

let passed = 0
const failed = []
const ok = (cond, label) => { if (cond) passed++; else { failed.push(label); console.log(`  FAIL ${label}`) } }
const wait = (ms) => page.waitForTimeout(ms)
const mb = (fn, arg) => page.evaluate(fn, arg)
const state = () => mb(() => { const s = window.__mb.store.getState(); return { mode: s.mode, atoms: s.s.atoms, bonds: s.s.bonds, view: s.view, groupsView: s.groupsView, selection: s.selection } })
const points = () => mb(() => window.__mb.scene.debugPoints())
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `shots/board-${size}-${name}.png` }) }
const noSideScroll = async (label) => ok((await mb(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, `${label}: no sideways scroll`)

// ---- real input
const tapAt = async (p) => { if (phone) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await wait(160) }
/** The control's center, after checking that a press there lands on the control itself. */
async function reachable(sel, label) {
  const loc = page.locator(sel).first()
  await loc.scrollIntoViewIfNeeded()
  const b = await loc.boundingBox()
  if (!b) { ok(false, `${label}: ${sel} is on the page`); return null }
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  const hit = await mb(({ sel, p }) => { const n = document.elementFromPoint(p.x, p.y); return n?.closest(sel) ? '' : `${n?.tagName}.${n?.className}` }, { sel, p })
  ok(hit === '', `${label}: a press on the middle of ${sel} reaches it${hit ? ` (it lands on ${hit})` : ''}`)
  return hit === '' ? p : null
}
async function press(sel, label = sel) {
  const p = await reachable(sel, label)
  if (p) await tapAt(p)
  await wait(140)
}
async function drag(from, to) {
  const steps = 14
  const at = (i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })
  if (phone) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
    for (let i = 1; i <= steps; i++) { const p = at(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); await wait(12) }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) { const p = at(i); await page.mouse.move(p.x, p.y); await wait(8) }
    await page.mouse.up()
  }
  await wait(520)
}
const atomPoint = async (id) => (await points()).atoms.find((a) => a.id === id)
async function atomsAtRest() {
  let before = (await points()).atoms
  for (let i = 0; i < 60; i++) {
    await wait(200)
    const now = (await points()).atoms
    if (now.length === before.length && now.every((a, k) => Math.hypot(a.x - before[k].x, a.y - before[k].y) < 0.8)) return
    before = now
  }
}
/** Waits for the model to finish lifting (or to settle back on the board). */
async function lifted(up = true) {
  for (let i = 0; i < 60; i++) {
    const l = (await points()).lift
    if (up ? l >= 1 : l <= 0) return true
    await wait(100)
  }
  return false
}
const box = (sel) => page.locator(sel).first().boundingBox()
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// ---- free build: put atoms on the board with taps on the tray, bond them with drags
const NAME = { H: 'hydrogen', C: 'carbon', N: 'nitrogen', O: 'oxygen', F: 'fluorine', Cl: 'chlorine', I: 'iodine' }
/** Builds a molecule of a middle atom and outer atoms, each bonded once to the middle atom. */
async function build(center, outer) {
  await press(`[data-tray="${center}"]`, `tray ${NAME[center]}`)
  await wait(300)
  for (const el of outer) {
    await press(`[data-tray="${el}"]`, `tray ${NAME[el]}`)
    await wait(300)
  }
  await atomsAtRest()
  const st = await state()
  const mid = st.atoms[0].id
  for (const a of st.atoms.slice(1)) {
    const from = await atomPoint(a.id)
    const to = await atomPoint(mid)
    await drag(from, to)
  }
  await atomsAtRest()
  return mid
}
/** Adds lines to the one bond on the board until it has `order` lines: a tap on the bond, then "Add a bond". */
async function raiseBond(order) {
  for (let k = 0; k < 4 && (await state()).bonds[0]?.order < order; k++) {
    const b = (await points()).bonds[0]
    await tapAt(b)
    // the card for the tapped bond takes taps once it has grown into place (M-0006)
    await wait(900)
    if ((await state()).selection?.kind === 'bond') await press('[data-key="bond-plus"]', 'Add a bond')
    await wait(300)
  }
  await tapAt(await emptySpot())
}
const emptySpot = async () => { const b = await box('.mb-canvas-wrap'); return { x: b.x + 26, y: b.y + b.height * 0.5 } }
const complete = () => mb(() => window.__mb.report().complete)
async function clearBoard() {
  await press('[data-key="clear"]', 'Clear')
  await wait(500)
  await lifted(false)
}

// ---------------------------------------------------------------- 1. the top bar
async function topbar() {
  console.log('top bar: four tabs and the back button')
  const back = await box('[data-key="exit"]')
  const tabs = []
  for (const m of ['guided', 'free', 'shapes', 'exercise']) tabs.push({ m, b: await box(`[data-key="mode-${m}"]`) })
  ok(tabs.every((t) => t.b), 'top bar: all four tabs are on the page')
  ok(!!back, 'top bar: the back button is on the page')
  ok(tabs.every((t) => !overlap(t.b, back)), `top bar: no tab lies over the back button (back ${JSON.stringify(back)})`)
  ok(tabs.every((t, i) => i === 0 || !overlap(t.b, tabs[i - 1].b)), 'top bar: no two tabs overlap')
  ok(tabs.every((t) => t.b.x >= 0 && t.b.x + t.b.width <= viewport.width && t.b.y >= 0), 'top bar: every tab is inside the window')
  ok(tabs.every((t) => t.b.width >= 44 && t.b.height >= 34), `top bar: every tab is at least 44 by 34 px (${tabs.map((t) => `${Math.round(t.b.width)}x${Math.round(t.b.height)}`).join(' ')})`)
  ok(back.width >= 44 && back.height >= 44, 'top bar: the back button is at least 44 px')
  await shot('topbar')
  for (const { m } of [...tabs.slice(1), tabs[0]]) {
    await press(`[data-key="mode-${m}"]`, `tab ${m}`)
    await wait(400)
    const st = await state()
    const sel = await mb(() => [...document.querySelectorAll('.mb-modes [aria-selected="true"]')].map((n) => n.getAttribute('data-mode')).join())
    ok(st.mode === m && sel === m, `top bar: a press on the ${m} tab opens it and marks only that tab (mode ${st.mode}, marked ${sel})`)
  }
  // the current tab reads apart from the others: its own fill
  const fills = await mb(() => [...document.querySelectorAll('.mb-modes button')].map((n) => getComputedStyle(n).backgroundColor))
  ok(new Set(fills).size === 2 && fills.filter((f) => f === fills[0]).length === 1, `top bar: only the current tab is filled (${fills.join(' | ')})`)
  await reachable('[data-key="exit"]', 'back button')
  await noSideScroll('top bar')
}

// ---------------------------------------------------------------- 2. the switch on the lifted model
async function groupsSwitch() {
  console.log('switch: electron geometry and molecular geometry, on water in free build')
  await press('[data-key="mode-free"]', 'tab free')
  await wait(400)
  const o = await build('O', ['H', 'H'])
  ok(await complete(), 'switch: water is built in free build')
  // free build's counter has its most tiles now (the charge too): none of them may lie over the top bar
  const tiles = await mb(() => [...document.querySelectorAll('.mb-ledger .mb-tile')].map((n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } }))
  const bar = await mb(() => [...document.querySelectorAll('.mb-modes button, [data-key="exit"]')].map((n) => { const r = n.getBoundingClientRect(); return { key: n.getAttribute('data-key'), x: r.left, y: r.top, width: r.width, height: r.height } }))
  const under = bar.filter((b) => tiles.some((c) => overlap(b, c))).map((b) => b.key)
  ok(tiles.length === 4 && under.length === 0, `top bar: free build's ${tiles.length} counter tiles lie over no tab and not the back button (${under.join() || 'none'})`)
  ok(await page.locator('[data-key^="groups-"]').count() === 0, 'switch: no switch on the flat drawing')
  await press('[data-key="see-shape"]', 'See the 3D shape')
  ok(await lifted(), 'switch: the model lifts')
  await wait(400)
  ok(await page.locator('[data-key="groups-all"]').count() === 1 && await page.locator('[data-key="groups-atoms"]').count() === 1, 'switch: the lifted model of water has the switch')
  const words = (await page.locator('.mb-groups button').allInnerTexts()).join('|')
  ok(words === 'Electron geometry|Molecular geometry', `switch: the two choices read Electron geometry and Molecular geometry (${words})`)
  ok(await page.locator('[data-key="groups-all"]').getAttribute('aria-selected') === 'true', 'switch: the electron geometry is shown first')
  let p = await points()
  const loneOn = (pts) => pts.dots.filter((d) => d.key.startsWith(`L:${o}:`))
  ok(p.lobes.length === 2, `switch: oxygen's 2 lone pairs are drawn as lobes (${p.lobes.length})`)
  ok(loneOn(p).length === 4 && loneOn(p).every((d) => d.size > 0.9), `switch: oxygen's 4 unshared electrons are drawn (${loneOn(p).map((d) => d.size).join()})`)
  // where each atom sits, measured from oxygen, so the bob of the whole model does not count
  const rel = (pts) => { const c = pts.atoms.find((a) => a.id === o).at; return pts.atoms.map((a) => ({ id: a.id, d: a.at.map((q, i) => q - c[i]) })) }
  const before = rel(p)
  await shot('switch-all')

  // the atoms must stay readable with the switch on screen: no ball under the switch or the dock, and the middle atom big enough
  const controls = await mb(() => [...document.querySelectorAll('.mb-dock > *, .mb-groups')].filter((n) => n.childElementCount).map((n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } }))
  const covered = p.atoms.filter((a) => controls.some((c) => overlap({ x: a.x - a.r, y: a.y - a.r, width: 2 * a.r, height: 2 * a.r }, c)))
  ok(covered.length === 0, `switch: no atom lies under the switch or the dock (${covered.map((a) => a.el).join() || 'none'})`)
  const rO = p.atoms.find((a) => a.id === o).r
  ok(rO >= (phone ? 18 : 24), `switch: oxygen is drawn ${rO.toFixed(1)} px across its radius, big enough to read`)
  const sw = await box('.mb-groups')
  const dockTop = (await box('.mb-tools')).y
  console.log(`  measure: switch ${Math.round(sw.width)}x${Math.round(sw.height)} at ${Math.round(sw.x)},${Math.round(sw.y)}; dock row from ${Math.round(dockTop)}; oxygen radius ${rO.toFixed(1)} px; model center ${Math.round(p.model.x)},${Math.round(p.model.y)}`)

  await press('[data-key="groups-atoms"]', 'Molecular geometry')
  ok((await state()).groupsView === 'atoms', 'switch: a press on Molecular geometry picks it')
  await wait(700)
  p = await points()
  ok(await page.locator('[data-key="groups-atoms"]').getAttribute('aria-selected') === 'true', 'switch: Molecular geometry is marked')
  ok(p.lobes.length === 0 && p.model.hide === 1, `switch: the lone pairs' lobes are gone (${p.lobes.length} lobes, hide ${p.model.hide})`)
  ok(loneOn(p).length === 4 && loneOn(p).every((d) => d.size === 0), `switch: oxygen's unshared electrons have faded out (${loneOn(p).map((d) => d.size).join()})`)
  ok(p.dots.filter((d) => d.key.startsWith('B:')).every((d) => d.size > 0.9), 'switch: the shared electrons in the bonds stay')
  const after = rel(p)
  const moved = Math.max(...after.map((a) => Math.hypot(...a.d.map((q, i) => q - before.find((b) => b.id === a.id).d[i]))))
  ok(moved < 0.02, `switch: the atoms keep their places (moved ${moved.toFixed(3)})`)
  await shot('switch-atoms')

  // halfway: the change is animated
  const allAt = await reachable('[data-key="groups-all"]', 'Electron geometry')
  if (allAt) { if (phone) await page.touchscreen.tap(allAt.x, allAt.y); else await page.mouse.click(allAt.x, allAt.y) }
  const seen = []
  for (let i = 0; i < 24 && seen[seen.length - 1] !== 0; i++) { seen.push((await points()).model.hide); await wait(50) }
  ok(seen.some((h) => h > 0 && h < 1) && seen[seen.length - 1] === 0, `switch: the lone pairs come back over time, not at once (fade read as ${seen.join(' ')})`)
  await wait(300)
  p = await points()
  ok(p.lobes.length === 2 && loneOn(p).every((d) => d.size > 0.9), 'switch: Electron geometry brings the lone pairs back')

  if (!phone) {
    // the keyboard: Tab from the marked choice to the other one, then Enter
    await page.keyboard.press('Tab')
    const on = await mb(() => document.activeElement?.getAttribute('data-key'))
    ok(on === 'groups-atoms', `switch: Tab moves from Electron geometry to Molecular geometry (${on})`)
    await page.keyboard.press('Enter')
    await wait(300)
    ok((await state()).groupsView === 'atoms', 'switch: Enter on Molecular geometry picks it')
    await press('[data-key="groups-all"]', 'Electron geometry')
  }

  // back on the flat drawing every electron is drawn, whatever the switch says
  await press('[data-key="groups-atoms"]', 'Molecular geometry')
  await press('[data-key="view-flat"]', 'Flat drawing')
  await lifted(false)
  await wait(500)
  p = await points()
  ok(loneOn(p).every((d) => d.size > 0.9) && (await page.locator('[data-key^="groups-"]').count()) === 0, 'switch: the flat drawing shows every electron and no switch')
  await press('[data-key="see-shape"]', 'See the 3D shape')
  await lifted()
  await wait(500)
  p = await points()
  // the pick belongs to the model it was made on: once the model has come down, the next lift draws every
  // electron group again, so no later screen hides lone pairs it talks about (M-0017)
  ok(p.lobes.length > 0 && loneOn(p).every((d) => d.size > 0.9) && (await state()).groupsView === 'all', `switch: lifted again, the model shows every electron group (${p.lobes.length} lobes, ${(await state()).groupsView})`)
  await press('[data-key="groups-all"]', 'Electron geometry')
  await noSideScroll('switch')
  await clearBoard()
}

// ---------------------------------------------------------------- 3. molecules of two atoms
async function pair(label, a, b, { order = 1, extra = null, polar = false } = {}) {
  console.log(`two atoms: ${label}`)
  await build(a, [b])
  if (order > 1) await raiseBond(order)
  if (extra) {
    const id = (await state()).atoms.find((x) => x.el === extra).id
    await tapAt(await atomPoint(id))
    // the card for the tapped atom takes taps once it has grown into place
    await wait(900)
    await press('[data-key="e-plus"]', '+ electron')
    await tapAt(await emptySpot())
  }
  const st = await state()
  ok(await complete(), `${label}: the board accepts it (${st.bonds.map((x) => x.order).join()} bond, ${st.atoms.map((x) => `${x.el}${x.lone}`).join(' ')})`)
  await press('[data-key="see-shape"]', 'See the 3D shape')
  ok(await lifted(), `${label}: the model lifts`)
  const p = await points()
  ok(!!p.model.pair && p.model.center === null && p.lobes.length === 0, `${label}: neither atom is drawn as a middle atom, and no lobes (${JSON.stringify(p.model)})`)
  ok(await page.locator('[data-key^="groups-"]').count() === 0, `${label}: no switch, because there is no middle atom`)
  ok(p.atoms.length === 2 && p.atoms.every((x) => x.at && Math.abs(x.at[1] - p.atoms[0].at[1]) < 1e-3), `${label}: both atoms sit level in the model (${p.atoms.map((x) => x.at?.join(' ')).join(' / ')})`)
  const wrap = await box('.mb-canvas-wrap')
  ok(p.atoms.every((x) => x.x - x.r > wrap.x && x.x + x.r < wrap.x + wrap.width && x.y - x.r > wrap.y && x.y + x.r < wrap.y + wrap.height), `${label}: both atoms are on screen`)
  ok(Math.abs(p.atoms[0].y - p.atoms[1].y) < 2.5, `${label}: the line through the two atoms lies across the screen (heights ${p.atoms.map((x) => Math.round(x.y)).join(', ')})`)
  const bond = p.bonds[0]
  ok(Math.abs(bond.x - p.model.x) < 3 && Math.abs(bond.y - p.model.y) < 9, `${label}: the middle of the bond is the model's center (bond ${Math.round(bond.x)},${Math.round(bond.y)}, center ${Math.round(p.model.x)},${Math.round(p.model.y)})`)
  // each atom's unshared electrons sit on its far side, away from the other atom
  const behind = p.dots.filter((d) => d.key.startsWith('L:')).every((d) => {
    const me = p.atoms.find((x) => x.id === d.key.split(':')[1])
    const other = p.atoms.find((x) => x !== me)
    return (d.x - me.x) * (me.x - other.x) + (d.y - me.y) * (me.y - other.y) > 0
  })
  ok(behind, `${label}: each atom's lone pairs sit behind it, away from the bond`)
  if (a === b) {
    const [d0, d1] = p.atoms.map((x) => Math.hypot(x.x - p.model.x, x.y - p.model.y))
    ok(Math.abs(d0 - d1) < 3, `${label}: the two atoms are the same distance from the center (${d0.toFixed(1)}, ${d1.toFixed(1)})`)
    const n = p.atoms.map((x) => p.dots.filter((d) => d.key.startsWith(`L:${x.id}:`)).length)
    ok(n[0] === n[1], `${label}: both atoms have the same number of unshared electrons drawn (${n.join(', ')})`)
    // and they are mirror images of each other across the middle of the bond
    const mine = (x) => p.dots.filter((d) => d.key.startsWith(`L:${x.id}:`))
    const [da, db] = p.atoms.map(mine)
    const worst = Math.max(0, ...da.map((d) => Math.min(...db.map((e) => Math.hypot(d.x - p.model.x + (e.x - p.model.x), d.y - e.y)))))
    ok(worst < 4, `${label}: the two atoms' lone pairs are mirror images (worst miss ${worst.toFixed(1)} px)`)
  }
  ok(p.atoms.every((x) => x.r >= (phone ? 14 : 22)), `${label}: both atoms are drawn big enough to read (${p.atoms.map((x) => x.r.toFixed(1)).join(', ')} px)`)
  if (polar) {
    ok(p.dipoles.wanted === 1 && p.dipoles.bonds === 1, `${label}: the bond's dipole arrow is drawn (${JSON.stringify(p.dipoles)})`)
    // the arrow lies beside the bond: its middle is near the bond's middle
    const arrow = await mb(() => { const g = document.querySelector('.mb-dipoles .mb-dipole:not(.is-net)'); if (!g || g.style.display === 'none') return null; const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    const reach = Math.max(...p.atoms.map((x) => x.r))
    ok(p.dipoles.net && p.dipoles.netDrawn, `${label}: the net dipole is drawn (${JSON.stringify(p.dipoles)})`)
    // the net dipole runs along the bond, above it, and its label is on screen
    const net = await mb(() => { const g = document.querySelector('.mb-dipoles .mb-dipole.is-net'); const t = document.querySelector('.mb-delta.is-net'); if (!g || g.style.display === 'none' || !t) return null; const r = g.getBoundingClientRect(); const q = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, tag: { x: q.left, y: q.top, width: q.width, height: q.height } } })
    const span = Math.abs(p.atoms[0].x - p.atoms[1].x)
    ok(!!net && Math.abs(net.x - bond.x) < span * 0.25 && net.y < bond.y && net.w > span * 0.6, `${label}: the net dipole runs along the bond above it (${net ? `${Math.round(net.x)},${Math.round(net.y)} ${Math.round(net.w)} px wide` : 'none'}; bond ${Math.round(bond.x)},${Math.round(bond.y)})`)
    ok(!!net && net.tag.x >= wrap.x && net.tag.x + net.tag.width <= wrap.x + wrap.width, `${label}: the net dipole's label is inside the board`)
    ok(!!arrow && Math.hypot(arrow.x - bond.x, arrow.y - bond.y) < reach * 1.6, `${label}: the dipole arrow sits beside the bond (${arrow ? `${Math.round(arrow.x)},${Math.round(arrow.y)}` : 'none'} vs bond ${Math.round(bond.x)},${Math.round(bond.y)})`)
  }
  await shot(`pair-${label}`)
  // the slow turn: left alone, the model turns and the line swings toward the viewer
  const gap0 = Math.abs(p.atoms[0].x - p.atoms[1].x)
  await wait(4200)
  const q = await points()
  const gap1 = Math.abs(q.atoms[0].x - q.atoms[1].x)
  ok(gap1 < gap0 - 1, `${label}: left alone the model turns slowly (atoms ${gap0.toFixed(1)} px apart, then ${gap1.toFixed(1)})`)
  // and a drag on the empty board turns it too
  const before = q.atoms.map((x) => x.x)
  const wb = await box('.mb-canvas-wrap')
  const from = { x: wb.x + 30, y: wb.y + wb.height * 0.5 }
  // (100 px: a 60 px drag after the slow turn can land on the mirror image of where the model was)
  await drag(from, { x: from.x + 100, y: from.y })
  const r = await points()
  ok(r.atoms.some((x, i) => Math.abs(x.x - before[i]) > 3), `${label}: a drag across the board turns the model`)
  await clearBoard()
}

try { await topbar() } catch (e) { failed.push(`top bar: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 4).join(' ')}`); await shot('topbar-error') }
try { await groupsSwitch() } catch (e) { failed.push(`switch: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 4).join(' ')}`); await shot('switch-error') }
for (const [label, a, b, opts] of [
  ['HCl', 'Cl', 'H', { polar: true }],
  ['IF', 'I', 'F', { polar: true }],
  ['N2', 'N', 'N', { order: 3 }],
  ['O2', 'O', 'O', { order: 2 }],
  ['CN-', 'C', 'N', { order: 3, extra: 'C', polar: true }],
]) {
  try { await pair(label, a, b, opts) } catch (e) { failed.push(`${label}: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 4).join(' ')}`); await shot(`${label}-error`) }
}
// the way out: the back button, pressed for real, goes to the home screen (the module was opened by its address)
try {
  await press('[data-key="exit"]', 'back button')
  await page.waitForFunction(() => !window.__mb, null, { timeout: 10000 })
  ok(new URL(page.url()).pathname === `${folder}/`, `back: the back button returns to the home screen (${page.url()})`)
} catch (e) { failed.push(`back: ${String(e).split('\n')[0]}`) }

ok(errors.length === 0, `no console errors (${errors.slice(0, 3).join(' | ')})`)
console.log(`\n${size}: ${passed} passed, ${failed.length} failed`)
if (failed.length) console.log(failed.map((f) => ` - ${f}`).join('\n'))
await browser.close()
process.exit(failed.length ? 1 : 0)
