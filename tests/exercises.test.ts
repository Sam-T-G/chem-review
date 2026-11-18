// The exercise pool, the electron geometry on every problem, and molecules of two atoms in the engine.
// Every expected answer below is worked by hand from the sources in docs/chemistry/sources.md, never
// copied from what the code returns:
//   - valence electrons from the group numbers, plus one for each negative charge, minus one for each
//     positive charge (OpenStax Chemistry 2e, 7.3);
//   - the drawing: outer atoms get full shells, the rest goes on the middle atom, bonds get doubled
//     where formal charge (7.4) or a short middle atom calls for it, period 3 atoms may hold more than
//     8 (D-0005);
//   - electron geometry, molecular geometry and the bond angle text from section 7.6 (Figures 7.16 and
//     7.19), where a two-atom molecule is linear with no bond angle;
//   - ΔEN from the course's rounded table (D-0021): larger minus smaller, 0 to 0.4 nonpolar, above 0.4
//     up to 2.0 polar, and the bond dipoles added in the shape (the chapter 7 slides);
//   - resonance: more than one drawing with the same bonds and charges in different places, under the
//     app's convention (D-0005).
import { describe, expect, it } from 'vitest'
import { assess } from '../src/chem/assess'
import type { El } from '../src/chem/elements'
import { EXERCISES, EXERCISE_SETS, hasResonance, isDiatomic, referenceStructure } from '../src/chem/exercises'
import { sigmaPi } from '../src/chem/orbitals'
import { bondPolarity, moleculePolarity } from '../src/chem/polarity'
import { PROBLEMS, speciesOf, totalElectrons, type Problem } from '../src/chem/problems'
import { bestStructures, solveStar } from '../src/chem/solve'
import { addElectron, removeElectron, share, type Structure } from '../src/chem/structure'
import { ALL_CASES, shapeOf, type Geometry, type ShapeName } from '../src/chem/vsepr'
import { drawn, star } from './helpers'

type Kind = 'nonpolar' | 'polar' | 'ionic'
interface Row {
  id: string
  /** Valence electrons of the species. */
  total: number
  /** Bond order to each outer atom, in formula order (one resonance form where there are several). */
  orders: number[]
  /** Lone pairs on the middle atom. For two atoms, on the atom named the center. */
  lonePairs: number
  geometry: Geometry
  shape: ShapeName
  /** The bond angle text; '' for two atoms, which have no bond angle. */
  angle: string
  /** Each kind of bond: the outer element, ΔEN as printed, and the bond's kind. */
  bonds: [El, string, Kind][]
  polar: boolean
  resonance: boolean
}
const r = (id: string, total: number, orders: number[], lonePairs: number, geometry: Geometry, shape: ShapeName, angle: string, bonds: [El, string, Kind][], polar: boolean, resonance = false): Row => ({ id, total, orders, lonePairs, geometry, shape, angle, bonds, polar, resonance })
const ones = (n: number) => new Array<number>(n).fill(1)
const TET = 'tetrahedral'
const TP = 'trigonal planar'
const TBP = 'trigonal bipyramidal'
const OCT = 'octahedral'

/** The 20 molecules of the class worksheet, in the sheet's order. The handwritten cells on the photos are a
 *  student's answers and are not used. */
