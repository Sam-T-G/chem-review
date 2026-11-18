// The answers to one exercise's sheet, worked out by the engine. The worksheet's row for a
// molecule: valence electrons, the Lewis structure and its resonance, the electron geometry, the
// molecular geometry, the bond angle, each kind of bond's ΔEN and polarity, and the net dipole.
//
// Every answer comes from `referenceStructure(p)` and the engine in src/chem, never from
// `p.geometry` (RUN.md, shared contract). So the parts about geometry and polarity can be answered
// before the structure is on the board. Pure: no DOM, and nothing from store.ts or ui.ts.
import { hasResonance, isDiatomic, referenceStructure } from '../../../chem/exercises'
import type { El } from '../../../chem/elements'
import { bondPolarity, moleculePolarity, type BondPolarity, type MoleculePolarity } from '../../../chem/polarity'
import { atomsOf, speciesOf, totalElectrons, type Problem } from '../../../chem/problems'
import { idealDirs, type V3 } from '../../../chem/repulsion'
import { bestStructures, solveStar, type StarSolution } from '../../../chem/solve'
import type { Structure } from '../../../chem/structure'
import { ALL_CASES, classify, type Geometry, type ShapeInfo, type ShapeName } from '../../../chem/vsepr'
import { geometryChoices, mixedOuter, shapeChoices, shapeInfoFor } from '../guide'

/** The parts of the sheet, in the worksheet's order. */
export const PART_ORDER = ['valence', 'structure', 'resonance', 'eg', 'mg', 'angle', 'bonds', 'net'] as const
export type PartId = (typeof PART_ORDER)[number]

/** The answer for "no bond angle", for a molecule of two atoms. */
export const NO_ANGLE = 'none'
/** Every bond angle the shape table prints, in table order, then "no bond angle". */
export const ANGLES: string[] = [...new Set(ALL_CASES.map((c) => c.angle)), NO_ANGLE]

/** One kind of bond in the molecule: the middle atom (for two atoms, the first one) and an outer atom. */
export interface BondKind {
  a: El
  b: El
  pol: BondPolarity
  /** How many bonds of this kind the molecule has. */
  count: number
  /** True when the bond has a dipole: ΔEN above 0.4, or formal charges that differ between two atoms of one element (ozone). */
  polar: boolean
  /** True when only the formal charges make the bond polar. */
  byCharge: boolean
}

/** A way the net dipole could point, as a pick. `dir` is in the textbook arrangement. The words
 *  on the chip come from `directionLabel` in words.ts. */
export interface Direction {
  id: string
  /** toward or away from the atoms of one element, toward or away from the lone pairs, along one
   *  bond of a kind that has several, or for two atoms, toward the outer atom or toward the first. */
  kind: 'to' | 'from' | 'lone-to' | 'lone-from' | 'one' | 'pair'
  el: El | null
  /** For two atoms: the atom the arrow starts at (`el` is the one it points at). */
  from?: El
  /** How many atoms of `el`, or how many lone pairs. */
  count: number
  dir: V3
}

export interface Sheet {
  p: Problem
  /** The finished structure the engine draws. */
  ref: Structure
  diatomic: boolean
  total: number
  resonance: boolean
  /** The engine's equally good drawings (more than one means resonance structures). */
  forms: StarSolution[]
  info: ShapeInfo
  /** True when the outer atoms are not all one element. */
  mixed: boolean
  geometryChoices: Geometry[]
  shapeChoices: ShapeName[]
  /** The bond angle text from the shape table, or NO_ANGLE for two atoms. */
  angle: string
  angleChoices: string[]
  bonds: BondKind[]
  m: MoleculePolarity
  /** Null when the dipoles cancel or there are none. */
  directions: { choices: Direction[]; right: string } | null
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => {
  const n = len(a)
  return [a[0] / n, a[1] / n, a[2] / n]
}
const sum = (list: V3[]): V3 => list.reduce<V3>((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0])
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]]

/** The right pick is within this angle of the net dipole, and every other pick at least DISTRACTOR away. */
const WITHIN_DEG = 35
const DISTRACTOR_DEG = 45

/** The ways the net dipole could point, and which one it does. Null when the molecule's dipoles
 *  cancel, when the answer depends on which corners unlike atoms take, or when no plain phrase
 *  fits the net dipole closely enough. */
