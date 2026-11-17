// Real-input check of the whole app in headless Chromium. Every action is a real pointer or key
// event sent through the browser (mouse on desktop, touch on the phone size); nothing is clicked
// from script. Each guided problem is solved the way the guide tells a student to solve it.
//
// Usage: node scripts/check-browser.mjs [desktop|phone] [first problem index] [how many]
//        node scripts/check-browser.mjs [desktop|phone] extras   (wrong answers, hints, refused moves, undo, keyboard, free build)
//        node scripts/check-browser.mjs [desktop|phone] shell    (home screen, opening the module, the way back, saved progress)
//        node scripts/check-browser.mjs [desktop|phone] terms    (the highlighted key terms and the card each one opens)
// Needs the built site served on port 5210 (pnpm web:serve), or MB_URL pointing at one (the live
// site included: MB_URL=https://sam-t-g.github.io/chem-review).
// MB_SHOTS=1 saves screenshots to shots/.
import { chromium } from 'playwright'

const [size = 'desktop', firstArg = '0', countArg = '99'] = process.argv.slice(2)
const base = (process.env.MB_URL ?? 'http://localhost:5210').replace(/\/$/, '')
const url = firstArg === 'shell' ? `${base}/` : `${base}/lewis`
// the folder the site is served from: nothing for a site at the root, /chem-review on GitHub Pages
const folder = new URL(base).pathname.replace(/\/$/, '')
const phone = size === 'phone'
const viewport = phone ? { width: 390, height: 844 } : { width: 1360, height: 840 }
const SHOTS = process.env.MB_SHOTS === '1'

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
if (firstArg !== 'shell') await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })

let passed = 0
const failed = []
const ok = (cond, label) => { if (cond) passed++; else { failed.push(label); console.log(`  FAIL ${label}`) } }
const wait = (ms) => page.waitForTimeout(ms)
const mb = (fn, arg) => page.evaluate(fn, arg)
const state = () => mb(() => { const s = window.__mb.store.getState(); return { step: s.step, mode: s.mode, problem: s.problem, atoms: s.s.atoms, bonds: s.s.bonds, view: s.view, toast: s.toast?.text ?? null, selection: s.selection } })
const report = () => mb(() => { const a = window.__mb.report(); return { complete: a.complete, issues: a.issues, atoms: a.atoms, electrons: a.electrons, topology: a.topology, charge: a.charge } })
const points = () => mb(() => window.__mb.scene.debugPoints())
const angles = () => mb(() => window.__mb.scene.debugAngles())
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `shots/${size}-${name}.png` }) }

// ---- real input
const press = async (sel) => { const loc = page.locator(sel).first(); if (phone) await loc.tap(); else await loc.click(); await wait(120) }
const tapAt = async (p) => { if (phone) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await wait(160) }
async function drag(from, to, hold = 0, during = null) {
  const steps = 14
  const at = (i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })
  if (phone) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
    for (let i = 1; i <= steps; i++) { const p = at(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); await wait(12) }
    if (hold) await wait(hold)
    if (during) await during()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) { const p = at(i); await page.mouse.move(p.x, p.y); await wait(8) }
    if (hold) await wait(hold)
    if (during) await during()
    await page.mouse.up()
  }
  await wait(520)
}
const centerOf = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const atomPoint = async (id) => (await points()).atoms.find((a) => a.id === id)
/** Waits until the atoms on the board have stopped moving. After a bond the layout slides the
 *  molecule toward the middle of the board for a few seconds, more slowly in a headless browser. */
async function atomsAtRest() {
  let before = (await points()).atoms
  for (let i = 0; i < 60; i++) {
    await wait(200)
    const now = (await points()).atoms
    if (now.length === before.length && now.every((a, k) => Math.hypot(a.x - before[k].x, a.y - before[k].y) < 0.8)) return
    before = now
  }
}

// ---- where to look next: the glow, the pointing hand, and the checks that stay over the board
const NAME = { H: 'hydrogen', Be: 'beryllium', B: 'boron', C: 'carbon', N: 'nitrogen', O: 'oxygen', F: 'fluorine', P: 'phosphorus', S: 'sulfur', Cl: 'chlorine', Br: 'bromine', Xe: 'xenon' }
const cueNow = () => mb(() => window.__mb.cue())
/** The cue is of this kind (and, for a question, names this control), and a glow that is switched
 *  on and can be seen is drawn over `sel`. The glows are read from the page itself. The layer needs
 *  a moment after a step opens. */
async function cued(label, kind, key = null, sel = null, glows = 1) {
  let c = null
  let on = sel === null
  for (let i = 0; i < 30; i++) {
    c = await cueNow()
    const r = sel ? await page.locator(sel).first().boundingBox().catch(() => null) : null
    c.halos = c.halos.filter((h) => h.opacity > 0.5 && h.w > 8 && h.h > 8)
    on = sel === null || (!!r && c.halos.some((h) => h.x <= r.x + 2 && h.y <= r.y + 2 && h.x + h.w >= r.x + r.width - 2 && h.y + h.h >= r.y + r.height - 2))
    if (c.cue?.kind === kind && (key === null || c.cue.key === key) && on && c.halos.length >= glows) break
    await wait(120)
  }
  ok(c.cue?.kind === kind && (key === null || c.cue.key === key), `${label}: the next action is ${kind}${key ? ` ${key}` : ''} (${JSON.stringify(c.cue)})`)
  ok(c.halos.length > 0 && on, `${label}: the place of the next action glows${sel ? ` (${sel})` : ''}`)
  return c
}
/** The pointing hand acts out a drag within a few seconds. */
async function handActs(label, carries = false) {
  let seen = false
  let eyes = null
  for (let i = 0; i < 50 && !(seen && (!carries || eyes !== null)); i++) {
    const c = await cueNow()
    seen = seen || c.hand === 'demo'
    if (c.carriedEyes !== null) eyes = c.carriedEyes
    if (!(seen && (!carries || eyes !== null))) await wait(100)
  }
  ok(seen, `${label}: the pointing hand is on screen and acts out the drag`)
  // the atom the hand carries is drawn like the atoms in the row: its eyes are a patch about 20 px wide, not a speck
  if (carries) ok(eyes !== null && eyes > 12, `${label}: the atom the hand carries has its face (eyes ${eyes === null ? 'not seen' : Math.round(eyes) + ' px wide'})`)
}
/** The three checks that stay over the board, as their states. */
const strip = () => mb(() => [...document.querySelectorAll('.mb-checkbar .mb-chk')].map((n) => n.getAttribute('data-state')).join(' '))

// ---- drawing dipole arrows (step 6)
/** A point on an atom that no other atom covers, nearest its middle. Null when the atom is hidden. */
function clearPoint(atoms, id) {
  const a = atoms.find((x) => x.id === id)
  const others = atoms.filter((x) => x.id !== id)
  const free = (q) => others.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > o.r + 9)
  if (free(a)) return { x: a.x, y: a.y }
  for (const f of [0.35, 0.6]) for (let k = 0; k < 12; k++) {
    const q = { x: a.x + a.r * f * Math.cos((k * Math.PI) / 6), y: a.y + a.r * f * Math.sin((k * Math.PI) / 6) }
    if (free(q)) return q
  }
  return null
}
/** Turns the 3D model with a real drag on the empty corner of the board. */
async function turnModel() {
  const b = await page.locator('.mb-canvas-wrap').boundingBox()
  const from = { x: b.x + 30, y: b.y + b.height * 0.5 }
  await drag(from, { x: from.x + 46, y: from.y })
}
/** Draws a bond's dipole arrow with a real drag from one atom to another. The model is turned first
 *  when one of the two atoms is behind another atom. */
async function drawArrow(fromId, toId, during = null) {
  for (let i = 0; i < 12; i++) {
    const atoms = (await points()).atoms
    const a = clearPoint(atoms, fromId)
    const b = clearPoint(atoms, toId)
    const A = atoms.find((x) => x.id === fromId)
    const B = atoms.find((x) => x.id === toId)
    if (a && b && Math.hypot(A.x - B.x, A.y - B.y) > A.r + B.r + 6) { await drag(a, b, during ? 200 : 0, during); return }
    await turnModel()
  }
  throw new Error(`no clear view of atoms ${fromId} and ${toId} to draw an arrow between`)
}
/** The same arrow from the keyboard: Enter on the atom it starts on, then Enter on the atom it points at. */
async function keyArrow(fromId, toId) {
  const label = async (id) => mb((id) => { const s = window.__mb.store.getState().s; return s.atoms.find((a) => a.id === id).el }, id)
  const focusHit = async (re) => { for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); if (await mb((src) => document.activeElement?.classList.contains('mb-hit') && new RegExp(src).test(document.activeElement.getAttribute('aria-label') ?? ''), re.source)) return true } return false }
  const capital = (w) => w.charAt(0).toUpperCase() + w.slice(1)
  const from = capital(NAME[await label(fromId)])
  const to = capital(NAME[await label(toId)])
  ok(await focusHit(new RegExp(`^${from}\\. Press Enter to start a dipole arrow`)), `keyboard: Tab reaches ${from.toLowerCase()}, which says Enter starts an arrow there`)
  await page.keyboard.press('Enter'); await wait(200)
  ok((await state()).selection?.id !== undefined, `keyboard: Enter on ${from.toLowerCase()} starts the arrow`)
  ok(await focusHit(new RegExp(`^${to}\\. Press Enter to point the dipole arrow at`)), `keyboard: Tab reaches ${to.toLowerCase()}, which says Enter points the arrow at it`)
  await page.keyboard.press('Enter'); await wait(500)
}
/** Which way the net dipole points on screen, worked out here from where the atoms are drawn and
 *  the slides' electronegativities: each polar bond is an arrow along the bond toward the atom that
 *  pulls harder, and the arrows of one kind of bond are the same length. */
async function netOnScreen() {
  const { atoms } = await points()
  const st = await state()
  const top = (await report()).topology
  const c = atoms.find((a) => a.id === top.center)
  const cEl = st.atoms.find((a) => a.id === top.center).el
  let x = 0, y = 0
  for (const a of atoms) {
    if (a.id === c.id || Math.abs(EN[a.el] - EN[cEl]) <= 4) continue
    const sign = EN[a.el] > EN[cEl] ? 1 : -1
    x += sign * (a.x - c.x); y += sign * (a.y - c.y)
  }
  const len = Math.hypot(x, y)
  return { c, atoms, x: x / (len || 1), y: y / (len || 1), len }
}
/** Draws the net dipole with a real drag out of the middle atom, the right way or the opposite way.
 *  Returns the direction it was drawn in on screen. */
async function drawNet(opposite) {
  for (let i = 0; i < 12; i++) {
    const n = await netOnScreen()
    const from = clearPoint(n.atoms, n.c.id)
    if (from && n.len > 24) {
      const k = opposite ? -1 : 1
      await drag(from, { x: n.c.x + k * n.x * (n.c.r + 92), y: n.c.y + k * n.y * (n.c.r + 92) })
      return { x: k * n.x, y: k * n.y }
    }
    await turnModel()
  }
  throw new Error('no clear view of the middle atom to draw the net dipole from')
}
/** Sets the net dipole with a tap on an aim point: the one nearest the direction worked out here.
 *  Falls back to a drag when no aim point lies within 25° of it. Returns how it was set. */
async function aimNet() {
  const n = await netOnScreen()
  const { aims } = await points()
  let best = null
  let least = 25
  for (const a of aims) {
    const off = degreesApart({ x: a.x - n.c.x, y: a.y - n.c.y }, n)
    if (off < least) { least = off; best = a }
  }
  if (!best) { await drawNet(false); return 'drag' }
  await tapAt(best)
  return `tap on "${best.label}"`
}
const degreesApart = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / ((Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)) || 1)))) * 180) / Math.PI
/** The net dipole from the keyboard: the arrow keys turn it 15° at a time from pointing up, Enter sets it. */
async function keyNet() {
  let found = false
  for (let i = 0; i < 80 && !found; i++) { await page.keyboard.press('Tab'); found = await mb(() => document.activeElement?.classList.contains('mb-hit') && /turn the net dipole arrow/.test(document.activeElement.getAttribute('aria-label') ?? '')) }
  ok(found, 'keyboard: Tab reaches the middle atom, which says the arrow keys turn the net dipole arrow')
  const n = await netOnScreen()
  const target = (Math.atan2(-n.y, n.x) * 180) / Math.PI // degrees counterclockwise from pointing right
  const steps = Math.round((((target - 90 + 540) % 360) - 180) / 15)
  await page.keyboard.press('Enter'); await wait(150)
  ok((await points()).draw.drawing === true, 'keyboard: Enter on the middle atom shows the net dipole arrow')
  for (let k = 0; k < Math.abs(steps); k++) { await page.keyboard.press(steps > 0 ? 'ArrowLeft' : 'ArrowRight'); await wait(40) }
  await page.keyboard.press('Enter'); await wait(300)
}

