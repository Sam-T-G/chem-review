import { describe, expect, it } from 'vitest'
import type { El } from '../src/chem/elements'
import { solveStar, type StarSolution } from '../src/chem/solve'

/** One row per species: the accepted Lewis structure, written down from the textbook rules
 *  (OpenStax Chemistry 2e, 7.3 and 7.4), not from this code. Terminals are `El:order:lone`. */
interface Row {
  name: string
  center: El
  terminals: El[]
  charge: number
  total: number
  centerLone: number
  terms: string[] // sorted
  fcCenter: number
  forms: number // resonance forms with this pattern
}
const ROWS: Row[] = [
  { name: 'CH4', center: 'C', terminals: ['H', 'H', 'H', 'H'], charge: 0, total: 8, centerLone: 0, terms: ['H:1:0', 'H:1:0', 'H:1:0', 'H:1:0'], fcCenter: 0, forms: 1 },
  { name: 'NH3', center: 'N', terminals: ['H', 'H', 'H'], charge: 0, total: 8, centerLone: 2, terms: ['H:1:0', 'H:1:0', 'H:1:0'], fcCenter: 0, forms: 1 },
  { name: 'H2O', center: 'O', terminals: ['H', 'H'], charge: 0, total: 8, centerLone: 4, terms: ['H:1:0', 'H:1:0'], fcCenter: 0, forms: 1 },
  { name: 'HF', center: 'F', terminals: ['H'], charge: 0, total: 8, centerLone: 6, terms: ['H:1:0'], fcCenter: 0, forms: 1 },
  { name: 'H2', center: 'H', terminals: ['H'], charge: 0, total: 2, centerLone: 0, terms: ['H:1:0'], fcCenter: 0, forms: 1 },
  { name: 'F2', center: 'F', terminals: ['F'], charge: 0, total: 14, centerLone: 6, terms: ['F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'O2', center: 'O', terminals: ['O'], charge: 0, total: 12, centerLone: 4, terms: ['O:2:4'], fcCenter: 0, forms: 1 },
  { name: 'N2', center: 'N', terminals: ['N'], charge: 0, total: 10, centerLone: 2, terms: ['N:3:2'], fcCenter: 0, forms: 1 },
  { name: 'CO', center: 'C', terminals: ['O'], charge: 0, total: 10, centerLone: 2, terms: ['O:3:2'], fcCenter: -1, forms: 1 },
  { name: 'CO2', center: 'C', terminals: ['O', 'O'], charge: 0, total: 16, centerLone: 0, terms: ['O:2:4', 'O:2:4'], fcCenter: 0, forms: 1 },
  { name: 'HCN', center: 'C', terminals: ['H', 'N'], charge: 0, total: 10, centerLone: 0, terms: ['H:1:0', 'N:3:2'], fcCenter: 0, forms: 1 },
  { name: 'CH2O', center: 'C', terminals: ['H', 'H', 'O'], charge: 0, total: 12, centerLone: 0, terms: ['H:1:0', 'H:1:0', 'O:2:4'], fcCenter: 0, forms: 1 },
  { name: 'BF3', center: 'B', terminals: ['F', 'F', 'F'], charge: 0, total: 24, centerLone: 0, terms: ['F:1:6', 'F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'BeCl2', center: 'Be', terminals: ['Cl', 'Cl'], charge: 0, total: 16, centerLone: 0, terms: ['Cl:1:6', 'Cl:1:6'], fcCenter: 0, forms: 1 },
  { name: 'NH4+', center: 'N', terminals: ['H', 'H', 'H', 'H'], charge: 1, total: 8, centerLone: 0, terms: ['H:1:0', 'H:1:0', 'H:1:0', 'H:1:0'], fcCenter: 1, forms: 1 },
  { name: 'H3O+', center: 'O', terminals: ['H', 'H', 'H'], charge: 1, total: 8, centerLone: 2, terms: ['H:1:0', 'H:1:0', 'H:1:0'], fcCenter: 1, forms: 1 },
  { name: 'O3', center: 'O', terminals: ['O', 'O'], charge: 0, total: 18, centerLone: 2, terms: ['O:1:6', 'O:2:4'], fcCenter: 1, forms: 2 },
  { name: 'NO2-', center: 'N', terminals: ['O', 'O'], charge: -1, total: 18, centerLone: 2, terms: ['O:1:6', 'O:2:4'], fcCenter: 0, forms: 2 },
  { name: 'NO2+', center: 'N', terminals: ['O', 'O'], charge: 1, total: 16, centerLone: 0, terms: ['O:2:4', 'O:2:4'], fcCenter: 1, forms: 1 },
  { name: 'CO3 2-', center: 'C', terminals: ['O', 'O', 'O'], charge: -2, total: 24, centerLone: 0, terms: ['O:1:6', 'O:1:6', 'O:2:4'], fcCenter: 0, forms: 3 },
  { name: 'NO3-', center: 'N', terminals: ['O', 'O', 'O'], charge: -1, total: 24, centerLone: 0, terms: ['O:1:6', 'O:1:6', 'O:2:4'], fcCenter: 1, forms: 3 },
  { name: 'N3-', center: 'N', terminals: ['N', 'N'], charge: -1, total: 16, centerLone: 0, terms: ['N:2:4', 'N:2:4'], fcCenter: 1, forms: 1 },
  { name: 'OCN-', center: 'C', terminals: ['O', 'N'], charge: -1, total: 16, centerLone: 0, terms: ['N:3:2', 'O:1:6'], fcCenter: 0, forms: 1 },
  { name: 'PCl5', center: 'P', terminals: ['Cl', 'Cl', 'Cl', 'Cl', 'Cl'], charge: 0, total: 40, centerLone: 0, terms: ['Cl:1:6', 'Cl:1:6', 'Cl:1:6', 'Cl:1:6', 'Cl:1:6'], fcCenter: 0, forms: 1 },
  { name: 'SF6', center: 'S', terminals: ['F', 'F', 'F', 'F', 'F', 'F'], charge: 0, total: 48, centerLone: 0, terms: ['F:1:6', 'F:1:6', 'F:1:6', 'F:1:6', 'F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'SF4', center: 'S', terminals: ['F', 'F', 'F', 'F'], charge: 0, total: 34, centerLone: 2, terms: ['F:1:6', 'F:1:6', 'F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'ClF3', center: 'Cl', terminals: ['F', 'F', 'F'], charge: 0, total: 28, centerLone: 4, terms: ['F:1:6', 'F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'XeF2', center: 'Xe', terminals: ['F', 'F'], charge: 0, total: 22, centerLone: 6, terms: ['F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'XeF4', center: 'Xe', terminals: ['F', 'F', 'F', 'F'], charge: 0, total: 36, centerLone: 4, terms: ['F:1:6', 'F:1:6', 'F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'BrF5', center: 'Br', terminals: ['F', 'F', 'F', 'F', 'F'], charge: 0, total: 42, centerLone: 2, terms: ['F:1:6', 'F:1:6', 'F:1:6', 'F:1:6', 'F:1:6'], fcCenter: 0, forms: 1 },
  { name: 'I3-', center: 'I', terminals: ['I', 'I'], charge: -1, total: 22, centerLone: 6, terms: ['I:1:6', 'I:1:6'], fcCenter: -1, forms: 1 },
]

function termStrings(sol: StarSolution, terminals: El[]): string[] {
  return terminals.map((el, i) => `${el}:${sol.orders[i]}:${sol.termLone[i]}`).sort()
}

describe('solveStar: the accepted Lewis structure for one center atom', () => {
  for (const row of ROWS) {
    it(row.name, () => {
      const ref = solveStar(row.center, row.terminals, row.charge)
      expect(ref, 'has a reference').not.toBeNull()
      if (!ref) return
      expect(ref.total).toBe(row.total)
      expect(ref.octet).toHaveLength(row.forms)
      for (const sol of ref.octet) {
        expect(sol.centerLone).toBe(row.centerLone)
        expect(termStrings(sol, row.terminals)).toEqual(row.terms)
        expect(sol.fcCenter).toBe(row.fcCenter)
        // every electron is accounted for
        const placed = sol.centerLone + sol.termLone.reduce((a, b) => a + b, 0) + 2 * sol.orders.reduce((a, b) => a + b, 0)
        expect(placed).toBe(row.total)
        // formal charges add up to the charge of the species
        expect(sol.fcCenter + sol.fcTerm.reduce((a, b) => a + b, 0)).toBe(row.charge)
      }
      // for these species the two conventions agree
      expect(ref.sameAnswer).toBe(true)
    })
  }

  it('SO2: keeps sulfur at 8 under the octet rule, and reaches 10 when formal charges come first', () => {
    const ref = solveStar('S', ['O', 'O'], 0)!
    expect(ref.sameAnswer).toBe(false)
    expect(ref.octet).toHaveLength(2)
    expect(ref.octet[0]!.centerCount).toBe(8)
    expect(ref.octet[0]!.fcCenter).toBe(1)
    expect(ref.charge).toHaveLength(1)
    expect(ref.charge[0]!.orders).toEqual([2, 2])
    expect(ref.charge[0]!.centerCount).toBe(10)
    expect(ref.charge[0]!.sumAbs).toBe(0)
  })

  it('SO4 2-: four single bonds under the octet rule, two double bonds when formal charges come first', () => {
    const ref = solveStar('S', ['O', 'O', 'O', 'O'], -2)!
    expect(ref.total).toBe(32)
    expect(ref.octet).toHaveLength(1)
    expect(ref.octet[0]!.orders).toEqual([1, 1, 1, 1])
    expect(ref.octet[0]!.fcCenter).toBe(2)
    expect(ref.charge.every((sol) => sol.orders.filter((o) => o === 2).length === 2)).toBe(true)
    expect(ref.charge).toHaveLength(6)
    expect(ref.charge[0]!.sumAbs).toBe(2)
  })

  it('has no reference for an odd number of electrons (NO, 11)', () => {
    expect(solveStar('N', ['O'], 0)).toBeNull()
  })

  it('never puts more than 8 electrons on a period 2 center', () => {
    for (const row of ROWS) {
      const ref = solveStar(row.center, row.terminals, row.charge)!
      if (['B', 'Be', 'C', 'N', 'O', 'F'].includes(row.center)) {
        for (const sol of [...ref.octet, ...ref.charge]) expect(sol.centerCount, row.name).toBeLessThanOrEqual(8)
      }
    }
  })
})
