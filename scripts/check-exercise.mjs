// Real-input check of the exercises in headless Chromium. Every action is a real pointer, touch or
// key event sent through the browser; nothing is clicked or focused from script. Before each press
// the check asserts that document.elementFromPoint at the press point lands on the control.
//
// One molecule is worked from start to finish: the total typed, the structure built by dragging
// atoms from the row under the board and onto each other, every part answered, with one wrong
// answer per part and its card. Then: the 3D shape locked until both geometries are right, the
// finished row, the next molecule, a reload that shows the molecule as finished, and the keyboard.
//
// Usage: node scripts/check-exercise.mjs [desktop|phone]
// Needs the built site served (pnpm exec serve dist -l 5233), with MB_URL pointing at it.
// MB_SHOTS=1 saves screenshots to MB_SHOT_DIR (default shots/).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const [size = 'desktop'] = process.argv.slice(2)
const base = (process.env.MB_URL ?? 'http://localhost:5210').replace(/\/$/, '')
const phone = size === 'phone'
const viewport = phone ? { width: 390, height: 844 } : { width: 1360, height: 840 }
const SHOTS = process.env.MB_SHOTS === '1'
const SHOT_DIR = process.env.MB_SHOT_DIR ?? 'shots'
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true })

// The answers of the worksheet's molecules, worked by hand from docs/chemistry/sources.md (the same
// rows as tests/exercise-pool.ts). The check works the first molecule of the picker that is here.
// [total, electron geometry, molecular geometry, bond angle, {outer atom: [ΔEN, polar]}, polar, direction]
const ANSWERS = {
  H2O: [8, 'tetrahedral', 'bent', 'less than 109.5°', { H: ['1.4', true] }, true, 'toward the 2 lone pairs'],
  CH2Cl2: [20, 'tetrahedral', 'tetrahedral', '109.5°', { H: ['0.4', false], Cl: ['0.5', true] }, true, 'toward the 2 chlorine atoms'],
  SiCl4: [32, 'tetrahedral', 'tetrahedral', '109.5°', { Cl: ['1.2', true] }, false, null],
  PCl3: [26, 'tetrahedral', 'trigonal pyramidal', 'less than 109.5°', { Cl: ['0.9', true] }, true, 'toward the 3 chlorine atoms'],
  SCl2: [20, 'tetrahedral', 'bent', 'less than 109.5°', { Cl: ['0.5', true] }, true, 'toward the 2 chlorine atoms'],
}
const VALENCE = { H: 1, C: 4, Si: 4, O: 6, P: 5, S: 6, Cl: 7 }
const slug = (t) => t.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
// without these a headless page counts as hidden and its animations stand still
await cdp.send('Page.bringToFront')
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