const VALENCE = { H: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, Xe: 8 }
// Steps 6 and 7, from the course's chapter 7 and 8 slides and not from the app:
// electronegativity in tenths (the table the slides subtract with), which molecules are polar (for
// an ion: whose bond dipoles do not cancel), and how many pi bonds each finished structure has.
const EN = { H: 21, Be: 15, B: 20, C: 25, N: 30, O: 35, F: 40, P: 21, S: 25, Cl: 30, Br: 28, Xe: 26 }
const POLAR = new Set(['NH3', 'H2O', 'CH2O', 'HCN', 'SF4', 'ClF3', 'BrF5', 'SO2', 'NO2-'])
const PI = { CO2: 2, CH2O: 1, HCN: 2, 'NO2-': 1, 'CO3 2-': 1, SO2: 2, 'SO4 2-': 2, 'PO4 3-': 1 }
const HYBRID = ['sp', 'sp2', 'sp3', 'sp3d', 'sp3d2']
/** The right answer for a bond: nonpolar when the two atoms differ by 0.4 or less, otherwise the atom that pulls harder. */
const bondAnswer = (a, b) => (Math.abs(EN[a] - EN[b]) <= 4 ? 'nonpolar' : EN[a] > EN[b] ? a : b)
const PROBLEMS = firstArg === 'shell' ? [] : await mb(() => {
  const s = window.__mb.store
  const out = []
  const start = s.getState().problem
  for (let i = 0; i < 40; i++) { s.selectProblem(i); if (s.getState().problem !== i) break; const p = s.problemOf(); out.push({ i, id: p.id, formula: p.formula, charge: p.charge, center: p.center, shape: p.shape }) }
  s.selectProblem(start)
  return out
})

/** Works one guided problem from the picker to the end of step 7. `wrong` adds wrong turns on the
 *  way: an electron added by hand in the check step, wrong group counts, a wrong shape, a dipole
 *  arrow drawn the wrong way round, a net dipole drawn the opposite way. `wrong.keys` draws the
 *  arrows of step 6 from the keyboard, `wrong.flat` draws a bond's arrow on the flat drawing, and
 *  `wrong.endOn` first draws the net dipole while it points at the viewer. `wrong.aim` sets the
 *  net dipole with a tap on an aim point. */
