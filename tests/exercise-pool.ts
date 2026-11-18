// Shared by the exercise tests: the molecules the tests work, and their answers worked by hand.
//
// The pool in src/chem/exercises.ts is being written by the chem team at the same time, so the
// tests run over that pool and over this list: the 20 molecules of the class worksheet and eight
// molecules of two atoms. Each row is worked by hand with the rules in docs/chemistry/sources.md:
// OpenStax Chemistry 2e 7.3 and 7.4 for the count and the structure, 7.6 for the geometries and
// angles, and the course's chapter 7 slides and electronegativity table for ΔEN and polarity
// (0.4 or less is nonpolar). None of it is copied from what the code returns, and none of it comes
// from the handwritten cells on the worksheet photos.
import { EXERCISES } from '../src/chem/exercises'
import type { El } from '../src/chem/elements'
import type { Problem } from '../src/chem/problems'
import type { Geometry, ShapeName } from '../src/chem/vsepr'

export interface Worked {
  id: string
  formula: [El, number][]
  charge: number
  center: El
  name: string
  total: number
  resonance: boolean
  eg: Geometry
  mg: ShapeName
  /** The shape table's text, or 'none' for two atoms. */
  angle: string
  /** ΔEN for each outer element, as printed, and whether that bond is polar. */
  bonds: Record<string, [string, boolean]>
  /** Polar, or for an ion: the bond dipoles do not cancel. */
  polar: boolean
  /** The pick for the net dipole's direction, or null when there is none. */
  dir: string | null
}

const w = (id: string, formula: [El, number][], charge: number, center: El, name: string, total: number, resonance: boolean, eg: Geometry, mg: ShapeName, angle: string, bonds: Record<string, [string, boolean]>, polar: boolean, dir: string | null): Worked => ({
  id, formula, charge, center, name, total, resonance, eg, mg, angle, bonds, polar, dir,
})

