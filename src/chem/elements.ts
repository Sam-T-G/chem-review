// Element facts for the atoms this demo can place. The numbers come from src/chem/elements.data.json,
// which scripts/gen-elements.mjs writes from Valence's validated periodic-table data (Pauling
// electronegativity from PubChem). Nothing here is typed in by hand except the shell rules below.
import data from './elements.data.json'

export type El = 'H' | 'Be' | 'B' | 'C' | 'N' | 'O' | 'F' | 'Al' | 'Si' | 'P' | 'S' | 'Cl' | 'As' | 'Se' | 'Br' | 'Kr' | 'I' | 'Xe'

export interface ElementInfo {
  symbol: El
  name: string
  z: number
  group: number
  period: number
  /** Electrons in the outer shell of the neutral atom. */
  valence: number
  /** Pauling electronegativity. */
  en: number | null
}

export const EL_ORDER: El[] = (data as ElementInfo[]).map((e) => e.symbol)
export const ELEMENTS = Object.fromEntries((data as ElementInfo[]).map((e) => [e.symbol, e])) as Record<El, ElementInfo>

export function element(el: El): ElementInfo {
  return ELEMENTS[el]
}

/** How many electrons each shell of the neutral atom holds, innermost first. The last entry is
 *  the outer shell (the valence electrons); the others are the core electrons (OpenStax
 *  Chemistry 2e, 6.4). For the main-group atoms here the inner shells are full: 2, 8, 18, 18. */
export function shellsOf(el: El): number[] {
  const e = ELEMENTS[el]
  return [...[2, 8, 18, 18].slice(0, e.period - 1), e.valence]
}

/** Electrons that fill the atom's outer shell in a Lewis structure.
 *  Hydrogen fills at 2. Beryllium (4), boron and aluminum (6) are the usual electron-deficient
 *  centers (OpenStax Chemistry 2e, 7.3). Every other atom here follows the octet rule. */
export function shellTarget(el: El): number {
  if (el === 'H') return 2
  if (el === 'Be') return 4
  if (el === 'B' || el === 'Al') return 6
  return 8
}

/** The most electrons the outer shell can hold on the board. Hydrogen holds 2 and period 2 atoms
 *  hold 8. Period 3 and below can go past 8 (PCl5, SF6); 16 is this demo's ceiling. */
export function shellMax(el: El): number {
  const p = ELEMENTS[el].period
  if (p === 1) return 2
  if (p === 2) return 8
  return 16
}

/** True when the atom may hold more than 8 electrons. */
export function canExpand(el: El): boolean {
  return ELEMENTS[el].period >= 3
}