const SHEET: Row[] = [
  // 2(1) + 6 = 8; O–H 3.5 − 2.1 = 1.4 (the sheet's printed example row)
  r('H2O', 8, [1, 1], 2, TET, 'bent', 'less than 109.5°', [['H', '1.4', 'polar']], true),
  // 4 + 2(1) + 2(7) = 20; C–H 2.5 − 2.1 = 0.4 nonpolar, C–Cl 3.0 − 2.5 = 0.5 polar; the two C–Cl dipoles do not cancel
  r('CH2Cl2', 20, ones(4), 0, TET, TET, '109.5°', [['H', '0.4', 'nonpolar'], ['Cl', '0.5', 'polar']], true),
  // 4 + 4(7) = 32; Si–Cl 3.0 − 1.8 = 1.2; four alike in a tetrahedron cancel
  r('SiCl4', 32, ones(4), 0, TET, TET, '109.5°', [['Cl', '1.2', 'polar']], false),
  // 3 + 3(7) = 24; boron keeps 6; B–F 4.0 − 2.0 = 2.0, still polar; three alike in a plane cancel
  r('BF3', 24, ones(3), 0, TP, TP, '120°', [['F', '2.0', 'polar']], false),
  // 5 + 3(7) = 26; 24 on the chlorines and bonds, 2 left: one lone pair; P–Cl 3.0 − 2.1 = 0.9
  r('PCl3', 26, ones(3), 1, TET, 'trigonal pyramidal', 'less than 109.5°', [['Cl', '0.9', 'polar']], true),
  // 5 + 5(7) = 40; phosphorus holds 10
  r('PCl5', 40, ones(5), 0, TBP, TBP, '90° and 120°', [['Cl', '0.9', 'polar']], false),
  // 4 + 3 + 1 = 8; one lone pair; C–H is 0.4, nonpolar on the course table, so no bond dipoles to add
  r('CH3-', 8, ones(3), 1, TET, 'trigonal pyramidal', 'less than 109.5°', [['H', '0.4', 'nonpolar']], false),
  // 6 + 6(7) = 48; S–F 4.0 − 2.5 = 1.5
  r('SF6', 48, ones(6), 0, OCT, OCT, '90°', [['F', '1.5', 'polar']], false),
  // 4 + 6(7) + 2 = 48; silicon holds 12
  r('SiCl6 2-', 48, ones(6), 0, OCT, OCT, '90°', [['Cl', '1.2', 'polar']], false),
  // 6 + 2(7) = 20; 16 on the chlorines and bonds, 4 left: two lone pairs; S–Cl 3.0 − 2.5 = 0.5
  r('SCl2', 20, [1, 1], 2, TET, 'bent', 'less than 109.5°', [['Cl', '0.5', 'polar']], true),
  // 6 + 4(7) = 34; 32 on the chlorines and bonds, 2 left; Se–Cl 3.0 − 2.4 = 0.6
  r('SeCl4', 34, ones(4), 1, TBP, 'seesaw', 'less than 90° and less than 120°', [['Cl', '0.6', 'polar']], true),
  // 4 + 3 − 1 = 6; all six in the three bonds, carbon stays at 6 (D-0032); C–H 0.4 nonpolar
  r('CH3+', 6, ones(3), 0, TP, TP, '120°', [['H', '0.4', 'nonpolar']], false),
  // 7 + 5(7) = 42; 40 on the chlorines and bonds, 2 left; I–Cl 3.0 − 2.5 = 0.5
  r('ICl5', 42, ones(5), 1, OCT, 'square pyramidal', 'less than 90°', [['Cl', '0.5', 'polar']], true),
  // 7 + 7 = 14; one bond and three lone pairs on each atom; I–F 4.0 − 2.5 = 1.5; the bond's dipole is the net dipole
  r('IF', 14, [1], 3, 'linear', 'linear', '', [['F', '1.5', 'polar']], true),
  // 7 + 2(7) + 1 = 22; 16 on the chlorines and bonds, 6 left: three lone pairs in the triangle's seats
  r('ICl2-', 22, [1, 1], 3, TBP, 'linear', '180°', [['Cl', '0.5', 'polar']], false),
  // 7 + 3(7) = 28; 24 on the chlorines and bonds, 4 left
  r('ICl3', 28, ones(3), 2, TBP, 'T-shaped', 'less than 90°', [['Cl', '0.5', 'polar']], true),
  // 4 + 3(6) + 2 = 24; one C=O, three places for it; C–O 3.5 − 2.5 = 1.0; cancels as the slides' nitrate does
  r('CO3 2-', 24, [2, 1, 1], 0, TP, TP, '120°', [['O', '1.0', 'polar']], false, true),
  // 3(6) = 18; O=O–O, two places for the double bond; ΔEN 0, and the formal charges make it polar (the slides)
  r('O3', 18, [2, 1], 1, TP, 'bent', 'less than 120°', [['O', '0.0', 'nonpolar']], true, true),
  // 8 + 4(7) = 36; 32 on the fluorines and bonds, 4 left; Xe–F 4.0 − 2.6 = 1.4
  r('XeF4', 36, ones(4), 2, OCT, 'square planar', '90°', [['F', '1.4', 'polar']], false),
  // 5 + 2 + 1 = 8; two lone pairs; P–H 2.1 − 2.1 = 0.0, nonpolar. Phosphorus carries the −1 (5 − 4 − 2), but
  // the slides' formal-charge rule is for ozone, a bond between atoms of one element, so there are no bond
  // dipoles to add and the ion is nonpolar
  r('PH2-', 8, [1, 1], 2, TET, 'bent', 'less than 109.5°', [['H', '0.0', 'nonpolar']], false),
]

