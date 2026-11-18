// The exercise pool: molecules and ions a student works without the guided steps. Each one has a
// single center atom or is a molecule of two atoms. Same shape as a guided problem, so the same
// engine functions and the same words work on both lists.
//
// The first set is the class worksheet's 20 molecules in the sheet's order (Sam's ask, D-0030). Six of them are
// also guided problems, and those six are the same objects as in PROBLEMS. Every answer the pool
// implies (electron count, drawing, both geometries, bond angle, ΔEN, polarity, resonance) is worked
// by hand in tests/exercises.test.ts from the sources in docs/chemistry/sources.md (D-0032).
import { bestStructures, signatureOf, solveStar } from './solve'
import { PROBLEMS, speciesOf, type Problem } from './problems'
import type { Structure } from './structure'

const guided = (id: string): Problem => {
  const p = PROBLEMS.find((x) => x.id === id)
  if (!p) throw new Error(`no guided problem ${id}`)
  return p
}

/** The class worksheet, in the sheet's order. */
const SHEET: Problem[] = [
  guided('H2O'),
  { id: 'CH2Cl2', formula: [['C', 1], ['H', 2], ['Cl', 2]], charge: 0, center: 'C', name: 'dichloromethane', group: 'Single bonds', geometry: 'tetrahedral', shape: 'tetrahedral' },
  { id: 'SiCl4', formula: [['Si', 1], ['Cl', 4]], charge: 0, center: 'Si', name: 'silicon tetrachloride', group: 'Single bonds', geometry: 'tetrahedral', shape: 'tetrahedral' },
  guided('BF3'),
  { id: 'PCl3', formula: [['P', 1], ['Cl', 3]], charge: 0, center: 'P', name: 'phosphorus trichloride', group: 'Single bonds', geometry: 'tetrahedral', shape: 'trigonal pyramidal' },
  guided('PCl5'),
  { id: 'CH3-', formula: [['C', 1], ['H', 3]], charge: -1, center: 'C', name: 'the methyl anion', group: 'Ions', geometry: 'tetrahedral', shape: 'trigonal pyramidal' },
  guided('SF6'),
  { id: 'SiCl6 2-', formula: [['Si', 1], ['Cl', 6]], charge: -2, center: 'Si', name: 'the hexachlorosilicate ion', group: 'Fewer or more than 8 electrons', geometry: 'octahedral', shape: 'octahedral' },
  { id: 'SCl2', formula: [['S', 1], ['Cl', 2]], charge: 0, center: 'S', name: 'sulfur dichloride', group: 'Single bonds', geometry: 'tetrahedral', shape: 'bent' },
  { id: 'SeCl4', formula: [['Se', 1], ['Cl', 4]], charge: 0, center: 'Se', name: 'selenium tetrachloride', group: 'Fewer or more than 8 electrons', geometry: 'trigonal bipyramidal', shape: 'seesaw' },
  // 6 electrons in all: carbon keeps 6, like boron in BF3 (D-0032)
  { id: 'CH3+', formula: [['C', 1], ['H', 3]], charge: 1, center: 'C', name: 'the methyl cation', group: 'Fewer or more than 8 electrons', geometry: 'trigonal planar', shape: 'trigonal planar' },
  { id: 'ICl5', formula: [['I', 1], ['Cl', 5]], charge: 0, center: 'I', name: 'iodine pentachloride', group: 'Fewer or more than 8 electrons', geometry: 'octahedral', shape: 'square pyramidal' },
  { id: 'IF', formula: [['I', 1], ['F', 1]], charge: 0, center: 'I', name: 'iodine monofluoride', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'ICl2-', formula: [['I', 1], ['Cl', 2]], charge: -1, center: 'I', name: 'the dichloroiodate ion', group: 'Fewer or more than 8 electrons', geometry: 'trigonal bipyramidal', shape: 'linear' },
  { id: 'ICl3', formula: [['I', 1], ['Cl', 3]], charge: 0, center: 'I', name: 'iodine trichloride', group: 'Fewer or more than 8 electrons', geometry: 'trigonal bipyramidal', shape: 'T-shaped' },
  guided('CO3 2-'),
  { id: 'O3', formula: [['O', 3]], charge: 0, center: 'O', name: 'ozone', group: 'Double and triple bonds', geometry: 'trigonal planar', shape: 'bent' },
  guided('XeF4'),
  { id: 'PH2-', formula: [['P', 1], ['H', 2]], charge: -1, center: 'P', name: 'the phosphanide ion', group: 'Ions', geometry: 'tetrahedral', shape: 'bent' },
]

