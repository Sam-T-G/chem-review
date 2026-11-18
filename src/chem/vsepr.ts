// VSEPR: count the electron groups around the center atom, then name the arrangement.
// Names and ideal angles follow OpenStax Chemistry 2e, section 7.6 (Figures 7.16 and 7.19).
import { topologyOf } from './assess'
import { atomById, bondsOf, type Structure } from './structure'

export type Geometry = 'linear' | 'trigonal planar' | 'tetrahedral' | 'trigonal bipyramidal' | 'octahedral'
export type ShapeName =
  | 'linear'
  | 'trigonal planar'
  | 'bent'
  | 'tetrahedral'
  | 'trigonal pyramidal'
  | 'trigonal bipyramidal'
  | 'seesaw'
  | 'T-shaped'
  | 'octahedral'
  | 'square pyramidal'
  | 'square planar'

/** The electron geometry: the arrangement of all the electron groups around the middle atom, lone pairs included. */
export type ElectronGeometry = Geometry
/** The molecular geometry: the arrangement of the atoms only. */
export type MolecularGeometry = ShapeName

/** What VSEPR says about a molecule with one middle atom, or about a molecule of two atoms.
 *
 *  Two atoms (`diatomic: true`, IF, HCl, N2): the two atoms sit on a line, so `geometry` and `shape` are both
 *  linear and `angle` is '' (there is no bond angle). The counts describe the atom the engine treats as the
 *  middle one: the atom that is not hydrogen, or else the less electronegative one (`topologyOf` in assess.ts),
 *  whichever atom a problem names as its center. `bonded` is 1, `lonePairs` is that atom's lone pairs (3 on
 *  chlorine in HCl, 1 on either nitrogen in N2), and `groups` is their sum. For two atoms `groups` does not
 *  choose the geometry. */
export interface ShapeInfo {
  /** Electron groups around the center: bonded atoms plus lone pairs. */
  groups: number
  bonded: number
  lonePairs: number
  /** The electron geometry: the arrangement of all the groups. */
  geometry: ElectronGeometry
  /** The molecular geometry: the arrangement of the atoms only. */
  shape: MolecularGeometry
  /** Bond angle between atoms, ideal or "less than" the ideal when lone pairs squeeze it. '' for two atoms. */
  angle: string
  /** True for a molecule of two atoms, which has no bond angle. */
  diatomic: boolean
}

const GEOMETRY: Record<number, Geometry> = { 2: 'linear', 3: 'trigonal planar', 4: 'tetrahedral', 5: 'trigonal bipyramidal', 6: 'octahedral' }

// key: `${bonded},${lonePairs}`
const SHAPES: Record<string, { shape: ShapeName; angle: string }> = {
  '2,0': { shape: 'linear', angle: '180°' },
  '3,0': { shape: 'trigonal planar', angle: '120°' },
  '2,1': { shape: 'bent', angle: 'less than 120°' },
  '4,0': { shape: 'tetrahedral', angle: '109.5°' },
  '3,1': { shape: 'trigonal pyramidal', angle: 'less than 109.5°' },
  '2,2': { shape: 'bent', angle: 'less than 109.5°' },
  '5,0': { shape: 'trigonal bipyramidal', angle: '90° and 120°' },
  '4,1': { shape: 'seesaw', angle: 'less than 90° and less than 120°' },
  '3,2': { shape: 'T-shaped', angle: 'less than 90°' },
  '2,3': { shape: 'linear', angle: '180°' },
  '6,0': { shape: 'octahedral', angle: '90°' },
  '5,1': { shape: 'square pyramidal', angle: 'less than 90°' },
  '4,2': { shape: 'square planar', angle: '90°' },
}

export const ALL_SHAPES: ShapeName[] = [...new Set(Object.values(SHAPES).map((s) => s.shape))]

/** Every row of the shape table: each count of bonded atoms and lone pairs the app names, 13 in all, in table order. */
export const ALL_CASES: ShapeInfo[] = Object.keys(SHAPES).map((key) => {
  const [bonded, lonePairs] = key.split(',').map(Number) as [number, number]
  return classify(bonded, lonePairs)!
})

/** Every count of bonded atoms and lone pairs that makes the named shape (bent and linear have two each). */
export function shapeCases(name: ShapeName): { bonded: number; lonePairs: number }[] {
  return Object.entries(SHAPES)
    .filter(([, v]) => v.shape === name)
    .map(([key]) => {
      const [bonded, lonePairs] = key.split(',').map(Number) as [number, number]
      return { bonded, lonePairs }
    })
}

// Angles that two bonds of a row make and the row's label leaves out. The two axial positions of a
// trigonal bipyramid are on one line through the middle atom, and so are opposite corners of an
// octahedron, so a row with atoms in both of those positions also holds an angle of 180° (a little
// less once lone pairs squeeze the bonds). A label of two angles also holds each of its angles alone.
const ALSO_ANGLES: Record<string, string[]> = {
  '5,0': ['90°', '120°', '180°'],
  '4,1': ['less than 90°', 'less than 120°', '180°'],
  '3,2': ['180°'],
  '6,0': ['180°'],
  '5,1': ['180°'],
  '4,2': ['180°'],
}

/** Angle labels that are true of two bonds in this row, or true before the lone pairs squeeze them,
 *  although the row's own label is another one. A question about the row's bond angle never offers
 *  one of these as a wrong answer. */
export function alsoAngles(bonded: number, lonePairs: number): string[] {
  return ALSO_ANGLES[`${bonded},${lonePairs}`] ?? []
}

export function classify(bonded: number, lonePairs: number): ShapeInfo | null {
  const entry = SHAPES[`${bonded},${lonePairs}`]
  const groups = bonded + lonePairs
  const geometry = GEOMETRY[groups]
  if (!entry || !geometry) return null
  return { groups, bonded, lonePairs, geometry, shape: entry.shape, angle: entry.angle, diatomic: false }
}

export interface CenterDomains {
  /** One entry per bonded atom. A double or triple bond is still one group. */
  bonds: { atomId: string; order: number }[]
  lonePairs: number
  /** 1 when the center holds an odd electron. */
  unpaired: number
}

export function centerDomains(s: Structure, centerId: string): CenterDomains {
  const center = atomById(s, centerId)
  const bonds = bondsOf(s, centerId).map((b) => ({ atomId: b.a === centerId ? b.b : b.a, order: b.order }))
  const lone = center?.lone ?? 0
  return { bonds, lonePairs: Math.floor(lone / 2), unpaired: lone % 2 }
}

/** The shape of whatever is on the board, or null when it has no single center
 *  (loose atoms, chains, rings) or the center holds an odd electron. */
export function shapeOf(s: Structure): ShapeInfo | null {
  const top = topologyOf(s)
  if (top.kind !== 'star') return null
  const d = centerDomains(s, top.center)
  if (d.unpaired) return null
  if (top.terminals.length === 1) {
    return { groups: 1 + d.lonePairs, bonded: 1, lonePairs: d.lonePairs, geometry: 'linear', shape: 'linear', angle: '', diatomic: true }
  }
  return classify(d.bonds.length, d.lonePairs)
}

/** Measured bond angles printed in OpenStax Chemistry 2e, 7.6: water in the text, ammonia in Figure 7.18. */
export const MEASURED_ANGLE: Record<string, string> = {
  H2O: '104.5°',
  NH3: '106.8°',
}
