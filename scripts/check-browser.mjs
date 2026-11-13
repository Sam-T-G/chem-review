// Real-input check of the whole app in headless Chromium. Every action is a real pointer or key
// event sent through the browser (mouse on desktop, touch on the phone size); nothing is clicked
// from script. Each guided problem is solved the way the guide tells a student to solve it.
//
// Usage: node scripts/check-browser.mjs [desktop|phone] [first problem index] [how many]
//        node scripts/check-browser.mjs [desktop|phone] extras   (wrong answers, hints, refused moves, undo, keyboard, free build)
//        node scripts/check-browser.mjs [desktop|phone] shell    (home screen, opening the module, the way back, saved progress)
// Needs the built site served on port 5210 (pnpm web:serve), or MB_URL pointing at one.
// MB_SHOTS=1 saves screenshots to shots/.
import { chromium } from 'playwright'

const [size = 'desktop', firstArg = '0', countArg = '99'] = process.argv.slice(2)
const base = (process.env.MB_URL ?? 'http://localhost:5210').replace(/\/$/, '')
const url = firstArg === 'shell' ? `${base}/` : `${base}/lewis`
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
async function drag(from, to, hold = 0) {
  const steps = 14
  const at = (i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })
  if (phone) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
    for (let i = 1; i <= steps; i++) { const p = at(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); await wait(12) }
    if (hold) await wait(hold)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) { const p = at(i); await page.mouse.move(p.x, p.y); await wait(8) }
    if (hold) await wait(hold)
    await page.mouse.up()
  }
  await wait(520)
}
const centerOf = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const atomPoint = async (id) => (await points()).atoms.find((a) => a.id === id)

const VALENCE = { H: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, Xe: 8 }
const PROBLEMS = firstArg === 'shell' ? [] : await mb(() => {
  const s = window.__mb.store
  const out = []
  const start = s.getState().problem
  for (let i = 0; i < 40; i++) { s.selectProblem(i); if (s.getState().problem !== i) break; const p = s.problemOf(); out.push({ i, id: p.id, formula: p.formula, charge: p.charge, center: p.center, shape: p.shape }) }
  s.selectProblem(start)
  return out
})

