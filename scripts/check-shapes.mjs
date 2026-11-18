// Real-input check of the shapes quiz (/shapes) in headless Chromium. Every action is a real
// pointer, touch or key event sent through the browser. Before each press the check asks the page
// which element is at the point it will press (elementFromPoint) and fails if it is not the
// control. Nothing is clicked from script.
//
// Usage: node scripts/check-shapes.mjs [desktop|phone]
// Needs the built site served on port 5210 (pnpm web:serve), or MB_URL pointing at one.
// MB_SHOTS=1 saves screenshots to shots/ (shapes-<size>-<name>.png).
//
// It walks the series, flips the switch between the two geometries, answers a question right and
// one wrong, sees the missed row come back, answers until a row is known, reloads and sees it
// still known, uses the keyboard, and checks that nothing on screen gives the answer while a
// question is open: no key-term card links to a term the quiz blocks, and a counts question whose
// electron part was missed keeps that name off the screen until the molecular part is answered. The answers below are the shape table, written by hand from OpenStax
// Chemistry 2e, section 7.6.
import { chromium } from 'playwright'

const [size = 'desktop'] = process.argv.slice(2)
const base = (process.env.MB_URL ?? 'http://localhost:5210').replace(/\/$/, '')
const phone = size === 'phone'
const viewport = phone ? { width: 390, height: 844 } : { width: 1360, height: 840 }
const SHOTS = process.env.MB_SHOTS === '1'