export function directionsOf(m: MoleculePolarity, diatomic: boolean): Sheet['directions'] {
  if (!m.polar || !m.net || m.depends) return null
  if (diatomic) {
    const b = m.bonds[0]!
    const toOuter: Direction = { id: 'to-outer', kind: 'pair', el: b.el, from: m.center.el, count: 1, dir: [1, 0, 0] }
    const toCenter: Direction = { id: 'to-center', kind: 'pair', el: m.center.el, from: b.el, count: 1, dir: [-1, 0, 0] }
    // the arrow points at the δ− atom; ozone's case (formal charges) has no two-atom form
    return { choices: [toOuter, toCenter], right: b.out === 1 ? toOuter.id : toCenter.id }
  }
  const seats = idealDirs(m.bonded, m.lonePairs)
  if (!seats) return null
  // ozone: the formal charges sit on one outer atom in each drawing, but the real molecule is the
  // average of its two drawings, so each arrow counts the same
  const sizes = m.bonds.map((b) => (b.out === 0 ? 0 : m.why === 'charges' ? 1 : b.size))
  const net = unit(sum(m.bonds.map((b, i) => seats[i]!.map((x) => x * b.out * sizes[i]!) as V3)))
  const cands: Direction[] = []
  const kinds = [...new Set(m.bonds.map((b) => b.el))]
  const seatsOf = (el: El) => m.bonds.map((b, i) => (b.el === el ? seats[i]! : null)).filter((v): v is V3 => !!v)
  const lone = seats.slice(m.bonded)
  for (const el of kinds) cands.push({ id: `to-${el}`, kind: 'to', el, count: seatsOf(el).length, dir: sum(seatsOf(el)) })
  if (lone.length) cands.push({ id: 'to-lone', kind: 'lone-to', el: null, count: m.lonePairs, dir: sum(lone) })
  // one bond of a kind that has several: the net dipole taken to follow a single bond
  for (const el of kinds) if (seatsOf(el).length > 1) cands.push({ id: `one-${el}`, kind: 'one', el, count: 1, dir: seatsOf(el)[0]! })
  for (const el of kinds) cands.push({ id: `from-${el}`, kind: 'from', el, count: seatsOf(el).length, dir: neg(sum(seatsOf(el))) })
  if (lone.length) cands.push({ id: 'from-lone', kind: 'lone-from', el: null, count: m.lonePairs, dir: neg(sum(lone)) })
  // a phrase whose direction is zero (the 4 fluorine atoms of a square) or repeats an earlier one goes
  const kept: Direction[] = []
  for (const c of cands) {
    if (len(c.dir) < 1e-6) continue
    const d = unit(c.dir)
    if (kept.some((k) => dot(k.dir, d) > 0.98)) continue
    kept.push({ ...c, dir: d })
  }
  const cos = (deg: number) => Math.cos((deg * Math.PI) / 180)
  const right = kept.reduce<Direction | null>((best, c) => (!best || dot(c.dir, net) > dot(best.dir, net) ? c : best), null)
  if (!right || dot(right.dir, net) < cos(WITHIN_DEG)) return null
  const choices = kept.filter((c) => c === right || dot(c.dir, net) <= cos(DISTRACTOR_DEG)).slice(0, 4)
  if (!choices.includes(right)) choices[choices.length - 1] = right
  return { choices, right: right.id }
}

/** The bond angle picks: the right one, the wrong ideas (the angle without lone pairs, the flat
 *  drawing's 90°, no angle at all) and others from the table to make five, in table order. */
export function angleChoicesFor(info: ShapeInfo, angle: string): string[] {
  const pool = [angle]
  const add = (a: string | undefined) => {
    if (a && pool.length < 5 && !pool.includes(a)) pool.push(a)
  }
  if (info.diatomic) add('180°')
  else {
    add(classify(info.groups, 0)?.angle)
    add(classify(info.bonded, 0)?.angle)
    if (info.groups === 4) add('90°')
    add(NO_ANGLE)
  }
  for (const a of ANGLES) add(a)
  return ANGLES.filter((a) => pool.includes(a))
}

const cache = new Map<string, Sheet>()

/** The sheet for a problem. Throws when the engine has no structure for it: every molecule in
 *  the pool must have one (tests/exercise.test.ts checks the whole pool). */
export function sheetOf(p: Problem): Sheet {
  const hit = cache.get(p.id)
  if (hit && hit.p === p) return hit
  const ref = referenceStructure(p)
  const info = ref ? shapeInfoFor(ref) : null
  const m = ref ? moleculePolarity(ref) : null
  if (!ref || !info || !m) throw new Error(`no finished structure for ${p.id}`)
  const sp = speciesOf(p)
  const solved = solveStar(sp.center, sp.terminals, sp.charge)
  const forms = solved ? bestStructures(solved) : []
  const diatomic = isDiatomic(p)
  const kinds: BondKind[] = []
  // for two atoms the bond is named from the problem's first atom, whichever end the engine calls its middle
  const first = diatomic ? p.center : m.center.el
  for (const b of m.bonds) {
    const outer = diatomic ? (b.el === first ? m.center.el : b.el) : b.el
    const known = kinds.find((k) => k.b === outer)
    if (known) known.count++
    else kinds.push({ a: first, b: outer, pol: bondPolarity(first, outer), count: 1, polar: b.out !== 0, byCharge: b.out !== 0 && b.polarity.kind === 'nonpolar' })
  }
  const angle = info.diatomic ? NO_ANGLE : info.angle
  const sheet: Sheet = {
    p,
    ref,
    diatomic,
    total: totalElectrons(p),
    resonance: hasResonance(p),
    forms,
    info,
    mixed: mixedOuter(ref),
    geometryChoices: geometryChoices(),
    shapeChoices: shapeChoices(info),
    angle,
    angleChoices: angleChoicesFor(info, angle),
    bonds: kinds,
    m,
    directions: directionsOf(m, diatomic),
  }
  cache.set(p.id, sheet)
  return sheet
}

/** The atoms of the molecule, one entry per atom. */
export const atomCount = (p: Problem) => atomsOf(p).length

// ---------------------------------------------------------------- reading what a student typed

/** A whole number typed in a box, or null when the box holds no number. */
export function readWhole(text: string): number | null {
  const t = text.trim()
  return /^\d{1,3}$/.test(t) ? Number(t) : null
}
/** A ΔEN typed in a box, in tenths ("0.9", ".9", "0.90", "1" all read), or null when it is not a
 *  number. A minus sign is kept: a difference taken the wrong way round is a wrong idea to name. */
export function readTenths(text: string): number | null {
  const t = text.trim().replace(/[−–]/g, '-').replace(',', '.')
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
  const v = Number(t) * 10
  return Number.isFinite(v) ? v : null
}
