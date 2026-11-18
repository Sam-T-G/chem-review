// Every sentence a student reads in the exercises, as pure functions of the sheet, the answer and
// how many tries it had (MD5). tests/exercise-words.test.ts scans every line.
//
// A wrong answer gets the three-part card (Coach in ../guide.ts): what the answer is, why it does
// not answer the question, and the question handed back. The answer itself comes on the third try
// (L3), except for the yes-or-no and polar-or-nonpolar picks, where the first pick is final.
//
// `known` is the set of parts already answered. A card for one part never states the answer of
// another part that is still open: a wrong idea that can only be named by giving that answer away
// waits until the other part is answered, and the card falls back to a plainer one.
import { assess } from '../../../chem/assess'
import type { El } from '../../../chem/elements'
import { chargeWord, neutralElectrons, speciesOf } from '../../../chem/problems'
import type { Structure } from '../../../chem/structure'
import { ALL_CASES, classify, shapeCases, type Geometry, type ShapeName } from '../../../chem/vsepr'
import { cap, coachText, lower, netFeedback, netQuestion, shapeReadout, totalCoach, type Coach } from '../guide'
import { NO_ANGLE, PART_ORDER, type BondKind, type Direction, type PartId, type Sheet } from './sheet'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const list = (parts: string[], and = 'and') => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`)
const pairs = (n: number) => (n === 0 ? 'no lone pairs' : plural(n, 'lone pair'))
/** "the lone pair", "the 2 lone pairs". */
const theLone = (n: number) => (n === 1 ? 'the lone pair' : `the ${n} lone pairs`)
/** The middle atom's name: "oxygen", or "the middle oxygen atom" when an outer atom is the same element (ozone, FE-9). */
const center = (sh: Sheet) => (!sh.diatomic && sameAsMiddle(sh) ? `the middle ${lower(sh.p.center)} atom` : lower(sh.p.center))
const sameAsMiddle = (sh: Sheet) => sh.bonds.some((k) => k.b === sh.p.center)
/** The other atom of a molecule of two atoms. */
const other = (sh: Sheet) => sh.bonds[0]!.b
/** "a" or "an" before a geometry name: "an octahedral", "a tetrahedral". */
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
/** "180° is the bond angle", "90° and 120° are the bond angles". */
const angleIs = (angle: string) => (angle.includes(' and ') ? `${cap(angle)} are the bond angles` : `${cap(angle)} is the bond angle`)
const bondWord = (order: number) => (order === 1 ? 'single bond' : order === 2 ? 'double bond' : 'triple bond')
export type Known = ReadonlySet<PartId>

// ---------------------------------------------------------------- labels

/** The sheet's column names, as the class worksheet prints them. */
export const PART_TITLES: Record<PartId, string> = {
  valence: 'Valence electrons',
  structure: 'Lewis structure',
  resonance: 'Resonance',
  eg: 'Electron geometry',
  mg: 'Molecular geometry',
  angle: 'Bond angle',
  bonds: 'Bond polarity',
  net: 'Net dipole',
}
export const EX_WORDS = {
  tab: 'Exercises',
  checkTotal: 'Check the total',
  checkStructure: 'Check the structure',
  checkDeltas: 'Check ΔEN',
  yes: 'Yes',
  no: 'No',
  polar: 'Polar',
  nonpolar: 'Nonpolar',
  next: 'Next molecule',
  seeShape: 'See the 3D shape',
  change: 'Change molecule',
  pickTitle: 'Choose a molecule',
  close: 'Close',
  finished: 'Finished',
  done: 'done',
  notYet: 'not yet',
  onBoard: 'Electrons on the board',
  inBonds: 'In bonds',
  unshared: 'Unshared',
  valenceBox: 'Valence electrons in total',
  deltaBox: (k: BondKind) => `ΔEN for the ${bondName(k)} bond`,
}
/** The heading over the table of every answer, once the sheet is finished. */
export const finishedTitle = (sh: Sheet) => `The answers for ${sh.p.name}`
export const bondName = (k: Pick<BondKind, 'a' | 'b'>) => `${k.a}–${k.b}`
export const geometryLabel = (g: Geometry | ShapeName) => cap(g)
export const angleLabel = (a: string) => (a === NO_ANGLE ? 'No bond angle' : cap(a))

// ---------------------------------------------------------------- the questions

export function prompts(sh: Sheet) {
  const n = sh.p.name
  return {
    valence: `How many valence electrons does ${n} have in total?`,
    structure: `Build the Lewis structure of ${n} on the board, then check it.`,
    resonance: `Does ${n} have resonance structures?`,
    eg: `What is the electron geometry of ${n}?`,
    mg: `What is the molecular geometry of ${n}?`,
    angle: `What is the bond angle in ${n}?`,
    bonds: 'For each kind of bond, type ΔEN from the electronegativity table, then say whether the bond is polar or nonpolar.',
    // the guide's line about the middle atom does not fit a molecule of two atoms
    net: sh.diatomic ? { ...netQuestion(sh.p), sub: 'A polar bond has a dipole that points at its δ− atom.' } : netQuestion(sh.p),
    netWait: 'The net dipole adds up the bond dipoles, and which way they point depends on the molecular geometry. Answer Molecular geometry and Bond polarity first.',
    resonanceWait: 'Check the Lewis structure first.',
    direction: `Which way does the net dipole of ${n} point?`,
    liftWait: 'Finish the Lewis structure on the board to see the 3D shape.',
  }
}

// ---------------------------------------------------------------- valence electrons

/** A wrong total: the guide's coach, which names the wrong idea and shows the atoms with what each brings. */
export function valenceCoach(sh: Sheet, answer: number, tries: number): Coach {
  return totalCoach(sh.p, answer, tries)
}
export function valenceRight(sh: Sheet): string {
  return `${cap(sh.p.name)} has ${plural(sh.total, 'valence electron')}.`
}

// ---------------------------------------------------------------- the Lewis structure

/** The finished structure in words, given on the third wrong check. */
export function structureAnswer(sh: Sheet): string {
  const s = sh.ref
  const mid = s.atoms[0]!
  const c = lower(mid.el)
  if (sh.diatomic) {
    const out = s.atoms[1]!
    const kind = bondWord(s.bonds[0]!.order)
    if (out.el === mid.el) return `In the Lewis structure of ${sh.p.name}, the 2 ${c} atoms share a ${kind}, and each one has ${pairs(mid.lone / 2)}.`
    return `In the Lewis structure of ${sh.p.name}, ${c} and ${lower(out.el)} share a ${kind}. ${cap(c)} has ${pairs(mid.lone / 2)}, and ${lower(out.el)} has ${pairs(out.lone / 2)}.`
  }
  const groups = new Map<string, { el: El; order: number; lone: number; n: number }>()
  for (const b of s.bonds) {
    const atom = s.atoms.find((a) => a.id === b.b)!
    const key = `${atom.el}:${b.order}:${atom.lone}`
    const g = groups.get(key) ?? { el: atom.el, order: b.order, lone: atom.lone, n: 0 }
    g.n++
    groups.set(key, g)
  }
  // ozone: the outer atoms are oxygen too, so they are called outer and the middle one middle
  const mid2 = center(sh)
  const outerName = (el: El) => `${el === mid.el ? 'outer ' : ''}${lower(el)}`
  const lines = [...groups.values()].map((g) =>
    g.n === 1 ? `1 ${outerName(g.el)} atom has a ${bondWord(g.order)} to ${mid2} and ${pairs(g.lone / 2)}.` : `${g.n} ${outerName(g.el)} atoms each have a ${bondWord(g.order)} to ${mid2} and ${pairs(g.lone / 2)}.`,
  )
  return `In the Lewis structure of ${sh.p.name}, ${mid2} has ${pairs(mid.lone / 2)}. ${lines.join(' ')}`
}

const SHORT_ASK = (sh: Sheet) =>
  sh.diatomic
    ? `To add a bond, drag ${lower(other(sh))} onto ${center(sh)} again. To move an electron, tap an atom and use “− electron”, then tap another and use “+ electron”.`
    : `To add a bond, drag an outer atom onto ${center(sh)} again. To move an electron, tap an atom and use “− electron”, then tap another and use “+ electron”.`

/** What to say about a checked board that is not the Lewis structure yet. `tries` counts the
 *  wrong checks, this one included; a board with atoms missing or loose is not a try. */
export function structureCoach(sh: Sheet, s: Structure, tries: number, known: Known): Coach {
  const p = sh.p
  const a = assess(s, speciesOf(p))
  const first = a.issues[0]
  if (first?.kind === 'missing') return { lead: `${plural(first.els.length, 'atom')} still to put on the board.`, why: '', ask: '' }
  if (first?.kind === 'loose') return { lead: `${plural(first.ids.length, 'atom is', 'atoms are')} not bonded to the rest.`, why: '', ask: 'Drag each loose atom onto the atom it bonds to.' }
  if (tries >= 3) return { lead: structureAnswer(sh), why: '', ask: 'Change the board to match.' }
  if (first?.kind === 'skeleton') {
    if (first.why === 'outer-bonded') return { lead: 'Two outer atoms are bonded to each other.', why: `In ${p.name} every outer atom bonds only to the middle atom.`, ask: 'Swipe across the bond between the outer atoms to cut it.' }
    const mid = a.topology.kind === 'star' ? s.atoms.find((x) => x.id === (a.topology as { center: string }).center) : undefined
    return {
      lead: mid ? `${cap(lower(mid.el))} is in the middle of the drawing.` : 'The atom in the middle of the drawing is not the middle atom.',
      why: 'The middle atom is the least electronegative atom, and hydrogen never goes in the middle.',
      ask: 'Build the drawing again with the least electronegative atom in the middle.',
    }
  }
  if (first?.kind === 'electrons') {
    const { have, need } = first
    const k = Math.abs(have - need)
    const w = chargeWord(p.charge)
    const neutral = neutralElectrons(p)
    // the second wrong check says where to watch the count: the tile over the board
    const tile = `“${EX_WORDS.onBoard}”`
    if (have > need) {
      return {
        lead: known.has('valence') ? `The board has ${plural(have, 'electron')}, ${k} more than ${p.name} has.` : `The board has ${plural(have, 'electron')}, more than ${p.name} has.`,
        why: p.charge > 0 && have === neutral ? `The ${w} charge means the ion has fewer electrons than its atoms bring.` : `A Lewis structure has only the valence electrons of ${p.name}, so electrons can't be added to fill a shell.`,
        ask: known.has('valence')
          ? tries >= 2
            ? `Take ${plural(k, 'electron')} off: tap an atom, then “− electron”, until ${tile} reads ${need}.`
            : `Take ${plural(k, 'electron')} off: tap an atom, then “− electron”.`
          : tries >= 2
            ? `Work out the total under Valence electrons, then take electrons off until ${tile} matches that total.`
            : 'Work out the total under Valence electrons, then take the extra electrons off: tap an atom, then “− electron”.',
      }
    }
    return {
      lead: known.has('valence') ? `The board has ${plural(have, 'electron')}, ${k} fewer than ${p.name} has.` : `The board has ${plural(have, 'electron')}, fewer than ${p.name} has.`,
      why: p.charge < 0 && have === neutral ? `The ${w} charge means the ion has more electrons than its atoms bring.` : `Every valence electron of ${p.name} has to be in the drawing.`,
      ask: known.has('valence')
        ? tries >= 2
          ? `Add ${plural(k, 'electron')}: tap an atom, then “+ electron”, until ${tile} reads ${need}.`
          : `Add ${plural(k, 'electron')}: tap an atom, then “+ electron”.`
        : tries >= 2
          ? `Work out the total under Valence electrons, then add electrons until ${tile} matches that total.`
          : 'Work out the total under Valence electrons, then add the missing electrons: tap an atom, then “+ electron”.',
    }
  }
  if (first?.kind === 'over') {
    // assess() lets only a period 3 or later atom bonded to 2 or more atoms go past 8 (iodine holds 12 in ICl5 and 8 in IF)
    const hydrogen = first.ids.some((id) => s.atoms.find((a) => a.id === id)?.el === 'H')
    const why = hydrogen ? 'A hydrogen atom holds 2 electrons at most.' : 'Only a middle atom from period 3 onward, with 2 or more atoms bonded to it, can hold more than 8 electrons.'
    return { lead: `${atomsWord(s, first.ids)} more electrons than the outer shell holds here.`, why, ask: 'Swipe across a bond to take one line off, or tap the atom and use “− electron”.' }
  }
  if (first?.kind === 'short') {
    return { lead: `${atomsWord(s, first.ids)} fewer electrons than a full outer shell.`, why: 'Each atom ends with a full outer shell. An atom that is short can share 1 more pair in a bond.', ask: SHORT_ASK(sh) }
  }
  if (first?.kind === 'unpaired') {
    return { lead: `${atomsWord(s, first.ids)} an electron with no partner.`, why: 'In a finished Lewis structure the electrons sit in pairs.', ask: 'Tap that atom, use “− electron”, and add the electron to another atom with “+ electron”.' }
  }
  if (first?.kind === 'charges') {
    return {
      lead: `More than one drawing of ${p.name} fills every shell.`,
      why: 'The drawing with formal charges closest to 0 is the one that is used.',
      ask: tries >= 2 ? 'Read the formal charge beside each atom, then move a pair between a lone pair and a bond to bring the charges closer to 0.' : 'Read the formal charge beside each atom.',
    }
  }
  return { lead: `The drawing is not the Lewis structure of ${p.name} yet.`, why: '', ask: 'Look at the strip of checks above the board.' }
}
/** "Fluorine has", "2 chlorine atoms have": the atoms a shell check is about. */
function atomsWord(s: Structure, ids: string[]): string {
  const els = [...new Set(ids.map((id) => s.atoms.find((a) => a.id === id)!.el))]
  if (els.length > 1) return `${cap(list(els.map((el) => lower(el))))} have`
  const el = els[0]!
  const same = s.atoms.filter((a) => a.el === el).length
  if (ids.length === 1 && same > 1 && s.atoms.length > 2) {
    // ozone: say which oxygen atom, the middle one (bonded to 2 or more) or an outer one
    const degree = s.bonds.filter((b) => b.a === ids[0] || b.b === ids[0]).length
    return degree >= 2 ? `The middle ${lower(el)} atom has` : `1 outer ${lower(el)} atom has`
  }
  if (ids.length === 1) return same === 1 ? `${cap(lower(el))} has` : `1 ${lower(el)} atom has`
  // ozone: when the middle atom is this element too, say which ones (FX-8)
  const degree = (id: string) => s.bonds.filter((b) => b.a === id || b.b === id).length
  const middleHere = s.atoms.length > 2 && s.atoms.some((a) => a.el === el && degree(a.id) >= 2)
  if (middleHere) {
    const mid = ids.filter((id) => degree(id) >= 2).length
    const outer = ids.length - mid
    const outerWords = `${outer} outer ${lower(el)} ${outer === 1 ? 'atom' : 'atoms'}`
    return mid ? `The middle ${lower(el)} atom and ${outerWords} have` : `${outerWords} have`
  }
  return `${ids.length} ${lower(el)} atoms have`
}
export function structureRightText(sh: Sheet): string {
  return `This is the Lewis structure of ${sh.p.name}.`
}

