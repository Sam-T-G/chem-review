// Which key terms stay plain in the exercises (L10). In a guided step a card picks its example
// away from the molecule on screen. Outside the guided steps the module opens a card with no
// molecule (ui.ts passes null), so its example can be the exercise's own molecule, or another one
// with the same answer. Here every card is read as the module would open it, and a term whose
// card states something an open part of the sheet asks for is left plain: its word is printed
// without a button. Each card is judged on its own text and samples: the module refuses to open a
// term the part blocks (`Part.blockedTerms`) and leaves links to it out of every card it opens.
// Pure: no DOM, and nothing from store.ts or ui.ts.
import { ELEMENTS, type El } from '../../../chem/elements'
import { bondPolarity } from '../../../chem/polarity'
import { ALL_TERMS, elementsOf, sampleShape, termCard, type Sample, type TermCard, type TermId } from '../guide'
import { NO_ANGLE, type PartId, type Sheet } from './sheet'

const cardCache = new Map<TermId, TermCard>()
/** The card as the module opens it in the exercises: no molecule, no step. The same every time, so it is kept. */
export function exerciseCard(id: TermId): TermCard {
  let c = cardCache.get(id)
  if (!c) {
    c = termCard(id, null, null)
    cardCache.set(id, c)
  }
  return c
}

const sameSpecies = (m: Sample, p: Sheet['p']) => m.charge === p.charge && JSON.stringify([...m.formula].sort()) === JSON.stringify([...p.formula].sort())
const cardText = (c: TermCard) => [c.name, c.also ?? '', c.means, c.example, c.note ?? '', c.pictureLabel].join(' ').toLowerCase()
const els = (m: Sample): El[] => m.formula.map(([el]) => el)
/** A sample's geometries; a molecule of two atoms is linear and has no bond angle. */
function shapeOfSample(m: Sample): { geometry: string; shape: string; angle: string } {
  if (m.formula.reduce((n, [, k]) => n + k, 0) === 2) return { geometry: 'linear', shape: 'linear', angle: NO_ANGLE }
  const info = sampleShape(m)
  return { geometry: info.geometry, shape: info.shape, angle: info.angle }
}

