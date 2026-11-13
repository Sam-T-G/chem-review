// The guided problems, in teaching order. Each one has a single center atom.
import type { Species } from './assess'
import { ELEMENTS, type El } from './elements'
import type { ShapeName } from './vsepr'

export interface Problem {
  id: string
  /** The formula as written, element by element. */
  formula: [El, number][]
  charge: number
  center: El
  /** Lowercase name, used inside sentences. */
  name: string
  group: ProblemGroup
  /** The shape the finished molecule has. Checked against the engine in tests/problems.test.ts. */
  shape: ShapeName
}

export type ProblemGroup = 'Single bonds' | 'Double and triple bonds' | 'Ions' | 'Fewer or more than 8 electrons' | 'Expanded octets with double bonds'
export const GROUPS: ProblemGroup[] = ['Single bonds', 'Double and triple bonds', 'Ions', 'Fewer or more than 8 electrons', 'Expanded octets with double bonds']

export const PROBLEMS: Problem[] = [
  { id: 'CH4', formula: [['C', 1], ['H', 4]], charge: 0, center: 'C', name: 'methane', group: 'Single bonds', shape: 'tetrahedral' },
  { id: 'NH3', formula: [['N', 1], ['H', 3]], charge: 0, center: 'N', name: 'ammonia', group: 'Single bonds', shape: 'trigonal pyramidal' },
  { id: 'H2O', formula: [['H', 2], ['O', 1]], charge: 0, center: 'O', name: 'water', group: 'Single bonds', shape: 'bent' },
  { id: 'CO2', formula: [['C', 1], ['O', 2]], charge: 0, center: 'C', name: 'carbon dioxide', group: 'Double and triple bonds', shape: 'linear' },
  { id: 'CH2O', formula: [['C', 1], ['H', 2], ['O', 1]], charge: 0, center: 'C', name: 'formaldehyde', group: 'Double and triple bonds', shape: 'trigonal planar' },
  { id: 'HCN', formula: [['H', 1], ['C', 1], ['N', 1]], charge: 0, center: 'C', name: 'hydrogen cyanide', group: 'Double and triple bonds', shape: 'linear' },
  { id: 'NH4+', formula: [['N', 1], ['H', 4]], charge: 1, center: 'N', name: 'the ammonium ion', group: 'Ions', shape: 'tetrahedral' },
  { id: 'NO2-', formula: [['N', 1], ['O', 2]], charge: -1, center: 'N', name: 'the nitrite ion', group: 'Ions', shape: 'bent' },
  { id: 'CO3 2-', formula: [['C', 1], ['O', 3]], charge: -2, center: 'C', name: 'the carbonate ion', group: 'Ions', shape: 'trigonal planar' },
  { id: 'BF3', formula: [['B', 1], ['F', 3]], charge: 0, center: 'B', name: 'boron trifluoride', group: 'Fewer or more than 8 electrons', shape: 'trigonal planar' },
  { id: 'PCl5', formula: [['P', 1], ['Cl', 5]], charge: 0, center: 'P', name: 'phosphorus pentachloride', group: 'Fewer or more than 8 electrons', shape: 'trigonal bipyramidal' },
  { id: 'SF4', formula: [['S', 1], ['F', 4]], charge: 0, center: 'S', name: 'sulfur tetrafluoride', group: 'Fewer or more than 8 electrons', shape: 'seesaw' },
  { id: 'ClF3', formula: [['Cl', 1], ['F', 3]], charge: 0, center: 'Cl', name: 'chlorine trifluoride', group: 'Fewer or more than 8 electrons', shape: 'T-shaped' },
  { id: 'XeF2', formula: [['Xe', 1], ['F', 2]], charge: 0, center: 'Xe', name: 'xenon difluoride', group: 'Fewer or more than 8 electrons', shape: 'linear' },
  { id: 'SF6', formula: [['S', 1], ['F', 6]], charge: 0, center: 'S', name: 'sulfur hexafluoride', group: 'Fewer or more than 8 electrons', shape: 'octahedral' },
  { id: 'BrF5', formula: [['Br', 1], ['F', 5]], charge: 0, center: 'Br', name: 'bromine pentafluoride', group: 'Fewer or more than 8 electrons', shape: 'square pyramidal' },
  { id: 'XeF4', formula: [['Xe', 1], ['F', 4]], charge: 0, center: 'Xe', name: 'xenon tetrafluoride', group: 'Fewer or more than 8 electrons', shape: 'square planar' },
  // Formal charge decides these three: sulfur and phosphorus take more than 8 so the charges get smaller.
  { id: 'SO2', formula: [['S', 1], ['O', 2]], charge: 0, center: 'S', name: 'sulfur dioxide', group: 'Expanded octets with double bonds', shape: 'bent' },
  { id: 'SO4 2-', formula: [['S', 1], ['O', 4]], charge: -2, center: 'S', name: 'the sulfate ion', group: 'Expanded octets with double bonds', shape: 'tetrahedral' },
  { id: 'PO4 3-', formula: [['P', 1], ['O', 4]], charge: -3, center: 'P', name: 'the phosphate ion', group: 'Expanded octets with double bonds', shape: 'tetrahedral' },
]

/** Every atom of the problem, one entry per atom, in formula order. */
export function atomsOf(p: Problem): El[] {
  return p.formula.flatMap(([el, n]) => new Array<El>(n).fill(el))
}

export function speciesOf(p: Problem): Species {
  const atoms = atomsOf(p)
  const at = atoms.indexOf(p.center)
  return { center: p.center, terminals: atoms.filter((_, i) => i !== at), charge: p.charge }
}

/** Valence electrons of the neutral atoms, before the charge is counted. */
export function neutralElectrons(p: Problem): number {
  return p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].valence * k, 0)
}
/** Valence electrons of the species: the neutral atoms' count, minus the charge. */
export function totalElectrons(p: Problem): number {
  return neutralElectrons(p) - p.charge
}

/** "2−", "+", "" the way a charge is written after a formula. */
export function chargeLabel(charge: number): string {
  if (charge === 0) return ''
  const n = Math.abs(charge)
  return `${n === 1 ? '' : n}${charge > 0 ? '+' : '−'}`
}
/** "1+", "2−": the way a charge is named in a sentence. */
export function chargeWord(charge: number): string {
  return `${Math.abs(charge)}${charge > 0 ? '+' : '−'}`
}

/** The formula as HTML with subscripts and the charge as a superscript. */
export function formulaHtml(p: Pick<Problem, 'formula' | 'charge'>): string {
  const body = p.formula.map(([el, n]) => `${el}${n > 1 ? `<sub>${n}</sub>` : ''}`).join('')
  return p.charge === 0 ? body : `${body}<sup>${chargeLabel(p.charge)}</sup>`
}
/** The formula as plain text for labels read by screen readers: "CO3 2−". */
export function formulaText(p: Pick<Problem, 'formula' | 'charge'>): string {
  const body = p.formula.map(([el, n]) => `${el}${n > 1 ? n : ''}`).join('')
  return p.charge === 0 ? body : `${body} ${chargeWord(p.charge)}`
}