// ---------------------------------------------------------------- resonance

// The cards say only what the engine decides: more than one drawing is equally good, or only one
// drawing is the best. Where the bonds move is not claimed.
const RESONANCE_IS = 'Resonance structures are equally good drawings of the same atoms in the same places, with only the electrons moved.'
export function resonanceText(sh: Sheet, yes: boolean): { right: boolean; text: string; coach: Coach | null } {
  const n = sh.p.name
  if (yes === sh.resonance) {
    const text = yes ? `Yes. ${cap(n)} has more than one equally good Lewis structure.` : `No. Only 1 drawing of ${n} is the best Lewis structure.`
    return { right: true, text, coach: null }
  }
  const coach: Coach = yes
    ? { lead: `Only 1 drawing of ${n} is the best Lewis structure.`, why: RESONANCE_IS, ask: `So ${n} has no resonance.` }
    : { lead: `${cap(n)} has more than one equally good Lewis structure.`, why: RESONANCE_IS, ask: `So ${n} has resonance.` }
  return { right: false, text: coachText(coach), coach }
}

// ---------------------------------------------------------------- electron geometry

const GROUPS: Record<Geometry, number> = { linear: 2, 'trigonal planar': 3, tetrahedral: 4, 'trigonal bipyramidal': 5, octahedral: 6 }
/** Shared pairs in the finished structure's bonds, a double bond counted twice. */
const pairSum = (sh: Sheet) => sh.ref.bonds.reduce((n, b) => n + b.order, 0)