/** Molecules of two atoms besides IF. The center is the atom that is not hydrogen. */
const TWO: Row[] = [
  // 1 + 7 = 8; H–F 4.0 − 2.1 = 1.9
  r('HF', 8, [1], 3, 'linear', 'linear', '', [['H', '1.9', 'polar']], true),
  // H–Cl 3.0 − 2.1 = 0.9 (the slides' own example)
  r('HCl', 8, [1], 3, 'linear', 'linear', '', [['H', '0.9', 'polar']], true),
  // H–Br 2.8 − 2.1 = 0.7
  r('HBr', 8, [1], 3, 'linear', 'linear', '', [['H', '0.7', 'polar']], true),
  // 7 + 7 = 14; two of one element pull equally
  r('F2', 14, [1], 3, 'linear', 'linear', '', [['F', '0.0', 'nonpolar']], false),
  r('Cl2', 14, [1], 3, 'linear', 'linear', '', [['Cl', '0.0', 'nonpolar']], false),
  r('Br2', 14, [1], 3, 'linear', 'linear', '', [['Br', '0.0', 'nonpolar']], false),
  // 5 + 5 = 10: a single bond leaves the middle atom at 4, a triple bond fills both with one lone pair each
  r('N2', 10, [3], 1, 'linear', 'linear', '', [['N', '0.0', 'nonpolar']], false),
  // 6 + 6 = 12: a double bond fills both with two lone pairs each
  r('O2', 12, [2], 2, 'linear', 'linear', '', [['O', '0.0', 'nonpolar']], false),
]

/** The rest of the pool. */
const MORE: Row[] = [
  // 4 + 4(7) = 32; C–Cl 0.5
  r('CCl4', 32, ones(4), 0, TET, TET, '109.5°', [['Cl', '0.5', 'polar']], false),
  // 4 + 1 + 3(7) = 26; C–H gives no dipole, the three C–Cl dipoles do not cancel
  r('CHCl3', 26, ones(4), 0, TET, TET, '109.5°', [['H', '0.4', 'nonpolar'], ['Cl', '0.5', 'polar']], true),
  // 5 + 3(7) = 26; N–F 4.0 − 3.0 = 1.0
  r('NF3', 26, ones(3), 1, TET, 'trigonal pyramidal', 'less than 109.5°', [['F', '1.0', 'polar']], true),
  // 6 + 2(7) = 20; O–F 4.0 − 3.5 = 0.5
  r('OF2', 20, [1, 1], 2, TET, 'bent', 'less than 109.5°', [['F', '0.5', 'polar']], true),
  // 6 + 3 − 1 = 8; one lone pair; O–H 1.4
  r('H3O+', 8, ones(3), 1, TET, 'trigonal pyramidal', 'less than 109.5°', [['H', '1.4', 'polar']], true),
  // 5 + 2 + 1 = 8; two lone pairs; N–H 3.0 − 2.1 = 0.9
  r('NH2-', 8, [1, 1], 2, TET, 'bent', 'less than 109.5°', [['H', '0.9', 'polar']], true),
  // 5 + 3(6) + 1 = 24; one N=O, three places for it; N–O 3.5 − 3.0 = 0.5; cancels (the slides' example)
  r('NO3-', 24, [2, 1, 1], 0, TP, TP, '120°', [['O', '0.5', 'polar']], false, true),
  // 7 + 4(7) + 1 = 36; 32 on the fluorines and bonds, 4 left; Br–F 4.0 − 2.8 = 1.2
  r('BrF4-', 36, ones(4), 2, OCT, 'square planar', '90°', [['F', '1.2', 'polar']], false),
  // 4 + 6 + 2(7) = 24; C=O and two C–Cl; C–O 1.0 and C–Cl 0.5 are different sizes, so they do not cancel
  r('COCl2', 24, [2, 1, 1], 0, TP, TP, '120°', [['O', '1.0', 'polar'], ['Cl', '0.5', 'polar']], true),
  // 4 + 2(6) = 16; S=C=S; C–S 2.5 − 2.5 = 0.0
  r('CS2', 16, [2, 2], 0, 'linear', 'linear', '180°', [['S', '0.0', 'nonpolar']], false),
  // 6 + 3(6) = 24; formal charge first (D-0005): three S=O, sulfur at 12, every charge 0, one drawing
  r('SO3', 24, [2, 2, 2], 0, TP, TP, '120°', [['O', '1.0', 'polar']], false),
  // 2 + 2(7) = 16; beryllium keeps 4; Be–Cl 3.0 − 1.5 = 1.5
  r('BeCl2', 16, [1, 1], 0, 'linear', 'linear', '180°', [['Cl', '1.5', 'polar']], false),
  // 3 + 3(7) = 24; boron keeps 6; B–Cl 3.0 − 2.0 = 1.0
  r('BCl3', 24, ones(3), 0, TP, TP, '120°', [['Cl', '1.0', 'polar']], false),
  // 5 + 5(7) = 40; As–F 4.0 − 2.0 = 2.0, still polar
  r('AsF5', 40, ones(5), 0, TBP, TBP, '90° and 120°', [['F', '2.0', 'polar']], false),
  // 7 + 5(7) = 42; 2 left; Cl–F 4.0 − 3.0 = 1.0
  r('ClF5', 42, ones(5), 1, OCT, 'square pyramidal', 'less than 90°', [['F', '1.0', 'polar']], true),
]