export const WORKED: Worked[] = [
  // the example row the instructor printed: 8, tetrahedral, bent, less than 109.5, O–H 1.4, polar
  w('H2O', [['H', 2], ['O', 1]], 0, 'O', 'water', 8, false, 'tetrahedral', 'bent', 'less than 109.5°', { H: ['1.4', true] }, true, 'toward the 2 lone pairs'),
  // C–H 2.5 − 2.1 = 0.4 is nonpolar, C–Cl 3.0 − 2.5 = 0.5 is polar, so only the chlorines pull
  w('CH2Cl2', [['C', 1], ['H', 2], ['Cl', 2]], 0, 'C', 'dichloromethane', 20, false, 'tetrahedral', 'tetrahedral', '109.5°', { H: ['0.4', false], Cl: ['0.5', true] }, true, 'toward the 2 chlorine atoms'),
  w('SiCl4', [['Si', 1], ['Cl', 4]], 0, 'Si', 'silicon tetrachloride', 32, false, 'tetrahedral', 'tetrahedral', '109.5°', { Cl: ['1.2', true] }, false, null),
  w('BF3', [['B', 1], ['F', 3]], 0, 'B', 'boron trifluoride', 24, false, 'trigonal planar', 'trigonal planar', '120°', { F: ['2.0', true] }, false, null),
  w('PCl3', [['P', 1], ['Cl', 3]], 0, 'P', 'phosphorus trichloride', 26, false, 'tetrahedral', 'trigonal pyramidal', 'less than 109.5°', { Cl: ['0.9', true] }, true, 'toward the 3 chlorine atoms'),
  w('PCl5', [['P', 1], ['Cl', 5]], 0, 'P', 'phosphorus pentachloride', 40, false, 'trigonal bipyramidal', 'trigonal bipyramidal', '90° and 120°', { Cl: ['0.9', true] }, false, null),
  w('CH3-', [['C', 1], ['H', 3]], -1, 'C', 'the methyl anion', 8, false, 'tetrahedral', 'trigonal pyramidal', 'less than 109.5°', { H: ['0.4', false] }, false, null),
  w('SF6', [['S', 1], ['F', 6]], 0, 'S', 'sulfur hexafluoride', 48, false, 'octahedral', 'octahedral', '90°', { F: ['1.5', true] }, false, null),
  w('SiCl6 2-', [['Si', 1], ['Cl', 6]], -2, 'Si', 'the hexachlorosilicate ion', 48, false, 'octahedral', 'octahedral', '90°', { Cl: ['1.2', true] }, false, null),
  w('SCl2', [['S', 1], ['Cl', 2]], 0, 'S', 'sulfur dichloride', 20, false, 'tetrahedral', 'bent', 'less than 109.5°', { Cl: ['0.5', true] }, true, 'toward the 2 chlorine atoms'),
  // seesaw: the two axial Se–Cl dipoles cancel, the two equatorial ones add up on the side away from the lone pair
  w('SeCl4', [['Se', 1], ['Cl', 4]], 0, 'Se', 'selenium tetrachloride', 34, false, 'trigonal bipyramidal', 'seesaw', 'less than 90° and less than 120°', { Cl: ['0.6', true] }, true, 'toward the 4 chlorine atoms'),
  w('CH3+', [['C', 1], ['H', 3]], 1, 'C', 'the methyl cation', 6, false, 'trigonal planar', 'trigonal planar', '120°', { H: ['0.4', false] }, false, null),
  // square pyramidal: the 4 base dipoles cancel, the top I–Cl dipole points at its chlorine
  w('ICl5', [['I', 1], ['Cl', 5]], 0, 'I', 'iodine pentachloride', 42, false, 'octahedral', 'square pyramidal', 'less than 90°', { Cl: ['0.5', true] }, true, 'toward the 5 chlorine atoms'),
  w('IF', [['I', 1], ['F', 1]], 0, 'I', 'iodine monofluoride', 14, false, 'linear', 'linear', 'none', { F: ['1.5', true] }, true, 'from iodine toward fluorine'),
  w('ICl2-', [['I', 1], ['Cl', 2]], -1, 'I', 'the dichloroiodate ion', 22, false, 'trigonal bipyramidal', 'linear', '180°', { Cl: ['0.5', true] }, false, null),
  // T-shaped: the two axial dipoles cancel and the equatorial one is left
  w('ICl3', [['I', 1], ['Cl', 3]], 0, 'I', 'iodine trichloride', 28, false, 'trigonal bipyramidal', 'T-shaped', 'less than 90°', { Cl: ['0.5', true] }, true, 'toward the 3 chlorine atoms'),
  w('CO3 2-', [['C', 1], ['O', 3]], -2, 'C', 'the carbonate ion', 24, true, 'trigonal planar', 'trigonal planar', '120°', { O: ['1.0', true] }, false, null),
  // the slides' odd case: ΔEN 0, and the formal charges (+1 in the middle) still make the bonds polar
  w('O3', [['O', 3]], 0, 'O', 'ozone', 18, true, 'trigonal planar', 'bent', 'less than 120°', { O: ['0.0', true] }, true, 'toward the 2 oxygen atoms'),
  w('XeF4', [['Xe', 1], ['F', 4]], 0, 'Xe', 'xenon tetrafluoride', 36, false, 'octahedral', 'square planar', '90°', { F: ['1.4', true] }, false, null),
  // two atoms: no middle atom, both geometries linear, no bond angle
  w('HCl', [['H', 1], ['Cl', 1]], 0, 'H', 'hydrogen chloride', 8, false, 'linear', 'linear', 'none', { Cl: ['0.9', true] }, true, 'from hydrogen toward chlorine'),
  // the second atom in the middle slot this time, as the pool may name either one
  w('HF', [['H', 1], ['F', 1]], 0, 'F', 'hydrogen fluoride', 8, false, 'linear', 'linear', 'none', { H: ['1.9', true] }, true, 'from hydrogen toward fluorine'),
  w('HBr', [['H', 1], ['Br', 1]], 0, 'Br', 'hydrogen bromide', 8, false, 'linear', 'linear', 'none', { H: ['0.7', true] }, true, 'from hydrogen toward bromine'),
  w('F2', [['F', 2]], 0, 'F', 'fluorine', 14, false, 'linear', 'linear', 'none', { F: ['0.0', false] }, false, null),
  w('Cl2', [['Cl', 2]], 0, 'Cl', 'chlorine', 14, false, 'linear', 'linear', 'none', { Cl: ['0.0', false] }, false, null),
  w('Br2', [['Br', 2]], 0, 'Br', 'bromine', 14, false, 'linear', 'linear', 'none', { Br: ['0.0', false] }, false, null),
  w('N2', [['N', 2]], 0, 'N', 'nitrogen', 10, false, 'linear', 'linear', 'none', { N: ['0.0', false] }, false, null),
  w('O2', [['O', 2]], 0, 'O', 'oxygen', 12, false, 'linear', 'linear', 'none', { O: ['0.0', false] }, false, null),
  // P–H 2.1 − 2.1 = 0.0: no polar bond, so nothing to add up
  w('PH2-', [['P', 1], ['H', 2]], -1, 'P', 'the phosphanide ion', 8, false, 'tetrahedral', 'bent', 'less than 109.5°', { H: ['0.0', false] }, false, null),
]

/** Worked by hand, where the engine gives another answer today. Each one is a finding for the chem
 *  team; tests/exercise.test.ts checks that the disagreement is still there, so a row moves into
 *  WORKED the day the engine changes. Empty since 2026-11-17: PH2− was here until polarity.ts kept
 *  the formal-charge rule to bonds between two atoms of one element (ozone), and it is in WORKED now. */
export const ENGINE_GAPS: Worked[] = []

/** A worked molecule as a pool entry. The group and shape fields are filled in only so that it
 *  has the pool's type; nothing in the exercises reads them (or the electron geometry). */
export const asProblem = (x: Worked): Problem => ({ id: x.id, formula: x.formula, charge: x.charge, center: x.center, name: x.name, group: 'Single bonds', shape: x.mg, geometry: x.eg }) as unknown as Problem

/** Every molecule the exercise tests run over: the pool as it is in this checkout, and the worked list. */
export const ALL: Problem[] = [...EXERCISES, ...[...WORKED, ...ENGINE_GAPS].filter((x) => !EXERCISES.some((p) => p.id === x.id)).map(asProblem)]