/** The second try's ask: the counts on the middle atom once the structure is answered, then what to do with them. */
function countAsk(sh: Sheet, known: Known, part: 'eg' | 'mg' | 'angle'): string {
  const c = center(sh)
  const { bonded, lonePairs } = sh.info
  if (!known.has('structure')) return `Build the Lewis structure on the board, then count the bonded atoms and the lone pairs on ${c}.`
  const counts = `${plural(bonded, 'bonded atom')} and ${pairs(lonePairs)}`
  // the molecular geometry and angle cards often say the bonded atoms already, so their ask names the counts once
  if (part === 'eg') return `${cap(c)} has ${counts}. Add the bonded atoms and the lone pairs together, and pick the electron geometry for that many electron groups.`
  return `Pick the ${part === 'mg' ? 'molecular geometry' : 'bond angle'} for ${counts} on ${c}.`
}

/** Where the lone pairs go, for the bond angle ask (the electron geometry is answered there). With 5 groups they
 *  take the places of the flat triangle around the middle; 2 lone pairs on 6 groups sit on opposite sides
 *  (OpenStax 7.6). For 3, 4 or 6 groups with 1 lone pair any place gives the same molecular geometry. */
function putLone(sh: Sheet): string {
  const { lonePairs: lp, groups, geometry } = sh.info
  const c = center(sh)
  if (groups === 5) return `Put ${theLone(lp)} in ${lp === 3 ? 'all 3' : `${lp} of the 3`} places of the flat triangle around ${c}`
  if (groups === 6 && lp === 2) return `Put the 2 lone pairs on opposite sides of ${c}`
  return `Put ${theLone(lp)} on ${c} in ${lp} of the ${groups} places of ${article(geometry)} ${geometry} electron geometry`
}
/** The molecular geometry ask once the structure is answered: how many places there are around the middle
 *  atom, without naming the electron geometry (that part may be open), then where the lone pairs go (FX-5). */