const ROWS = [...SHEET, ...TWO, ...MORE]
const ex = (id: string) => {
  const p = EXERCISES.find((x) => x.id === id)
  if (!p) throw new Error(`${id} is not in the pool`)
  return p
}
const drawingOf = (p: Problem, row: Row) => {
  const sp = speciesOf(p)
  return drawn(sp.center, sp.terminals, row.orders, 2 * row.lonePairs)
}

describe('the exercise pool', () => {
  it('holds every molecule of the table once, and nothing else', () => {
    expect(new Set(EXERCISES.map((p) => p.id)).size).toBe(EXERCISES.length)
    expect([...EXERCISES.map((p) => p.id)].sort()).toEqual(ROWS.map((x) => x.id).sort())
    expect(EXERCISES.length).toBe(43)
  })
  it('uses the guided problems’ own objects for the six worksheet molecules that are also guided', () => {
    for (const id of ['H2O', 'BF3', 'PCl5', 'SF6', 'CO3 2-', 'XeF4']) expect(ex(id), id).toBe(PROBLEMS.find((p) => p.id === id))
    const guided = new Set(PROBLEMS.map((p) => p.id))
    expect(EXERCISES.filter((p) => guided.has(p.id)).map((p) => p.id).sort()).toEqual(['BF3', 'CO3 2-', 'H2O', 'PCl5', 'SF6', 'XeF4'])
  })
  it('puts each exercise in exactly one set: the worksheet in its order first, then the two-atom molecules', () => {
    const all = EXERCISE_SETS.flatMap((s) => s.ids)
    expect(all.length).toBe(EXERCISES.length)
    expect(new Set(all)).toEqual(new Set(EXERCISES.map((p) => p.id)))
    expect(new Set(EXERCISE_SETS.map((s) => s.id)).size).toBe(EXERCISE_SETS.length)
    expect(EXERCISE_SETS[0]).toMatchObject({ id: 'sheet', ids: SHEET.map((x) => x.id) })
    expect(EXERCISE_SETS[0]!.ids).toEqual(['H2O', 'CH2Cl2', 'SiCl4', 'BF3', 'PCl3', 'PCl5', 'CH3-', 'SF6', 'SiCl6 2-', 'SCl2', 'SeCl4', 'CH3+', 'ICl5', 'IF', 'ICl2-', 'ICl3', 'CO3 2-', 'O3', 'XeF4', 'PH2-'])
    expect(EXERCISE_SETS[1]!.ids).toEqual(TWO.map((x) => x.id))
    for (const s of EXERCISE_SETS) expect(s.title.length, s.id).toBeGreaterThan(0)
  })
  it('lists the molecules in the order of their sets', () => {
    expect(EXERCISES.map((p) => p.id)).toEqual(EXERCISE_SETS.flatMap((s) => s.ids))
  })
  it('has a lowercase name, and a center that is in the formula', () => {
    for (const p of EXERCISES) {
      expect(p.name, p.id).toBe(p.name.toLowerCase())
      expect(p.formula.some(([el]) => el === p.center), p.id).toBe(true)
      // one middle atom, or two atoms in all, or one element only (ozone)
      const n = p.formula.find(([el]) => el === p.center)![1]
      expect(n === 1 || isDiatomic(p) || p.formula.length === 1, p.id).toBe(true)
    }
  })
  it('knows which ones have two atoms', () => {
    expect(EXERCISES.filter(isDiatomic).map((p) => p.id).sort()).toEqual(['Br2', 'Cl2', 'F2', 'HBr', 'HCl', 'HF', 'IF', 'N2', 'O2'])
  })
})

