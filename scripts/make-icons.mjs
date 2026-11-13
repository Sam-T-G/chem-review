// Draws the app icons (a water molecule in the app's palette) and writes them to assets/images.
// Run with: node scripts/make-icons.mjs
import { chromium } from 'playwright'

const INK = '#3a3358'
// H–O–H at 104.5°, with oxygen's two lone pairs
function molecule({ mono = false } = {}) {
  const fill = (c) => (mono ? '#ffffff' : c)
  const stroke = mono ? 'none' : INK
  const O = { x: 512, y: 470, r: 190 }
  const H = [{ x: 196, y: 715 }, { x: 828, y: 715 }]
  const dots = [129, 111, 69, 51].map((deg) => ({ x: 512 + 250 * Math.cos((deg * Math.PI) / 180), y: 470 - 250 * Math.sin((deg * Math.PI) / 180) }))
  return `
    ${H.map((h) => `<line x1="${O.x}" y1="${O.y}" x2="${h.x}" y2="${h.y}" stroke="${fill('#7467c2')}" stroke-width="56" stroke-linecap="round"/>`).join('')}
    ${H.map((h) => `<circle cx="${h.x}" cy="${h.y}" r="115" fill="${fill('#fff6e6')}" stroke="${stroke}" stroke-width="18"/>`).join('')}
    <circle cx="${O.x}" cy="${O.y}" r="${O.r}" fill="${fill('#ff8fa3')}" stroke="${stroke}" stroke-width="18"/>
    ${dots.map((d) => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="40" fill="${fill('#ffd15c')}" stroke="${stroke}" stroke-width="16"/>`).join('')}`
}
const svg = (body, { bg = null, scale = 1 } = {}) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    ${bg ? `<defs><radialGradient id="g" cx="20%" cy="0%" r="120%"><stop offset="0" stop-color="#f7eaf5"/><stop offset="0.6" stop-color="#e9e7ff"/><stop offset="1" stop-color="#dfe4ff"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>` : ''}
    <g transform="translate(512 512) scale(${scale}) translate(-512 -540)">${body}</g>
  </svg>`

const FILES = [
  ['icon.png', svg(molecule(), { bg: true, scale: 0.86 }), 1024, false],
  ['favicon.png', svg(molecule(), { bg: true, scale: 0.86 }), 96, false],
  ['splash-icon.png', svg(molecule(), { scale: 0.9 }), 1024, true],
  // Android crops the foreground to the middle two thirds
  ['android-icon-foreground.png', svg(molecule(), { scale: 0.56 }), 1024, true],
  ['android-icon-background.png', svg('', { bg: true }), 1024, false],
  ['android-icon-monochrome.png', svg(molecule({ mono: true }), { scale: 0.56 }), 1024, true],
]

const browser = await chromium.launch()
for (const [name, markup, size, transparent] of FILES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`)
  await page.screenshot({ path: `assets/images/${name}`, omitBackground: transparent })
  await page.close()
  console.log(`wrote assets/images/${name} (${size}px)`)
}
await browser.close()