function placesAsk(sh: Sheet): string {
  const { lonePairs: lp, groups, bonded } = sh.info
  const c = center(sh)
  const then = `then name where the ${bonded} outer atoms sit.`
  if (groups === 5) return `${cap(c)} has 5 places for electron groups: 3 in a flat triangle around it, 1 above and 1 below. Put ${theLone(lp)} in the triangle, where ${lp === 1 ? 'it has' : 'they have'} the most room, ${then}`
  if (groups === 6 && lp === 2) return `${cap(c)} has 6 places for electron groups, at the 2 ends of 3 lines that cross at ${c}. Put the 2 lone pairs on opposite sides, as far apart as they can get, ${then}`
  return `Put ${theLone(lp)} in ${lp} of the ${groups} places around ${c}, ${then}`
}
/** Why lone pairs leave the angle as it is: on opposite sides of an octahedron (square planar), or filling the
 *  flat triangle of a trigonal bipyramid (linear). `angle` adds the angle, for the third try only (FX-6). */
function balanced(sh: Sheet, angle: boolean): string {
  const c = center(sh)
  const end = angle ? `stay ${sh.angle} apart` : 'are not squeezed'
  return sh.info.groups === 5 ? `The lone pairs on ${c} sit in the flat triangle around it and push both bonds equally, so the bonds ${end}.` : `The lone pairs on ${c} sit on opposite sides of it and push the bonds equally, so the bonds ${end}.`
}
/** The third-try reason for a net dipole when some dipoles cancel in pairs: a square pyramid, a T-shape, a seesaw (FX-4). */
function rowWhy(sh: Sheet): string | null {
  const polar = sh.bonds.filter((k) => k.polar)
  if (polar.length !== 1 || sh.diatomic) return null
  const name = bondName(polar[0]!)
  const { bonded, lonePairs } = sh.info
  if (bonded === 5 && lonePairs === 1) return `The 4 ${name} dipoles of the square cancel in pairs, so only the dipole of the ${name} bond across from the lone pair is left.`
  if (bonded === 3 && lonePairs === 2) return `The 2 ${name} dipoles across from each other cancel, so only the dipole of the ${name} bond in the flat triangle is left.`
  if (bonded === 4 && lonePairs === 1) return `The 2 ${name} dipoles across from each other cancel, and the other 2 add up, pointing away from the lone pair.`
  return null
}

export function geometryRight(sh: Sheet): string {
  if (sh.diatomic) return `${cap(sh.info.geometry)}: 2 atoms always sit on a straight line.`
  return `${cap(sh.info.geometry)}: ${plural(sh.info.groups, 'electron group')} around ${center(sh)}.`
}
export function geometryCoach(sh: Sheet, pick: Geometry, tries: number, known: Known): Coach {
  const { info, p } = sh
  const c = center(sh)
  const n = GROUPS[pick]
  if (tries >= 3) {
    // before the structure is answered the lone pairs are not counted out loud: the structure part asks for them
    const why = sh.diatomic
      ? `${cap(p.name)} has 2 atoms and no middle atom, and 2 atoms always sit on a straight line.`
      : known.has('structure')
        ? `${cap(c)} has ${plural(info.groups, 'electron group')}: ${plural(info.bonded, 'bonded atom')} and ${pairs(info.lonePairs)}.`
        : `${cap(c)} has ${plural(info.groups, 'electron group')}, counting each of its ${plural(info.bonded, 'bonded atom')} and each lone pair on ${c} as 1 group.`
    return { lead: `The electron geometry of ${p.name} is ${info.geometry}.`, why, ask: '' }
  }
  if (sh.diatomic) {
    const ask = tries === 2 ? `${cap(p.name)} has 1 bond between its 2 atoms. Picture where the 2 atoms sit, then pick the electron geometry for that.` : 'Pick the electron geometry that 2 atoms make.'
    return { lead: `${cap(pick)} is the electron geometry for ${n} electron groups around a middle atom.`, why: `${cap(p.name)} has 2 atoms and no middle atom.`, ask }
  }
  let coach: Coach
  if (info.lonePairs > 0 && n === info.bonded) {
    coach = { lead: `${cap(pick)} is the electron geometry for ${n} electron groups, the number of atoms bonded to ${c}.`, why: `Each lone pair on ${c} is an electron group too.`, ask: `Count the lone pairs on ${c} as well.` }
  } else if (known.has('structure') && pairSum(sh) !== info.bonded && n === pairSum(sh) + info.lonePairs) {
    coach = { lead: `${cap(pick)} counts each shared pair of a double or triple bond as its own group.`, why: 'A double or triple bond points one way, so the whole bond is 1 electron group.', ask: 'Count each bond once.' }
  } else {
    coach = {
      lead: `${cap(pick)} is the electron geometry for ${n} electron groups.`,
      why: `Each atom bonded to ${c} is 1 electron group, and each lone pair on ${c} is 1 more.`,
      ask: `Count the electron groups on ${c} in ${p.name}, then pick the electron geometry for that many.`,
    }
  }
  return tries === 2 ? { ...coach, ask: countAsk(sh, known, 'eg') } : coach
}

