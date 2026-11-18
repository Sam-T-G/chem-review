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
const center = (sh: Sheet) => lower(sh.p.center)
/** The other atom of a molecule of two atoms. */
const other = (sh: Sheet) => sh.bonds[0]!.b
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
  checkStructure: 'Check my structure',
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
  tableTitle: 'The finished row',
}
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
    netWait: 'The net dipole is the bond dipoles added up in the molecular geometry, so answer Molecular geometry and Bond polarity first.',
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
  const lines = [...groups.values()].map((g) =>
    g.n === 1 ? `1 ${lower(g.el)} atom has a ${bondWord(g.order)} to ${c} and ${pairs(g.lone / 2)}.` : `${g.n} ${lower(g.el)} atoms each have a ${bondWord(g.order)} to ${c} and ${pairs(g.lone / 2)}.`,
  )
  return `In the Lewis structure of ${sh.p.name}, ${c} has ${pairs(mid.lone / 2)}. ${lines.join(' ')}`
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
    if (have > need) {
      return {
        lead: known.has('valence') ? `The board has ${plural(have, 'electron')}, ${k} more than ${p.name} has.` : `The board has ${plural(have, 'electron')}, more than ${p.name} has.`,
        why: p.charge > 0 && have === neutral ? `The ${w} charge means the ion has fewer electrons than its atoms bring.` : `A Lewis structure has only the valence electrons of ${p.name}, so electrons can't be added to fill a shell.`,
        ask: known.has('valence') ? `Take ${plural(k, 'electron')} off: tap an atom, then “− electron”.` : 'Work out the total under Valence electrons, then take the extra electrons off: tap an atom, then “− electron”.',
      }
    }
    return {
      lead: known.has('valence') ? `The board has ${plural(have, 'electron')}, ${k} fewer than ${p.name} has.` : `The board has ${plural(have, 'electron')}, fewer than ${p.name} has.`,
      why: p.charge < 0 && have === neutral ? `The ${w} charge means the ion has more electrons than its atoms bring.` : `Every valence electron of ${p.name} has to be in the drawing.`,
      ask: known.has('valence') ? `Add ${plural(k, 'electron')}: tap an atom, then “+ electron”.` : 'Work out the total under Valence electrons, then add the missing electrons: tap an atom, then “+ electron”.',
    }
  }
  if (first?.kind === 'over') {
    return { lead: `${atomsWord(s, first.ids)} more electrons than the outer shell holds here.`, why: 'Each atom ends with a full outer shell, and no more than that.', ask: 'Swipe across a bond to take one line off, or tap the atom and use “− electron”.' }
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
  if (ids.length === 1) return same === 1 ? `${cap(lower(el))} has` : `1 ${lower(el)} atom has`
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

function countAsk(sh: Sheet, known: Known): string {
  const c = center(sh)
  const { bonded, lonePairs } = sh.info
  return known.has('structure') ? `${cap(c)} has ${plural(bonded, 'bonded atom')} and ${pairs(lonePairs)}.` : `Build the Lewis structure on the board, then count the bonded atoms and the lone pairs on ${c}.`
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
    const why = sh.diatomic ? `${cap(p.name)} has 2 atoms and no middle atom, and 2 atoms always sit on a straight line.` : known.has('structure') ? `${cap(c)} has ${plural(info.groups, 'electron group')}: ${plural(info.bonded, 'bonded atom')} and ${pairs(info.lonePairs)}.` : `${cap(c)} has ${plural(info.groups, 'electron group')}.`
    return { lead: `The electron geometry of ${p.name} is ${info.geometry}.`, why, ask: '' }
  }
  if (sh.diatomic) return { lead: `${cap(pick)} is the electron geometry for ${n} electron groups around a middle atom.`, why: `${cap(p.name)} has 2 atoms and no middle atom.`, ask: 'Pick the arrangement 2 atoms make.' }
  let coach: Coach
  if (info.lonePairs > 0 && n === info.bonded) {
    coach = { lead: `${cap(pick)} is the electron geometry for ${n} electron groups, the number of atoms bonded to ${c}.`, why: `Each lone pair on ${c} is an electron group too.`, ask: `Count the lone pairs on ${c} as well.` }
  } else if (known.has('structure') && pairSum(sh) !== info.bonded && n === pairSum(sh) + info.lonePairs) {
    coach = { lead: `${cap(pick)} counts each shared pair of a double or triple bond as its own group.`, why: 'A double or triple bond points one way, so the whole bond is 1 electron group.', ask: 'Count each bond once.' }
  } else {
    coach = { lead: `${cap(pick)} is the electron geometry for ${n} electron groups.`, why: `${cap(c)} in ${p.name} has a different number.`, ask: `Count the atoms bonded to ${c} and the lone pairs on ${c}: each one is 1 electron group.` }
  }
  return tries === 2 ? { ...coach, ask: countAsk(sh, known) } : coach
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
    const why = sh.diatomic ? `${cap(p.name)} has 2 atoms and no middle atom, and 2 atoms always sit on a straight line.` : known.has('structure') ? `${cap(c)} has ${plural(info.bonded, 'bonded atom')} and ${pairs(info.lonePairs)}.` : ''
    return { lead: `The molecular geometry of ${p.name} is ${info.shape}.`, why, ask: '' }
  }
  const cases = shapeCases(pick)
  if (sh.diatomic) return { lead: `A ${pick} molecule has ${cases[0]!.bonded + 1} atoms.`, why: `${cap(p.name)} has 2 atoms and no middle atom.`, ask: 'Pick the molecular geometry 2 atoms make.' }
  let coach: Coach
  if (info.lonePairs > 0 && pick === info.geometry && known.has('eg')) {
    coach = { lead: `${cap(pick)} is the electron geometry of ${p.name}: where all ${info.groups} electron groups point, lone pairs included.`, why: 'The molecular geometry is named for where the atoms are, and a lone pair is not an atom.', ask: 'Name the arrangement of the atoms only.' }
  } else if (info.lonePairs > 0 && pick === classify(info.bonded, 0)?.shape && known.has('structure')) {
    coach = { lead: `${cap(pick)} would be the molecular geometry if ${c} had no lone pairs.`, why: `${cap(c)} has ${pairs(info.lonePairs)}, and each lone pair takes up room around ${c} too.`, ask: 'Pick again with the lone pairs in their places.' }
  } else if (info.shape === 'tetrahedral' && pick === 'square planar') {
    coach = { lead: 'Square planar is how 4 bonds look in a flat drawing, 90° apart.', why: 'In 3D, 4 electron groups around 1 atom spread further apart than 90°.', ask: 'Pick the molecular geometry the atoms make in 3D.' }
  } else {
    const lp = cases.length === 1 ? pairs(cases[0]!.lonePairs) : `${cases.map((k) => k.lonePairs).join(' or ')} lone pairs`
    const why = cases[0]!.bonded !== info.bonded ? `${cap(c)} has ${plural(info.bonded, 'bonded atom')}.` : `With ${plural(info.bonded, 'bonded atom')}, the number of lone pairs on ${c} decides the molecular geometry.`
    coach = { lead: `${cap(pick)} is the molecular geometry for ${plural(cases[0]!.bonded, 'bonded atom')} and ${lp} around the middle atom.`, why, ask: `Count the bonded atoms and the lone pairs on ${c}, then pick again.` }
  }
  return tries === 2 ? { ...coach, ask: countAsk(sh, known) } : coach
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
    return { lead: `The bond ${isAre(sh.angle)} ${p.name} ${sh.angle.includes(' and ') ? 'are' : 'is'} ${sh.angle}.`, why: squeezed ? `A lone pair pushes harder than a bond, so the bonds on ${c} end up closer together.` : '', ask: '' }
  }
  if (sh.diatomic) return { lead: `${cap(pick)} is an angle between 2 bonds.`, why: `${cap(p.name)} has 2 atoms, 1 bond and no middle atom, and a bond angle needs 2 bonds that meet at a middle atom.`, ask: 'Pick again.' }
  if (pick === NO_ANGLE) return { lead: 'Only a molecule of 2 atoms has no bond angle.', why: `${cap(p.name)} has ${plural(info.bonded + 1, 'atom')}, so its bonds meet at ${c}.`, ask: `Pick the angle between 2 bonds on ${c}.` }
  let coach: Coach
  if (squeezed && pick === classify(info.groups, 0)?.angle && known.has('eg') && known.has('mg')) {
    coach = { lead: `${cap(pick)} is the bond angle when all ${info.groups} electron groups are bonded atoms.`, why: `A lone pair pushes harder than a bond, so the bonds on ${c} end up closer together.`, ask: 'Pick again.' }
  } else if (!squeezed && pick.startsWith('less') && (known.has('structure') || known.has('mg'))) {
    coach = {
      lead: `${cap(pick)} is a bond angle squeezed by lone pairs.`,
      why: info.lonePairs === 0 ? `${cap(c)} has no lone pairs, so nothing squeezes its bonds.` : `The ${plural(info.lonePairs, 'lone pair')} on ${c} sit where their pushes balance, so the bonds are not squeezed.`,
      ask: 'Pick again.',
    }
  } else if (info.groups === 4 && pick === '90°' && known.has('eg')) {
    coach = { lead: `90° is how ${info.bonded} bonds look in a flat drawing.`, why: 'In 3D, 4 electron groups spread further apart than 90°.', ask: 'Pick again.' }
  } else {
    const cases = ALL_CASES.filter((k) => k.angle === pick)
    coach = {
      lead: `${cap(pick)} is the bond angle for ${list(cases.map((k) => `${plural(k.bonded, 'bonded atom')} and ${pairs(k.lonePairs)}`), 'or')}.`,
      why: `The bond angle comes from the electron geometry and the molecular geometry of ${p.name}.`,
      ask: known.has('eg') && known.has('mg') ? `${cap(p.name)} has a ${info.geometry} electron geometry and a ${info.shape} molecular geometry.` : 'Work out the electron geometry and the molecular geometry first.',
    }
  }
  return tries === 2 && known.has('structure') ? { ...coach, ask: countAsk(sh, known) } : coach
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
  const coach = { ...f.coach, lead: `${cap(sh.p.name)} has only 1 bond, so nothing cancels its dipole.` }
  return { right: false, text: coachText(coach), coach }
}