// bonded,lonePairs: electron geometry, molecular geometry, bond angle
const TABLE = {
  '2,0': ['linear', 'linear', '180°'],
  '3,0': ['trigonal planar', 'trigonal planar', '120°'],
  '2,1': ['trigonal planar', 'bent', 'less than 120°'],
  '4,0': ['tetrahedral', 'tetrahedral', '109.5°'],
  '3,1': ['tetrahedral', 'trigonal pyramidal', 'less than 109.5°'],
  '2,2': ['tetrahedral', 'bent', 'less than 109.5°'],
  '5,0': ['trigonal bipyramidal', 'trigonal bipyramidal', '90° and 120°'],
  '4,1': ['trigonal bipyramidal', 'seesaw', 'less than 90° and less than 120°'],
  '3,2': ['trigonal bipyramidal', 'T-shaped', 'less than 90°'],
  '2,3': ['trigonal bipyramidal', 'linear', '180°'],
  '6,0': ['octahedral', 'octahedral', '90°'],
  '5,1': ['octahedral', 'square pyramidal', 'less than 90°'],
  '4,2': ['octahedral', 'square planar', '90°'],
}
const KEYS = Object.keys(TABLE)
const answerOf = (ask, row) => TABLE[row][ask === 'electron' ? 0 : ask === 'molecular' ? 1 : 2]
/** What on screen would give the answer: the name (a tetrahedron counts), or a number of degrees in the angle. */
function answerRe(ask, row) {
  const a = answerOf(ask, row)
  if (ask === 'angle') return new RegExp(`(?<![\\d.])(?:${a.match(/\d+(?:\.\d+)?°/g).map((n) => n.replace('.', '\\.')).join('|')})`)
  const stem = a.endsWith('al') ? `${a.slice(0, -2)}(?:al|on)?` : a
  return new RegExp(`(?<![\\p{L}-])${stem}(?!\\p{L})`, 'iu')
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

let passed = 0
const failed = []
const ok = (cond, label) => { if (cond) passed++; else { failed.push(label); console.log(`  FAIL ${label}`) } }
const wait = (ms) => page.waitForTimeout(ms)
const mb = (fn, arg) => page.evaluate(fn, arg)
const shot = async (name) => { if (SHOTS) { await wait(450); await page.screenshot({ path: `shots/shapes-${size}-${name}.png` }) } }

async function open() {
  await page.goto(`${base}/shapes`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__mb, null, { timeout: 15000 })
  // headless Chrome freezes animations in a page that is not in front
  await cdp.send('Page.bringToFront')
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await wait(900)
}
const sq = () => mb(() => { const s = window.__mb.store.getState(); return { mode: s.mode, solved: s.solved, ...s.shapes } })
const sceneInput = () => mb(() => { const i = window.__mb.scene.input; return { angles: i.angles.length, groupsView: i.groupsView ?? null, atoms: i.s.atoms.length, view: i.view } })
const panelText = () => mb(() => document.querySelector('.mb-panel')?.innerText ?? '')

/** A real press on the first element matching `sel`. The element is scrolled into view, and the
 *  press waits until the point at its center hits it (a piece that is still arriving takes no taps). */
async function press(sel, label) {
  const loc = page.locator(sel).first()
  await loc.waitFor({ state: 'attached', timeout: 5000 })
  await loc.scrollIntoViewIfNeeded()
  let at = null
  for (let i = 0; i < 30 && !at; i++) {
    const b = await loc.boundingBox()
    if (b) {
      const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      const hit = await loc.evaluate((el, p) => { const n = document.elementFromPoint(p.x, p.y); return !!n && (n === el || el.contains(n)) }, p)
      if (hit) at = p
    }
    if (!at) await wait(100)
  }
  ok(at !== null, `${label}: the point pressed is on ${sel}`)
  if (!at) return
  if (phone) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
  await wait(350)
}
/** A glow that can be seen covers the element. */
async function glows(sel, label) {
  let on = false
  for (let i = 0; i < 30 && !on; i++) {
    const r = await page.locator(sel).first().boundingBox().catch(() => null)
    const c = await mb(() => window.__mb.cue())
    on = !!r && c.halos.filter((h) => h.opacity > 0.5 && h.w > 8).some((h) => h.x <= r.x + 2 && h.y <= r.y + 2 && h.x + h.w >= r.x + r.width - 2 && h.y + h.h >= r.y + r.height - 2)
    if (!on) await wait(120)
  }
  ok(on, `${label}: ${sel} glows as the next thing to do`)
}
/** Every atom of the lifted model is in view on the board: not under the panel, the dock or the edge. */
async function modelInView(label) {
  await page.waitForFunction(() => window.__mb.scene.debugPoints().lift >= 0.99, null, { timeout: 8000 }).catch(() => {})
  await wait(300)
  const r = await mb(() => {
    const pts = window.__mb.scene.debugPoints()
    const wrap = document.querySelector('.mb-canvas-wrap').getBoundingClientRect()
    const bad = pts.atoms.filter((a) => {
      const n = document.elementFromPoint(a.x, a.y)
      return !n || n.closest('.mb-panel, .mb-dock, .mb-top') || a.x - a.r < wrap.left || a.x + a.r > wrap.right || a.y - a.r < wrap.top || a.y + a.r > wrap.bottom
    })
    const ys = pts.atoms.map((a) => [a.y - a.r, a.y + a.r]).flat()
    return { n: pts.atoms.length, bad: bad.map((a) => a.el), tall: Math.round(Math.max(...ys) - Math.min(...ys)), board: Math.round(wrap.height) }
  })
  ok(r.n > 0 && r.bad.length === 0, `${label}: every atom of the model is in view on the board (${r.n} atoms, hidden: ${r.bad.join(' ') || 'none'}, model ${r.tall} px tall on a ${r.board} px board)`)
}
/** Nothing on screen gives the answer to the open question: no angle marks, no readout, no
 *  switch, no answer in the panel's text outside the choices, and no key-term card that states it. */
async function nothingGivesItAway(label, cards = false) {
  const st = await sq()
  const q = st.q
  const res = q.asks.filter((a) => a.right === null).map((a) => answerRe(a.ask, q.row))
  const text = await mb(() => {
    const p = document.querySelector('.mb-panel').cloneNode(true)
    p.querySelectorAll('.mb-choices').forEach((n) => n.remove())
    return p.innerText
  })
  for (const re of res) ok(!re.test(text), `${label}: the panel's text outside the choices does not give the answer (${re})`)
  ok((await sceneInput()).angles === 0, `${label}: no angle marks on the model`)
  ok((await page.locator('.mb-panel .mb-readout').count()) === 0, `${label}: no readout`)
  ok((await page.locator('[data-act="sq-view"]').count()) === 0, `${label}: the switch between the geometries is not offered`)
  const how = await mb(() => document.querySelector('.mb-panel .mb-how')?.innerText ?? '')
  ok(/Tap a choice/.test(how) && /With a keyboard, press 1 to [56]\b/.test(how), `${label}: a how-to line says to tap a choice, or with a keyboard press its number`)
  if (!cards) return
  const blocked = await blockedNow()
  ok(blocked.length > 0, `${label}: the quiz blocks some key terms while the question is open (${blocked.join(' ')})`)
  const shown = await mb(() => [...document.querySelectorAll('.mb-panel .mb-term')].map((n) => n.dataset.term))
  ok(shown.every((id) => !blocked.includes(id)), `${label}: no blocked term is highlighted in the panel`)
  const n = shown.length
  for (let i = 0; i < n; i++) {
    await press(`.mb-panel .mb-term >> nth=${i}`, `${label}: key term ${i + 1}`)
    await page.waitForFunction(() => !!window.__mb.term(), null, { timeout: 3000 }).catch(() => {})
    const card = await mb(() => document.querySelector('.mb-termcard')?.innerText ?? '')
    for (const re of res) ok(card.length > 0 && !re.test(card), `${label}: the card for "${card.split('\n')[0]}" does not give the answer`)
    const links = await mb(() => [...document.querySelectorAll('.mb-termcard [data-term-go]')].map((x) => x.dataset.termGo))
    ok(links.every((id) => !blocked.includes(id)), `${label}: the card for "${card.split('\n')[0]}" links to no blocked term (${links.join(' ')})`)
    if (phone) await press('.mb-termcard [data-term-close]', `${label}: close the card`)
    else { await page.keyboard.press('Escape'); await wait(250) }
  }
  console.log(`  ${label}: ${n} key terms highlighted, each card opened`)
}
/** The key terms the quiz will not open right now. Each term is asked for through the page's debug
 *  handle (the same path a press takes, past the part's blockedTerms hook); a term that opens no
 *  card is blocked. This only reads what the page allows: every press in this check is real input. */
async function blockedNow() {
  const ids = await mb(() => {
    const out = []
    for (const id of window.__mb.terms) {
      window.__mb.showTerm(id)
      if (window.__mb.term()?.id !== id) out.push(id)
    }
    return out
  })
  await page.keyboard.press('Escape')
  await wait(250)
  return ids
}
/** The open part of the question and its right choice. */
async function openAsk() {
  const q = (await sq()).q
  const a = q.asks.find((x) => x.right === null)
  return { q, a, right: answerOf(a.ask, q.row), wrongs: a.choices.filter((c) => c !== answerOf(a.ask, q.row) && !a.picks.includes(c)) }
}
const chip = (value) => `.mb-panel [data-act="sq-pick"][data-pick="${value}"]`
/** Answers every open part right: with a press, or with the number key of the choice. */
async function answerRight(how = 'press') {
  for (let i = 0; i < 3 && (await sq()).q.right === null; i++) {
    const { a, right } = await openAsk()
    if (how === 'keys') {
      await page.keyboard.press(String(a.choices.indexOf(right) + 1))
      await wait(400)
    } else await press(chip(right), `answer ${right}`)
  }
}
async function next(label) {
  await glows('.mb-btn-main', label)
  await press('.mb-btn-main', `${label}: next question`)
  await wait(300)
}

async function run() {
  await open()
  let st = await sq()
  ok(st.mode === 'shapes' && st.phase === 'learn' && st.card === 0, `/shapes opens the series on its first card (${st.mode} ${st.phase} ${st.card})`)
  ok(/Linear/.test(await page.locator('.mb-panel .mb-title').first().innerText()), 'the first card is linear')
  await glows('.mb-btn-main', 'series')
  await modelInView('series, carbon dioxide')
  ok(await mb(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll')

  console.log('series: forward, the arrow keys, a jump from the list')
  await press('.mb-btn-main', 'series: next card')
  ok((await sq()).card === 1, 'the main button goes to the second card')
  await page.keyboard.press('ArrowRight'); await wait(400)
  ok((await sq()).card === 2, 'the right arrow key goes forward')
  await page.keyboard.press('ArrowLeft'); await wait(400)
  ok((await sq()).card === 1, 'the left arrow key goes back')
  await press('[data-key="sq-go-4"]', 'series: trigonal pyramidal in the list')
  st = await sq()
  ok(st.card === 4, `the list jumps to trigonal pyramidal (card ${st.card})`)
  const card = await panelText()
  ok(/Trigonal pyramidal/.test(card) && /Electron geometry\s*Tetrahedral/i.test(card) && /less than 109\.5°/.test(card) && /ammonia/.test(card), 'the card names both geometries, the angle and the example')
  ok((await sceneInput()).angles > 0, 'the series model has its angle marks')
  await modelInView('series, ammonia')
  await shot('series')

  console.log('series: the switch between the two geometries')
  ok((await sceneInput()).groupsView === 'all', 'the model starts on the electron geometry (groupsView all)')
  await press('[data-key="sq-view-atoms"]', 'switch: molecular geometry')
  ok((await sq()).view === 'atoms' && (await sceneInput()).groupsView === 'atoms', 'the switch hands the board groupsView atoms')
  ok((await page.locator('[data-key="sq-view-atoms"]').getAttribute('aria-selected')) === 'true', 'the switch shows molecular geometry as chosen')
  await shot('series-atoms')
  await press('[data-key="sq-view-all"]', 'switch: electron geometry')
  ok((await sceneInput()).groupsView === 'all', 'the switch hands the board groupsView all again')

  console.log('quiz: the first question')
  await press('[data-key="sq-phase-quiz"]', 'the quiz tab')
  st = await sq()
  ok(st.phase === 'quiz' && st.q && st.q.right === null, 'the quiz opens on a question')
  await glows('.mb-panel .sq-choices', 'question')
  await nothingGivesItAway('first question', true)
  await shot('question')

  // one right answer
  await answerRight()
  st = await sq()
  ok(st.q.right === true && st.q.firstTry, 'a right answer closes the question')
  ok((await page.locator('.mb-panel .mb-fb[data-tone="good"]').count()) > 0, 'a right answer gets a green line')
  ok((await page.locator('.mb-panel .mb-readout').count()) === 1, 'the names, counts and angle of the row are shown after the answer')
  ok((await sceneInput()).atoms > 0 && (await sceneInput()).angles > 0, 'the model with its angle marks is shown after the answer')
  await shot('right')
  await next('after a right answer')

  console.log('quiz: a wrong answer, twice')
  let q = (await sq()).q
  await nothingGivesItAway('second question')
  const missed = q.row
  for (let i = 0; i < 3 && (await sq()).q.right === null; i++) {
    const { a, wrongs, right } = await openAsk()
    await press(chip(wrongs[0]), `wrong pick ${wrongs[0]}`)
    let now = await sq()
    if (now.q.asks.find((x) => x.ask === a.ask).right === null) {
      // the card under the open choices (a counts question can also show the first part's card above)
      ok((await page.locator('.mb-panel .sq-choices + .mb-coach').count()) === 1, 'a first wrong pick gets a card under the choices')
      ok((await page.locator(`${chip(wrongs[0])}[data-state="wrong"]`).count()) === 1, 'the wrong choice is marked')
      await nothingGivesItAway('after a first wrong pick')
      await shot('wrong')
      const { wrongs: left } = await openAsk()
      await press(chip(left[0]), `second wrong pick ${left[0]}`)
      now = await sq()
      ok(now.q.asks.find((x) => x.ask === a.ask).right === false, 'two wrong picks close that part')
      const coachText = await mb(() => [...document.querySelectorAll('.mb-panel .mb-coach')].map((n) => n.innerText).join(' '))
      // a counts question keeps the electron part's answer back while its molecular part is open (COPY-2)
      if (now.q.right === null) ok(!answerRe(a.ask, now.q.row).test(coachText) && /You'll see the electron geometry/.test(coachText), `the card keeps ${right} back while the molecular part is open`)
      else ok(answerRe(a.ask, now.q.row).test(coachText), `the last card gives the answer, ${right}`)
    }
  }
  st = await sq()
  ok(st.q.right === false && !st.q.firstTry, 'the question ends as a miss')
  ok(await mb(() => document.querySelector('.sq-pips .sq-pip[data-state="missed"]') !== null), 'the missed row has a dot marked missed')
  await shot('missed')
  await next('after a miss')
  q = (await sq()).q
  ok(q.row !== missed, `the next question is on another row (${q.row})`)
  await answerRight()
  await next('one question later')
  q = (await sq()).q
  ok(q.row === missed, `the missed row comes back after one other question (${q.row}, missed ${missed})`)

  console.log('quiz: answer until a row is known, partly with the keyboard')
  let known = null
  let viaTab = false
  for (let i = 0; i < 40 && !known; i++) {
    st = await sq()
    if (st.q.right !== null) await next(`question ${st.q.n}`)
    const { right } = await openAsk()
    if (!viaTab) {
      // Tab to the right choice and press Enter
      let on = false
      for (let k = 0; k < 40 && !on; k++) { await page.keyboard.press('Tab'); on = await mb((v) => document.activeElement?.getAttribute('data-pick') === v, right) }
      ok(on, 'Tab reaches a choice')
      await page.keyboard.press('Enter'); await wait(400)
      viaTab = true
      await answerRight()
    } else await answerRight(i % 2 ? 'keys' : 'press')
    st = await sq()
    if (st.q.madeKnown) known = st.q.row
  }
  ok(known !== null, `a row becomes known (${known})`)
  st = await sq()
  ok(st.solved.includes(`shape:${known}`), 'the known row is saved as shape:<bonded>,<lone pairs>')
  ok((await page.locator('.mb-panel .sq-burst').count()) > 0, 'a row that becomes known gets its own line')
  ok(new RegExp(`\\b${st.known.length} of 13 known`).test(await panelText()), 'the panel says how many of the 13 are known')
  ok((await page.locator('.mb-panel .sq-known li').count()) === st.known.length, 'the panel lists the known rows by name')
  await shot('known')

  console.log('reload: the known row stays known')
  await open()
  st = await sq()
  ok(st.phase === 'learn' && st.solved.includes(`shape:${known}`), 'after a reload the saved list still has the row')
  ok((await page.locator(`[data-key="sq-go-${KEYS.indexOf(known)}"] .sq-tick`).count()) === 1, 'the series list ticks the known row')
  await press('[data-key="sq-phase-quiz"]', 'the quiz tab after a reload')
  ok(/\b1 of 13 known/.test(await page.locator('.mb-panel .mb-name').innerText()), 'the quiz counts the row as known after a reload')
  ok((await sq()).q.row !== known, 'the known row is not asked')
  await shot('reload')
  ok(await mb(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll in the quiz')

  console.log('quiz: a counts question with its electron part missed')
  let counts = false
  for (let i = 0; i < 40 && !counts; i++) {
    st = await sq()
    if (st.q.right !== null) await next(`question ${st.q.n}`)
    st = await sq()
    if (st.q.kind === 'counts') counts = true
    else await answerRight()
  }
  ok(counts, 'a counts question comes up')
  if (!counts) return
  const row = (await sq()).q.row
  for (let t = 0; t < 2; t++) {
    const { wrongs } = await openAsk()
    await press(chip(wrongs[0]), `counts question, wrong electron pick ${wrongs[0]}`)
  }
  st = await sq()
  ok(st.q.asks[0].right === false && st.q.asks[1].right === null, 'two wrong picks close the electron part and open the molecular part')
  const heldText = await mb(() => {
    const p = document.querySelector('.mb-panel').cloneNode(true)
    p.querySelectorAll('.mb-choices').forEach((n) => n.remove())
    return p.innerText
  })
  ok(!answerRe('electron', row).test(heldText), `row ${row}: the electron geometry's name is not on screen while the molecular part is open`)
  ok(!answerRe('molecular', row).test(heldText), `row ${row}: the molecular geometry's name is not on screen while it is asked`)
  ok(/You'll see the electron geometry after you answer the molecular geometry/.test(heldText), 'the missed card says when the electron geometry is shown')
  await nothingGivesItAway('counts question, molecular part', true)
  await shot('counts-held')
  await answerRight()
  ok(answerRe('electron', row).test(await mb(() => [...document.querySelectorAll('.mb-panel .mb-coach')].map((n) => n.innerText).join(' '))), `row ${row}: once the question is finished the card gives the electron geometry, ${answerOf('electron', row)}`)
}

try { await run() } catch (e) { failed.push(`run: ${String(e).split('\n')[0]}`); console.log(`  ERROR ${String(e).split('\n').slice(0, 8).join('\n    ')}`); await shot('error') }
ok(errors.length === 0, `no console errors (${errors.slice(0, 3).join(' | ')})`)
console.log(`\nshapes ${size}: ${passed} passed, ${failed.length} failed`)
if (failed.length) console.log(failed.map((f) => ` - ${f}`).join('\n'))
await browser.close()
process.exit(failed.length ? 1 : 0)
