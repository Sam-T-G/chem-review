// Dev helper: open the app in headless Chromium, run a few real pointer actions, save screenshots.
// Usage: node scripts/shot.mjs <name> [width] [height] [scenario]
import { chromium } from 'playwright'

const [name = 'home', w = '1360', h = '840', scenario = ''] = process.argv.slice(2)
const url = process.env.MB_URL ?? 'http://localhost:5210/lewis'
const touch = Number(w) < 600
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

const snap = async (suffix) => { await page.waitForTimeout(250); await page.screenshot({ path: `shots/${name}${suffix ? '-' + suffix : ''}.png` }) }
const pts = () => page.evaluate(() => window.__mb.scene.debugPoints())
const state = () => page.evaluate(() => { const s = window.__mb.store.getState(); return { step: s.step, mode: s.mode, atoms: s.s.atoms, bonds: s.s.bonds, view: s.view, toast: s.toast?.text } })
const clickText = async (text) => { await page.getByRole('button', { name: text, exact: false }).first().click(); await page.waitForTimeout(150) }
const drag = async (from, to, steps = 12) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps }); await page.mouse.move(to.x, to.y, { steps }); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(450) }

async function countStep(values, total) {
  for (const [el, n] of Object.entries(values)) for (let i = 0; i < n; i++) await page.locator(`[data-key="inc-${el}"]`).click()
  await clickText('Check my counts')
  await page.locator('#mb-total').fill(String(total))
  await clickText('Check the total')
}
async function placeAll(centerEl, spots) {
  // drag each tray chip to a spot on the board (fractions of the canvas box)
  const box = await page.locator('.mb-canvas-wrap').boundingBox()
  for (const [el, fx, fy] of spots) {
    const chip = page.locator(`[data-tray="${el}"]`)
    const cb = await chip.boundingBox()
    await drag({ x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 }, { x: box.x + box.width * fx, y: box.y + box.height * fy })
  }
}
async function bondAllToCenter(centerEl) {
  for (let guard = 0; guard < 12; guard++) {
    const p = await pts(); const st = await state()
    const center = p.atoms.find((a) => a.el === centerEl)
    const bonded = new Set(st.bonds.flatMap((b) => [b.a, b.b]))
    const loose = p.atoms.find((a) => a.id !== center.id && !bonded.has(a.id))
    if (!loose) break
    await drag(loose, center)
  }
}

if (scenario === 'count') { await countStep({ C: 4, H: 1 }, 8); await snap('count-done') }
if (scenario.startsWith('ch4')) {
  await countStep({ C: 4, H: 1 }, 8)
  await clickText('Put the atoms on the board'); await snap('place-empty')
  await page.locator('[data-key="mid-C"]').click()
  await placeAll('C', [['C', 0.5, 0.5], ['H', 0.3, 0.3], ['H', 0.72, 0.32], ['H', 0.3, 0.72], ['H', 0.7, 0.7]])
  await snap('placed')
  await clickText('Bond the atoms')
  await bondAllToCenter('C'); await page.waitForTimeout(700); await snap('bonded')
  await clickText('Check each atom'); await snap('check')
  await clickText('Find the shape'); await snap('shape-q')
  await page.locator('[data-key="grp-4"]').click()
  await page.locator('[data-key="shp-tetrahedral"]').click()
  await page.waitForTimeout(2200); await snap('shape-3d')
}
console.log(JSON.stringify({ state: await state(), errors }, null, 1))
await snap('')
await browser.close()