/** Molecules of two atoms besides IF. The center is the atom the board treats as the middle one: the atom
 *  that is not hydrogen. */
const TWO_ATOMS: Problem[] = [
  { id: 'HF', formula: [['H', 1], ['F', 1]], charge: 0, center: 'F', name: 'hydrogen fluoride', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'HCl', formula: [['H', 1], ['Cl', 1]], charge: 0, center: 'Cl', name: 'hydrogen chloride', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'HBr', formula: [['H', 1], ['Br', 1]], charge: 0, center: 'Br', name: 'hydrogen bromide', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'F2', formula: [['F', 2]], charge: 0, center: 'F', name: 'a fluorine molecule', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'Cl2', formula: [['Cl', 2]], charge: 0, center: 'Cl', name: 'a chlorine molecule', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'Br2', formula: [['Br', 2]], charge: 0, center: 'Br', name: 'a bromine molecule', group: 'Single bonds', geometry: 'linear', shape: 'linear' },
  { id: 'N2', formula: [['N', 2]], charge: 0, center: 'N', name: 'a nitrogen molecule', group: 'Double and triple bonds', geometry: 'linear', shape: 'linear' },
  { id: 'O2', formula: [['O', 2]], charge: 0, center: 'O', name: 'an oxygen molecule', group: 'Double and triple bonds', geometry: 'linear', shape: 'linear' },
]

const SINGLE: Problem[] = [
  { id: 'CCl4', formula: [['C', 1], ['Cl', 4]], charge: 0, center: 'C', name: 'carbon tetrachloride', group: 'Single bonds', geometry: 'tetrahedral', shape: 'tetrahedral' },
  { id: 'CHCl3', formula: [['C', 1], ['H', 1], ['Cl', 3]], charge: 0, center: 'C', name: 'chloroform', group: 'Single bonds', geometry: 'tetrahedral', shape: 'tetrahedral' },
  { id: 'NF3', formula: [['N', 1], ['F', 3]], charge: 0, center: 'N', name: 'nitrogen trifluoride', group: 'Single bonds', geometry: 'tetrahedral', shape: 'trigonal pyramidal' },
  { id: 'OF2', formula: [['O', 1], ['F', 2]], charge: 0, center: 'O', name: 'oxygen difluoride', group: 'Single bonds', geometry: 'tetrahedral', shape: 'bent' },
]

const DOUBLE: Problem[] = [
  { id: 'COCl2', formula: [['C', 1], ['O', 1], ['Cl', 2]], charge: 0, center: 'C', name: 'phosgene', group: 'Double and triple bonds', geometry: 'trigonal planar', shape: 'trigonal planar' },
  { id: 'CS2', formula: [['C', 1], ['S', 2]], charge: 0, center: 'C', name: 'carbon disulfide', group: 'Double and triple bonds', geometry: 'linear', shape: 'linear' },
  // formal charge first (D-0005): three S=O, sulfur at 12
  { id: 'SO3', formula: [['S', 1], ['O', 3]], charge: 0, center: 'S', name: 'sulfur trioxide', group: 'Expanded octets with double bonds', geometry: 'trigonal planar', shape: 'trigonal planar' },
]

const IONS: Problem[] = [
  { id: 'H3O+', formula: [['H', 3], ['O', 1]], charge: 1, center: 'O', name: 'the hydronium ion', group: 'Ions', geometry: 'tetrahedral', shape: 'trigonal pyramidal' },
  { id: 'NH2-', formula: [['N', 1], ['H', 2]], charge: -1, center: 'N', name: 'the amide ion', group: 'Ions', geometry: 'tetrahedral', shape: 'bent' },
  { id: 'NO3-', formula: [['N', 1], ['O', 3]], charge: -1, center: 'N', name: 'the nitrate ion', group: 'Ions', geometry: 'trigonal planar', shape: 'trigonal planar' },
  { id: 'BrF4-', formula: [['Br', 1], ['F', 4]], charge: -1, center: 'Br', name: 'the tetrafluorobromate ion', group: 'Ions', geometry: 'octahedral', shape: 'square planar' },
]