let passed = 0
const failed = []
const ok = (cond, label) => { if (cond) passed++; else { failed.push(label); console.log(`  FAIL ${label}`) } }
const wait = (ms) => page.waitForTimeout(ms)
const mb = (fn, arg) => page.evaluate(fn, arg)
const ex = () => mb(() => { const s = window.__mb.store.getState(); return { mode: s.mode, view: s.view, at: s.exercise.at, atoms: s.s.atoms, bonds: s.s.bonds, solved: s.solved, valence: s.exercise.valence, structure: s.exercise.structure } })
const points = () => mb(() => window.__mb.scene.debugPoints())
const cueNow = () => mb(() => window.__mb.cue())
const text = async (sel) => (await page.locator(sel).allInnerTexts()).join(' ')
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOT_DIR}/exercise-${size}-${name}.png` }) }

async function open() {
  await page.goto(`${base}/exercises`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })
  await wait(900)
}

// ---- real input
/** Presses a control at its middle with the mouse or a finger, once the point lands on it. A piece of
 *  the panel that is still arriving takes no taps, so this waits for the hit point to come free. */
async function hit(sel, label = sel) {
  const loc = page.locator(sel).first()
  await loc.scrollIntoViewIfNeeded()
  let p = null
  let on = false
  for (let i = 0; i < 30 && !on; i++) {
    const b = await loc.boundingBox()
    p = b && { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    on = !!p && (await mb(({ x, y, sel }) => { const n = document.elementFromPoint(x, y); const want = document.querySelector(sel); return !!n && !!want && (n === want || want.contains(n)) }, { ...p, sel }))
    if (!on) await wait(80)
  }
  ok(on, `${label}: the press lands on the control`)
  if (!p) return
  if (phone) await page.touchscreen.tap(p.x, p.y)
  else await page.mouse.click(p.x, p.y)
  await wait(220)
}
const tapAt = async (p) => { if (phone) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await wait(180) }
async function drag(from, to) {
  const steps = 14
  const at = (i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })
  if (phone) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
    for (let i = 1; i <= steps; i++) { const q = at(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q.x, y: q.y }] }); await wait(12) }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) { const q = at(i); await page.mouse.move(q.x, q.y); await wait(8) }
    await page.mouse.up()
  }
  await wait(520)
}
const centerOf = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
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
/** Types into a box: a tap on it (a real focus), then real key presses. */
async function typeInto(sel, value) {
  await hit(sel, `${sel} box`)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value, { delay: 30 })
  await wait(150)
}
/** A wrong answer's card is open in this part: the three-part card, with something in its first line. */
async function cardIn(part, label) {
  const lead = (await text(`.ex-part[data-part="${part}"] .mb-coach-lead`)).trim()
  ok(lead.length > 10, `${label}: the wrong answer gets its card (${lead})`)
  return lead
}
const partState = (part) => mb((part) => document.querySelector(`.ex-part[data-part="${part}"]`)?.getAttribute('data-state'), part)
/** The glow is on the control of the next action. The module's debug handle reports the guided
 *  steps' cue only (window.__mb.cue().cue is null in a part's mode), so the check reads the glows
 *  themselves: one of them must cover the control. */
async function cued(label, key) {
  const sel = key === 'next' ? '.mb-btn-main' : `[data-cue="${key}"]`
  let on = false
  let seen = 0
  for (let i = 0; i < 40 && !on; i++) {
    const c = await cueNow()
    const halos = c.halos.filter((h) => h.opacity > 0.5 && h.w > 8 && h.h > 8)
    seen = halos.length
    const r = await page.locator(sel).first().boundingBox().catch(() => null)
    on = !!r && halos.some((h) => h.x <= r.x + 2 && h.y <= r.y + 2 && h.x + h.w >= r.x + r.width - 2 && h.y + h.h >= r.y + r.height - 2)
    if (!on) await wait(120)
  }
  ok(on, `${label}: the next action (${sel}) glows (${seen} glows on)`)
}
/** No highlighted key term on the sheet opens a card that terms.ts keeps plain. */
async function termsSafe(label) {
  const bad = await mb(() => {
    const plain = new Set((document.querySelector('.ex-sheet')?.getAttribute('data-ex-plain') ?? '').split(' '))
    return [...document.querySelectorAll('.mb-panel .mb-term')].map((b) => b.getAttribute('data-term')).filter((id) => plain.has(id))
  })
  ok(bad.length === 0, `${label}: no highlighted term opens a card kept plain (${bad.join(' ')})`)
}

async function work() {
  await open()
  let st = await ex()
  ok(st.mode === 'exercise', `/exercises opens the exercises (mode ${st.mode})`)
  // the first molecule of the picker that this check has answers for
  await hit('[data-key="picker"]', 'Change molecule')
  const picks = await mb(() => [...document.querySelectorAll('[data-act="ex-pick"]')].map((b) => ({ key: b.getAttribute('data-key'), at: Number(b.getAttribute('data-at')), f: b.querySelector('.mb-pick-f').textContent })))
  ok(picks.length >= 3, `the picker lists the pool (${picks.length})`)
  const formulaId = (f) => f.replace(/\s/g, '')
  const pick = picks.find((x) => ANSWERS[formulaId(x.f)])
  ok(!!pick, 'the pool has a molecule this check knows the answers to')
  if (!pick) return
  const id = formulaId(pick.f)
  const [total, eg, mg, angle, bonds, polar, dir] = ANSWERS[id]
  console.log(`${id}`)
  await hit(`[data-key="${pick.key}"]`, `pick ${id}`)
  st = await ex()
  ok(st.at === pick.at && st.atoms.length === 0, `${id}: the picker opens the molecule on an empty board`)

  // an empty sheet: no step rail, no Hint, nothing that gives a part away
  ok(await page.locator('.mb-rail').count() === 0 && await page.locator('[data-key="hint"]').count() === 0, `${id}: no step rail and no Hint button`)
  ok(await page.locator('.ex-part').count() === 7, `${id}: the sheet shows its parts (${await page.locator('.ex-part').count()})`)
  ok(!/\bof \d/.test(await text('.mb-ledger')), `${id}: the electron counter gives no total to reach (${await text('.mb-ledger')})`)
  ok(await page.locator('.mb-checkbar [data-k="chk-electrons"]').count() === 0, `${id}: the strip of checks has no electron total before the valence electrons are answered`)
  ok(await page.locator('[data-key="ex-see-shape"], [data-key="view-shape"]').count() === 0, `${id}: no way to the 3D shape yet`)
  await termsSafe(`${id} empty sheet`)
  await cued(`${id} empty sheet`, 'ex-valence')
  await shot('empty')

  // valence electrons: a wrong total, then the right one
  await typeInto('[data-key="ex-valence"]', String(total + 1))
  await hit('[data-key="ex-valence-check"]', 'Check the total')
  await cardIn('valence', `${id} valence`)
  await shot('wrong-card')
  await typeInto('[data-key="ex-valence"]', String(total))
  await hit('[data-key="ex-valence-check"]', 'Check the total')
  ok(await partState('valence') === 'right', `${id}: the right total is marked and locked`)
  ok(await page.locator('[data-key="ex-valence"]').count() === 0, `${id}: the total's box is gone once it is right`)
  ok(await page.locator('.mb-checkbar [data-k="chk-electrons"]').count() === 1, `${id}: the strip shows the electron total once the valence electrons are answered`)

  // electron geometry and molecular geometry: a wrong pick each, then the right one
  const wrongOf = async (act, right) => mb(({ act, right }) => [...document.querySelectorAll(`[data-act="${act}"]`)].map((b) => b.getAttribute('data-v')).find((v) => v !== right), { act, right })
  for (const [part, right] of [['eg', eg], ['mg', mg]]) {
    const w = await wrongOf(`ex-${part}`, right)
    await hit(`[data-key="ex-${part}-${slug(w)}"]`, `${part} pick ${w}`)
    await cardIn(part, `${id} ${part} (${w})`)
    ok(await page.locator('[data-key="ex-see-shape"]').count() === 0 && (await ex()).view === 'flat', `${id}: the 3D shape stays locked while a geometry is wrong`)
    await hit(`[data-key="ex-${part}-${slug(right)}"]`, `${part} pick ${right}`)
    ok(await partState(part) === 'right', `${id}: ${part} ${right} is marked right`)
  }
  ok(await page.locator('[data-key="ex-see-shape"]').count() === 0, `${id}: with no structure on the board the 3D shape stays shut`)
  ok(/Finish the Lewis structure/.test(await text('.ex-part[data-part="mg"] .mb-note')), `${id}: the sheet says the structure is needed for the 3D shape`)

  // bond angle
  const wa = await wrongOf('ex-angle', angle)
  await hit(`[data-key="ex-angle-${slug(wa)}"]`, `angle pick ${wa}`)
  await cardIn('angle', `${id} angle (${wa})`)
  await hit(`[data-key="ex-angle-${slug(angle)}"]`, `angle pick ${angle}`)
  ok(await partState('angle') === 'right', `${id}: the bond angle is marked right`)

  // bond polarity: a wrong ΔEN, then the right ones, then polar or nonpolar
  ok(await page.locator('.ex-part[data-part="net"] .mb-note').count() === 1, `${id}: the net dipole waits for the bond polarity`)
  const els = Object.keys(bonds)
  await typeInto(`[data-key="ex-den-${els[0]}"]`, '9.9')
  await hit('[data-key="ex-den-check"]', 'Check ΔEN')
  await cardIn('bonds', `${id} ΔEN`)
  for (const el of els) await typeInto(`[data-key="ex-den-${el}"]`, bonds[el][0])
  // Enter in the last box checks them
  await page.keyboard.press('Enter')
  await wait(300)
  for (const el of els) await hit(`[data-key="ex-bond-${el}-${bonds[el][1] ? 'polar' : 'nonpolar'}"]`, `${el} bond ${bonds[el][1] ? 'polar' : 'nonpolar'}`)
  ok(await partState('bonds') === 'right', `${id}: the bond polarity is marked right`)

  // net dipole: the first pick is final, so the wrong one is given its card with the answer
  await hit(`[data-key="ex-net-${polar ? 'nonpolar' : 'polar'}"]`, 'net dipole, the wrong pick')
  await cardIn('net', `${id} net dipole`)
  if (dir) {
    const choices = await mb(() => [...document.querySelectorAll('[data-act="ex-dir"]')].map((b) => ({ key: b.getAttribute('data-key'), label: b.textContent.trim().toLowerCase() })))
    const right = choices.find((c) => c.label === dir)
    const wrong = choices.find((c) => c.label !== dir)
    ok(!!right && !!wrong, `${id}: the direction picks hold "${dir}" (${choices.map((c) => c.label).join(' | ')})`)
    await hit(`[data-key="${wrong.key}"]`, `direction ${wrong.label}`)
    ok(/\w/.test(await text('.ex-part[data-part="net"] .mb-coach:last-of-type .mb-coach-lead')), `${id}: a wrong direction gets its card`)
    await hit(`[data-key="${right.key}"]`, `direction ${dir}`)
  }
  ok(await partState('net') === 'right', `${id}: the net dipole part is answered`)

  // the structure: check an empty board, then build it by dragging, with an extra electron first
  await hit('[data-key="ex-structure"]', 'Check my structure on an empty board')
  ok(/still to put on the board/.test(await text('.ex-part[data-part="structure"] .mb-coach-lead')), `${id}: an empty board is told what is missing`)
  ok((await ex()).structure.tries === 0, `${id}: checking an unfinished board is not a try`)
  const formula = await mb(() => { const s = window.__mb.store; const p = s.problemOf(); return { center: p.center, atoms: p.formula.flatMap(([el, n]) => new Array(n).fill(el)) } })
  const outer = [...formula.atoms]
  outer.splice(outer.indexOf(formula.center), 1)
  const on = (await points()).board.px
  const cx = on.x + on.w / 2
  const cy = on.y + on.h * 0.52
  const rx = Math.min(on.w * 0.36, 220)
  const ry = Math.min(on.h * 0.38, 150)
  ok(await page.locator(`[data-tray="${formula.center}"]`).count() === 1, `${id}: the row under the board holds the molecule's atoms`)
  await drag(await centerOf(`[data-tray="${formula.center}"]`), { x: cx, y: cy })
  for (let k = 0; k < outer.length; k++) {
    const a = (k / outer.length) * Math.PI * 2 + 0.5
    await drag(await centerOf(`[data-tray="${outer[k]}"]`), { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  }
  st = await ex()
  ok(st.atoms.length === outer.length + 1, `${id}: every atom dragged onto the board (${st.atoms.length})`)
  const centerId = st.atoms.find((a) => a.el === formula.center).id
  for (let guard = 0; guard < 12; guard++) {
    st = await ex()
    const bonded = new Set(st.bonds.flatMap((b) => [b.a, b.b]))
    const loose = st.atoms.find((a) => a.id !== centerId && !bonded.has(a.id))
    if (!loose) break
    await drag(await atomPoint(loose.id), await atomPoint(centerId))
    await atomsAtRest()
  }
  st = await ex()
  ok(st.bonds.length === outer.length, `${id}: every outer atom bonded by dragging (${st.bonds.length})`)
  const box = await page.locator('.mb-canvas-wrap').boundingBox()
  const empty = { x: box.x + 24, y: box.y + box.height * 0.5 }
  const someOuter = st.atoms.find((a) => a.id !== centerId)
  await tapAt(await atomPoint(someOuter.id))
  await hit('[data-key="e-plus"]', '+ electron')
  await tapAt(empty)
  await hit('[data-key="ex-structure"]', 'Check my structure')
  const lead = (await text('.ex-part[data-part="structure"] .mb-coach-lead')).trim()
  ok(/more than/.test(lead), `${id}: an extra electron is called out (${lead})`)
  await tapAt(await atomPoint(someOuter.id))
  await hit('[data-key="e-minus"]', '− electron')
  await tapAt(empty)
  ok(await page.locator('.ex-part[data-part="structure"] .mb-coach').count() === 0, `${id}: a change to the board takes the old result away`)
  await hit('[data-key="ex-structure"]', 'Check my structure')
  ok((await ex()).structure.right, `${id}: the Lewis structure is accepted`)

  // resonance, the last part: a wrong pick gets its card, and the sheet is finished
  // none of the molecules in ANSWERS has resonance
  const resonance = false
  await hit(`[data-key="ex-res-${resonance ? 'no' : 'yes'}"]`, 'resonance, the wrong pick')
  await cardIn('structure', `${id} resonance`)
  await wait(900)
  st = await ex()
  ok(st.view === 'shape', `${id}: the finished sheet lifts the model into 3D`)
  ok(st.solved.includes(`ex:${id}`), `${id}: the molecule is saved as finished (${st.solved.join()})`)
  ok(await page.locator('.ex-row .mb-readout div').count() === 7, `${id}: the finished row is shown as a table`)
  const marks = await mb(() => window.__mb.scene.debugAngles?.() ?? [])
  ok(Array.isArray(marks) && marks.length > 0, `${id}: the bond angles are marked on the model once the angle is answered (${JSON.stringify(marks).slice(0, 80)})`)
  await cued(`${id} finished`, 'next')
  await termsSafe(`${id} finished sheet`)
  await shot('finished')

  // the next molecule: another one, on an empty board, with empty answers
  await hit('[data-key="ex-next"]', 'Next molecule')
  st = await ex()
  ok(st.at !== pick.at && st.atoms.length === 0 && st.view === 'flat' && !st.valence.right, `${id}: Next molecule opens another molecule on an empty board, with the answers cleared`)
  await noSideScroll('after next')
  return { id, at: pick.at, total }
}

async function reloadAndKeys(done) {
  console.log('reload and keyboard')
  await open()
  await hit('[data-key="picker"]', 'Change molecule after reload')
  ok(await page.locator(`[data-key="ex-pick-${done.at}"] .mb-pick-done`).count() === 1, `reload: the picker marks ${done.id} as finished`)
  await hit(`[data-key="ex-pick-${done.at}"]`, `pick ${done.id} again`)
  ok(await page.locator('.ex-done').count() === 1, `reload: ${done.id} says it is finished`)
  // the keyboard: Tab to the box, type, Enter; Tab to a chip, Enter
  let found = false
  for (let i = 0; i < 40 && !found; i++) { await page.keyboard.press('Tab'); found = await mb(() => document.activeElement?.getAttribute('data-key') === 'ex-valence') }
  ok(found, 'keyboard: Tab reaches the valence box')
  await page.keyboard.type(String(done.total), { delay: 30 })
  await page.keyboard.press('Enter')
  await wait(400)
  ok(await partState('valence') === 'right', 'keyboard: Enter checks the total')
  const eg = ANSWERS[done.id][1]
  found = false
  for (let i = 0; i < 60 && !found; i++) { await page.keyboard.press('Tab'); found = await mb((k) => document.activeElement?.getAttribute('data-key') === k, `ex-eg-${slug(eg)}`) }
  ok(found, 'keyboard: Tab reaches the electron geometry picks')
  await page.keyboard.press('Enter')
  await wait(300)
  ok(await partState('eg') === 'right', 'keyboard: Enter on a pick answers it')
}

const noSideScroll = async (label) => ok((await mb(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, `${label}: no sideways scroll`)
async function room() {
  // the sheet scrolls inside the panel, and on a phone the board keeps its room
  const m = await mb(() => {
    const sc = document.querySelector('.ex-scroll')
    const c = document.querySelector('.mb-canvas-wrap').getBoundingClientRect()
    return { scrolls: sc.scrollHeight > sc.clientHeight + 4, page: document.documentElement.scrollHeight - window.innerHeight, board: c.height, w: c.width, vh: window.innerHeight }
  })
  ok(m.scrolls, 'the long sheet scrolls inside the panel')
  ok(m.page <= 1, `the page itself does not scroll (${m.page} px)`)
  ok(m.board >= m.vh * (phone ? 0.3 : 0.6) && m.w > 300, `the board keeps its room: ${Math.round(m.board)} px of ${m.vh} high`)
  console.log(`  board ${Math.round(m.w)} x ${Math.round(m.board)} px at ${size}`)
}

try {
  const done = await work()
  await room()
  if (done) await reloadAndKeys(done)
} catch (e) {
  failed.push(`error: ${String(e).split('\n')[0]}`)
  console.log(`  ERROR ${String(e).split('\n').slice(0, 8).join('\n    ')}`)
  await shot('error')
}
ok(errors.length === 0, `no console errors (${errors.slice(0, 3).join(' | ')})`)
console.log(`\n${size}: ${passed} passed, ${failed.length} failed`)
if (failed.length) console.log(failed.map((f) => ` - ${f}`).join('\n'))
await browser.close()
process.exit(failed.length ? 1 : 0)
