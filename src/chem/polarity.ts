// Bond polarity and molecular polarity, worked the way Sam's Chem 1A course works them (lecture
// slides for chapter 7 of Interactive General Chemistry):
//
//   1. Subtract the two electronegativities, larger minus smaller, with the rounded table on the
//      slides. That difference is ΔEN.
//   2. 0 to 0.4 is a nonpolar bond, above 0.4 up to 2.0 is a polar bond, above 2.0 is ionic.
//   3. A polar bond is an arrow (its bond dipole) that points at the more electronegative atom,
//      which is δ−. The other atom is δ+. A nonpolar bond gets no arrow.
//   4. Add the arrows in the molecule's shape. If they cancel, the molecule is nonpolar. They can
//      cancel only when the same atoms sit evenly around the middle atom.
//
// The slides' one odd case is ozone: its bonds have ΔEN = 0, but the formal charges (+1 on the
// middle oxygen, −1 shared by the outer two) make them polar, and the bent shape does not cancel.
// The app applies that rule only to a bond between two atoms of the same element, and shares the
// formal charges of like outer atoms equally, so ozone's two arrows are the same length.
//
// Pure TypeScript. The directions come from the textbook arrangement, never from the 3D model.
import { topologyOf } from './assess'
import type { El } from './elements'
import { idealDirs, type V3 } from './repulsion'
import { atomById, formalCharge, type Structure } from './structure'
import { centerDomains } from './vsepr'

/** Electronegativity in tenths, from the table on the chapter 7 slides: the one the course
 *  subtracts with (CO2: 3.5 − 2.5 = 1.0). Whole numbers, so every difference is exact. */
export const COURSE_EN: Record<El, number> = {
  H: 21,
  Be: 15,
  B: 20,
  C: 25,
  N: 30,
  O: 35,
  F: 40,
  Al: 15,
  Si: 18,
  P: 21,
  S: 25,
  Cl: 30,
  As: 20,
  Se: 24,
  Br: 28,
  Kr: 30,
  I: 25,
  Xe: 26,
}
/** ΔEN up to this, in tenths, is a nonpolar bond. */
export const NONPOLAR_UP_TO = 4
/** ΔEN above NONPOLAR_UP_TO and up to this is a polar covalent bond; above it the bond is ionic. */
export const POLAR_UP_TO = 20

export type BondKind = 'nonpolar' | 'polar' | 'ionic'
export interface BondPolarity {
  /** The more electronegative atom, the δ− end. Null when the two pull equally. */
  negative: El | null
  /** The less electronegative atom, the δ+ end. */
  positive: El | null
  /** The two electronegativities as printed, larger first: "3.5" and "2.5". */
  high: string
  low: string
  /** ΔEN in tenths, and as printed: "1.0". */
  tenths: number
  delta: string
  kind: BondKind
}

const printed = (tenths: number) => (tenths / 10).toFixed(1)
/** Electronegativity of an atom as the course's table prints it: "2.5". */
export const courseEN = (el: El) => printed(COURSE_EN[el])

export function bondPolarity(a: El, b: El): BondPolarity {
  const ea = COURSE_EN[a]
  const eb = COURSE_EN[b]
  const tenths = Math.abs(ea - eb)
  const negative = ea === eb ? null : ea > eb ? a : b
  return {
    negative,
    positive: negative === null ? null : negative === a ? b : a,
    high: printed(Math.max(ea, eb)),
    low: printed(Math.min(ea, eb)),
    tenths,
    delta: printed(tenths),
    kind: tenths <= NONPOLAR_UP_TO ? 'nonpolar' : tenths <= POLAR_UP_TO ? 'polar' : 'ionic',
  }
}

/** Why a molecule is polar or nonpolar. */
export type NetReason =
  /** No bond is polar, so there are no bond dipoles to add. */
  | 'no-polar-bonds'
  /** Polar bonds whose dipoles cancel: the same atoms, spread evenly around the middle atom. */
  | 'cancel'
  /** The same polar bond every time, in a shape that does not spread the bonds evenly. */
  | 'shape'
  /** Bonds of different polarity, so the dipoles are not the same size. */
  | 'different'
  /** Bonds between identical atoms that formal charges make polar (ozone). */
  | 'charges'

export interface BondDipole {
  /** The atom at the outer end of the bond. */
  atomId: string
  el: El
  polarity: BondPolarity
  /** Which way the arrow points along the bond: 1 from the middle atom out to this atom,
   *  −1 from this atom in to the middle atom, 0 for no arrow. */
  out: -1 | 0 | 1
  /** How long the arrow is, in tenths of ΔEN. 0 for no arrow. */
  size: number
}
export interface MoleculePolarity {
  polar: boolean
  why: NetReason
  center: { id: string; el: El }
  /** One entry per bonded atom, in the order the middle atom's bonds are listed. */
  bonds: BondDipole[]
  /** The different kinds of bond, in order of first appearance, with how many of each. */
  kinds: { center: El; terminal: El; polarity: BondPolarity; count: number }[]
  /** Bonded atoms and lone pairs on the middle atom. */
  bonded: number
  lonePairs: number
  /** The net dipole as a direction in the textbook arrangement (bonded atoms in seats 0, 1, ...).
   *  Null when the dipoles cancel or there are none. */
  net: V3 | null
  /** True when unlike outer atoms could sit in seats that are not all alike (five or six groups),
   *  so the answer depends on which seats they take. `polar` is then for one of the arrangements. */
  depends: boolean
}