export function directionLabel(sh: Sheet, d: Direction): string {
  const el = d.el ? lower(d.el) : ''
  const atoms = d.count === 1 ? `the ${el} atom` : `the ${d.count} ${el} atoms`
  const lone = d.count === 1 ? 'the lone pair' : `the ${d.count} lone pairs`
  switch (d.kind) {
    case 'to':
      return `toward ${atoms}`
    case 'from':
      return `away from ${atoms}`
    case 'lone-to':
      return `toward ${lone}`
    case 'lone-from':
      return `away from ${lone}`
    case 'one':
      return `along 1 ${sh.m.center.el}–${d.el} bond`
    case 'pair':
      return `from ${lower(d.from!)} toward ${el}`
  }
}
/** The words on a direction's chip. */
export const directionChip = (sh: Sheet, d: Direction) => cap(directionLabel(sh, d))
const rightDirection = (sh: Sheet) => sh.directions!.choices.find((c) => c.id === sh.directions!.right)!
export function directionRight(sh: Sheet): string {
  return `The net dipole points ${directionLabel(sh, rightDirection(sh))}.`
}
export function directionCoach(sh: Sheet, pickId: string, tries: number): Coach {
  if (tries >= 3) return { lead: directionRight(sh), why: 'Each bond dipole points at its δ− atom, and the net dipole is the bond dipoles added together.', ask: '' }
  const pick = sh.directions!.choices.find((c) => c.id === pickId)!
  const right = rightDirection(sh)
  const label = directionLabel(sh, pick)
  const polarKinds = sh.bonds.filter((k) => k.polar)
  const k = polarKinds[0]!
  const deltaMinus = k.byCharge ? '' : k.pol.negative ? `In each ${bondName(k)} bond, ${lower(k.pol.negative)} is δ−.` : ''
  const ask = tries === 2 && deltaMinus && polarKinds.length === 1 ? `${deltaMinus} Pick again.` : 'Pick again.'
  const dot = pick.dir[0] * right.dir[0] + pick.dir[1] * right.dir[1] + pick.dir[2] * right.dir[2]
  if (dot < -0.9) return { lead: `${cap(label)} is the opposite way.`, why: 'Each bond dipole points at its δ− atom, and the net dipole points the way the bond dipoles add up.', ask }
  if (pick.kind === 'one') {
    const n = sh.bonds.find((b) => b.b === pick.el)!.count
    return { lead: `${cap(label)} follows only 1 of the ${n} ${bondName({ a: sh.m.center.el, b: pick.el! })} bonds.`, why: `The net dipole is all the bond dipoles added together, so the other ${n - 1 === 1 ? 'dipole moves' : 'dipoles move'} the sum off that bond.`, ask }
  }
  return { lead: `The net dipole of ${sh.p.name} does not point ${label}.`, why: 'The net dipole is the bond dipoles added together, and each one points at its δ− atom.', ask }
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
    { label: PART_TITLES.net, value: sh.directions ? `${net}, ${directionLabel(sh, rightDirection(sh))}` : net },
  ]
}
/** Under the finished row: whether the molecule comes back, and why. */
export function finishedNote(sh: Sheet, missed: PartId[], comeBack: number): string {
  if (!missed.length) return `Every part of ${sh.p.name} was right the first time.`
  const names = PART_ORDER_WORDS(missed)
  return `${cap(sh.p.name)} comes back after ${comeBack} more molecules, because ${list(names)} had a wrong answer.`
}
const PART_ORDER_WORDS = (missed: PartId[]) => PART_ORDER.filter((id) => missed.includes(id)).map((id) => PART_TITLES[id])