describe('every exercise, worked by hand', () => {
  for (const row of ROWS) {
    describe(row.id, () => {
      it('counts its valence electrons', () => {
        expect(totalElectrons(ex(row.id))).toBe(row.total)
      })
      it('has the hand-worked drawing as its reference structure', () => {
        const p = ex(row.id)
        const ref = referenceStructure(p)!
        expect(ref).not.toBeNull()
        const sp = speciesOf(p)
        expect(ref.atoms[0]).toMatchObject({ el: sp.center, lone: 2 * row.lonePairs })
        expect(ref.atoms.slice(1).map((a) => a.el)).toEqual(sp.terminals)
        expect(ref.bonds.map((b) => b.order).sort()).toEqual([...row.orders].sort())
        // outer atoms have full shells: 2 for hydrogen, 8 for the rest
        ref.atoms.slice(1).forEach((a, i) => {
          const order = ref.bonds[i]!.order
          expect(a.lone + 2 * order, `${row.id} ${a.el}`).toBe(a.el === 'H' ? 2 : 8)
        })
        expect(sigmaPi(ref)).toEqual({ sigma: row.orders.length, pi: row.orders.reduce((n, o) => n + o - 1, 0) })
      })
      it('passes the check when drawn with the app’s moves, as the exercise and in free build', () => {
        const p = ex(row.id)
        const { s } = drawingOf(p, row)
        expect(assess(s, speciesOf(p)).issues).toEqual([])
        expect(assess(s, speciesOf(p)).charge).toBe(p.charge)
        expect(assess(s).issues).toEqual([])
      })
      it('has the hand-worked electron geometry, molecular geometry and bond angle', () => {
        const p = ex(row.id)
        expect(p.geometry).toBe(row.geometry)
        expect(p.shape).toBe(row.shape)
        const info = shapeOf(drawingOf(p, row).s)!
        expect(info).toMatchObject({ geometry: row.geometry, shape: row.shape, angle: row.angle, diatomic: isDiatomic(p) })
        if (!isDiatomic(p)) expect(info).toMatchObject({ bonded: row.orders.length, lonePairs: row.lonePairs, groups: row.orders.length + row.lonePairs })
        expect(shapeOf(referenceStructure(p)!)).toMatchObject({ geometry: row.geometry, shape: row.shape, angle: row.angle })
      })
      it('has the hand-worked ΔEN for each bond, and is polar or not', () => {
        const p = ex(row.id)
        const kinds = new Set(speciesOf(p).terminals)
        expect([...kinds].sort()).toEqual(row.bonds.map(([el]) => el).sort())
        for (const [el, delta, kind] of row.bonds) expect(bondPolarity(p.center, el), `${p.center}–${el}`).toMatchObject({ delta, kind })
        const m = moleculePolarity(drawingOf(p, row).s)!
        expect(m.polar).toBe(row.polar)
        expect(m.depends).toBe(false)
      })
      it('has resonance or not', () => {
        expect(hasResonance(ex(row.id))).toBe(row.resonance)
      })
    })
  }
})

/** Electron geometry and resonance of the twenty guided problems, worked by hand the same way. SO2 has one
 *  drawing under the app's convention (two S=O, sulfur at 10), so it has no resonance here (D-0005). */
const GUIDED: Record<string, [Geometry, boolean]> = {
  CH4: [TET, false], NH3: [TET, false], H2O: [TET, false], CO2: ['linear', false], CH2O: [TP, false], HCN: ['linear', false],
  'NH4+': [TET, false], 'NO2-': [TP, true], 'CO3 2-': [TP, true], BF3: [TP, false], PCl5: [TBP, false], SF4: [TBP, false],
  ClF3: [TBP, false], XeF2: [TBP, false], SF6: [OCT, false], BrF5: [OCT, false], XeF4: [OCT, false], SO2: [TP, false],
  'SO4 2-': [TET, true], 'PO4 3-': [TET, true],
}