async function solve(p, wrong = {}) {
  console.log(`${p.id}${Object.keys(wrong).length ? ' with wrong turns' : ''}`)
  // open the picker and choose the molecule
  await press('[data-key="picker"]')
  await press(`[data-key="pick-${p.i}"]`)
  let st = await state()
  ok(st.problem === p.i && st.step === 'count', `${p.id}: picker opens the problem at the count step`)
  await cued(`${p.id} count`, 'ask', `count-${p.formula[0][0]}`, `[data-cue="count-${p.formula[0][0]}"]`)
  ok(await page.locator('.mb-checkbar .mb-chk').count() === 0, `${p.id}: no checks are shown while the board holds sample atoms`)
  // a key term: "valence electrons" is highlighted, and its card explains the term with an atom this molecule does not have
  const valenceCard = await openTerm('valence')
  const valenceExample = ((await cardText()).split('Example')[1] ?? '').split('Keep in mind')[0]
  const namedHere = p.formula.map(([el]) => NAME[el]).filter((n) => new RegExp(n, 'i').test(valenceExample))
  ok(valenceCard?.id === 'valence' && valenceExample.length > 20 && namedHere.length === 0, `${p.id}: the card for "valence electrons" opens, and its example names none of this molecule's atoms (${namedHere.join()})`)
  await closeTerm()
  ok(await termNow() === null, `${p.id}: the card closes again`)

  // 1. count
  for (const [el] of p.formula) for (let k = 0; k < VALENCE[el]; k++) await press(`[data-key="inc-${el}"]`)
  await press('[data-key="count-check"]')
  const total = p.formula.reduce((n, [el, k]) => n + VALENCE[el] * k, 0) - p.charge
  await page.locator('#mb-total').pressSequentially(String(total), { delay: 30 })
  await press('[data-key="total-check"]')
  ok(await page.locator('.mb-total.is-right').count() === 1, `${p.id}: total of ${total} accepted`)
  await cued(`${p.id} count done`, 'next', null, '.mb-btn-main')
  await press('[data-key="next"]')

  // 2. place: answer the middle question, then drag each atom from the tray onto the board
  if (p.formula.length > 1) {
    await cued(`${p.id} place`, 'ask', 'middle', '[data-cue="middle"]')
    await press(`[data-key="mid-${p.center}"]`)
  }
  // the three checks are over the board from here on, and none is marked wrong while the board is empty
  ok((await strip()) === 'wait wait wait', `${p.id}: the three checks are shown over the empty board, all waiting (${await strip()})`)
  const tray = await cued(`${p.id} place`, 'tray', null, `[data-tray="${p.center}"]`)
  ok(tray.cue.el === p.center && tray.cue.demo === true, `${p.id}: the middle atom in the row under the board is the one to drag first`)
  if (p.i < 2) await handActs(`${p.id} place`, true)
  const box = await page.locator('.mb-canvas-wrap').boundingBox()
  const pts0 = await points()
  // board rectangle on screen is inside the canvas box minus the chrome; aim within its middle
  const outer = p.formula.flatMap(([el, n]) => new Array(el === p.center ? n - 1 : n).fill(el))
  const ring = outer.length
  // the atoms go on an oval around the middle of the board, as the board is drawn on the page now
  const on = (await points()).board.px
  const cx = on.x + on.w / 2
  const cy = on.y + on.h * 0.52
  const rx = Math.min(on.w * 0.36, 220)
  const ry = Math.min(on.h * 0.38, 150)
  await drag(await centerOf(`[data-tray="${p.center}"]`), { x: cx, y: cy })
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2 + 0.5
    await drag(await centerOf(`[data-tray="${outer[k]}"]`), { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  }
  st = await state()
  ok(st.atoms.length === ring + 1, `${p.id}: all ${ring + 1} atoms placed by dragging from the tray (got ${st.atoms.length})`)
  void pts0
  // each atom's electron count is beside it as soon as it is on the board
  // the count of the atom that was just dropped fades in: give it a moment
  let badges = ''
  for (let i = 0; i < 20; i++) {
    badges = await mb(() => [...document.querySelectorAll('.mb-count')].map((n) => getComputedStyle(n).opacity).join(' '))
    if (badges.split(' ').filter((o) => Number(o) > 0.9).length === ring + 1) break
    await wait(100)
  }
  ok(badges.split(' ').filter((o) => Number(o) > 0.9).length === ring + 1, `${p.id}: every atom on the board shows its electron count in the place step (${badges})`)
  await press('[data-key="next"]')
  const firstDrag = await cued(`${p.id} bond`, 'drag', null, null, 2)
  ok(firstDrag.halos.length === 2, `${p.id}: the outer atom and the middle atom are both ringed (${firstDrag.halos.length})`)
  if (p.i < 3) await handActs(`${p.id} bond`)

  // 3. bond: drag each outer atom onto the center
  const centerId = (await state()).atoms.find((a) => a.el === p.center).id
  for (let guard = 0; guard < 14; guard++) {
    st = await state()
    const bonded = new Set(st.bonds.flatMap((b) => [b.a, b.b]))
    const loose = st.atoms.find((a) => a.id !== centerId && !bonded.has(a.id))
    if (!loose) break
    const before = st.bonds.length
    await drag(await atomPoint(loose.id), await atomPoint(centerId))
    st = await state()
    if (st.bonds.length === before) {
      // refused: a cation whose center is full. Do what the panel says: take the electron off, then bond.
      ok(/full with|already has/.test((await page.locator('.mb-fb').allInnerTexts()).join(' ') + ' ' + (st.toast ?? '')), `${p.id}: a refused bond explains that the center is full`)
      await tapAt(await atomPoint(loose.id))
      await press('[data-key="e-minus"]')
      await tapAt({ x: box.x + 30, y: box.y + box.height * 0.5 }) // tap empty board to deselect
      await drag(await atomPoint(loose.id), await atomPoint(centerId))
    }
  }
  st = await state()
  ok(st.bonds.length === ring, `${p.id}: every outer atom bonded to the center (${st.bonds.length} of ${ring})`)
  // A molecule's electron total is right as soon as its atoms are on the board. A negative ion's atoms bring
  // fewer electrons than the ion has, and that is dealt with in the next step, so its total waits and is not marked wrong.
  const totalNow = (await strip()).split(' ')[0]
  ok(totalNow === (p.charge < 0 ? 'wait' : 'pass'), `${p.id}: over the board the electron total ${p.charge < 0 ? 'waits for the check step' : 'is checked off once every atom is on it'} (${await strip()})`)
  await press('[data-key="next"]')

  // 4. check: do what the hint says, one move at a time, until there is nothing left to fix
  const empty = { x: box.x + 30, y: box.y + box.height * 0.5 }
  const electron = async (atomId, key) => { await tapAt(await atomPoint(atomId)); await press(`[data-key="${key}"]`); await tapAt(empty) }
  if (wrong.addElectron) {
    // a wrong turn: fill an outer atom's shell with an electron the molecule does not have
    const outerAtom = (await state()).atoms.find((a) => a.id !== centerId)
    await electron(outerAtom.id, 'e-plus')
    const lead = (await text('.mb-coach-lead')).trim()
    ok(wrong.addElectron.test(lead), `${p.id}: an electron added by hand is called out (${lead})`)
    ok(/can't be added to fill a shell/.test(await text('.mb-coach-why')), `${p.id}: the explanation says electrons can't be added`)
    const ask = await text('.mb-coach-ask')
    ok(/then “− electron”/.test(ask), `${p.id}: the explanation says how to take the electron off (${ask})`)
    await electron(outerAtom.id, 'e-minus')
    ok(await page.locator('.mb-coach').count() === 0, `${p.id}: taking the electron off clears the explanation`)
  }
  for (let guard = 0; guard < 24; guard++) {
    const m = await mb(() => window.__mb.nextMove())
    if (!m) break
    if (m.kind === 'bond') await drag(await atomPoint(m.from), await atomPoint(m.to))
    else if (m.kind === 'add') await electron(m.atomId, 'e-plus')
    else if (m.kind === 'remove') await electron(m.atomId, 'e-minus')
    else if (m.kind === 'transfer') { await electron(m.from, 'e-minus'); await electron(m.to, 'e-plus') }
    else break
  }
  const done = await report()
  ok(done.complete, `${p.id}: Lewis structure accepted (${JSON.stringify(done.issues)})`)
  ok(done.charge === p.charge, `${p.id}: charge on the board is ${p.charge}`)
  ok(await page.locator('.mb-checks li[data-state="pass"]').count() === 3, `${p.id}: all three checks show as passed`)
  ok((await strip()) === 'pass pass pass', `${p.id}: the strip over the board shows the same three checks passed (${await strip()})`)
  await shot(`${p.id.replace(/\W/g, '')}-flat`)
  await press('[data-key="next"]')

  // 5. shape: count groups, commit to a shape, watch it lift
  const groups = await mb(() => { const s = window.__mb.store.getState(); const c = window.__mb.report().topology.center; const atom = s.s.atoms.find((a) => a.id === c); return s.s.bonds.filter((b) => b.a === c || b.b === c).length + Math.floor(atom.lone / 2) })
  for (const w of wrong.groups ?? []) {
    const before = (await points()).ringed
    await press(`[data-key="grp-${w.n}"]`)
    const lead = (await text('.mb-coach-lead')).trim()
    ok(w.says.test(lead), `${p.id}: a count of ${w.n} groups is explained (${lead})`)
    // the board rings each group the explanation is about, twice over
    let ringed = 0
    for (let i = 0; i < 60 && ringed < w.rings; i++) { await wait(200); ringed = (await points()).ringed - before }
    await wait(500)
    ringed = (await points()).ringed - before
    ok(ringed === w.rings, `${p.id}: the board draws ${w.rings} rings for that answer (got ${ringed})`)
    if (w.shot) await shot(w.shot)
  }
  await press(`[data-key="grp-${groups}"]`)
  ok(await page.locator('.mb-coach').count() === 0, `${p.id}: the right group count clears the explanation`)
  await press(`[data-key="shp-${wrong.shape ? wrong.shape.pick : p.shape}"]`)
  await wait(phone ? 2400 : 2100)
  st = await state()
  if (wrong.shape) {
    const said = await text('.mb-coach')
    ok(wrong.shape.says.test(said), `${p.id}: picking ${wrong.shape.pick} is explained (${said.replace(/\s+/g, ' ')})`)
    ok(new RegExp(`The shape is ${p.shape}\\.`).test(said), `${p.id}: the explanation ends with the right shape`)
    await shot(`${p.id.replace(/\W/g, '')}-wrong-shape`)
  }
  ok(st.view === 'shape', `${p.id}: the model lifts into the 3D view`)
  const shapeText = (await page.locator('.mb-readout dd.is-big').innerText()).toLowerCase()
  ok(shapeText === p.shape.toLowerCase(), `${p.id}: readout names the shape ${p.shape} (got ${shapeText})`)
  const lift = (await points()).lift
  ok(lift > 0.99, `${p.id}: lift finished (${lift.toFixed(2)})`)
  const ang = (await angles()).map((x) => Math.round(x))
  const expect = { tetrahedral: [109], 'trigonal planar': [120], 'trigonal bipyramidal': [90, 120, 180], octahedral: [90, 180] }[p.shape]
  // exact ideal angles hold when every bond is the same kind; a double bond among singles pushes a little harder
  const sameBonds = new Set(st.bonds.map((b) => b.order)).size === 1
  if (expect && sameBonds) ok(ang.every((a) => expect.some((e) => Math.abs(a - e) <= 1)), `${p.id}: bond angles in the model are ${expect.join('/')} (got ${ang.join(',')})`)
  if (p.shape === 'linear') ok(ang.every((a) => a >= 179), `${p.id}: the two bonds make a straight line (got ${ang.join(',')})`)
  if (p.shape === 'bent' || p.shape === 'trigonal pyramidal') ok(ang.every((a) => a < 120 && a > 95), `${p.id}: bonds are squeezed together (got ${ang.join(',')})`)
  await shot(`${p.id.replace(/\W/g, '')}-3d`)

  // drag an outer atom away in 3D and let go: the model returns to the same arrangement
  const outerId = (await state()).atoms.find((a) => a.id !== centerId).id
  const from = await atomPoint(outerId)
  await drag(from, { x: from.x + 70, y: from.y - 50 }, 150)
  await wait(2600)
  const ang2 = (await angles()).map((x) => Math.round(x)).sort((a, b) => a - b)
  const ang1 = [...ang].sort((a, b) => a - b)
  ok(ang1.length === ang2.length && ang1.every((a, i) => Math.abs(a - ang2[i]) <= 2), `${p.id}: after a drag in 3D the angles settle back (${ang1.join(',')} vs ${ang2.join(',')})`)
  const scroll = await mb(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(scroll <= 0, `${p.id}: no sideways scroll`)
  ok(await page.locator('[data-key="next"]').isEnabled(), `${p.id}: the shape step leads on to the polar bonds`)
  await press('[data-key="next"]')

  // 6. polar bonds: draw each polar bond's dipole arrow on the model, press the button for a
  //    nonpolar bond, say whether the molecule is polar, then draw the net dipole of a polar one
  st = await state()
  ok(st.step === 'polar' && st.view === 'shape', `${p.id}: step 6 opens on the 3D model`)
  ok((await strip()) === 'pass pass pass', `${p.id}: the three checks stay over the board on the 3D model (${await strip()})`)
  const outerKinds = [...new Set(outer)]
  const polarKinds = outerKinds.filter((el) => bondAnswer(p.center, el) !== 'nonpolar')
  const outerOf = (el) => st.atoms.find((a) => a.id !== centerId && a.el === el).id
  ok((await points()).draw.kind === 'bond', `${p.id}: the board takes a drawn arrow while a bond is asked about`)
  for (let guard = 0; guard < 4; guard++) {
    const asked = await mb(() => document.querySelector('[data-act="bond-polar"]')?.getAttribute('data-el') ?? null)
    if (!asked) break
    const answer = bondAnswer(p.center, asked)
    // an arrow runs from the atom that pulls less to the atom that pulls harder
    const [tail, head] = answer === asked ? [centerId, outerOf(asked)] : [outerOf(asked), centerId]
    if (guard === 0) {
      // before the first try the hand acts the drag out along a bond, and the atoms of that bond are ringed
      const rings = 1 + outer.filter((el) => el === asked).length
      const c = await cued(`${p.id} polar`, 'arrow', null, null, rings)
      // the button for a bond with no arrow glows too, when it is in view in the panel
      ok(c.halos.length === rings || c.halos.length === rings + 1, `${p.id}: the middle atom and each ${asked} atom are ringed (${c.halos.length} glows for ${rings} atoms)`)
      // the button for no arrow glows with the atoms, where the panel shows it without scrolling
      const inView = await mb(() => { const b = document.querySelector('[data-cue="no-arrow"]')?.getBoundingClientRect(); const v = document.querySelector('.mb-panel .mb-scroll')?.getBoundingClientRect(); return !!b && !!v && b.bottom < v.bottom - 12 && b.top > v.top + 12 })
      if (inView) await cued(`${p.id} polar`, 'arrow', null, '[data-cue="no-arrow"]', rings + 1)
    }
    if (wrong.bond && guard === 0) {
      // a wrong turn: an arrow that points at the atom that pulls less (on a nonpolar bond, any arrow is wrong)
      await drawArrow(head, tail)
      const lead = (await text('.mb-coach-lead')).trim()
      ok(wrong.bond.test(lead), `${p.id}: a wrong arrow on the ${p.center}–${asked} bond is explained (${lead})`)
      const pts = await points()
      ok(pts.dipoles.wanted === 0, `${p.id}: no arrow is drawn for a bond that is not answered yet`)
      ok(pts.draw.wrong === true, `${p.id}: the wrong arrow stays on the board`)
      await shot(`${p.id.replace(/\W/g, '')}-wrong-arrow`)
    }
    if (answer === 'nonpolar') await press(`[data-key="pol-${asked}-nonpolar"]`)
    else if (wrong.keys) await keyArrow(tail, head)
    else if (wrong.flat) {
      // the same arrow on the flat drawing
      await press('[data-key="view-flat"]')
      await wait(phone ? 2400 : 2100)
      const flat = await points()
      ok(flat.lift < 0.01 && flat.draw.kind === 'bond', `${p.id}: a bond's arrow can be drawn on the flat drawing (lift ${flat.lift.toFixed(2)})`)
      await drawArrow(tail, head)
      ok(await page.locator(`[data-key="pol-${asked}-nonpolar"]`).count() === 0, `${p.id}: the arrow drawn on the flat drawing is accepted`)
      await press('[data-key="view-shape"]')
      await wait(phone ? 2400 : 2100)
    } else {
      // while the arrow is held over the atom it points at, the board says which atom that is
      let said = null
      await drawArrow(tail, head, async () => { said = await mb(() => { const n = document.querySelector('.mb-delta.is-cap'); return n && getComputedStyle(n).opacity === '1' ? n.textContent : '' }) })
      const headEl = st.atoms.find((a) => a.id === head).el
      ok(said === `points at ${NAME[headEl]}`, `${p.id}: the arrow says what it points at while it is drawn (${said})`)
    }
  }
  ok(await page.locator('[data-act="bond-polar"]').count() === 0, `${p.id}: every kind of bond is answered (${outerKinds.map((el) => `${p.center}–${el} ${bondAnswer(p.center, el)}`).join(', ')})`)
  const arrowsWanted = outer.filter((el) => polarKinds.includes(el)).length
  await wait(400)
  let dip = (await points()).dipoles
  // a bond that points straight at the viewer leaves no room for its arrow, and the model turns slowly when left alone: wait for it to come round
  for (let i = 0; i < 40 && arrowsWanted > 0 && dip.bonds === 0; i++) { await wait(250); dip = (await points()).dipoles }
  ok(dip.wanted === arrowsWanted && dip.bonds >= Math.min(1, arrowsWanted), `${p.id}: the board draws a dipole arrow on each of the ${arrowsWanted} polar bonds (asked for ${dip.wanted}, on screen ${dip.bonds})`)
  ok(dip.net === false, `${p.id}: the net dipole is not drawn before the molecule question is answered`)
  ok((await points()).draw.kind === null, `${p.id}: no arrow can be drawn while polar or nonpolar is the question`)
  const isPolar = POLAR.has(p.id)
  const said = wrong.net ? !isPolar : isPolar
  await press(`[data-key="net-${said ? 'polar' : 'nonpolar'}"]`)
  if (wrong.net) {
    const card = await text('.mb-coach')
    ok(wrong.net.test(card), `${p.id}: a wrong answer about the whole molecule is explained (${card.replace(/\s+/g, ' ')})`)
  } else ok(await page.locator('.mb-coach').count() === 0, `${p.id}: ${isPolar ? 'polar' : 'nonpolar'} is accepted`)
  await wait(500)
  let pts = await points()
  ok(pts.dipoles.net === false, `${p.id}: the net dipole is not on the board ${isPolar ? 'before it is drawn' : 'because the dipoles cancel'}`)
  ok(pts.draw.kind === (isPolar ? 'net' : null), `${p.id}: ${isPolar ? 'the net dipole is asked for as a drawing' : 'there is no net dipole to draw'} (${pts.draw.kind})`)
  if (isPolar) {
    ok(!(await page.locator('[data-key="next"]').isEnabled()), `${p.id}: the step waits for the net dipole`)
    await wait(1300) // the model turns until the net dipole lies across the screen
    const aim = await cued(`${p.id} net dipole`, 'aim')
    ok(aim.halos.length === 1, `${p.id}: the middle atom is ringed for the net dipole`)
    const dots = (await points()).aims
    ok(dots.length >= 2 && dots.every((d) => d.label.length > 0), `${p.id}: the aim points are around the model, each with its words (${dots.map((d) => d.label).join(' | ')})`)
    if (wrong.endOn) {
      // a wrong turn of the model: seen from above, this molecule's net dipole points at the viewer,
      // and an arrow drawn then is not judged
      const b = await page.locator('.mb-canvas-wrap').boundingBox()
      const corner = { x: b.x + 30, y: b.y + b.height * 0.4 }
      await drag(corner, { x: corner.x, y: corner.y + 200 })
      const before = await mb(() => { const s = window.__mb.store.getState(); return { tries: s.polar.arrow.tries, aim: s.polar.aim } })
      const top = await netOnScreen()
      await drag(clearPoint(top.atoms, top.c.id) ?? top.c, { x: top.c.x + top.c.r + 92, y: top.c.y })
      const after = await mb(() => { const s = window.__mb.store.getState(); return { tries: s.polar.arrow.tries, aim: s.polar.aim, right: s.polar.arrow.right, toast: s.toast?.text ?? '' } })
      ok(/pointed toward you or away from you/.test(after.toast), `${p.id}: an arrow drawn while the net dipole points at the viewer gets a message (${after.toast})`)
      ok(after.tries === before.tries && after.right === false && after.aim === before.aim + 1, `${p.id}: that arrow costs no try, and the model is told to turn (tries ${before.tries} to ${after.tries})`)
      await wait(1600) // the model turns back to a side view
      const side = await netOnScreen()
      ok(side.len > top.len * 1.5, `${p.id}: the model turned until the net dipole lies across the screen (${top.len.toFixed(0)} px to ${side.len.toFixed(0)} px)`)
    }
    if (wrong.arrow) {
      // a wrong turn: the net dipole drawn the opposite way
      const way = await drawNet(true)
      // the card for a wrong polar-or-nonpolar pick can still be on screen above this one: read the newest
      const lead = (await page.locator('.mb-coach-lead').last().innerText()).trim()
      ok(wrong.arrow.test(lead), `${p.id}: a net dipole drawn the opposite way is explained (${lead})`)
      pts = await points()
      ok(pts.dipoles.net === false && pts.draw.wrong === true, `${p.id}: the wrong net dipole stays on the board, and the right one is not shown`)
      const off = pts.draw.wrongWay ? degreesApart(pts.draw.wrongWay, way) : 999
      ok(off < 12, `${p.id}: the wrong net dipole is redrawn the way it was drawn (${off.toFixed(0)}° off)`)
      await shot(`${p.id.replace(/\W/g, '')}-wrong-net`)
    }
    // odd-numbered molecules set the net dipole with a tap on an aim point, the others with a drag
    let how = 'drag'
    if (wrong.keys) await keyNet()
    else if (p.i % 2 === 1 || wrong.aim) how = await aimNet()
    else await drawNet(false)
    console.log(`  net dipole set by ${wrong.keys ? 'keyboard' : how}`)
    await wait(500)
    pts = await points()
    ok(pts.dipoles.net === true, `${p.id}: the net dipole is drawn the right way and stays on the model`)
    ok(/net dipole/.test(await text('.mb-fb')), `${p.id}: the panel says where the net dipole points`)
    ok(pts.draw.kind === null, `${p.id}: nothing is left to draw`)
  }
  ok(await page.locator('[data-key="next"]').isEnabled(), `${p.id}: step 6 is finished`)
  // A key term: the ΔEN card works its example on another bond, with another ΔEN than any bond of this molecule.
  // (Checked here, after the arrows are drawn: an untouched 3D model starts to turn slowly after 2.5 seconds,
  // and a card opened before the drawing would leave the check dragging at atoms that are moving.)
  const enCard = await openTerm('delta-en')
  const enShown = ((await cardText()).match(/ΔEN = [\d.]+ − [\d.]+ = ([\d.]+)/) ?? [])[1]
  const enMine = [...new Set(outer)].map((el) => (Math.abs(EN[p.center] - EN[el]) / 10).toFixed(1))
  ok(enCard?.id === 'delta-en' && !!enShown && !enMine.includes(enShown), `${p.id}: the ΔEN card's example (${enShown}) is not the ΔEN of a bond of this molecule (${enMine.join()})`)
  await closeTerm()
  await shot(`${p.id.replace(/\W/g, '')}-polar`)
  await press('[data-key="next"]')

  // 7. sigma and pi bonds, then the hybridization of the middle atom
  st = await state()
  ok(st.step === 'orbitals', `${p.id}: step 7 opens`)
  const sigma = ring
  const pi = PI[p.id] ?? 0
  if (wrong.sigma) {
    // a wrong turn: every line counted as a sigma bond
    for (let k = 0; k < sigma + pi; k++) await press('[data-key="inc-sigma"]')
    await press('[data-key="bonds-check"]')
    const lead = (await text('.mb-coach-lead')).trim()
    ok(wrong.sigma.test(lead), `${p.id}: a wrong count of sigma bonds is explained (${lead})`)
    for (let k = 0; k < pi; k++) await press('[data-key="dec-sigma"]')
  } else for (let k = 0; k < sigma; k++) await press('[data-key="inc-sigma"]')
  for (let k = 0; k < pi; k++) await press('[data-key="inc-pi"]')
  await press('[data-key="bonds-check"]')
  ok(await page.locator('[data-act="hybrid"]').count() === 5, `${p.id}: ${sigma} sigma and ${pi} pi accepted, and the hybridization question opens`)
  const hybrid = HYBRID[groups - 2]
  if (wrong.hybrid) {
    await press(`[data-key="hyb-${wrong.hybrid.pick}"]`)
    const lead = (await text('.mb-coach-lead')).trim()
    ok(wrong.hybrid.says.test(lead), `${p.id}: picking ${wrong.hybrid.pick} is explained (${lead})`)
  }
  await press(`[data-key="hyb-${hybrid}"]`)
  ok(await page.locator('[data-act="hybrid"]').count() === 0, `${p.id}: ${hybrid} is accepted for ${groups} electron groups`)
  const table = await text('.mb-readout')
  ok(/Polarity/.test(table) && /Sigma and pi bonds/.test(table) && new RegExp(`${sigma} sigma, ${pi} pi`).test(table), `${p.id}: the table at the end lists polarity and ${sigma} sigma, ${pi} pi`)
  ok((await mb(() => window.__mb.store.getState().solved)).includes(p.id), `${p.id}: the molecule counts as finished after step 7`)
  ok(await page.locator('[data-key="next"]').isEnabled(), `${p.id}: the next molecule is offered`)
  await noSideScroll(`${p.id} after step 7`)
}

const text = async (sel) => (await page.locator(sel).allInnerTexts()).join(' ')
const noSideScroll = async (label) => ok((await mb(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, `${label}: no sideways scroll`)
const emptySpot = async () => { const b = await page.locator('.mb-canvas-wrap').boundingBox(); return { x: b.x + 26, y: b.y + b.height * 0.5 } }

async function extras() {
  const byId = (id) => PROBLEMS.find((p) => p.id === id)
  // ---- wrong counts, hints and the periodic table (methane)
  console.log('extras: count step')
  await shot('count-start')
  for (let k = 0; k < 6; k++) await press('[data-key="inc-C"]') // 6 is carbon's atomic number
  // the number that changed pops; the hydrogen number next to it stays still
  const pops = await mb(() => [...document.querySelectorAll('.mb-stepper output')].map((o) => getComputedStyle(o).animationName))
  ok(pops.length === 2 && pops[0] === 'mb-tick' && pops[1] === 'none', `count: pressing + on carbon moves carbon's number only (${pops.join(', ')})`)
  for (let k = 0; k < 4; k++) await press('[data-key="inc-H"]') // 4 is how many hydrogen atoms methane has
  await press('[data-key="count-check"]')
  ok(/atomic number/.test(await text('.mb-fb')), 'count: answering 6 for carbon names the atomic-number mix-up')
  // each wrong count gets its own explanation in three parts: what the number is, why it is not the answer, what to do
  const cards = page.locator('.mb-rows .mb-coach')
  ok(await cards.count() === 2, `count: two wrong counts get two explanations (${await cards.count()})`)
  ok(/^6 is carbon's atomic number\.$/.test((await cards.nth(0).locator('.mb-coach-lead').innerText()).trim()), 'count: the first line says what 6 is')
  ok(/2 of them are in the inner shell/.test(await cards.nth(0).locator('.mb-coach-why').innerText()), 'count: the second line says why 6 is too many')
  ok(/outer shell/.test(await cards.nth(0).locator('.mb-coach-ask').innerText()), 'count: the third line says what to count')
  ok(/4 is the number of hydrogen atoms in methane/.test(await cards.nth(1).innerText()), 'count: answering 4 for hydrogen says 4 is the number of hydrogen atoms')
  // the picture of carbon's shells: 2 gray electrons inside, 4 on the outer ring
  const fig = page.locator('.mb-shells[data-el="C"]')
  ok(await fig.locator('.mb-sh-core').count() === 2 && await fig.locator('.mb-sh-e').count() === 4, 'count: the picture of carbon shows 2 inner and 4 outer electrons')
  ok(await cards.nth(1).locator('.mb-shells').count() === 0, 'count: the hydrogen explanation has no picture (the count of atoms was the mix-up)')
  await fig.scrollIntoViewIfNeeded()
  // the panel may still be scrolling the new explanation into view: look until the picture has come to rest
  let figBox = null
  let onTop = false
  let under = ''
  for (let i = 0; i < 12 && !onTop; i++) {
    await wait(250)
    figBox = await fig.locator('svg').boundingBox()
    under = figBox ? await mb(({ x, y }) => { const n = document.elementFromPoint(x, y); return n?.closest('.mb-shells') ? '' : `${n?.tagName}.${n?.className}` }, { x: figBox.x + figBox.width / 2, y: figBox.y + figBox.height / 2 }) : 'no box'
    onTop = under === ''
  }
  ok(!!figBox && figBox.width >= 70 && figBox.height >= 70 && onTop, `count: the picture is on screen and not covered (${figBox ? Math.round(figBox.width) + ' x ' + Math.round(figBox.height) : 'missing'}${under ? ', under ' + under : ''})`)
  await shot('count-coach')
  // changing the number keeps the explanation up, so the picture can still be counted from
  await press('[data-key="dec-H"]')
  ok(await page.locator('.mb-rows .mb-coach').count() === 2, 'count: the explanations stay while a number is changed')
  ok(await page.locator('.mb-rows .mb-coach.is-same').count() === 2, 'count: an explanation already on screen does not shake again')
  await press('[data-key="dec-H"]'); await press('[data-key="dec-H"]')
  await press('[data-key="count-check"]')
  // carbon's second miss: the same first line, now with the group rule
  ok(/atomic number/.test(await text('.mb-fb')) && /Carbon is in group 14/.test(await text('.mb-coach-ask')), 'count: a second miss on carbon adds the group rule')
  ok(await page.locator('.mb-row[data-state="right"]').count() === 1, 'count: hydrogen is marked right while carbon is not')
  ok(await page.locator('[data-key="next"]').isDisabled(), 'count: Next stays off until the counts are right')
  await press('[data-key="hint"]')
  ok(await page.locator('.mb-pt td.is-mine').count() === 2, 'count: the first hint shows the periodic table with C and H marked')
  ok(await page.locator('.mb-pt-val').count() === 0, 'count: the first hint does not show the valence row')
  await press('[data-key="hint"]')
  ok(await page.locator('.mb-pt-val').count() === 1, 'count: the second hint adds the valence electron row')
  await shot('count-hints')
  // the hints have run out and the Hint button is off: another Enter must not land on a stepper
  const before = await mb(() => JSON.stringify(window.__mb.store.getState().count.answers))
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  ok((await mb(() => JSON.stringify(window.__mb.store.getState().count.answers))) === before, 'count: Enter after the last hint changes nothing')
  ok(await mb(() => document.activeElement?.classList.contains('mb-step') ?? false), 'count: the focus rests on the step, where Enter does nothing')
  await press('[data-key="dec-C"]'); await press('[data-key="dec-C"]')
  await press('[data-key="count-check"]')
  ok(await page.locator('.mb-row[data-state="right"]').count() === 2, 'count: 4 for carbon is accepted')
  await page.locator('#mb-total').pressSequentially('5', { delay: 30 })
  await page.keyboard.press('Enter')
  await wait(150)
  ok(/Count every atom/.test(await text('.mb-total .mb-fb')), 'count: a total of 5 says to count every atom')
  ok(/5 counts hydrogen once/.test(await text('.mb-total .mb-coach-lead')) && /4 hydrogen atoms/.test(await text('.mb-total .mb-coach-why')), 'count: a total of 5 says hydrogen was counted once')
  // the picture of how the total is built: one ball for the carbon atom, four for the hydrogen atoms, no sums yet
  const tally = page.locator('.mb-total .mb-tally')
  const perRow = await tally.locator('li').evaluateAll((rows) => rows.map((li) => li.querySelectorAll('.mb-ball').length))
  ok(perRow.join(',') === '1,4', `count: the picture has a ball for every atom (${perRow.join(',')})`)
  ok(/1 carbon atom brings 4/.test(await tally.innerText()) && /4 hydrogen atoms bring 1 each/.test(await tally.innerText()), 'count: the picture says what each kind of atom brings')
  ok((await tally.getAttribute('data-reveal')) === 'atoms' && /\?/.test(await tally.locator('.mb-tally-total').innerText()), 'count: the first miss leaves the sums and the total to the student')
  ok(!/[×=]/.test(await text('.mb-total .mb-coach')), 'count: the explanation is in words, with no bare sum')
  await shot('total-coach')
  // a second miss that fits no known mix-up: each kind of atom is added up, in words and in the picture
  await page.keyboard.type('7', { delay: 30 })
  await page.keyboard.press('Enter')
  await wait(150)
  ok(/The 4 hydrogen atoms bring 1 each, which makes 4/.test(await text('.mb-total .mb-coach-why')), 'count: a second wrong total adds up each kind of atom')
  ok((await tally.getAttribute('data-reveal')) === 'sums' && (await tally.locator('.mb-tally-sum').allInnerTexts()).join(',') === '4,4', 'count: the picture now shows each row\'s sum')
  // the wrong answer comes back selected, so typing replaces it
  await page.keyboard.type('8', { delay: 30 })
  await page.keyboard.press('Enter')
  await wait(150)
  ok(await page.locator('.mb-total.is-right').count() === 1, 'count: Enter in the total box checks it, and 8 is accepted')
  await noSideScroll('count step')

  // ---- ion total (carbonate)
  console.log('extras: ion total and the middle atom')
  const co3 = byId('CO3 2-')
  await press('[data-key="picker"]')
  await shot('picker')
  await press(`[data-key="pick-${co3.i}"]`)
  for (let k = 0; k < 4; k++) await press('[data-key="inc-C"]')
  for (let k = 0; k < 6; k++) await press('[data-key="inc-O"]')
  await press('[data-key="count-check"]')
  await page.locator('#mb-total').pressSequentially('22', { delay: 30 })
  await press('[data-key="total-check"]')
  ok(/neutral atoms/.test(await text('.mb-total .mb-fb')) && /2 extra electrons/.test(await text('.mb-total .mb-fb')), 'ion: 22 for carbonate explains the 2 extra electrons')
  // the check button took the focus, so click back into the box: its old answer is replaced by typing over a selection
  await page.locator('#mb-total').click({ clickCount: 3 })
  await page.keyboard.type('24', { delay: 30 })
  await press('[data-key="total-check"]')
  await press('[data-key="next"]')
  // a move to the next step: the old step's text leaves as bubbles that pop, and the new step's text blows up into place
  ok(await page.locator('.mb-fx .mb-ghost').count() === 1 && await page.locator('.mb-fx .mb-drop').count() > 0, 'step change: the old text is drawn once more to deflate, and small bubbles burst from it')
  // the deflating copy of the old step is out of reach: one title, and it is the new step's
  ok(await page.locator('.mb-title').count() === 1 && /Put the atoms on the board/.test(await text('.mb-title')), 'step change: only the new step can be found on the page while the old one deflates')
  const arriving = await mb(() => [...document.querySelectorAll('.mb-step > *')].map((n) => `${n.classList.contains('is-new')}:${getComputedStyle(n).animationName.split(',')[0].trim()}`))
  ok(arriving.length >= 3 && arriving.every((a) => a === 'true:mb-inflate'), `step change: every chunk of the new step blows up into place (${arriving.join(' ')})`)
  // a piece that is still growing takes no taps: its buttons are moving, and a tap could land on the wrong one (M-0006)
  const early = await mb(() => [...document.querySelectorAll('.mb-step > *')].map((n) => getComputedStyle(n).pointerEvents))
  ok(early.length >= 3 && early.every((v) => v === 'none'), `step change: the new text takes no taps while it is arriving (${early.join(' ')})`)
  await wait(900)
  ok(await page.locator('.mb-fx .mb-ghost, .mb-fx .mb-drop').count() === 0, 'step change: the old text and the bubbles are gone a moment later')
  // the animation clock runs with the frames, which a software renderer draws slowly: wait for the end instead of a fixed time
  const settled = await page.waitForFunction(() => [...document.querySelectorAll('.mb-step > *')].every((n) => { const cs = getComputedStyle(n); return cs.opacity === '1' && (cs.scale === 'none' || cs.scale === '1' || cs.scale === '1 1') }), null, { timeout: 8000 }).then(() => true, () => false)
  ok(settled, 'step change: the new text ends at full size and fully visible')
  const late = await page.waitForFunction(() => [...document.querySelectorAll('.mb-step > *')].every((n) => getComputedStyle(n).pointerEvents !== 'none'), null, { timeout: 4000 }).then(() => true, () => false)
  ok(late, 'step change: the new text takes taps once it has arrived')
  await press('[data-key="mid-O"]')
  // inside a step only what is new moves: the explanation blows up, the question above it stays still
  const inStep = await mb(() => ({ q: document.querySelector('.mb-step > .mb-q').classList.contains('is-new'), card: document.querySelector('.mb-step > .mb-coach').classList.contains('is-new') }))
  ok(inStep.q === false && inStep.card === true, `in a step: the new explanation arrives and the question stays still (${JSON.stringify(inStep)})`)
  ok(/Pick again/.test(await text('.mb-fb')), 'middle: picking oxygen for carbonate says why and asks again')
  ok(/3 oxygen atoms, and only 1 atom is in the middle/.test(await text('.mb-coach-lead')), 'middle: picking oxygen says there are 3 oxygen atoms and 1 middle')
  ok(await page.locator('[data-tray]').count() === 2, 'middle: the tray is ready with carbon and oxygen')
  await press('[data-key="mid-C"]')
  ok(/least electronegative/.test(await text('.mb-fb')), 'middle: picking carbon gives the rule')

  // ---- board moves (methane)
  console.log('extras: board moves')
  const ch4 = byId('CH4')
  await press('[data-key="picker"]')
  await press(`[data-key="pick-${ch4.i}"]`)
  for (let k = 0; k < 4; k++) await press('[data-key="inc-C"]')
  await press('[data-key="inc-H"]')
  await press('[data-key="count-check"]')
  await page.locator('#mb-total').pressSequentially('8', { delay: 30 })
  await press('[data-key="total-check"]')
  await press('[data-key="next"]')
  await press('[data-key="mid-C"]')
  // a tap on a tray chip drops the atom on a free spot
  await press('[data-tray="C"]'); await wait(300)
  await press('[data-tray="H"]')
  // a line whose words changed ("1 of 5" to "2 of 5") leaves and arrives the same way as any other text
  const line = await mb(() => { const n = [...document.querySelectorAll('.mb-step > .mb-fb')].pop(); return `${n.textContent.trim()}|${n.classList.contains('is-new')}|${getComputedStyle(n).animationName}` })
  ok(/^2 of 5 atoms on the board\.\|true\|mb-inflate$/.test(line), `text: a progress line that changes blows up into place like any other text (${line})`)
  ok(await page.locator('.mb-fx .mb-ghost').count() === 1, 'text: the line it replaces deflates')
  // the body text above it did not change, so it stays still
  ok(await mb(() => !document.querySelector('.mb-step > .mb-body').classList.contains('is-new')), 'text: the paragraph above the line stays still')
  // one kind of arrival and one kind of leaving, everywhere: no other entrance animation is in use
  const names = await mb(() => [...new Set([...document.querySelectorAll('.mb-panel *, .mb-ledger *, .mb-dock *')].flatMap((n) => getComputedStyle(n).animationName.split(',').map((x) => x.trim())))].sort().join(' '))
  ok(/mb-inflate/.test(names) && !/mb-rise|mb-wobble/.test(names), `text: one arrival animation is in use, with no leftover slide or blink (${names})`)
  await wait(300)
  await press('[data-tray="H"]'); await wait(300)
  let st = await state()
  ok(st.atoms.length === 3, `tray: tapping a chip puts the atom on the board (${st.atoms.length} of 3)`)
  const [c, h1, h2] = st.atoms.map((a) => a.id)
  // drag an atom off the board: it goes back to the tray
  const box = await page.locator('.mb-canvas-wrap').boundingBox()
  const b0 = (await points()).board
  void b0
  await drag(await atomPoint(h2), { x: box.x + box.width - 6, y: box.y + box.height * 0.5 })
  st = await state()
  ok(st.atoms.length === 2, 'board: dragging an atom off the board removes it')
  ok(/×3/.test(await text('.mb-chip-n')), 'board: the removed hydrogen is back in the tray (3 left to place)')
  // the bin: an atom carried to the Clear button comes off the board, and the button says so while the atom is carried
  await press('[data-tray="H"]'); await wait(500)
  st = await state()
  const h3 = st.atoms[st.atoms.length - 1].id
  let binOpen = null
  await drag(await atomPoint(h3), await centerOf('[data-key="clear"]'), 150, async () => {
    binOpen = await mb(() => { const d = document.querySelector('.mb-dock'); const b = document.querySelector('[data-key="clear"]'); return `${d.classList.contains('is-binning')}|${d.classList.contains('is-bin-hot')}|${getComputedStyle(b, '::after').content}` })
  })
  ok(/^true\|true\|"Drop here to take it off"$/.test(binOpen), `board: while an atom is carried the Clear button opens as a bin and says what a drop does (${binOpen})`)
  st = await state()
  ok(st.atoms.length === 2 && !st.atoms.some((a) => a.id === h3), 'board: an atom dropped on the bin comes off the board')
  ok(await mb(() => !document.querySelector('.mb-dock').classList.contains('is-binning')), 'board: the bin closes when the atom is let go')
  // bond by dragging one of carbon's dots onto hydrogen
  const dot = (await points()).dots.find((d) => d.key.startsWith(`L:${c}:`))
  await drag(dot, await atomPoint(h1))
  st = await state()
  ok(st.bonds.length === 1, 'board: dragging a carbon dot onto hydrogen makes a bond')
  // the counter: the bond changed "In bonds" and "Unshared", so those two pop and the total stays still
  const tiles = await mb(() => [...document.querySelectorAll('.mb-tile-v b')].map((b) => getComputedStyle(b).animationName))
  ok(tiles.length === 3 && tiles[0] === 'none' && tiles[1] === 'mb-tick' && tiles[2] === 'mb-tick', `board: a new bond moves the two counter numbers that changed, and the total stays still (${tiles.join(', ')})`)
  // a swipe across the bond's line cuts it, with no tap on the bond first
  await atomsAtRest()
  {
    const a = await atomPoint(c)
    const b = await atomPoint(h1)
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const mid = { x: a.x + ((b.x - a.x) * (a.r + (len - a.r - b.r) / 2)) / len, y: a.y + ((b.y - a.y) * (a.r + (len - a.r - b.r) / 2)) / len }
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
    await drag({ x: mid.x + n.x * 64, y: mid.y + n.y * 64 }, { x: mid.x - n.x * 64, y: mid.y - n.y * 64 })
    st = await state()
    ok(st.bonds.length === 0 && st.atoms.length === 2 && st.selection === null, `board: a swipe across a bond cuts it (${st.bonds.length} bonds left)`)
    // a stroke that crosses no bond changes nothing
    await drag({ x: mid.x + n.x * 64, y: mid.y + n.y * 64 }, { x: mid.x - n.x * 64, y: mid.y - n.y * 64 })
    ok((await state()).atoms.length === 2, 'board: a swipe across the bare board changes nothing')
    await drag(await atomPoint(h1), await atomPoint(c))
    ok((await state()).bonds.length === 1, 'board: the bond is made again by dragging hydrogen onto carbon')
  }
  // a second bond to hydrogen is refused with the reason
  await drag(await atomPoint(h1), await atomPoint(c))
  st = await state()
  ok(st.bonds.length === 1 && st.bonds[0].order === 1 && /Hydrogen already has 2 electrons/.test(st.toast ?? ''), `board: a second bond to hydrogen is refused and says why (${st.toast})`)
  ok(await page.locator('.mb-toast.is-on').count() === 1, 'board: the refusal shows on screen')
  await shot('refused')
  // tap the bond, remove it, undo
  const bondPt = (await points()).bonds[0]
  await tapAt(bondPt)
  ok(/single bond/.test(await text('.mb-sel')), 'board: tapping a bond selects it')
  await press('[data-key="bond-minus"]')
  ok((await state()).bonds.length === 0, 'board: Remove a bond takes the bond away')
  await press('[data-key="undo"]')
  ok((await state()).bonds.length === 1, 'board: Undo brings the bond back')
  // tap an atom: the card shows its count
  await tapAt(await atomPoint(c))
  ok(/Carbon/.test(await text('.mb-sel')) && /5 of 8/.test(await text('.mb-sel')), 'board: tapping carbon shows 5 of 8 electrons')
  await shot('selected')
  await tapAt(await emptySpot())
  ok((await state()).selection === null, 'board: tapping empty board clears the selection')
  await press('[data-key="clear"]')
  ok((await state()).atoms.length === 0, 'board: Clear empties the board')
  await press('[data-key="undo"]')
  ok((await state()).atoms.length === 2, 'board: Undo brings the atoms back')

  // ---- keyboard: place from the tray with Enter, then bond two atoms with Enter on each
  if (!phone) {
    console.log('extras: keyboard')
    const focusOn = async (pred, max = 60) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (await mb(pred)) return true } return false }
    ok(await focusOn(() => document.activeElement?.getAttribute('data-tray') === 'H'), 'keyboard: Tab reaches the hydrogen chip')
    await page.keyboard.press('Enter'); await wait(300)
    st = await state()
    ok(st.atoms.length === 3, 'keyboard: Enter on the chip places a hydrogen')
    const newH = st.atoms[st.atoms.length - 1].id
    ok(await focusOn(() => document.activeElement?.classList.contains('mb-hit') && /^Carbon/.test(document.activeElement.getAttribute('aria-label') ?? '')), 'keyboard: Tab reaches the carbon atom')
    await page.keyboard.press('Enter'); await wait(150)
    ok((await state()).selection?.id === c, 'keyboard: Enter selects carbon')
    ok(await focusOn(() => document.activeElement?.classList.contains('mb-hit') && /^Hydrogen: 1 of 2/.test(document.activeElement.getAttribute('aria-label') ?? '')), 'keyboard: Tab reaches the unbonded hydrogen')
    await page.keyboard.press('Enter'); await wait(400)
    st = await state()
    ok(st.bonds.some((b) => [b.a, b.b].includes(newH)), 'keyboard: Enter on a second atom bonds it to the selected one')
    const ring = await mb(() => { const el = document.activeElement; const cs = el ? getComputedStyle(el) : null; return cs ? cs.outlineStyle + ' ' + cs.outlineWidth : '' })
    ok(/solid/.test(ring) && !/ 0px/.test(ring), `keyboard: the focused atom shows a focus ring (${ring})`)
  }

  // ---- free build: water, its shape, an ion
  console.log('extras: free build')
  await press('[data-key="mode-free"]')
  st = await state()
  ok(st.mode === 'free' && st.atoms.length === 0, 'free: switching to Free build opens an empty board')
  const sameBalls = async (label) => {
    await wait(200)
    const drawn = (await points()).atoms
    const real = (await state()).atoms
    ok(drawn.length === real.length && real.every((a) => drawn.find((d) => d.id === a.id)?.el === a.el), `${label}: every ball on the board is the right element`)
  }
  const fbox = await page.locator('.mb-canvas-wrap').boundingBox()
  const mid = { x: fbox.x + fbox.width / 2, y: fbox.y + fbox.height * 0.52 }
  // an empty free board points at the first atom in the row, and the hand acts out the drag
  await cued('free', 'tray', null, '[data-tray="H"]')
  await drag(await centerOf('[data-tray="O"]'), mid)
  ok((await cueNow()).cue === null, 'free: with an atom on the board, nothing is pointed at')
  // an atom dropped from the row onto an atom on the board is bonded to it in the same move
  await drag(await centerOf('[data-tray="H"]'), await atomPoint((await state()).atoms[0].id))
  st = await state()
  ok(st.atoms.length === 2 && st.bonds.length === 1, `free: a hydrogen dropped on oxygen is bonded to it (${st.atoms.length} atoms, ${st.bonds.length} bonds)`)
  await drag(await centerOf('[data-tray="H"]'), { x: mid.x + (phone ? 90 : 190), y: mid.y - 20 })
  st = await state()
  ok(st.atoms.length === 3, 'free: three atoms dragged from the tray')
  await sameBalls('free build (its atom ids repeat the guided board\'s)')
  const o = st.atoms.find((a) => a.el === 'O').id
  const bondedH = new Set(st.bonds.flatMap((b) => [b.a, b.b]))
  for (const h of st.atoms.filter((a) => a.el === 'H' && !bondedH.has(a.id))) await drag(await atomPoint(h.id), await atomPoint(o))
  ok((await report()).complete, 'free: H2O is accepted')
  ok(await page.locator('.mb-checks li[data-state="pass"]').count() === 3, 'free: all three checks pass')
  ok(/Charge of everything on the board: 0/.test(await text('.mb-charge')), 'free: the charge reads 0')
  // electronegativity and dipoles, shown with nothing asked (D-0029)
  const enRows = (await page.locator('.mb-en li').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim()).sort()
  ok(enRows.join() === 'H Hydrogen 2.1,O Oxygen 3.5', `free: the electronegativity table lists oxygen 3.5 and hydrogen 2.1 (${enRows.join()})`)
  const ohRow = (await text('.mb-pol li')).replace(/\u2060/g, '').replace(/\s+/g, ' ').trim()
  ok(/^O–H Polar\. ΔEN = 3\.5 − 2\.1 = 1\.4\./.test(ohRow), `free: the O–H bond is worked out as polar, ΔEN 1.4 (${ohRow})`)
  ok(/^Polar\. /.test(await text('[data-k="free-net"]')), 'free: water reads as a polar molecule')
  let dip = (await points()).dipoles
  for (let i = 0; i < 20 && dip.bonds < 2; i++) { await wait(250); dip = (await points()).dipoles }
  ok(dip.wanted === 2 && dip.bonds === 2 && !dip.net, `free: both O–H arrows are on the flat drawing, and no net dipole (${JSON.stringify(dip)})`)
  await tapAt(await atomPoint(o))
  ok(/electronegativity 3\.5/.test(await text('.mb-sel')), 'free: a tapped oxygen shows its electronegativity')
  await tapAt(await emptySpot())
  await shot('free-water')
  await press('[data-key="see-shape"]')
  await wait(2200)
  ok((await page.locator('.mb-readout dd.is-big').innerText()).toLowerCase() === 'bent', 'free: See the 3D shape names water bent')
  dip = (await points()).dipoles
  ok(dip.bonds === 2 && dip.net && dip.netDrawn, `free: on the 3D shape the net dipole is drawn too (${JSON.stringify(dip)})`)
  ok((await angles()).every((a) => a > 95 && a < 109), 'free: the H–O–H angle in the model is below 109.5')
  await shot('free-water-3d')
  ok(await page.locator('[data-tray]').count() === 0, 'free: the atom tray steps aside while the 3D shape is showing')
  await press('[data-key="view-flat"]')
  await wait(1600)
  ok((await points()).lift < 0.01, 'free: Flat drawing puts the model back on the board')
  ok(await page.locator('[data-tray]').count() === 18, 'free: the tray is back with all 18 atoms')
  // take an electron off oxygen's lone pairs: the charge becomes 1+ and the checklist says oxygen is short
  await tapAt(await atomPoint(o))
  await press('[data-key="e-minus"]')
  ok(/1\+/.test(await text('.mb-ledger')), 'free: removing an electron shows a 1+ charge in the counter')
  ok(await page.locator('.mb-checks li[data-state="fail"]').count() >= 1, 'free: the checklist reports the short atom')
  await page.locator('[data-k="free-wait"]').waitFor({ timeout: 3000 }).catch(() => {})
  ok(await page.locator('[data-k="free-net"]').count() === 0 && /Fill every shell/.test(await text('[data-k="free-wait"]')), `free: with a shell short, polar or nonpolar waits (${await text('[data-k="free-wait"]')})`)
  await press('[data-key="e-plus"]')
  await press('[data-key="e-plus"]')
  ok(/Oxygen already has 8 electrons/.test((await state()).toast ?? ''), 'free: a ninth electron on oxygen is refused with the reason')
  await tapAt(await emptySpot())
  await noSideScroll('free build')
  // Clear works from the 3D shape too, and brings the flat board back
  await press('[data-key="see-shape"]')
  await wait(2200)
  ok((await state()).view === 'shape' && await page.locator('[data-key="clear"]').isEnabled(), 'free: the Clear button is on while the 3D shape is showing')
  await press('[data-key="clear"]')
  await wait(1600)
  st = await state()
  ok(st.atoms.length === 0 && st.view === 'flat' && (await points()).lift < 0.01, `free: Clear on the 3D shape empties the board and brings the flat board back (${st.atoms.length} atoms, ${st.view})`)
  ok(await page.locator('[data-tray]').count() === 18, 'free: the tray is back after that')
  // Clear switched itself off with the board empty: the focus it had moves to Undo, which brings the atoms back
  if (!phone) ok(await mb(() => document.activeElement?.getAttribute('data-key')) === 'undo', 'free: after Clear the focus is on Undo')
  await press('[data-key="undo"]')
  await wait(1900)
  st = await state()
  ok(st.atoms.length === 3 && st.view === 'shape', `free: Undo brings the cleared atoms back, on the 3D shape they were cleared from (${st.atoms.length} atoms, ${st.view})`)

  // ---- two fingers: a second finger on the board must not take over a drag
  if (phone) {
    console.log('extras: two fingers')
    await press('[data-key="clear"]')
    await press('[data-tray="C"]'); await wait(400)
    const a = (await points()).atoms[0]
    const fbox2 = await page.locator('.mb-canvas-wrap').boundingBox()
    const f1 = (x, y) => ({ x, y, id: 1 })
    const f2 = (x, y) => ({ x, y, id: 2 })
    const goal = { x: a.x + 60, y: a.y + 10 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(a.x, a.y)] })
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(a.x + (60 * i) / 8, a.y + (10 * i) / 8)] }); await wait(12) }
    // second finger lands far away, moves, and lifts while the first is still holding the atom
    const far = { x: fbox2.x + 40, y: fbox2.y + fbox2.height * 0.45 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1(goal.x, goal.y), f2(far.x, far.y)] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(goal.x, goal.y), f2(far.x + 20, far.y + 20)] })
    await wait(120)
    let now = (await points()).atoms[0]
    ok(Math.hypot(now.x - goal.x, now.y - goal.y) < 14, `two fingers: the atom stays under the first finger (${Math.round(now.x)},${Math.round(now.y)} vs ${Math.round(goal.x)},${Math.round(goal.y)})`)
    // lift only the second finger: the browser reads a touch list without it as that finger leaving
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(goal.x, goal.y)] })
    await wait(120)
    ok((await state()).atoms.length === 1, 'two fingers: lifting the second finger does not drop or remove the atom')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [f1(goal.x + 30, goal.y)] })
    await wait(120)
    now = (await points()).atoms[0]
    ok(Math.hypot(now.x - (goal.x + 30), now.y - goal.y) < 14, 'two fingers: the first finger still drags the atom afterwards')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await wait(300)
    await press('[data-key="clear"]')
  }

  // ---- back to Guided: the methane board is still there; the step rail goes back and forth
  console.log('extras: mode switch and step rail')
  await press('[data-key="mode-guided"]')
  st = await state()
  ok(st.mode === 'guided' && st.atoms.length >= 2 && st.problem === ch4.i, 'modes: Guided comes back with the methane board as it was left')
  await sameBalls('back in Guided')
  await press('[data-key="step-count"]')
  ok((await state()).step === 'count', 'rail: tapping Count goes back to step 1')
  ok(await page.locator('.mb-total.is-right').count() === 1, 'rail: the finished count is still shown')
  await press('[data-key="next"]')
  ok((await state()).step === 'place', 'rail: Next returns to step 2')
  ok(await page.locator('[data-key="step-shape"]').isDisabled(), 'rail: Shape is locked until the earlier steps are done')
  await noSideScroll('guided')

  // ---- the count step's sample atoms stay on the board when the window gets narrow
  if (!phone) {
    console.log('extras: resize during the count step')
    const ch2o = byId('CH2O')
    await press('[data-key="picker"]')
    await press(`[data-key="pick-${ch2o.i}"]`)
    await page.setViewportSize({ width: 420, height: 800 })
    await wait(700)
    const pts = await points()
    const cbox = await page.locator('.mb-canvas-wrap').boundingBox()
    ok(pts.atoms.length === 3 && pts.atoms.every((a) => a.x - a.r > cbox.x && a.x + a.r < cbox.x + cbox.width), `resize: all three sample atoms are inside the stage (${pts.atoms.map((a) => Math.round(a.x)).join(',')} in ${Math.round(cbox.width)})`)
    await noSideScroll('narrow window')
    await shot('count-narrow')
    await page.setViewportSize(viewport)
    await wait(400)
  }

  // ---- wrong turns in the check and shape steps: carbon dioxide, then water
  console.log('extras: wrong turns')
  await press('[data-key="mode-guided"]')
  await solve(byId('CO2'), {
    addElectron: /^The board has 17 electrons, 1 more than carbon dioxide has\.$/,
    groups: [
      { n: 4, says: /^4 counts every shared pair as its own group\.$/, rings: 4, shot: 'groups-coach' },
      { n: 6, says: /^6 counts the lone pairs on the outer atoms\.$/, rings: 4 },
    ],
    shape: { pick: 'bent', says: /Bent is the shape for 2 atoms and 1 or 2 lone pairs/ },
    bond: /^That arrow points at carbon\.$/,
    net: /polar, and the dipoles still cancel[\s\S]*Carbon dioxide is nonpolar\./,
    sigma: /^4 counts every line as a sigma bond\.$/,
    hybrid: { pick: 'sp3', says: /^sp³ goes with 4 electron groups\.$/ },
  })
  await solve(byId('H2O'), {
    groups: [{ n: 2, says: /^2 is the number of atoms bonded to oxygen\.$/, rings: 4 }],
    shape: { pick: 'linear', says: /Linear would be the shape if oxygen had no lone pairs/ },
    net: /spread evenly around the middle atom[\s\S]*Water is polar\./,
    arrow: /^That arrow points against the bond arrows\.$/,
    endOn: true,
    flat: true,
    aim: true,
    hybrid: { pick: 'sp', says: /^sp goes with 2 electron groups\.$/ },
  })
  // ---- the arrows of step 6 from the keyboard, and an arrow on a nonpolar bond: formaldehyde
  if (!phone) {
    console.log('extras: dipole arrows from the keyboard')
    await solve(byId('CH2O'), { bond: /^Only a polar bond has a dipole arrow\.$/, keys: true })
  }
  // ---- Clear from a finished guided molecule on the 3D model: back to the step where the atoms go on the board
  console.log('extras: clear on the 3D model')
  let end = await state()
  ok(end.step === 'orbitals' && end.view === 'shape' && await page.locator('[data-key="clear"]').isEnabled(), 'clear: the Clear button is on at step 7, on the 3D model')
  await press('[data-key="clear"]')
  await wait(1700)
  end = await state()
  ok(end.atoms.length === 0 && end.step === 'place' && end.view === 'flat', `clear: the board is empty and the molecule is back at the place step (${end.atoms.length} atoms, ${end.step}, ${end.view})`)
  ok((await strip()) === 'wait wait wait', `clear: the three checks go back to waiting (${await strip()})`)
  await press('[data-key="undo"]')
  await wait(1900)
  end = await state()
  ok(end.atoms.length > 0 && end.bonds.length > 0, 'clear: Undo brings the structure back')
  ok(end.step === 'orbitals' && end.view === 'shape', `clear: Undo also puts the step and the 3D model back (${end.step}, ${end.view})`)
  ok((await strip()) === 'pass pass pass' && await page.locator('[data-key="next"]').isEnabled(), 'clear: the answers are back too, and the molecule is finished again')
}