// ---------------------------------------------------------------- molecular geometry

export function shapeRight(sh: Sheet): string {
  if (sh.diatomic) return `${cap(sh.info.shape)}: 2 atoms always sit on a straight line.`
  return `${cap(sh.info.shape)}: ${plural(sh.info.bonded, 'atom')} and ${pairs(sh.info.lonePairs)} around ${center(sh)}.`
}
export function shapeCoach(sh: Sheet, pick: ShapeName, tries: number, known: Known): Coach {
  const { info, p } = sh
  const c = center(sh)
  if (tries >= 3) {
    const why = sh.diatomic
      ? `${cap(p.name)} has 2 atoms and no middle atom, and 2 atoms always sit on a straight line.`
      : known.has('structure')
        ? `${cap(c)} has ${plural(info.bonded, 'bonded atom')} and ${pairs(info.lonePairs)}.`
        : `${cap(c)} has ${plural(info.bonded, 'bonded atom')}, and the molecular geometry names where those atoms sit, with any lone pairs on ${c} left out.`
    return { lead: `The molecular geometry of ${p.name} is ${info.shape}.`, why, ask: '' }
  }
  const cases = shapeCases(pick)
  if (sh.diatomic) {
    const ask = tries === 2 ? `${cap(p.name)} has 1 bond between its 2 atoms. Picture where the 2 atoms sit, then pick the molecular geometry for that.` : 'Pick the molecular geometry that 2 atoms make.'
    return { lead: `${cap(article(pick))} ${pick} molecule has ${cases[0]!.bonded + 1} atoms.`, why: `${cap(p.name)} has 2 atoms and no middle atom.`, ask }
  }
  let coach: Coach
  if (info.lonePairs > 0 && pick === info.geometry && known.has('eg')) {
    coach = { lead: `${cap(pick)} is the electron geometry of ${p.name}: where all ${info.groups} electron groups point, lone pairs included.`, why: 'The molecular geometry is named for where the atoms are, and a lone pair is not an atom.', ask: `Pick the molecular geometry for the atoms around ${c} only.` }
  } else if (info.lonePairs > 0 && pick === classify(info.bonded, 0)?.shape && known.has('structure')) {
    coach = { lead: `${cap(pick)} would be the molecular geometry if ${c} had no lone pairs.`, why: `${cap(c)} has ${pairs(info.lonePairs)}, and each lone pair takes up room around ${c} too.`, ask: placesAsk(sh) }
  } else if (info.shape === 'tetrahedral' && pick === 'square planar') {
    coach = { lead: 'Square planar is how 4 bonds look in a flat drawing, 90° apart.', why: 'In 3D, 4 electron groups around 1 atom spread further apart than 90°.', ask: 'Pick the molecular geometry the atoms make in 3D.' }
  } else {
    const lp = list(cases.map((k) => pairs(k.lonePairs)), 'or')
    const why = cases[0]!.bonded !== info.bonded ? `${cap(c)} has ${plural(info.bonded, 'bonded atom')}.` : `The molecular geometries with ${plural(info.bonded, 'bonded atom')} differ in the number of lone pairs on the middle atom.`
    coach = { lead: `${cap(pick)} is the molecular geometry for ${plural(cases[0]!.bonded, 'bonded atom')} and ${lp} around the middle atom.`, why, ask: `Count the bonded atoms and the lone pairs on ${c}, then pick again.` }
  }
  return tries === 2 ? { ...coach, ask: countAsk(sh, known, 'mg') } : coach
}

// ---------------------------------------------------------------- bond angle

