import { describe, expect, it } from 'vitest'
import { assess } from '../src/chem/assess'
import { PROBLEMS, atomsOf, chargeLabel, formulaHtml, formulaText, neutralElectrons, speciesOf, totalElectrons } from '../src/chem/problems'
import { bestStructures, solveStar } from '../src/chem/solve'
import { solveLikeAStudent } from './helpers'
import { shapeOf } from '../src/chem/vsepr'

/** Valence electron totals worked by hand from group numbers and charge. */
const TOTALS: Record<string, number> = {
  CH4: 8, NH3: 8, H2O: 8, CO2: 16, CH2O: 12, HCN: 10, 'NH4+': 8, 'NO2-': 18, 'CO3 2-': 24,
  BF3: 24, PCl5: 40, SF4: 34, ClF3: 28, XeF2: 22, SF6: 48, BrF5: 42, XeF4: 36,
  SO2: 18, 'SO4 2-': 32, 'PO4 3-': 32,
}
/** Problems where formal charge calls for more than 8 electrons on the middle atom. */
const EXPANDED_BY_CHARGE = ['SO2', 'SO4 2-', 'PO4 3-']

describe('the guided problems', () => {
  it('has unique ids and a center that is in the formula exactly once (or is the only element)', () => {
    expect(new Set(PROBLEMS.map((p) => p.id)).size).toBe(PROBLEMS.length)
    for (const p of PROBLEMS) {
      const n = p.formula.find(([el]) => el === p.center)?.[1]
      expect(n, p.id).toBe(1)
    }
  })

  for (const p of PROBLEMS) {
    describe(p.id, () => {
      it('counts its valence electrons', () => {
        expect(totalElectrons(p)).toBe(TOTALS[p.id])
        expect(neutralElectrons(p) - p.charge).toBe(TOTALS[p.id])
      })
      it('has an accepted structure, and the two conventions differ only where formal charge expands the octet', () => {
        const sp = speciesOf(p)
        const ref = solveStar(sp.center, sp.terminals, sp.charge)
        expect(ref).not.toBeNull()
        expect(bestStructures(ref!).length).toBeGreaterThan(0)
        expect(ref!.sameAnswer).toBe(!EXPANDED_BY_CHARGE.includes(p.id))
        expect(ref!.total).toBe(TOTALS[p.id])
      })
      it('can be solved with the app’s moves, and the result has the listed shape', () => {
        const s = solveLikeAStudent(p.id)
        const a = assess(s, speciesOf(p))
        expect(a.issues).toEqual([])
        expect(a.charge).toBe(p.charge)
        expect(s.atoms.map((x) => x.el).sort()).toEqual(atomsOf(p).sort())
        expect(shapeOf(s)?.shape).toBe(p.shape)
      })
    })
  }

  it('solves the three expanded-octet problems to the drawing with the smallest formal charges', () => {
    const shell = (id: string) => {
      const s = solveLikeAStudent(id)
      const a = assess(s, speciesOf(PROBLEMS.find((p) => p.id === id)!))
      return { center: a.atoms[0]!.count, charges: a.atoms.map((x) => x.fc), orders: s.bonds.map((b) => b.order).sort() }
    }
    // sulfur dioxide: two double bonds, sulfur at 10, every formal charge 0
    expect(shell('SO2')).toEqual({ center: 10, charges: [0, 0, 0], orders: [2, 2] })
    // sulfate: two double bonds and two single bonds, sulfur at 12, −1 on the two single-bonded oxygens
    const so4 = shell('SO4 2-')
    expect(so4.center).toBe(12)
    expect(so4.orders).toEqual([1, 1, 2, 2])
    expect([...so4.charges].sort()).toEqual([-1, -1, 0, 0, 0])
    // phosphate: one double bond, phosphorus at 10, −1 on three oxygens
    const po4 = shell('PO4 3-')
    expect(po4.center).toBe(10)
    expect(po4.orders).toEqual([1, 1, 1, 2])
    expect([...po4.charges].sort()).toEqual([-1, -1, -1, 0, 0])
  })

  it('writes formulas with subscripts and charges', () => {
    const byId = (id: string) => PROBLEMS.find((p) => p.id === id)!
    expect(formulaHtml(byId('CH4'))).toBe('CH<sub>4</sub>')
    expect(formulaHtml(byId('H2O'))).toBe('H<sub>2</sub>O')
    expect(formulaHtml(byId('NH4+'))).toBe('NH<sub>4</sub><sup>+</sup>')
    expect(formulaHtml(byId('CO3 2-'))).toBe('CO<sub>3</sub><sup>2−</sup>')
    expect(formulaText(byId('CO3 2-'))).toBe('CO3 2−')
    expect(chargeLabel(-1)).toBe('−')
    expect(chargeLabel(0)).toBe('')
  })
})