// ---- key terms: the highlighted words and the card each one opens
const termNow = () => mb(() => window.__mb.term())
const cardText = () => mb(() => document.querySelector('.mb-termcard')?.innerText ?? '')
/** Ids of the words highlighted in the panel now, in reading order. */
const highlighted = () => mb(() => [...document.querySelectorAll('.mb-panel .mb-term')].map((b) => b.dataset.term))
/** Wait until the open card has finished popping into place: while it grows, its box on screen is not its real size. */
const cardSettled = () =>
  page.waitForFunction(() => { const c = document.querySelector('.mb-termcard'); return !c.hidden && Math.abs(c.getBoundingClientRect().width - c.offsetWidth) < 1 && c.getAnimations().every((a) => a.playState === 'finished') }, null, { timeout: 5000 }).catch(() => {})
/** Open a highlighted word's card with a real press and say what the card shows. */
async function openTerm(id) {
  const loc = page.locator(`.mb-panel .mb-term[data-term="${id}"]`).first()
  await loc.scrollIntoViewIfNeeded()
  if (phone) await loc.tap(); else await loc.click()
  await page.waitForFunction((id) => window.__mb.term()?.id === id, id, { timeout: 4000 }).catch(() => {})
  await cardSettled()
  return termNow()
}
/** Close the open card the way this screen size offers first: Escape with a keyboard, the close button on a phone. */
async function closeTerm() {
  if (phone) await page.locator('.mb-termcard [data-term-close]').tap(); else await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__mb.term() === null, null, { timeout: 4000 }).catch(() => {})
  await wait(150)
}
/** The card that is open is all on screen, and its picture fits inside it. */
async function cardFits(label) {
  const m = await mb(() => {
    const card = document.querySelector('.mb-termcard')
    const inner = card.querySelector('.mb-termcard-in')
    const r = card.getBoundingClientRect()
    const art = card.querySelector('.mb-term-pic :is(svg, table)')?.getBoundingClientRect()
    const pic = card.querySelector('.mb-term-pic').getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight, art: art ? { w: art.width, h: art.height, left: art.left, right: art.right } : null, pic: { left: pic.left, right: pic.right }, sideways: inner.scrollWidth - inner.clientWidth }
  })
  ok(m.left >= -0.5 && m.right <= m.w + 0.5 && m.top >= -0.5 && m.bottom <= m.h + 0.5, `${label}: the card is all on screen (${Math.round(m.left)}, ${Math.round(m.top)} to ${Math.round(m.right)}, ${Math.round(m.bottom)})`)
  ok(!!m.art && m.art.w > 40 && m.art.h > 20, `${label}: the card has a picture (${m.art ? `${Math.round(m.art.w)} x ${Math.round(m.art.h)}` : 'none'})`)
  ok(!!m.art && m.art.left >= m.pic.left - 0.5 && m.art.right <= m.pic.right + 0.5 && m.sideways <= 0, `${label}: the picture fits inside the card`)
}