const isAre = (angle: string) => (angle.includes(' and ') ? 'angles in' : 'angle in')
export function angleRight(sh: Sheet): string {
  if (sh.diatomic) return `No bond angle: ${sh.p.name} has only 1 bond.`
  const squeezed = sh.angle.startsWith('less')
  return `${cap(sh.angle)}.${squeezed ? ` A lone pair pushes harder than a bond, so the bonds on ${center(sh)} end up closer together.` : ''}`
}
export function angleCoach(sh: Sheet, pick: string, tries: number, known: Known): Coach {
  const { info, p } = sh
  const c = center(sh)
  const squeezed = sh.angle.startsWith('less')
  if (tries >= 3) {
    if (sh.diatomic) return { lead: `${cap(p.name)} has no bond angle.`, why: `A bond angle is between 2 bonds that meet at a middle atom, and ${p.name} has 2 atoms, 1 bond and no middle atom.`, ask: '' }
    // how the angle is built, without counting the lone pairs out loud (the structure part may be open)
    const why = squeezed
      ? `A lone pair pushes harder than a bond, so the bonds on ${c} end up closer together.`
      : info.lonePairs > 0
        ? balanced(sh, true)
        : `The electron groups around ${c} push each other as far apart as they can get, which leaves the bonds ${sh.angle} apart.`
    return { lead: `The bond ${isAre(sh.angle)} ${p.name} ${sh.angle.includes(' and ') ? 'are' : 'is'} ${sh.angle}.`, why, ask: '' }
  }
  if (sh.diatomic) {
    // try 1 gives the rule, try 2 the count for this molecule
    // try 2 gives the count, never the answer (FX-11); a double or triple bond is still 1 bond (FX-10, N2 and O2)
    const why = tries === 2 ? `${cap(p.name)} has only 2 atoms, so 1 bond joins them. A double or triple bond still counts as 1 bond.` : 'A bond angle needs 2 bonds that meet at a middle atom.'
    return { lead: `${cap(pick)} is an angle between 2 bonds.`, why, ask: tries === 2 ? 'Pick again.' : `Count the bonds in ${p.name}, then pick again.` }
  }
  if (pick === NO_ANGLE) return { lead: 'Only a molecule of 2 atoms has no bond angle.', why: `${cap(p.name)} has ${plural(info.bonded + 1, 'atom')}, so its bonds meet at ${c}.`, ask: tries === 2 ? `Picture 2 of the bonds on ${c}, and pick the angle between them.` : `Pick the angle between 2 bonds on ${c}.` }
  let coach: Coach
  if (squeezed && pick === classify(info.groups, 0)?.angle && known.has('eg') && known.has('mg')) {
    coach = { lead: `${angleIs(pick)} when all ${info.groups} electron groups are bonded atoms.`, why: `A lone pair pushes harder than a bond, so the bonds on ${c} end up closer together.`, ask: 'Pick again.' }
  } else if (!squeezed && pick.startsWith('less') && (known.has('structure') || known.has('mg'))) {
    coach = {
      lead: `${cap(pick)} is a bond angle squeezed by lone pairs.`,
      why: info.lonePairs === 0 ? `${cap(c)} has no lone pairs, so nothing squeezes its bonds.` : balanced(sh, false),
      ask: 'Pick again.',
    }
  } else if (info.groups === 4 && pick === '90°' && known.has('eg')) {
    coach = { lead: `90° is how ${info.bonded} bonds look in a flat drawing.`, why: 'In 3D, 4 electron groups spread further apart than 90°.', ask: 'Pick again.' }
  } else {
    const cases = ALL_CASES.filter((k) => k.angle === pick)
    const eg = info.geometry
    // with both geometries answered, the ask hands back a smaller job: the places of the electron
    // geometry, the lone pairs in some of them, the bonds in the rest. No angle is named, because
    // with no lone pairs the electron geometry's angle is the answer
    const geos = known.has('eg') && known.has('mg')
    const ask = !geos
      ? 'Work out the electron geometry and the molecular geometry first.'
      : info.lonePairs === 0
        ? `Pick the bond angle of ${article(eg)} ${eg} electron geometry.`
        : `${putLone(sh)}. Find the ${info.bonded === 2 ? 'angle' : 'angles'} between the bonds in the places left, then decide whether ${info.lonePairs === 1 ? 'the lone pair squeezes' : 'the lone pairs squeeze'} them.`
    // no claim that lone pairs squeeze: some molecules have none, and some have lone pairs that balance (FE-6)
    const why = !geos
      ? 'The bond angle comes from the electron geometry, and from any lone pairs on the middle atom.'
      : info.lonePairs === 0
        ? `With no lone pairs on ${c}, the bond angle is the angle of the electron geometry.`
        : squeezed
          ? `The bond angle starts from the angle of the electron geometry, and ${theLone(info.lonePairs)} on ${c} can change it.`
          : `The bond angle starts from the angle of the electron geometry. Check whether the lone pairs on ${c} push some bonds harder than others.`
    coach = { lead: `${angleIs(pick)} for ${cases.map((k) => `${plural(k.bonded, 'bonded atom')} with ${pairs(k.lonePairs)}`).join(', or ')}.`, why, ask }
  }
  // try 2 always says something new: the counts once the structure is answered, or how to get them (FE-4)
  return tries === 2 ? { ...coach, ask: countAsk(sh, known, 'angle') } : coach
}

// ---------------------------------------------------------------- bond polarity

