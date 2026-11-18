// Which key terms stay plain in the exercises (L10). In a guided step a card picks its example
// away from the molecule on screen. Outside the guided steps the module opens a card with no
// molecule (ui.ts passes null), so its example can be the exercise's own molecule, or another one
// with the same answer. Here every card is read as the module would open it, and a term whose
// card states something an open part of the sheet asks for is left plain: its word is printed
// without a button. A card that links to such a card is left plain too.
// Pure: no DOM, and nothing from store.ts or ui.ts.
import { ELEMENTS, type El } from '../../../chem/elements'
import { bondPolarity } from '../../../chem/polarity'
import { ALL_TERMS, elementsOf, sampleShape, termCard, type Sample, type TermCard, type TermId } from '../guide'
import { NO_ANGLE, type PartId, type Sheet } from './sheet'

/** The card as the module opens it in the exercises: no molecule, no step. */
export const exerciseCard = (id: TermId): TermCard => termCard(id, null, null)

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
  }
  if (open.has('net') && shaped.some((x) => x.shape === sh.info.shape)) return 'shows a molecule of the same molecular geometry'
  if (open.has('resonance') && c.id === 'resonance' && samples.some((m) => m.formula.length === p.formula.length && shapeOfSample(m).shape === sh.info.shape)) return 'shows resonance in a molecule like this one'
  return null
}

/** The terms to leave plain on the screen of this sheet, with these parts still open. */
export function plainTerms(sh: Sheet, open: ReadonlySet<PartId>): TermId[] {
  const plain = new Set<TermId>(ALL_TERMS.filter((id) => giveAway(exerciseCard(id), sh, open) !== null))
  // a card is no safer than the cards it links to
  for (let grew = true; grew; ) {
    grew = false
    for (const id of ALL_TERMS) {
      if (plain.has(id)) continue
      if (exerciseCard(id).related.some((r) => plain.has(r.id))) {
        plain.add(id)
        grew = true
      }
    }
  }
  return [...plain]
}

/** Takes the button off every key term in `html` whose card is in `plain`, leaving its word. The
 *  module's `coach()` highlights the terms of a card by itself, so its HTML goes through this. */
export function unwrapTerms(html: string, plain: ReadonlySet<string>): string {
  return html.replace(/<button type="button" class="mb-term" data-term="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g, (whole, id: string, word: string) => (plain.has(id) ? word : whole))
}