async function solve(p) {
  console.log(`${p.id}`)
  // open the picker and choose the molecule
  await press('[data-key="picker"]')
  await press(`[data-key="pick-${p.i}"]`)
  let st = await state()
  ok(st.problem === p.i && st.step === 'count', `${p.id}: picker opens the problem at the count step`)

  // 1. count
  for (const [el] of p.formula) for (let k = 0; k < VALENCE[el]; k++) await press(`[data-key="inc-${el}"]`)
  await press('[data-key="count-check"]')
  const total = p.formula.reduce((n, [el, k]) => n + VALENCE[el] * k, 0) - p.charge
  await page.locator('#mb-total').pressSequentially(String(total), { delay: 30 })
  await press('[data-key="total-check"]')
  ok(await page.locator('.mb-total.is-right').count() === 1, `${p.id}: total of ${total} accepted`)
  await press('[data-key="next"]')

  // 2. place: answer the middle question, then drag each atom from the tray onto the board
  if (p.formula.length > 1) await press(`[data-key="mid-${p.center}"]`)
  const box = await page.locator('.mb-canvas-wrap').boundingBox()
  const pts0 = await points()
  // board rectangle on screen is inside the canvas box minus the chrome; aim within its middle
  const outer = p.formula.flatMap(([el, n]) => new Array(el === p.center ? n - 1 : n).fill(el))
  const ring = outer.length
  const cx = box.x + box.width / 2
  const cy = box.y + box.height * (phone ? 0.5 : 0.52)
  const rx = Math.min(box.width * 0.26, 220)
  const ry = Math.min(box.height * (phone ? 0.16 : 0.2), 150)
  await drag(await centerOf(`[data-tray="${p.center}"]`), { x: cx, y: cy })
  for (let k = 0; k < ring; k++) {
    const a = (k / ring) * Math.PI * 2 + 0.5
    await drag(await centerOf(`[data-tray="${outer[k]}"]`), { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  }
  st = await state()
  ok(st.atoms.length === ring + 1, `${p.id}: all ${ring + 1} atoms placed by dragging from the tray (got ${st.atoms.length})`)
  void pts0
  await press('[data-key="next"]')

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
  await press('[data-key="next"]')

  // 4. check: do what the hint says, one move at a time, until there is nothing left to fix
  const empty = { x: box.x + 30, y: box.y + box.height * 0.5 }
  const electron = async (atomId, key) => { await tapAt(await atomPoint(atomId)); await press(`[data-key="${key}"]`); await tapAt(empty) }
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
  await shot(`${p.id.replace(/\W/g, '')}-flat`)
  await press('[data-key="next"]')

  // 5. shape: count groups, commit to a shape, watch it lift
  const groups = await mb(() => { const s = window.__mb.store.getState(); const c = window.__mb.report().topology.center; const atom = s.s.atoms.find((a) => a.id === c); return s.s.bonds.filter((b) => b.a === c || b.b === c).length + Math.floor(atom.lone / 2) })
  await press(`[data-key="grp-${groups}"]`)
  await press(`[data-key="shp-${p.shape}"]`)
  await wait(phone ? 2400 : 2100)
  st = await state()
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
  await press('[data-key="inc-H"]')
  await press('[data-key="count-check"]')
  ok(/atomic number/.test(await text('.mb-fb')), 'count: answering 6 for carbon names the atomic-number mix-up')
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
  await press('[data-key="mid-O"]')
  ok(/Pick again/.test(await text('.mb-fb')), 'middle: picking oxygen for carbonate says why and asks again')
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
  await press('[data-tray="H"]'); await wait(300)
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
  // bond by dragging one of carbon's dots onto hydrogen
  const dot = (await points()).dots.find((d) => d.key.startsWith(`L:${c}:`))
  await drag(dot, await atomPoint(h1))
  st = await state()
  ok(st.bonds.length === 1, 'board: dragging a carbon dot onto hydrogen makes a bond')
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
  await drag(await centerOf('[data-tray="O"]'), mid)
  await drag(await centerOf('[data-tray="H"]'), { x: mid.x - (phone ? 90 : 190), y: mid.y - 20 })
  await drag(await centerOf('[data-tray="H"]'), { x: mid.x + (phone ? 90 : 190), y: mid.y - 20 })
  st = await state()
  ok(st.atoms.length === 3, 'free: three atoms dragged from the tray')
  await sameBalls('free build (its atom ids repeat the guided board\'s)')
  const o = st.atoms.find((a) => a.el === 'O').id
  for (const h of st.atoms.filter((a) => a.el === 'H')) await drag(await atomPoint(h.id), await atomPoint(o))
  ok((await report()).complete, 'free: H2O is accepted')
  ok(await page.locator('.mb-checks li[data-state="pass"]').count() === 3, 'free: all three checks pass')
  ok(/Charge of everything on the board: 0/.test(await text('.mb-charge')), 'free: the charge reads 0')
  await shot('free-water')
  await press('[data-key="see-shape"]')
  await wait(2200)
  ok((await page.locator('.mb-readout dd.is-big').innerText()).toLowerCase() === 'bent', 'free: See the 3D shape names water bent')
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
  await press('[data-key="e-plus"]')
  await press('[data-key="e-plus"]')
  ok(/Oxygen already has 8 electrons/.test((await state()).toast ?? ''), 'free: a ninth electron on oxygen is refused with the reason')
  await tapAt(await emptySpot())
  await noSideScroll('free build')

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
  ok(new URL(page.url()).pathname === '/lewis', `home: the card opens /lewis (${page.url()})`)
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
  ok(new URL(page.url()).pathname === '/', `back: the back button returns to the home screen (${page.url()})`)
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
} else {
  const first = Number(firstArg)
  const list = PROBLEMS.slice(first, first + Number(countArg))
  for (const p of list) {
    try { await solve(p) } catch (e) { failed.push(`${p.id}: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n')[0]}`); await shot(`${p.id.replace(/\W/g, '')}-error`) }
  }
}
ok(errors.length === 0, `no console errors (${errors.slice(0, 3).join(' | ')})`)
console.log(`\n${size}: ${passed} passed, ${failed.length} failed`)
if (failed.length) console.log(failed.map((f) => ` - ${f}`).join('\n'))
await browser.close()
process.exit(failed.length ? 1 : 0)