/** One bond as a viewer sees it: the direction from the middle atom to the bonded atom, as a unit
 *  vector with x to the viewer's right, y up, and z toward the viewer. */
export interface SeenBond {
  atomId: string
  dir: V3
}
/** The net dipole as a viewer sees it. */
export interface SeenNet {
  /** The direction the net dipole points across the screen: a unit vector, x to the right and y up.
   *  Both are 0 when the net dipole points straight at the viewer or straight away. */
  x: number
  y: number
  /** The share of the net dipole that lies across the screen, from 0 (it points at the viewer or
   *  away) to 1 (the viewer sees it from the side). */
  across: number
}

/** Adds the bond dipoles the way a viewer sees them: each arrow runs along its bond, toward the
 *  bond's δ− atom, as long as the bond's ΔEN. Null when the dipoles cancel, when there are none,
 *  or when `seen` leaves out a bond that has a dipole. */
export function netAsSeen(m: MoleculePolarity, seen: SeenBond[]): SeenNet | null {
  if (!m.net) return null
  const sum: V3 = [0, 0, 0]
  for (const b of m.bonds) {
    if (b.out === 0) continue
    const dir = seen.find((x) => x.atomId === b.atomId)?.dir
    if (!dir) return null
    for (let k = 0; k < 3; k++) sum[k]! += dir[k]! * b.out * b.size
  }
  const length = Math.hypot(sum[0], sum[1], sum[2])
  if (length < 1e-6) return null
  const flat = Math.hypot(sum[0], sum[1])
  return flat < 1e-6 ? { x: 0, y: 0, across: 0 } : { x: sum[0] / flat, y: sum[1] / flat, across: flat / length }
}

/** A formal charge difference of 1 across a bond between two atoms of the same element counts like this much ΔEN, in tenths. */
const CHARGE_AS_TENTHS = 10

/** Bond dipoles and the net dipole of a molecule with one middle atom. Null for anything else
 *  (loose atoms, chains, rings) and for a middle atom that holds an odd electron. */
export function moleculePolarity(s: Structure): MoleculePolarity | null {
  const top = topologyOf(s)
  if (top.kind !== 'star') return null
  const centerAtom = atomById(s, top.center)
  if (!centerAtom) return null
  const d = centerDomains(s, top.center)
  if (d.unpaired) return null

  // Outer atoms of one element share their formal charges equally: ozone's −1 is shared by the outer two
  // (the slides), so both bonds get the same arrow whichever resonance drawing is on the board.
  const sharedCharge = new Map<El, number>()
  for (const b of d.bonds) {
    const el = atomById(s, b.atomId)!.el
    const same = d.bonds.filter((x) => atomById(s, x.atomId)!.el === el)
    if (!sharedCharge.has(el)) sharedCharge.set(el, same.reduce((n, x) => n + formalCharge(s, x.atomId), 0) / same.length)
  }

  let byCharge = false
  const bonds: BondDipole[] = d.bonds.map((b) => {
    const el = atomById(s, b.atomId)!.el
    const polarity = bondPolarity(centerAtom.el, el)
    if (polarity.kind !== 'nonpolar') return { atomId: b.atomId, el, polarity, out: polarity.negative === el ? 1 : -1, size: polarity.tenths }
    // two atoms of the same element pull equally, but a formal charge on one of them still shifts the
    // electrons (ozone). Two different elements with the same table value (P–H, C–S) get no arrow.
    const gap = formalCharge(s, top.center) - sharedCharge.get(el)!
    if (el === centerAtom.el && Math.abs(gap) > 1e-9) {
      byCharge = true
      return { atomId: b.atomId, el, polarity, out: gap > 0 ? 1 : -1, size: Math.abs(gap) * CHARGE_AS_TENTHS }
    }
    return { atomId: b.atomId, el, polarity, out: 0, size: 0 }
  })

  const kinds: MoleculePolarity['kinds'] = []
  for (const b of bonds) {
    const known = kinds.find((k) => k.terminal === b.el)
    if (known) known.count++
    else kinds.push({ center: centerAtom.el, terminal: b.el, polarity: b.polarity, count: 1 })
  }

  const base = { center: { id: top.center, el: centerAtom.el }, bonds, kinds, bonded: bonds.length, lonePairs: d.lonePairs }
  const arrows = bonds.filter((b) => b.out !== 0)
  if (arrows.length === 0) return { ...base, polar: false, why: 'no-polar-bonds', net: null, depends: false }

  // two atoms sit on a line; more than two take the textbook seats for their shape
  const seats = bonds.length === 1 ? ([[1, 0, 0]] as V3[]) : idealDirs(bonds.length, d.lonePairs)
  if (!seats) return null
  const sum: V3 = [0, 0, 0]
  bonds.forEach((b, i) => {
    const seat = seats[i]!
    for (let k = 0; k < 3; k++) sum[k]! += seat[k]! * b.out * b.size
  })
  const length = Math.hypot(sum[0], sum[1], sum[2])
  const alike = bonds.every((b) => b.out === bonds[0]!.out && b.size === bonds[0]!.size)
  // with five or six groups the seats are not all alike, so unlike atoms could be arranged more than one way
  const depends = !alike && bonds.length + d.lonePairs >= 5
  if (length < 1e-6) return { ...base, polar: false, why: 'cancel', net: null, depends }
  const net: V3 = [sum[0] / length, sum[1] / length, sum[2] / length]
  return { ...base, polar: true, why: byCharge ? 'charges' : alike ? 'shape' : 'different', net, depends }
}