/** Why a card would give away part of the sheet, or null when it is safe with these parts open. */
export function giveAway(c: TermCard, sh: Sheet, open: ReadonlySet<PartId>): string | null {
  const p = sh.p
  const text = cardText(c)
  const samples = [...c.about.samples, ...(c.picture.kind === 'lewis' ? c.picture.samples : []), ...(c.picture.kind === 'model' ? [c.picture.sample] : [])]
  if (samples.some((m) => sameSpecies(m, p))) return 'draws the molecule on screen'
  if (text.includes(p.name.replace(/^the /, '').toLowerCase())) return 'names the molecule on screen'
  const mine = elementsOf(p)
  const columns = new Set(mine.map((el) => ELEMENTS[el].group))
  if (open.has('valence') || open.has('structure')) {
    // atoms of one column have the same number of valence electrons and make the same bonds
    const used = [...c.about.els, ...samples.flatMap(els)]
    if (used.some((el) => columns.has(ELEMENTS[el].group))) return 'works on an atom from a column of the molecule'
    for (const el of Object.keys(ELEMENTS) as El[]) if (columns.has(ELEMENTS[el].group) && text.includes(ELEMENTS[el].name.toLowerCase())) return `names ${el}`
  }
  const shaped = samples.map(shapeOfSample)
  if (open.has('eg') && (shaped.some((x) => x.geometry === sh.info.geometry) || text.includes(sh.info.geometry))) return 'shows the electron geometry'
  if (open.has('mg') && (shaped.some((x) => x.shape === sh.info.shape) || text.includes(sh.info.shape.toLowerCase()))) return 'shows the molecular geometry'
  if (open.has('angle') && (shaped.some((x) => x.angle === sh.angle) || (sh.angle !== NO_ANGLE && text.includes(sh.angle)))) return 'shows the bond angle'
  if (open.has('bonds')) {
    const deltas = sh.bonds.map((k) => k.pol.delta)
    if (c.picture.kind === 'pair') {
      const pic = c.picture
      if (mine.includes(pic.a) || mine.includes(pic.b)) return 'works a bond of the molecule'
      if (deltas.includes(bondPolarity(pic.a, pic.b).delta)) return 'gives a ΔEN of the molecule'
    }
    for (const el of mine) if (text.includes(ELEMENTS[el].name.toLowerCase())) return `names ${el}`
    if (deltas.some((d) => text.includes(`= ${d}`))) return 'gives a ΔEN of the molecule'
    // a bond of 2 atoms of one element (F–F, the O–O bonds of ozone): a card about such a bond states its ΔEN
    // and, for ozone, points the wrong way, since there the formal charges make the bond polar (FX-3)
    const raw = [c.means, c.example, c.note ?? ''].join(' ')
    if (deltas.includes('0.0') && /ΔEN is 0\b/.test(raw)) return 'gives a ΔEN of 0, which the molecule has'
    if (sh.bonds.some((k) => k.a === k.b) && (/same element/i.test(raw) || /\b([A-Z][a-z]?)–\1\b/.test(raw) || (c.picture.kind === 'pair' && c.picture.a === c.picture.b))) return 'states a bond of 2 atoms of one element'
  }
  if (open.has('net') && shaped.some((x) => x.shape === sh.info.shape)) return 'shows a molecule of the same molecular geometry'
  // a molecule of 2 atoms: its net dipole is its 1 bond dipole, so a card that draws or names a bond whose 2 atoms
  // come from the same columns (H–Cl on HBr) shows which way it points and whether it is polar
  if (open.has('net') && sh.diatomic) {
    const key = (a: El, b: El) => [ELEMENTS[a].group, ELEMENTS[b].group].sort().join('-')
    const k = sh.bonds[0]!
    const mine = key(k.a, k.b)
    const pairs: [El, El][] = c.picture.kind === 'pair' ? [[c.picture.a, c.picture.b]] : []
    for (const m of [c.means, c.example, c.note ?? ''].join(' ').matchAll(/\b([A-Z][a-z]?)–([A-Z][a-z]?)\b/g)) if (m[1]! in ELEMENTS && m[2]! in ELEMENTS) pairs.push([m[1] as El, m[2] as El])
    if (pairs.some(([a, b]) => key(a, b) === mine)) return 'shows a bond like the molecule, which is its net dipole'
    // "the arrows point at chlorine" on hydrogen chloride (FX-13)
    const neg = k.pol.negative ? ELEMENTS[k.pol.negative].name.toLowerCase() : null
    if (neg && new RegExp(`points? at ${neg}`).test(text)) return 'says which atom a dipole points at'
  }
  if (open.has('resonance') && c.id === 'resonance' && samples.some((m) => m.formula.length === p.formula.length && shapeOfSample(m).shape === sh.info.shape)) return 'shows resonance in a molecule like this one'
  return null
}

/** The terms to leave plain on the screen of this sheet, with these parts still open. The same set
 *  is the part's `blockedTerms`, so a link to one of them is taken out of any card that opens. */
export function plainTerms(sh: Sheet, open: ReadonlySet<PartId>): TermId[] {
  return ALL_TERMS.filter((id) => giveAway(exerciseCard(id), sh, open) !== null)
}

/** Takes the button off every key term in `html` whose card is in `plain`, leaving its word. The
 *  module's `coach()` highlights the terms of a card by itself, so its HTML goes through this. */
export function unwrapTerms(html: string, plain: ReadonlySet<string>): string {
  return html.replace(/<button type="button" class="mb-term" data-term="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g, (whole, id: string, word: string) => (plain.has(id) ? word : whole))
}