async function terms() {
  const byId = (id) => PROBLEMS.find((p) => p.id === id)
  const all = await mb(() => window.__mb.terms)
  // the cards a student can open in the count step: from its sentences, from a wrong answer's card, or from a hint
  const COUNT_TERMS = ['valence', 'shell', 'group', 'atomic-number', 'ion', 'lewis', 'bond', 'full-shell']
  const COUNT_NAMES = ['Valence electrons', 'Electron shell', 'Group and period', 'Atomic number', 'Ion']
  // every atom the app has, by its column of the periodic table: atoms in one column have the same number of valence electrons
  const COLUMN = { hydrogen: 1, beryllium: 2, boron: 13, aluminum: 13, carbon: 14, silicon: 14, nitrogen: 15, phosphorus: 15, arsenic: 15, oxygen: 16, sulfur: 16, selenium: 16, fluorine: 17, chlorine: 17, bromine: 17, iodine: 17, krypton: 18, xenon: 18 }
  console.log('terms: the highlighted words (methane, count step)')
  let words = await highlighted()
  ok(words.join() === 'valence,shell', `words: the count step highlights "valence electrons" and "outer shell" (${words.join()})`)
  // each highlighted word is a button a pointer can reach: the element under its middle is the word itself
  // (a step's text takes no presses while it is still arriving, so this waits for it to settle)
  await page.waitForFunction(() => [...document.querySelectorAll('.mb-panel .mb-term')].every((b) => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b }), null, { timeout: 4000 }).catch(() => {})
  const reach = await mb(() => [...document.querySelectorAll('.mb-panel .mb-term')].map((b) => { const r = b.getBoundingClientRect(); return b.tagName === 'BUTTON' && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b }))
  ok(reach.length === 2 && reach.every(Boolean), 'words: each highlighted word is a button, and nothing lies over it')
  ok(await mb(() => document.querySelectorAll('button .mb-term, label .mb-term, h1 .mb-term, h2 .mb-term').length) === 0, 'words: no highlighted word sits inside a button, a label or a heading')
  ok(await termNow() === null && await page.locator('.mb-termcard').isHidden(), 'card: nothing is open before a word is pressed')

  console.log('terms: opening and closing a card')
  let card = await openTerm('valence')
  ok(card?.id === 'valence' && card.name === 'Valence electrons', `card: a press on "valence electrons" opens its card (${card?.name})`)
  await shot('term-valence')
  ok(card?.side === (phone ? 'sheet' : 'beside'), `card: it opens ${phone ? 'as a sheet from the bottom edge' : 'beside the panel'} (${card?.side})`)
  await cardFits('card')
  const look = await mb(() => {
    const el = document.querySelector('.mb-termcard')
    const word = document.querySelector('.mb-panel .mb-term[data-term="valence"]')
    const panel = document.querySelector('.mb-panel').getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { role: el.getAttribute('role'), labelled: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent, expanded: word.getAttribute('aria-expanded'), focusIn: el.contains(document.activeElement), right: r.right, panelLeft: panel.left, scrim: !document.querySelector('.mb-termscrim').hidden }
  })
  ok(look.role === 'dialog' && look.labelled === 'Valence electrons', 'card: it is a dialog named after the term')
  ok(look.expanded === 'true' && look.focusIn, 'card: the word is marked as open, and the keyboard is inside the card')
  if (phone) ok(look.scrim, 'card: the rest of the screen is dimmed behind the sheet')
  else ok(look.right <= look.panelLeft + 1 && !look.scrim, `card: it sits beside the panel and covers none of it (${Math.round(look.right)} against ${Math.round(look.panelLeft)})`)
  await noSideScroll('card open')
  // the example is another atom: methane's carbon and hydrogen are not in it
  let textNow = await cardText()
  ok(/Nitrogen has 7 electrons in 2 shells: 2 and 5\./.test(textNow) && !/carbon|hydrogen/i.test(textNow.split('Example')[1] ?? ''), 'card: the example is nitrogen, an atom methane does not have')
  ok(/Keep in mind/.test(textNow) && /Related terms/.test(textNow), 'card: it has an example, one thing to keep in mind, and related terms')
  // the pointing hand stays away while a card is open, and the glow stays where the next action is
  if (!phone) {
    await wait(1200)
    const c = await cueNow()
    ok(c.hand === 'off' && c.halos.length >= 1, `card: the hand is away while the card is open, and the glow stays (${c.hand}, ${c.halos.length})`)
  }
  await closeTerm()
  let back = await mb(() => ({ open: window.__mb.term(), hidden: document.querySelector('.mb-termcard').hidden, focus: document.activeElement?.dataset?.term ?? null, expanded: document.querySelector('.mb-panel .mb-term[data-term="valence"]').getAttribute('aria-expanded') }))
  ok(back.open === null && back.hidden && back.expanded === 'false', `card: ${phone ? 'the close button' : 'Escape'} closes it`)
  ok(back.focus === 'valence', `card: the keyboard is back on the word (${back.focus})`)

  // a second press on the same word closes the card (on a phone the sheet's dimmed backdrop lies over the word)
  if (!phone) {
    await openTerm('shell')
    await press('.mb-panel .mb-term[data-term="shell"]')
    await wait(250)
    ok(await termNow() === null, 'card: a second press on the word closes its card')
  }
  // the close button
  await openTerm('shell')
  await press('.mb-termcard [data-term-close]')
  await wait(250)
  ok(await termNow() === null, 'card: the close button closes it')
  if (phone) {
    await openTerm('shell')
    await page.touchscreen.tap(195, 60)
    await wait(350)
    ok(await termNow() === null, 'card: a tap on the dimmed screen above the sheet closes it')
    ok((await state()).step === 'count' && await mb(() => document.querySelector('[data-k="count-C"]').textContent) === '0', 'card: that tap reaches nothing behind the sheet')
  } else {
    // a press anywhere else closes the card, and the press still counts
    await openTerm('shell')
    await press('[data-key="inc-C"]')
    await wait(250)
    ok(await termNow() === null && await mb(() => document.querySelector('[data-k="count-C"]').textContent) === '1', 'card: a press on + for carbon closes the card and still adds 1')
    await press('[data-key="dec-C"]')
    // with the keyboard: Tab to the word, Enter opens, Tab stays inside the card, Escape closes and goes back to the word
    await page.locator('.mb-step').click({ position: { x: 4, y: 4 } })
    let on = null
    for (let k = 0; k < 60 && on !== 'valence'; k++) {
      await page.keyboard.press('Tab')
      on = await mb(() => document.activeElement?.dataset?.term ?? null)
    }
    ok(on === 'valence', 'keyboard: Tab reaches the highlighted word')
    await page.keyboard.press('Enter')
    await wait(500)
    ok((await termNow())?.id === 'valence', 'keyboard: Enter opens the card')
    await page.keyboard.press('Tab')
    ok(await mb(() => document.querySelector('.mb-termcard').contains(document.activeElement) && document.activeElement.hasAttribute('data-term-close')), 'keyboard: Tab goes to the close button inside the card')
    await page.keyboard.press('Escape')
    await wait(250)
    ok(await termNow() === null && await mb(() => document.activeElement?.dataset?.term) === 'valence', 'keyboard: Escape closes the card and returns to the word')
    ok((await state()).mode === 'guided' && !(await state()).pickerOpen, 'keyboard: that Escape did nothing else')
  }

  console.log('terms: related terms')
  await openTerm('valence')
  let chips = await page.locator('.mb-termcard .mb-term-go').allInnerTexts()
  ok(chips.join() === 'Electron shell,Group and period,Atomic number', `related: the valence card links to the count step's other terms (${chips.join()})`)
  await press('.mb-termcard [data-term-go="group"]')
  await page.waitForFunction(() => window.__mb.term()?.id === 'group', null, { timeout: 4000 }).catch(() => {})
  await cardSettled()
  card = await termNow()
  ok(card?.id === 'group' && card.name === 'Group and period', `related: a press on "Group and period" turns the card to that term (${card?.name})`)
  await cardFits('related')
  ok(await page.locator('.mb-termcard .mb-pt td.is-mine').count() === 3 && await page.locator('.mb-termcard .mb-pt-val').count() === 0, 'related: the group card marks one column of the periodic table and gives no row of valence electrons')
  ok(await mb(() => document.querySelector('.mb-panel .mb-term[data-term="valence"]').getAttribute('aria-expanded')) === 'false', 'related: the first word is no longer marked as open, because the card shows another term')
  if (!phone) {
    // a press on the first word brings its own card back
    await press('.mb-panel .mb-term[data-term="valence"]')
    await cardSettled()
    ok((await termNow())?.id === 'valence', 'related: a press on the first word brings its own card back')
    await press('.mb-termcard [data-term-go="group"]')
    await page.waitForFunction(() => window.__mb.term()?.id === 'group', null, { timeout: 4000 }).catch(() => {})
    await cardSettled()
  }
  await closeTerm()
  ok(await mb(() => document.activeElement?.dataset?.term) === 'valence', 'related: closing it puts the keyboard back on the word the first card was opened from')
  if (!phone) {
    // a press on bare board closes the card, and the keyboard goes back to the word
    await openTerm('valence')
    await tapAt(await emptySpot())
    await wait(200)
    ok(await termNow() === null && await mb(() => document.activeElement?.dataset?.term) === 'valence', `card: a press on the bare board closes it and the keyboard goes back to the word (${await mb(() => document.activeElement?.tagName)})`)
  }
  // a card belongs to its step: when the step changes under it (driven from the store here), it closes
  await openTerm('valence')
  await mb(() => window.__mb.store.selectProblem(1))
  await wait(900)
  ok(await termNow() === null, 'card: it closes when the molecule changes under it')
  await mb(() => window.__mb.store.selectProblem(0))
  await wait(900)

  console.log('terms: a wrong answer\'s card has its own highlighted words')
  for (let k = 0; k < 6; k++) await press('[data-key="inc-C"]') // 6 is carbon's atomic number
  for (let k = 0; k < 1; k++) await press('[data-key="inc-H"]')
  await press('[data-key="count-check"]')
  await wait(1100)
  ok(await page.locator('.mb-coach .mb-term[data-term="atomic-number"]').count() === 1, 'coach: the card about the atomic-number mix-up highlights "atomic number"')
  card = await openTerm('atomic-number')
  textNow = await cardText()
  ok(card?.name === 'Atomic number' && /Nitrogen's atomic number is 7/.test(textNow), 'coach: its card explains the atomic number with nitrogen, and gives no number for carbon')
  await closeTerm()

  console.log('terms: every card, in free build')
  await press('[data-key="mode-free"]')
  await wait(900)
  ok(all.length === 40, `cards: there are 40 key terms (${all.length})`)
  let bad = []
  for (const id of all) {
    await mb((id) => window.__mb.showTerm(id), id)
    await cardSettled()
    const m = await mb(() => {
      const card = document.querySelector('.mb-termcard')
      const inner = card.querySelector('.mb-termcard-in')
      const r = card.getBoundingClientRect()
      const art = card.querySelector('.mb-term-pic :is(svg, table)')?.getBoundingClientRect()
      const pic = card.querySelector('.mb-term-pic').getBoundingClientRect()
      const paras = [...card.querySelectorAll('.mb-term-means, .mb-term-ex p')].map((n) => n.textContent.trim())
      return { name: card.querySelector('h3').textContent, onScreen: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, art: !!art && art.width > 40 && art.height > 20 && art.left >= pic.left - 0.5 && art.right <= pic.right + 0.5, sideways: inner.scrollWidth - inner.clientWidth, words: paras.every((t) => t.length > 20 && !/undefined|NaN|\[object/.test(t)), label: card.querySelector('.mb-term-pic').getAttribute('aria-label') }
    })
    if (!(m.name && m.onScreen && m.art && m.sideways <= 0 && m.words && m.label)) bad.push(`${id}: ${JSON.stringify(m)}`)
  }
  ok(bad.length === 0, `cards: each of the 40 opens with a name, a meaning, an example and a picture that fits (${bad.slice(0, 2).join(' | ')})`)
  await shot('term-last')
  await mb(() => window.__mb.showTerm('shape:trigonal bipyramidal'))
  await cardSettled()
  ok((await termNow())?.name === 'Trigonal bipyramidal' && await page.locator('.mb-termcard .mb-pic-atom').count() === 6, 'cards: the trigonal bipyramidal card draws a middle atom and 5 atoms around it')
  await mb(() => window.__mb.showTerm('multiple'))
  await cardSettled()
  ok((await page.locator('.mb-termcard .mb-term-go').allInnerTexts()).join() === 'Bond,Sigma bond,Pi bond', 'cards: in free build a card links to every related term')

  console.log('terms: what the pictures show')
  /** Where the atoms, labels and arrows of the open card's picture are on screen. */
  const picture = () => mb(() => {
    const mid = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
    const card = document.querySelector('.mb-termcard')
    return {
      atoms: [...card.querySelectorAll('.mb-pic-atom')].map((c) => ({ el: c.parentElement.querySelector('text').textContent, ...mid(c) })),
      deltas: [...card.querySelectorAll('.mb-pic-delta')].map((t) => ({ text: t.textContent, ...mid(t) })),
      heads: [...card.querySelectorAll('.mb-pic-arrow.is-bond .is-head')].map(mid),
      tails: [...card.querySelectorAll('.mb-pic-arrow.is-bond')].map(mid),
      net: [...card.querySelectorAll('.mb-pic-arrow.is-net')].map((g) => ({ head: mid(g.querySelector('.is-head')), all: mid(g) })),
      badges: [...card.querySelectorAll('.mb-pic-badge')].map((g) => ({ text: g.querySelector('text').textContent, charge: g.classList.contains('is-charge'), ...mid(g) })),
      tags: [...card.querySelectorAll('.mb-pic-tag text')].map((t) => t.textContent).join(''),
    }
  })
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const show = async (id) => { await mb((id) => window.__mb.showTerm(id), id); await cardSettled(); return picture() }
  let pic = await show('dipole')
  let H = pic.atoms.find((a) => a.el === 'H')
  let Cl = pic.atoms.find((a) => a.el === 'Cl')
  const minus = pic.deltas.find((d) => d.text === 'δ−')
  const plus = pic.deltas.find((d) => d.text === 'δ+')
  ok(!!H && !!Cl && !!minus && !!plus && Math.abs(minus.x - Cl.x) < 12 && Math.abs(plus.x - H.x) < 12, 'picture: on the H–Cl bond, δ− is over chlorine and δ+ over hydrogen')
  ok(pic.heads.length === 1 && dist(pic.heads[0], Cl) < dist(pic.heads[0], H) && dist(pic.tails[0], H) > 20, 'picture: the bond arrow points at chlorine')
  pic = await show('pi')
  ok(pic.tags === 'πσπσπ', `picture: the double bond's lines are π and σ, the triple bond's π, σ and π (${pic.tags})`)
  pic = await show('sigma')
  ok(pic.tags === 'σπσ', `picture: the single bond's line is σ, the double bond's π and σ (${pic.tags})`)
  pic = await show('formal-charge')
  let O = pic.atoms.find((a) => a.el === 'O')
  H = pic.atoms.find((a) => a.el === 'H')
  ok(pic.badges.length === 1 && pic.badges[0].charge && pic.badges[0].text === '−1' && dist(pic.badges[0], O) < dist(pic.badges[0], H), 'picture: hydroxide has −1 marked on oxygen')
  pic = await show('full-shell')
  ok(pic.badges.length === 1 && pic.badges[0].text === '8' && !pic.badges[0].charge, 'picture: the ring around chlorine in HCl is marked 8')
  pic = await show('electron-group')
  ok(pic.badges.map((b) => b.text).join('') === '1234', `picture: the four electron groups of NF₃ are numbered (${pic.badges.map((b) => b.text).join('')})`)
  pic = await show('net-dipole')
  const S = pic.atoms.find((a) => a.el === 'S')
  const cls = pic.atoms.filter((a) => a.el === 'Cl')
  ok(!!S && cls.length === 2 && pic.heads.length === 2 && pic.heads.every((h) => Math.min(...cls.map((c) => dist(h, c))) < dist(h, S)), 'picture: in SCl₂ each bond arrow points at a chlorine atom')
  ok(pic.net.length === 1 && cls.every((c) => c.y > S.y) && pic.net[0].head.y > pic.net[0].all.y + 4, 'picture: the net dipole points from sulfur toward the side the chlorine atoms are on')
  pic = await show('cancel')
  const Be = pic.atoms.find((a) => a.el === 'Be')
  ok(pic.net.length === 0 && pic.heads.length === 2 && (pic.heads[0].x - Be.x) * (pic.heads[1].x - Be.x) < 0, 'picture: in BeCl₂ the two bond arrows point in opposite directions, and no net dipole is drawn')
  await closeTerm()
  await press('[data-key="mode-guided"]')
  await wait(900)

  console.log('terms: no card gives a number of the molecule on screen (count step, all 20)')
  bad = []
  for (const p of PROBLEMS) {
    await mb((i) => window.__mb.store.selectProblem(i), p.i)
    await wait(60)
    const columns = new Set(p.formula.map(([el]) => COLUMN[NAME[el]]))
    const near = Object.keys(COLUMN).filter((name) => columns.has(COLUMN[name]))
    for (const id of COUNT_TERMS) {
      await mb((id) => window.__mb.showTerm(id), id)
      const seen = await mb(() => ({ example: document.querySelector('.mb-termcard .mb-term-ex p').textContent, label: document.querySelector('.mb-termcard .mb-term-pic').getAttribute('aria-label'), symbols: [...document.querySelectorAll('.mb-termcard .mb-pic-sym, .mb-termcard .mb-sh-sym, .mb-termcard .mb-pt td.is-mine')].map((n) => n.textContent), chips: [...document.querySelectorAll('.mb-termcard .mb-term-go')].map((b) => b.textContent) }))
      const named = near.filter((n) => new RegExp(n, 'i').test(`${seen.example} ${seen.label}`))
      if (named.length) bad.push(`${p.id} ${id} names ${named.join()}`)
      const drawn = seen.symbols.filter((sym) => columns.has(COLUMN[NAME[sym] ?? { Si: 'silicon', I: 'iodine', Se: 'selenium' }[sym]]))
      if (drawn.length) bad.push(`${p.id} ${id} draws ${drawn.join()}`)
      if (!seen.chips.every((c) => COUNT_NAMES.includes(c))) bad.push(`${p.id} ${id} links to ${seen.chips.join()}`)
    }
  }
  ok(bad.length === 0, `leak: in the count step no card names or draws an atom from a column of the molecule's atoms, and no card links past the count step (${bad.slice(0, 3).join(' | ')})`)
  // nitrite is bent with one double bond, as ozone is: its resonance card shows the nitrate ion's three drawings
  await mb((i) => window.__mb.store.selectProblem(i), byId('NO2-').i)
  await mb(() => window.__mb.showTerm('resonance'))
  await cardSettled()
  ok(/nitrate ion, NO₃⁻, has 3 resonance structures/.test(await cardText()) && await page.locator('.mb-termcard .mb-pic-swap').count() === 2 && await page.locator('.mb-termcard .mb-pic-dot').count() === 0, 'leak: with the nitrite ion on screen the resonance card shows three drawings of nitrate, as lines without dots')
  await cardFits('resonance')
  await mb((i) => window.__mb.store.selectProblem(i), 0)
  await mb(() => window.__mb.showTerm('valence'))
  await closeTerm()

  console.log('terms: which words each step highlights (carbon dioxide, moved along from the store)')
  const co2 = byId('CO2')
  const move = (fn) => mb(fn).then(() => wait(1500))
  await move(() => { const s = window.__mb.store; s.selectProblem(3); s.setCount('C', 4); s.setCount('O', 6); s.checkCounts(); s.typeTotal(16); s.checkTotal(); s.next(); s.pickMiddle('C'); window.__ids = [s.place('C', null), s.place('O', null), s.place('O', null)]; s.next() })
  ok(co2 && (await state()).step === 'bond', 'steps: carbon dioxide is at the bond step')
  words = await highlighted()
  ok(words.includes('bond') && await mb(() => document.querySelector('.mb-panel .mb-term[data-term="bond"]').textContent) === 'bond', `steps: the bond step highlights the noun "bond" and leaves the verb at the start of the sentence plain (${words.join()})`)
  await move(() => { const s = window.__mb.store; const [c, o1, o2] = window.__ids; s.bond(o1, c); s.bond(o2, c); s.next() })
  words = await highlighted()
  ok(words.includes('formal-charge') && !words.includes('full-shell'), `steps: the check step highlights "formal charges"; the row about shells names the atoms that are short, so "full shell" is not on screen yet (${words.join()})`)
  card = await openTerm('formal-charge')
  textNow = await cardText()
  ok(card?.name === 'Formal charge' && /BF₄⁻/.test(textNow) && /3 − 0 − 4 = −1/.test(textNow) && !/oxygen|carbon/i.test(textNow.split('Example')[1].split('Keep in mind')[0]), 'steps: the formal charge card works its example on BF₄⁻, which shares no atom with carbon dioxide')
  await cardFits('formal charge')
  await closeTerm()
  await move(() => { const s = window.__mb.store; const [c, o1, o2] = window.__ids; s.bond(o1, c); s.bond(o2, c) })
  words = await highlighted()
  ok(words.includes('full-shell') && words.includes('lewis'), `steps: with the structure finished, "full outer shell" and "Lewis structure" are highlighted (${words.join()})`)
  await move(() => window.__mb.store.next())
  words = await highlighted()
  ok((await state()).step === 'shape' && words.includes('electron-group') && words.includes('lone-pair') && !words.includes('bond'), `steps: the shape step highlights "electron groups" and "lone pair", and "bond" is plain by now (${words.join()})`)
  ok(!words.some((w) => w.startsWith('shape:')), 'steps: no shape is named in the text before the shape is picked')
  await move(() => { const s = window.__mb.store; s.answerGroups(2); s.pickShape('linear') })
  words = await highlighted()
  ok(words.includes('shape:linear') && words.includes('bond-angle'), `steps: once the shape is picked, its name and "bond angle" are highlighted (${words.join()})`)
  card = await openTerm('shape:linear')
  ok(card?.name === 'Linear' && /BeCl₂/.test(await cardText()), 'steps: the card for "linear" shows beryllium chloride')
  await closeTerm()
  await move(() => window.__mb.store.next())
  words = await highlighted()
  ok((await state()).step === 'polar' && ['electronegativity', 'polar', 'delta-en'].every((w) => words.includes(w)) && !words.includes('bond'), `steps: step 6 highlights "electronegativity", "polar" and "ΔEN" (${words.join()})`)
  card = await openTerm('delta-en')
  textNow = await cardText()
  ok(card?.name === 'ΔEN' && /ΔEN = 3\.0 − 2\.1 = 0\.9/.test(textNow) && !/3\.5 − 2\.5/.test(textNow), 'steps: the ΔEN card subtracts for H–Cl, never for the C–O bond the student is asked about')
  await cardFits('ΔEN')
  await shot('term-delta-en')
  await closeTerm()
  await move(() => { const s = window.__mb.store; s.answerBond('O', 'O'); s.answerNet(false); s.next() })
  words = await highlighted()
  ok((await state()).step === 'orbitals' && words.includes('sigma') && words.includes('pi'), `steps: step 7 highlights "sigma bonds" and "pi bonds" (${words.join()})`)
  card = await openTerm('pi')
  ok(card?.name === 'Pi bond' && await page.locator('.mb-termcard .mb-pic-tag').count() === 5, 'steps: the pi bond card labels each line of a double and a triple bond')
  await closeTerm()
  await noSideScroll('terms')
}

async function shell() {
  console.log('shell: home')
  await shot('home')
  ok((await page.title()) === 'Chem Review', `home: the page title is Chem Review (${await page.title()})`)
  ok(await page.getByRole('heading', { name: 'Chem Review' }).count() === 1, 'home: the app name is a heading')
  const card = page.getByRole('link', { name: /Lewis structures and shapes/ })
  ok(await card.count() === 1, 'home: one module card, and it is a link')
  ok(/20 molecules/.test(await card.innerText()) && !/finished/.test(await card.innerText()), 'home: the card says 20 molecules, with nothing finished yet')
  await noSideScroll('home')
  if (phone) await card.tap(); else await card.click()
  await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })
  ok(new URL(page.url()).pathname === `${folder}/lewis`, `home: the card opens /lewis (${page.url()})`)
  ok(await page.locator('.mb-canvas').count() === 1, 'module: the board is on screen')
  ok((await page.title()) === 'Lewis structures and shapes', `module: the page title names the module (${await page.title()})`)
  const fonts = await mb(() => document.fonts.check('900 20px "Nunito Variable"'))
  ok(fonts, 'module: the Nunito variable font is loaded')
  const vars = await mb(() => getComputedStyle(document.querySelector('.mb')).getPropertyValue('--grape-deep').trim())
  ok(vars === '#5a4daa', `module: colors come from the shared tokens (--grape-deep is ${vars})`)

  console.log('shell: finish methane, then go back')
  const list = await mb(() => { const s = window.__mb.store; const p = s.problemOf(); return { i: s.getState().problem, id: p.id, formula: p.formula, charge: p.charge, center: p.center, shape: p.shape } })
  PROBLEMS.push(list)
  await solve(list)
  await press('[data-key="exit"]')
  await page.waitForFunction(() => !window.__mb, null, { timeout: 10000 })
  ok(new URL(page.url()).pathname === `${folder}/`, `back: the back button returns to the home screen (${page.url()})`)
  ok(await page.locator('.mb-canvas').count() === 0, 'back: the board is taken down')
  await page.waitForTimeout(300)
  ok(/1 of 20 molecules finished/.test(await page.getByRole('link', { name: /Lewis structures and shapes/ }).innerText()), 'back: the card now says 1 of 20 molecules finished')
  await shot('home-progress')

  console.log('shell: reload, reopen')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  ok(/1 of 20 molecules finished/.test(await page.getByRole('link', { name: /Lewis structures and shapes/ }).innerText()), 'reload: the finished count is still there')
  const again = page.getByRole('link', { name: /Lewis structures and shapes/ })
  if (phone) await again.tap(); else await again.click()
  await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })
  await press('[data-key="picker"]')
  ok(await page.locator('.mb-pick-done').count() === 1, 'reopen: the picker ticks methane as finished')
  await press('[data-key="picker-close"]')
  // straight to the module by its address, then back: with no history, the back button still goes home
  await page.goto(`${base}/lewis`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })
  ok(true, 'address: /lewis opens the module directly')
  await noSideScroll('module')
}

if (firstArg === 'shell') {
  try { await shell() } catch (e) { failed.push(`shell: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 3).join(' ')}`); await shot('shell-error') }
} else if (firstArg === 'extras') {
  try { await extras() } catch (e) { failed.push(`extras: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 3).join(' ')}`); await shot('extras-error') }
} else if (firstArg === 'terms') {
  try { await terms() } catch (e) { failed.push(`terms: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 6).join(' ')}`); await shot('terms-error') }
} else {
  const first = Number(firstArg)
  const list = PROBLEMS.slice(first, first + Number(countArg))
  for (const p of list) {
    try { await solve(p) } catch (e) { failed.push(`${p.id}: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 14).join('\n    ')}`); await shot(`${p.id.replace(/\W/g, '')}-error`) }
  }
}
ok(errors.length === 0, `no console errors (${errors.slice(0, 3).join(' | ')})`)
console.log(`\n${size}: ${passed} passed, ${failed.length} failed`)
if (failed.length) console.log(failed.map((f) => ` - ${f}`).join('\n'))
await browser.close()
process.exit(failed.length ? 1 : 0)