describe('the electron geometry on every problem', () => {
  it('is on each guided problem, worked by hand', () => {
    expect(Object.keys(GUIDED).sort()).toEqual(PROBLEMS.map((p) => p.id).sort())
    for (const p of PROBLEMS) expect(p.geometry, p.id).toBe(GUIDED[p.id]![0])
  })
  it('matches the engine’s finished structure on both lists, for both geometries', () => {
    for (const p of [...PROBLEMS, ...EXERCISES]) {
      const info = shapeOf(referenceStructure(p)!)
      expect(info?.geometry, p.id).toBe(p.geometry)
      expect(info?.shape, p.id).toBe(p.shape)
    }
  })
  it('gives each guided problem resonance or not, worked by hand', () => {
    for (const p of PROBLEMS) expect(hasResonance(p), p.id).toBe(GUIDED[p.id]![1])
  })
})

describe('the shape table', () => {
  it('has the 13 rows of OpenStax Figures 7.16 and 7.19, in table order', () => {
    const rows: [number, number, Geometry, ShapeName, string][] = [
      [2, 0, 'linear', 'linear', '180°'],
      [3, 0, TP, TP, '120°'],
      [2, 1, TP, 'bent', 'less than 120°'],
      [4, 0, TET, TET, '109.5°'],
      [3, 1, TET, 'trigonal pyramidal', 'less than 109.5°'],
      [2, 2, TET, 'bent', 'less than 109.5°'],
      [5, 0, TBP, TBP, '90° and 120°'],
      [4, 1, TBP, 'seesaw', 'less than 90° and less than 120°'],
      [3, 2, TBP, 'T-shaped', 'less than 90°'],
      [2, 3, TBP, 'linear', '180°'],
      [6, 0, OCT, OCT, '90°'],
      [5, 1, OCT, 'square pyramidal', 'less than 90°'],
      [4, 2, OCT, 'square planar', '90°'],
    ]
    expect(ALL_CASES.map((c) => [c.bonded, c.lonePairs, c.geometry, c.shape, c.angle])).toEqual(rows)
    for (const c of ALL_CASES) expect(c).toMatchObject({ groups: c.bonded + c.lonePairs, diatomic: false })
  })
})