const NOT_EIGHT: Problem[] = [
  { id: 'BeCl2', formula: [['Be', 1], ['Cl', 2]], charge: 0, center: 'Be', name: 'beryllium chloride', group: 'Fewer or more than 8 electrons', geometry: 'linear', shape: 'linear' },
  { id: 'BCl3', formula: [['B', 1], ['Cl', 3]], charge: 0, center: 'B', name: 'boron trichloride', group: 'Fewer or more than 8 electrons', geometry: 'trigonal planar', shape: 'trigonal planar' },
  { id: 'AsF5', formula: [['As', 1], ['F', 5]], charge: 0, center: 'As', name: 'arsenic pentafluoride', group: 'Fewer or more than 8 electrons', geometry: 'trigonal bipyramidal', shape: 'trigonal bipyramidal' },
  { id: 'ClF5', formula: [['Cl', 1], ['F', 5]], charge: 0, center: 'Cl', name: 'chlorine pentafluoride', group: 'Fewer or more than 8 electrons', geometry: 'octahedral', shape: 'square pyramidal' },
]

/** A named group of exercises, for the list a student picks from. Every exercise is in exactly one set. */
export interface ExerciseSet {
  id: string
  title: string
  /** Ids of its exercises, in the order they are listed. */
  ids: string[]
}

const SETS: [ExerciseSet['id'], ExerciseSet['title'], Problem[]][] = [
  ['sheet', 'From the class worksheet', SHEET],
  ['two-atoms', 'Molecules with two atoms', TWO_ATOMS],
  ['single-bonds', 'Single bonds', SINGLE],
  ['double-bonds', 'Double bonds', DOUBLE],
  ['ions', 'Ions', IONS],
  ['not-eight', 'Fewer or more than 8 electrons', NOT_EIGHT],
]

/** Every exercise, each once, in the order of its set. */
export const EXERCISES: Problem[] = SETS.flatMap(([, , list]) => list)

/** The first set is the class worksheet (id `sheet`), in the sheet's order. The second is the molecules of two
 *  atoms. */
export const EXERCISE_SETS: ExerciseSet[] = SETS.map(([id, title, list]) => ({ id, title, ids: list.map((p) => p.id) }))

/** True for a molecule of two atoms, which has no middle atom. */
export function isDiatomic(p: Pick<Problem, 'formula'>): boolean {
  return p.formula.reduce((n, [, k]) => n + k, 0) === 2
}

/** The finished Lewis structure of a problem, as the engine draws it: the center is atom `a1`
 *  and the outer atoms follow in formula order. For two atoms, `a1` is the atom the problem names
 *  as its center, and the drawing is the same whichever one that is. Null when the engine has no
 *  reference for it. Where there is resonance, this is the first of the drawings. */
export function referenceStructure(p: Problem): Structure | null {
  const sp = speciesOf(p)
  const ref = solveStar(sp.center, sp.terminals, sp.charge)
  const sol = ref ? bestStructures(ref)[0] : undefined
  if (!sol) return null
  const atoms = [{ id: 'a1', el: sp.center, lone: sol.centerLone }, ...sp.terminals.map((el, i) => ({ id: `a${i + 2}`, el, lone: sol.termLone[i]! }))]
  const bonds = sp.terminals.map((_, i) => ({ id: `a1-a${i + 2}`, a: 'a1', b: `a${i + 2}`, order: sol.orders[i]! }))
  return { atoms, bonds, seq: atoms.length + 1 }
}

/** True when the molecule has resonance: under the app's convention (D-0005) the engine finds more
 *  than one best drawing, each with the same bonds and charges moved to different outer atoms
 *  (ozone, carbonate). Under that convention sulfur dioxide has one drawing, so it has none. */
export function hasResonance(p: Problem): boolean {
  const sp = speciesOf(p)
  const ref = solveStar(sp.center, sp.terminals, sp.charge)
  const forms = ref ? bestStructures(ref) : []
  if (forms.length < 2) return false
  const first = signatureOf(sp.center, sp.terminals, forms[0]!)
  return forms.filter((f) => signatureOf(sp.center, sp.terminals, f) === first).length > 1
}