/** A ΔEN in tenths as it is printed: "0.9", "−0.9". */
export const tenthsText = (v: number) => (v < 0 ? `−${(-v / 10).toFixed(1)}` : (v / 10).toFixed(1))
const subtraction = (k: BondKind) => `ΔEN = ${k.pol.high} − ${k.pol.low} = ${k.pol.delta}`
export function deltaRight(k: BondKind): string {
  return `${subtraction(k)}.`
}
export function deltaCoach(k: BondKind, v: number, tries: number): Coach {
  const name = bondName(k)
  if (tries >= 3) return { lead: `For ${name}, ${subtraction(k)}.`, why: '', ask: '' }
  const hi = Number(k.pol.high) * 10
  const lo = Number(k.pol.low) * 10
  const a = lower(k.a)
  const b = lower(k.b)
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-6
  let coach: Coach
  if (near(v, hi + lo)) coach = { lead: `${tenthsText(v)} is the two electronegativities added.`, why: 'ΔEN is the difference between them.', ask: 'Subtract the smaller electronegativity from the larger.' }
  else if (k.pol.tenths > 0 && near(v, -k.pol.tenths)) coach = { lead: `${tenthsText(v)} is the smaller electronegativity minus the larger.`, why: 'ΔEN is the larger minus the smaller, so ΔEN is never below 0.', ask: 'Subtract the other way round.' }
  else if (near(v, hi) || near(v, lo)) {
    const el = near(v, hi) ? (k.pol.negative ?? k.a) : (k.pol.positive ?? k.a)
    const whose = lower(el)
    coach = { lead: `${tenthsText(v)} is the electronegativity of ${whose}.`, why: `ΔEN is the difference between the electronegativities of the 2 atoms in the bond.`, ask: 'Find both in the table and subtract.' }
  } else if (k.count > 1 && k.pol.tenths > 0 && near(v, k.pol.tenths * k.count)) {
    coach = { lead: `${tenthsText(v)} is ΔEN times the ${k.count} ${name} bonds.`, why: 'ΔEN is worked out for 1 bond.', ask: `Give ΔEN for 1 ${name} bond.` }
  } else coach = { lead: `ΔEN for ${name} is not ${tenthsText(v)}.`, why: 'ΔEN is the larger electronegativity minus the smaller one.', ask: k.a === k.b ? `Find ${a} in the table.` : `Find ${a} and ${b} in the table and subtract.` }
  if (tries === 2) {
    const ask = k.a === k.b ? `Both atoms are ${a}, with an electronegativity of ${k.pol.high}.` : `The electronegativity of ${k.pol.negative === k.a ? a : b} is ${k.pol.high} and of ${k.pol.negative === k.a ? b : a} is ${k.pol.low}. Subtract the smaller from the larger.`
    return { ...coach, ask }
  }
  return coach
}

/** Why a bond between two atoms of one element is polar: the formal charges, as in ozone. */
const byChargeWhy = (k: BondKind) => `The 2 atoms of the ${bondName(k)} bond pull equally, but their formal charges are not the same, so the shared electrons sit closer to the atom with the more negative formal charge.`
export function bondPickText(k: BondKind, polar: boolean): { right: boolean; text: string; coach: Coach | null } {
  const name = bondName(k)
  if (polar === k.polar) {
    if (k.byCharge) return { right: true, text: `Polar. ΔEN is ${k.pol.delta}. ${byChargeWhy(k)}`, coach: null }
    return { right: true, text: k.polar ? `Polar: ${subtraction(k)}, which is above 0.4.` : `Nonpolar: ${subtraction(k)}, which is 0.4 or less.`, coach: null }
  }
  let coach: Coach
  if (k.byCharge) coach = { lead: `ΔEN for ${name} is ${k.pol.delta}, and the ${name} bonds are still polar.`, why: byChargeWhy(k), ask: `So the ${name} bond is polar.` }
  else if (polar) coach = { lead: 'A bond is polar only when ΔEN is above 0.4.', why: `For ${name}, ${subtraction(k)}.`, ask: `So the ${name} bond is nonpolar.` }
  else coach = { lead: 'A bond is nonpolar only when ΔEN is 0.4 or less.', why: `For ${name}, ${subtraction(k)}, which is above 0.4.`, ask: `So the ${name} bond is polar.` }
  return { right: false, text: coachText(coach), coach }
}

// ---------------------------------------------------------------- net dipole

/** The verdict on polar or nonpolar, with the reason: the guide's words, which give the answer
 *  either way. For a molecule of two atoms the guide's line about bonds spread around the middle
 *  atom does not fit, so its lead is replaced. */
export function netText(sh: Sheet, polar: boolean): { right: boolean; text: string; coach: Coach | null } {
  const f = netFeedback(sh.p, sh.m, sh.info.diatomic ? null : sh.info, polar)
  if (f.right || !f.coach || !sh.diatomic || sh.m.why !== 'shape') return f
  const k = sh.bonds[0]!
  const coach = { ...f.coach, lead: `${cap(sh.p.name)} has only 1 bond, so nothing cancels its dipole.`, why: `ΔEN for ${bondName(k)} is ${k.pol.delta}, so the bond is polar.` }
  return { right: false, text: coachText(coach), coach }
}

/** The words for a direction. `full` adds where the arrow passes for "away from" (the class
 *  worksheet's "up through oxygen"): the sentence that gives the answer and the finished row use it,
 *  the chips do not. */