describe('two atoms, whichever one is named the center', () => {
  // The other atom named as the center. The answers do not change: one bond, full shells on both atoms.
  const swapped: [string, El, number, number][] = [
    // id, the other atom, its unshared electrons, the first atom's unshared electrons
    ['HF', 'H', 0, 6],
    ['HCl', 'H', 0, 6],
    ['HBr', 'H', 0, 6],
    ['IF', 'F', 6, 6],
  ]
  for (const [id, other, otherLone, firstLone] of swapped) {
    it(`${id} with ${other} named the center`, () => {
      const p = ex(id)
      const q: Problem = { ...p, center: other }
      const first = p.center
      expect(speciesOf(q)).toEqual({ center: other, terminals: [first], charge: 0 })
      const solved = solveStar(other, [first], 0)!
      expect(solved.total).toBe(p.id === 'IF' ? 14 : 8)
      expect(bestStructures(solved).map((x) => [x.orders, x.centerLone, x.termLone])).toEqual([[[1], otherLone, [firstLone]]])
      const ref = referenceStructure(q)!
      expect(ref.atoms.map((a) => [a.el, a.lone])).toEqual([
        [other, otherLone],
        [first, firstLone],
      ])
      expect(ref.bonds.map((b) => b.order)).toEqual([1])
      expect(assess(ref, speciesOf(q)).issues).toEqual([])
      expect(assess(ref, speciesOf(p)).issues).toEqual([])
      expect(hasResonance(q)).toBe(false)
      expect(sigmaPi(ref)).toEqual({ sigma: 1, pi: 0 })
      // the same shape and the same polarity as with the usual center
      const usual = shapeOf(referenceStructure(p)!)!
      expect(shapeOf(ref)).toEqual(usual)
      expect(usual).toMatchObject({ geometry: 'linear', shape: 'linear', angle: '', diatomic: true, bonded: 1 })
      const m = moleculePolarity(ref)!
      expect(m.polar).toBe(true)
      expect(m.bonds).toHaveLength(1)
      // the bond's dipole is the net dipole: it lies along the bond and points the same way
      const b = m.bonds[0]!
      expect(m.net).toEqual([b.out, 0, 0])
      expect(moleculePolarity(referenceStructure(p)!)!.net).toEqual(m.net)
    })
  }
  it('names the atom that is not hydrogen, or the less electronegative one, when the board picks the center', () => {
    // shapeOf counts the lone pairs of that atom: chlorine's 3 in HCl, iodine's 3 in IF, nitrogen's 1 in N2
    expect(shapeOf(drawn('H', ['Cl'], [1], 0).s)).toMatchObject({ bonded: 1, lonePairs: 3, groups: 4 })
    expect(shapeOf(drawn('F', ['I'], [1], 6).s)).toMatchObject({ bonded: 1, lonePairs: 3, groups: 4 })
    expect(shapeOf(drawn('N', ['N'], [3], 2).s)).toMatchObject({ bonded: 1, lonePairs: 1, groups: 2 })
  })
  it('sends I=F back for too many electrons on iodine, whichever atom is named the center', () => {
    // one share between I and F, then a second where fluorine gives a pair: iodine at 10, fluorine at 8
    const b = star(['I', 'F'], [1])
    const op = share(b.s, b.ids[0]!, b.ids[1]!)
    if (!op.ok) throw new Error(op.why)
    const s = op.s
    expect(s.bonds[0]!.order).toBe(2)
    const named = (center: El) => assess(s, { center, terminals: [center === 'I' ? 'F' : 'I'], charge: 0 })
    for (const a of [named('I'), named('F'), assess(s)]) {
      expect(a.complete).toBe(false)
      expect(a.issues).toEqual([{ kind: 'over', ids: [b.ids[0]] }])
    }
  })
})

describe('a middle atom the electron count leaves short (D-0032)', () => {
  const CH3: Structure = drawn('C', ['H', 'H', 'H'], [1, 1, 1], 0).s
  it('accepts carbon at 6 in CH3+, as the exercise and in free build', () => {
    const sp = speciesOf(ex('CH3+'))
    for (const a of [assess(CH3, sp), assess(CH3)]) {
      expect(a.issues).toEqual([])
      expect(a.complete).toBe(true)
      expect(a.atoms[0]).toMatchObject({ el: 'C', count: 6, status: 'full', fc: 1 })
      expect(a.charge).toBe(1)
    }
  })
  it('still calls carbon short when it keeps a lone pair (CH2, a half-built board)', () => {
    const { s } = star(['C', 'H', 'H'], [1, 1])
    expect(assess(s).issues.map((i) => i.kind)).toEqual(['short'])
  })
  it('still calls carbon short in CH3− while its lone pair is missing', () => {
    // CH3− needs 8 electrons; with carbon at 6 the board holds 6, and the count is wrong first
    const sp = speciesOf(ex('CH3-'))
    expect(assess(CH3, sp).issues.map((i) => i.kind)).toEqual(['electrons', 'short'])
  })
  it('does not pass CH3 with an electron alone on carbon', () => {
    const op = addElectron(CH3, CH3.atoms[0]!.id)
    if (!op.ok) throw new Error(op.why)
    expect(assess(op.s).complete).toBe(false)
    expect(assess(op.s, speciesOf(ex('CH3+'))).complete).toBe(false)
  })
  it('accepts boron at 6 in BF3 as before, and keeps the methyl cation drawable from scratch', () => {
    expect(assess(drawn('B', ['F', 'F', 'F'], [1, 1, 1], 0).s).issues).toEqual([])
    // the app's moves reach CH3+: take one electron off carbon, then bond the three hydrogens
    const b = star(['C', 'H', 'H', 'H'])
    const off = removeElectron(b.s, b.ids[0]!)
    if (!off.ok) throw new Error(off.why)
    let s = off.s
    for (const h of b.ids.slice(1)) {
      const op = share(s, b.ids[0]!, h)
      if (!op.ok) throw new Error(op.why)
      s = op.s
    }
    expect(assess(s, speciesOf(ex('CH3+'))).complete).toBe(true)
  })
})