export function directionLabel(sh: Sheet, d: Direction, full = false): string {
  const el = d.el ? lower(d.el) : ''
  const mid = lower(sh.m.center.el)
  // ozone: the middle atom is oxygen too, so "the 2 oxygen atoms" could be any 2 of the 3
  const outer = d.el === sh.m.center.el ? 'outer ' : ''
  const atoms = d.count === 1 ? `the ${outer}${el} atom` : `the ${d.count} ${outer}${el} atoms`
  const lone = d.count === 1 ? 'the lone pair' : `the ${d.count} lone pairs`
  switch (d.kind) {
    case 'to':
      return `toward ${atoms}`
    case 'from':
      return full ? `away from ${atoms}, through the ${outer ? 'middle ' : ''}${mid} atom` : `away from ${atoms}`
    case 'lone-to':
      return `toward ${lone}`
    case 'lone-from':
      return `away from ${lone}`
    case 'one':
      return `along 1 ${sh.m.center.el}–${d.el} bond`
    case 'pair':
      return `from ${lower(d.from!)} toward ${el}`
    case 'axis':
      return d.where === 'square' ? `toward the ${el} atom across from the lone pair` : `toward the ${el} atom in the flat triangle with the 2 lone pairs`
    case 'side':
      return d.where === 'square' ? `toward 1 of the 4 ${el} atoms in the square` : `toward 1 of the 2 ${el} atoms across from each other`
  }
}
/** The words on a direction's chip. */
export const directionChip = (sh: Sheet, d: Direction) => cap(directionLabel(sh, d))
const rightDirection = (sh: Sheet) => sh.directions!.choices.find((c) => c.id === sh.directions!.right)!
export function directionRight(sh: Sheet): string {
  return `The net dipole points ${directionLabel(sh, rightDirection(sh), true)}.`
}
/** "the other C–Cl dipole", "the 2 C–Cl dipoles". */
const dipoles = (n: number, name: string, other = false) => (n === 1 ? `the ${other ? 'other ' : ''}${name} dipole` : `the ${other ? 'other ' : ''}${n} ${name} dipoles`)
export function directionCoach(sh: Sheet, pickId: string, tries: number): Coach {
  const polarKinds = sh.bonds.filter((k) => k.polar)
  const k = polarKinds[0]!
  // a molecule with 1 bond dipole (two atoms): its net dipole is that dipole
  const single = polarKinds.reduce((n, x) => n + x.count, 0) === 1
  const sumWhy = single
    ? `The ${bondName(k)} bond dipole points at its δ− atom, and it is the only bond dipole, so the net dipole points the same way.`
    : 'Each bond dipole points at its δ− atom, and the net dipole is the bond dipoles added together.'
  if (tries >= 3) return { lead: directionRight(sh), why: rowWhy(sh) ?? sumWhy, ask: '' }
  const pick = sh.directions!.choices.find((c) => c.id === pickId)!
  const right = rightDirection(sh)
  const label = directionLabel(sh, pick)
  // try 2 names the δ− end of every polar kind of bond, and the largest dipole when there are 2 kinds (FE-10)
  const ends = polarKinds.map((x) =>
    x.byCharge
      ? `in each ${bondName(x)} bond, the outer ${lower(x.b)} atom is δ−`
      : x.pol.negative
        ? `in ${x.count === 1 ? 'the' : 'each'} ${bondName(x)} bond, ${lower(x.pol.negative)} is δ−`
        : '',
  ).filter(Boolean)
  const largest = polarKinds.length > 1 && !polarKinds.some((x) => x.byCharge) ? [...polarKinds].sort((a, b) => b.pol.tenths - a.pol.tenths) : []
  const biggest = largest.length && largest[0]!.pol.tenths > largest[1]!.pol.tenths ? ` The ${bondName(largest[0]!)} dipole is the largest, with ΔEN ${largest[0]!.pol.delta}.` : ''
  const deltaMinus = ends.length ? `${cap(ends.join(', and '))}.${biggest}` : ''
  const ask = tries === 2 && deltaMinus ? `${deltaMinus} Pick again.` : 'Pick again.'
  const dot = pick.dir[0] * right.dir[0] + pick.dir[1] * right.dir[1] + pick.dir[2] * right.dir[2]
  if (dot < -0.9) return { lead: `${cap(label)} is the opposite way.`, why: sumWhy, ask }
  if (pick.kind === 'one') {
    // every other dipole that is really there: the rest of this kind, and every other polar kind (phosgene's C–O)
    const kind = sh.bonds.find((b) => b.b === pick.el)!
    const name = bondName(kind)
    const others = [...(kind.count > 1 ? [dipoles(kind.count - 1, name, true)] : []), ...polarKinds.filter((x) => x !== kind).map((x) => dipoles(x.count, bondName(x)))]
    const many = kind.count - 1 + polarKinds.filter((x) => x !== kind).reduce((n, x) => n + x.count, 0) > 1
    return {
      lead: `${cap(label)} follows only 1 of the ${kind.count} ${name} bonds.`,
      why: `The net dipole adds up every bond dipole, and ${list(others)} ${many ? 'point other ways' : 'points another way'}, so the total does not lie along that bond.`,
      ask,
    }
  }
  return { lead: `The net dipole of ${sh.p.name} does not point ${label}.`, why: sumWhy, ask }
}

// ---------------------------------------------------------------- the finished row

export function finishedRows(sh: Sheet): { label: string; value: string }[] {
  const r = shapeReadout(sh.p, sh.p.center, sh.info, sh.mixed)
  const ion = sh.p.charge !== 0
  const net = ion ? (sh.m.polar ? 'The bond dipoles do not cancel' : 'The bond dipoles cancel') : sh.m.polar ? 'Polar' : 'Nonpolar'
  return [
    { label: PART_TITLES.valence, value: String(sh.total) },
    { label: PART_TITLES.structure, value: sh.resonance ? 'On the board, with resonance' : 'On the board, no resonance' },
    { label: PART_TITLES.eg, value: cap(sh.info.geometry) },
    { label: PART_TITLES.mg, value: cap(sh.info.shape) },
    { label: PART_TITLES.angle, value: sh.diatomic ? 'No bond angle' : r.angle },
    { label: PART_TITLES.bonds, value: sh.bonds.map((k) => `${bondName(k)}: ΔEN ${k.pol.delta}, ${k.polar ? 'polar' : 'nonpolar'}`).join('; ') },
    { label: PART_TITLES.net, value: sh.directions ? `${net}, ${directionLabel(sh, rightDirection(sh), true)}` : net },
  ]
}
/** Under the finished row: whether the molecule comes back, and why. */
export function finishedNote(sh: Sheet, missed: PartId[], comeBack: number): string {
  if (!missed.length) return `Every part of ${sh.p.name} was right the first time.`
  const names = PART_ORDER_WORDS(missed)
  return `${cap(sh.p.name)} comes back after you finish ${comeBack} more molecules, because ${list(names)} had a wrong answer.`
}
const PART_ORDER_WORDS = (missed: PartId[]) => PART_ORDER.filter((id) => missed.includes(id)).map((id) => PART_TITLES[id])
