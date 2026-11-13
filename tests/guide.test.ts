import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ELEMENTS, EL_ORDER, type El } from '../src/chem/elements'
import { PROBLEMS, speciesOf, type Problem } from '../src/chem/problems'
import { addAtom, addElectron, removeElectron, share, type Structure } from '../src/chem/structure'
import { ALL_SHAPES } from '../src/chem/vsepr'
import {
  STEPS,
  bondInstruction,
  bondStatus,
  boardStepDone,
  checkGuidance,
  checkRows,
  countFeedback,
  finishedNotes,
  formalChargeSum,
  groupFacts,
  groupsFeedback,
  groupsRight,
  hintsFor,
  inventory,
  middleFeedback,
  middleNeeded,
  nextMove,
  refusalText,
  shapeChoices,
  shapeFeedback,
  shapeInfoFor,
  shapeReadout,
  titleOf,
  totalFeedback,
  totalSum,
} from '../src/modules/lewis/guide'
import { applyMove, nitrousOxide, solveLikeAStudent, star } from './helpers'

const P = (id: string): Problem => PROBLEMS.find((p) => p.id === id)!
const must = (op: ReturnType<typeof share>): Structure => {
  if (!op.ok) throw new Error(op.why)
  return op.s
}

describe('step 1: counting valence electrons', () => {
  it('names the atomic-number mix-up on the first miss', () => {
    expect(countFeedback('C', 6, 1)).toMatch(/6 is carbon's atomic number/)
    expect(countFeedback('O', 8, 1)).toMatch(/atomic number/)
    // hydrogen's atomic number equals its valence count, so 1 is never a mix-up; 2 just points at the table
    expect(countFeedback('H', 2, 1)).toMatch(/group on the periodic table/)
    expect(countFeedback('C', 0, 1)).toBe("Set a number for carbon. Find carbon's group on the periodic table.")
  })
  it('escalates: point at the table, then the group rule, then the answer', () => {
    expect(countFeedback('N', 3, 1)).toMatch(/Find nitrogen's group/)
    expect(countFeedback('N', 3, 2)).toBe('Nitrogen is in group 15. For groups 13 to 18, subtract 10 from the group number.')
    expect(countFeedback('H', 3, 2)).toBe('Hydrogen is in group 1. In groups 1 and 2, the group number is the number of valence electrons.')
    expect(countFeedback('N', 3, 3)).toBe('Nitrogen has 5 valence electrons.')
    expect(countFeedback('H', 3, 3)).toBe('Hydrogen has 1 valence electron.')
  })
  it('the group rule in the feedback gives the right count for every element', () => {
    for (const el of EL_ORDER) {
      const e = ELEMENTS[el]
      expect(e.group <= 2 ? e.group : e.group - 10, el).toBe(e.valence)
    }
  })
  it('writes the sum for molecules and ions', () => {
    expect(totalSum(P('CH4'))).toBe('4 + 4 × 1')
    expect(totalSum(P('H2O'))).toBe('2 × 1 + 6')
    expect(totalSum(P('CO3 2-'))).toBe('4 + 3 × 6 + 2')
    expect(totalSum(P('NH4+'))).toBe('5 + 4 × 1 − 1')
    expect(inventory(P('CO3 2-'))).toBe('1 carbon atom, 3 oxygen atoms and a 2− charge')
    expect(inventory(P('CH4'))).toBe('1 carbon atom and 4 hydrogen atoms')
  })
  it('the written sum equals the electron total for every problem', () => {
    for (const p of PROBLEMS) {
      const value = Function(`"use strict"; return (${totalSum(p).replace(/×/g, '*').replace(/−/g, '-')})`)() as number
      const want = p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].valence * k, 0) - p.charge
      expect(value, p.id).toBe(want)
    }
  })
  it('targets the usual wrong totals', () => {
    expect(totalFeedback(P('CO3 2-'), 22, 1)).toBe('22 is the count for the neutral atoms. The 2− charge means the ion has 2 extra electrons.')
    expect(totalFeedback(P('CO3 2-'), 20, 1)).toBe('A 2− charge means 2 extra electrons, so add 2 to 22.')
    expect(totalFeedback(P('NH4+'), 9, 1)).toBe('9 is the count for the neutral atoms. The 1+ charge means the ion is missing 1 electron.')
    expect(totalFeedback(P('NH4+'), 10, 1)).toBe('A 1+ charge means 1 electron fewer, so subtract 1 from 9.')
    expect(totalFeedback(P('CH4'), 5, 1)).toMatch(/^Count every atom\./)
    expect(totalFeedback(P('CH4'), 7, 1)).toBe('Add up the valence electrons of every atom.')
    expect(totalFeedback(P('CH4'), 7, 2)).toBe('Work out 4 + 4 × 1.')
    expect(totalFeedback(P('CH4'), 7, 3)).toBe('4 + 4 × 1 = 8.')
  })
})

describe('step 2: the middle atom', () => {
  it('uses the hydrogen rule when every outer atom is hydrogen', () => {
    const r = middleFeedback(P('NH3'), 'N')
    expect(r.right).toBe(true)
    expect(r.text).toMatch(/hydrogen always goes on the outside/)
    expect(middleFeedback(P('NH3'), 'H')).toMatchObject({ right: false })
  })
  it('uses electronegativity otherwise, and the data backs the claim for every problem', () => {
    expect(middleFeedback(P('CO2'), 'C').text).toMatch(/least electronegative/)
    expect(middleFeedback(P('CO2'), 'O').text).toMatch(/Oxygen pulls on shared electrons harder than carbon/)
    expect(middleFeedback(P('CH2O'), 'C').text).toMatch(/Hydrogen is never in the middle\.$/)
    for (const p of PROBLEMS) {
      const outer = speciesOf(p).terminals.filter((el) => el !== 'H')
      for (const el of outer) expect(ELEMENTS[p.center].en!, `${p.id}: ${p.center} vs ${el}`).toBeLessThan(ELEMENTS[el].en!)
    }
  })
  it('asks the question for every problem here (each has two or more elements)', () => {
    for (const p of PROBLEMS) expect(middleNeeded(p), p.id).toBe(true)
  })
})

describe('step 3: bonding', () => {
  it('names the outer atoms in the instruction', () => {
    expect(bondInstruction(P('CH4'))).toMatch(/^Drag each hydrogen atom onto carbon/)
    expect(bondInstruction(P('CH2O'))).toMatch(/^Drag each outer atom onto carbon/)
  })
  it('lists what is still off the board', () => {
    expect(bondStatus(P('CH4'), star(['C', 'H']).s).text).toBe('Still to put on the board: 3 hydrogen atoms.')
    expect(bondStatus(P('CH2O'), star(['C']).s).text).toBe('Still to put on the board: 2 hydrogen atoms and 1 oxygen atom.')
  })
  it('reports progress, then success', () => {
    const half = star(['C', 'H', 'H', 'H', 'H'], [1, 1])
    expect(bondStatus(P('CH4'), half.s)).toMatchObject({ done: false, text: '2 of 4 outer atoms bonded to carbon.' })
    const full = star(['C', 'H', 'H', 'H', 'H'], [1, 1, 1, 1])
    expect(bondStatus(P('CH4'), full.s).done).toBe(true)
    expect(boardStepDone('bond', P('CH4'), full.s)).toBe(true)
  })
  it('tells the ammonium student to take one electron off before the fourth bond', () => {
    const three = star(['N', 'H', 'H', 'H', 'H'], [1, 1, 1])
    const st = bondStatus(P('NH4+'), three.s)
    expect(st.done).toBe(false)
    expect(st.text).toMatch(/Nitrogen is full with 8 electrons/)
    expect(st.text).toMatch(/1 electron fewer/)
    expect(st.text).toMatch(/Tap the last hydrogen, tap “− electron”, then drag the hydrogen onto nitrogen\./)
    // doing exactly that finishes the step
    let s = must(removeElectron(three.s, three.ids[4]!))
    s = must(share(s, three.ids[0]!, three.ids[4]!))
    expect(bondStatus(P('NH4+'), s).done).toBe(true)
  })
  it('leaves "one from each atom" out for a positive ion, where one bond takes both electrons from the middle atom', () => {
    expect(bondInstruction(P('NH4+'))).toBe('Drag each hydrogen atom onto nitrogen and let go. Each bond is 2 shared electrons.')
    expect(bondInstruction(P('CO3 2-'))).toMatch(/one from each atom\.$/)
  })
  it('does not give the positive-ion advice when extra electrons were added to a neutral molecule', () => {
    // water: oxygen filled to 8 by hand, so no hydrogen can bond
    const b = star(['O', 'H', 'H'])
    let s = must(addElectron(b.s, b.ids[0]!))
    s = must(addElectron(s, b.ids[0]!))
    const st = bondStatus(P('H2O'), s)
    expect(st.done).toBe(false)
    expect(st.text).toBe('Oxygen is full with 8 electrons, and the board has 2 more electrons than water has. Tap oxygen, then “− electron” 2 times.')
    expect(st.text).not.toMatch(/charge/)
  })
  it('catches outer atoms bonded to each other and the wrong atom in the middle', () => {
    const b = star(['C', 'O', 'O'], [1, 1])
    const tri = must(share(b.s, b.ids[1]!, b.ids[2]!))
    expect(bondStatus(P('CO2'), tri).text).toMatch(/Two outer atoms are bonded to each other/)
    const wrong = star(['O', 'C', 'O'], [1, 1])
    expect(bondStatus(P('CO2'), wrong.s).text).toMatch(/Carbon is not in the middle/)
  })
})

describe('step 4: the checklist and what to do next', () => {
  it('CO2 after single bonds: counts are short, and the hint says to bond again', () => {
    const { s } = star(['C', 'O', 'O'], [1, 1])
    const rows = checkRows(P('CO2'), s)
    expect(rows.map((r) => r.state)).toEqual(['pass', 'fail', 'wait'])
    expect(rows[0]!.text).toBe('All 16 valence electrons are on the board.')
    expect(rows[1]!.text).toBe('Carbon has 6 of 8. 2 oxygen atoms have 7 of 8.')
    expect(checkGuidance(P('CO2'), s)).toBe('Drag oxygen onto carbon again. They share 1 more pair, which makes a double bond.')
  })
  it('names the bond the move will make: double the first time, triple the second (HCN)', () => {
    const b = star(['C', 'H', 'N'], [1, 1])
    expect(checkGuidance(P('HCN'), b.s)).toBe('Drag nitrogen onto carbon again. They share 1 more pair, which makes a double bond.')
    const dbl = must(share(b.s, b.ids[0]!, b.ids[2]!))
    expect(checkGuidance(P('HCN'), dbl)).toBe('Drag nitrogen onto carbon again. They share 1 more pair, which makes a triple bond.')
    const triple = must(share(dbl, b.ids[0]!, b.ids[2]!))
    expect(checkGuidance(P('HCN'), triple)).toBeNull()
  })
  it('nitrite: bond until nitrogen is full, then the extra electron goes on the short oxygen', () => {
    const single = star(['N', 'O', 'O'], [1, 1])
    expect(checkRows(P('NO2-'), single.s)[0]!.text).toBe('The board has 17 electrons. The nitrite ion has 18.')
    expect(checkGuidance(P('NO2-'), single.s)).toMatch(/^Drag oxygen onto nitrogen again/)
    const dbl = must(share(single.s, single.ids[0]!, single.ids[1]!))
    expect(checkGuidance(P('NO2-'), dbl)).toBe('Add the missing electron to the oxygen atom that is short: tap the atom, then “+ electron”.')
    const done = must(addElectron(dbl, single.ids[2]!))
    expect(checkRows(P('NO2-'), done).map((r) => r.state)).toEqual(['pass', 'pass', 'pass'])
    expect(checkGuidance(P('NO2-'), done)).toBeNull()
  })
  it('a full middle atom with short outer atoms: the hint is to move an electron', () => {
    // carbonate with both extra electrons put on carbon first
    const b = star(['C', 'O', 'O', 'O'])
    let s = must(addElectron(b.s, b.ids[0]!))
    s = must(addElectron(s, b.ids[0]!))
    for (const o of b.ids.slice(1)) s = must(share(s, b.ids[0]!, o))
    const g = checkGuidance(P('CO3 2-'), s)
    expect(g).toMatch(/Carbon is full, and 2 oxygen atoms are short/)
    expect(g).toMatch(/“− electron” on carbon, then “\+ electron” on the oxygen/)
  })
  it('full shells with avoidable formal charges: the third row fails', () => {
    const b = star(['C', 'O', 'O'], [3, 1])
    const rows = checkRows(P('CO2'), b.s)
    expect(rows.map((r) => r.state)).toEqual(['pass', 'pass', 'fail'])
    expect(checkGuidance(P('CO2'), b.s)).toMatch(/Formal charge = valence electrons − unshared electrons − bonds/)
  })
  it('works out a formal charge as a sum', () => {
    const b = star(['C', 'O', 'O'], [3, 1])
    expect(formalChargeSum(b.s, b.ids[0]!)).toBe('4 − 0 − 4 = 0')
    expect(formalChargeSum(b.s, b.ids[1]!)).toBe('6 − 2 − 3 = +1')
    expect(formalChargeSum(b.s, b.ids[2]!)).toBe('6 − 6 − 1 = −1')
  })
  it('free build has no electron target: the first row is about being one molecule', () => {
    const b = star(['O', 'H', 'H'], [1])
    const rows = checkRows(null, b.s)
    expect(rows[0]).toEqual({ state: 'fail', text: '1 atom is not bonded to the rest.' })
    expect(checkGuidance(null, b.s)).toBe('Drag each loose atom onto the atom it should bond to.')
  })
  it('free build: reports an electron with no partner, and how to fix it', () => {
    const sf3 = star(['S', 'F', 'F', 'F'], [1, 1, 1])
    const rows = checkRows(null, sf3.s)
    expect(rows.map((r) => r.state)).toEqual(['pass', 'fail', 'wait'])
    expect(rows[1]!.text).toBe('Sulfur has an electron with no partner.')
    expect(checkGuidance(null, sf3.s)).toBe('Electrons in a finished structure come in pairs. Bond sulfur to another atom, or add or remove 1 electron.')
  })
  it('free build: the third row says only what was checked', () => {
    // one middle atom, charges present: judged for that middle atom
    const n2o = nitrousOxide()
    expect(checkRows(null, n2o.s)[2]).toEqual({ state: 'pass', text: 'The formal charges are as small as they can be with nitrogen in the middle.' })
    // wrong middle atom
    const b = star(['O', 'C', 'O'], [3, 1])
    expect(checkRows(null, b.s)[2]).toEqual({ state: 'fail', text: 'The formal charges are smaller with carbon in the middle.' })
    expect(checkGuidance(null, b.s)).toBe('Clear the board and build it again with carbon in the middle.')
    // two atoms: peroxide, O–O with an extra electron on each, charges −1 and −1, judged as it stands
    const pair = star(['O', 'O'], [1])
    let s = must(addElectron(pair.s, pair.ids[0]!))
    s = must(addElectron(s, pair.ids[1]!))
    expect(checkRows(null, s)[2]).toEqual({ state: 'pass', text: 'The formal charges are as small as they can be.' })
    // a chain with two middle atoms and a charge on it: the charge is shown on the board, not judged.
    // H–O–O–O with an extra electron on the end oxygen.
    const chain = star(['O', 'H', 'O'], [1, 1])
    const third = addAtom(chain.s, 'O')
    let c = must(share(third.s, chain.ids[2]!, third.id))
    c = must(addElectron(c, third.id))
    const rows = checkRows(null, c)
    expect(rows.map((r) => r.state)).toEqual(['pass', 'pass', 'wait'])
    expect(rows[2]!.text).toBe('Formal charges are checked only for molecules with one middle atom.')
  })
  it('adds the right notes to finished structures', () => {
    const notes = (id: string) => finishedNotes(P(id), solveLikeAStudent(id)).join(' ')
    expect(notes('CH4')).toBe('')
    expect(notes('CO3 2-')).toMatch(/any of the 3 oxygen atoms.*average of the 3 drawings.*resonance structures/)
    expect(notes('CO3 2-')).toMatch(/−1 on each of 2 oxygen atoms\. They add up to the ion's 2− charge\./)
    expect(notes('NO2-')).toMatch(/either oxygen/)
    expect(notes('NO2-')).toMatch(/Formal charge: −1 on one oxygen atom, the same as the ion's 1− charge\./)
    expect(notes('NH4+')).toBe("Formal charge: +1 on nitrogen, the same as the ion's 1+ charge.")
    expect(notes('BF3')).toMatch(/Boron has only 6 electrons around it/)
    expect(notes('PCl5')).toMatch(/Phosphorus has 10 electrons around it/)
    expect(notes('SF6')).toMatch(/Sulfur has 12 electrons around it/)
    expect(notes('XeF4')).toMatch(/Xenon has 12 electrons around it/)
    expect(notes('SO2')).toBe('Sulfur has 10 electrons around it. Atoms from period 3 onward can hold more than 8.')
    expect(notes('SO4 2-')).toMatch(/^The 2 double bonds could be drawn on any 2 of the 4 oxygen atoms\. The real ion is an average of the 6 drawings/)
    expect(notes('SO4 2-')).toMatch(/Sulfur has 12 electrons around it/)
    expect(notes('PO4 3-')).toMatch(/^The double bond could be drawn on any of the 4 oxygen atoms\. The real ion is an average of the 4 drawings/)
    expect(notes('PO4 3-')).toMatch(/−1 on each of 3 oxygen atoms\. They add up to the ion's 3− charge\./)
  })
  it('expanded octets: the hints lead to the double bonds that shrink the formal charges', () => {
    // sulfur dioxide after single bonds: sulfur is at 8 but can take more, so the short oxygens bond again
    const so2 = star(['S', 'O', 'O'], [1, 1])
    expect(checkGuidance(P('SO2'), so2.s)).toBe('Drag oxygen onto sulfur again. They share 1 more pair, which makes a double bond.')
    // sulfate drawn with four single bonds and every shell full: formal charges +2 and four −1
    const b = star(['S', 'O', 'O', 'O', 'O'], [1, 1, 1, 1])
    let s = b.s
    for (const o of b.ids.slice(1, 3)) s = must(addElectron(s, o))
    s = must(removeElectron(s, b.ids[0]!))
    s = must(addElectron(s, b.ids[3]!))
    s = must(removeElectron(s, b.ids[0]!))
    s = must(addElectron(s, b.ids[4]!))
    expect(checkRows(P('SO4 2-'), s).map((r) => r.state)).toEqual(['pass', 'pass', 'fail'])
    const move = nextMove(P('SO4 2-'), s)!
    expect(move.kind).toBe('bond')
    expect(move.text).toBe('Drag one oxygen that has a − charge onto sulfur again. Sulfur can hold more than 8 electrons, and the double bond brings both formal charges closer to 0.')
    // two of those moves finish it
    s = applyMove(applyMove(s, move), nextMove(P('SO4 2-'), applyMove(s, move))!)
    expect(nextMove(P('SO4 2-'), s)).toBeNull()
    expect(checkRows(P('SO4 2-'), s).map((r) => r.state)).toEqual(['pass', 'pass', 'pass'])
  })
  it('every hint that names a move is a move the board accepts, from many half-built boards', () => {
    // for each problem: bond the outer atoms, then walk the hints; along the way also try the hints
    // after a wrong turn (an extra electron on the middle atom, when the board allows it)
    for (const p of PROBLEMS) {
      const sp = speciesOf(p)
      const b = star([sp.center, ...sp.terminals])
      const starts: Structure[] = [b.s]
      const extra = addElectron(b.s, b.ids[0]!)
      if (extra.ok) starts.push(extra.s)
      for (const start of starts) {
        let s = start
        for (const t of b.ids.slice(1)) {
          const op = share(s, b.ids[0]!, t)
          if (op.ok) s = op.s
        }
        for (let i = 0; i < 30; i++) {
          const m = nextMove(p, s)
          if (!m || m.kind === 'tell') break
          s = applyMove(s, m) // throws if the board refuses the hinted move
        }
      }
    }
  })
})

describe('step 5: the shape', () => {
  it('counts groups and explains the usual miscounts', () => {
    const co2 = solveLikeAStudent('CO2')
    const f = groupFacts(co2)!
    expect(f).toMatchObject({ bonded: 2, lonePairs: 0, groups: 2, bondPairs: 4 })
    expect(groupsFeedback('C', f, 4, 1)).toBe('A double or triple bond points in one direction, so count the whole bond as 1 group.')
    expect(groupsRight('C', f)).toBe('2 groups: 2 bonded atoms and no lone pairs on carbon.')
    const nh3 = groupFacts(solveLikeAStudent('NH3'))!
    expect(groupsFeedback('N', nh3, 3, 1)).toBe('Count the lone pair on nitrogen too.')
    expect(groupsFeedback('N', nh3, 5, 2)).toBe('Nitrogen has 3 bonded atoms and 1 lone pair.')
  })
  it('offers four shapes that always include the right one and the arrangement of all the groups', () => {
    for (const p of PROBLEMS) {
      const info = shapeInfoFor(solveLikeAStudent(p.id))!
      const choices = shapeChoices(info)
      expect(choices, p.id).toHaveLength(4)
      expect(new Set(choices).size, p.id).toBe(4)
      expect(choices, p.id).toContain(p.shape)
      expect(choices, p.id).toContain(info.geometry)
      for (const c of choices) expect(ALL_SHAPES).toContain(c)
    }
  })
  it('explains why the arrangement of the groups is not the shape', () => {
    const info = shapeInfoFor(solveLikeAStudent('NH3'))!
    const r = shapeFeedback('N', info, 'tetrahedral')
    expect(r.right).toBe(false)
    expect(r.text).toBe('The shape is trigonal pyramidal. The 4 groups do point to the corners of a tetrahedron, but 1 corner holds a lone pair. The shape is named for where the atoms are.')
    const xef4 = shapeInfoFor(solveLikeAStudent('XeF4'))!
    expect(shapeFeedback('Xe', xef4, 'octahedral').text).toMatch(/corners of an octahedron, but 2 corners hold lone pairs/)
    expect(shapeFeedback('N', info, 'trigonal pyramidal')).toEqual({ right: true, text: 'Trigonal pyramidal: 3 atoms and 1 lone pair around nitrogen.' })
  })
  it('prints measured angles only for water and ammonia', () => {
    const angle = (id: string) => shapeReadout(P(id), P(id).center, shapeInfoFor(solveLikeAStudent(id))!).angle
    expect(angle('H2O')).toBe('less than 109.5° (measured: 104.5°)')
    expect(angle('NH3')).toBe('less than 109.5° (measured: 106.8°)')
    expect(angle('CH4')).toBe('109.5°')
    expect(angle('NO2-')).toBe('less than 120°')
    expect(angle('SF4')).toBe('less than 90° and less than 120°')
    for (const p of PROBLEMS) if (p.id !== 'H2O' && p.id !== 'NH3') expect(angle(p.id), p.id).not.toMatch(/measured/)
  })
  it('says why for each lone-pair case', () => {
    const why = (id: string) => shapeReadout(P(id), P(id).center, shapeInfoFor(solveLikeAStudent(id))!).why
    expect(why('CH4')).toBeNull()
    expect(why('H2O')).toMatch(/lone pair pushes harder than a bond/)
    expect(why('SF4')).toMatch(/seats around the middle of a trigonal bipyramid/)
    expect(why('XeF4')).toMatch(/opposite sides of xenon/)
    expect(why('XeF2')).toMatch(/3 lone pairs spread evenly/)
  })
})

describe('refusals and hints', () => {
  it('says which shell is full', () => {
    const b = star(['O', 'H'], [1])
    expect(refusalText(b.s, 'shell-full', b.ids[1])).toBe('Hydrogen already has 2 electrons around it. Its outer shell holds 2.')
    expect(refusalText(b.s, 'max-order')).toMatch(/triple bond/)
    expect(refusalText(b.s, 'no-electrons')).toMatch(/A bond needs 2 electrons/)
    expect(refusalText(b.s, 'no-electrons', b.ids[1])).toBe('Hydrogen has no unshared electrons to take off.')
  })
  it('has at least one hint for every step of every problem while the step is unfinished', () => {
    for (const p of PROBLEMS) {
      const started = star([p.center, ...speciesOf(p).terminals], speciesOf(p).terminals.map(() => 1).slice(0, 1)).s
      for (const step of STEPS) {
        if (step.id === 'shape') continue
        expect(hintsFor(step.id, p, started).length, `${p.id} ${step.id}`).toBeGreaterThan(0)
      }
      expect(hintsFor('shape', p, solveLikeAStudent(p.id)).length, `${p.id} shape`).toBe(2)
    }
  })
})

describe('every sentence the guide can show', () => {
  /** Collect the copy for each problem across the states a student passes through. */
  function allCopy(): string[] {
    const out: string[] = STEPS.flatMap((s) => [s.label, s.title, s.next])
    for (const p of PROBLEMS) {
      const sp = speciesOf(p)
      out.push(titleOf(p), inventory(p), totalSum(p), bondInstruction(p))
      for (const [el] of p.formula) for (let tries = 1; tries <= 3; tries++) out.push(countFeedback(el, 0, tries), countFeedback(el, ELEMENTS[el].z, tries))
      for (const guess of [0, 5, 22, 99]) for (let tries = 1; tries <= 3; tries++) out.push(totalFeedback(p, guess, tries))
      for (const [el] of p.formula) out.push(middleFeedback(p, el).text)
      const empty = star([p.center]).s
      const loose = star([p.center, ...sp.terminals]).s
      const single = star([p.center, ...sp.terminals], sp.terminals.map(() => 1).slice(0, p.id === 'NH4+' ? 3 : undefined)).s
      const done = solveLikeAStudent(p.id)
      for (const s of [empty, loose, single, done]) {
        out.push(bondStatus(p, s).text, ...checkRows(p, s).map((r) => r.text), checkGuidance(p, s) ?? '', ...finishedNotes(p, s))
        for (const step of STEPS) out.push(...hintsFor(step.id, p, s))
        for (const a of s.atoms) out.push(refusalText(s, 'shell-full', a.id), refusalText(s, 'no-electrons', a.id), formalChargeSum(s, a.id))
      }
      out.push(...checkRows(null, done).map((r) => r.text), refusalText(done, 'max-order'), refusalText(done, 'no-electrons'), refusalText(done, 'same-atom'))
      const info = shapeInfoFor(done)!
      const f = groupFacts(done)!
      for (let n = 2; n <= 6; n++) for (let tries = 1; tries <= 2; tries++) out.push(groupsFeedback(p.center, f, n, tries))
      out.push(groupsRight(p.center, f))
      for (const name of shapeChoices(info)) out.push(shapeFeedback(p.center, info, name).text)
      const r = shapeReadout(p, p.center, info)
      out.push(r.groups, r.arrangement, r.shape, r.angle, r.why ?? '')
    }
    return [...new Set(out.filter(Boolean))]
  }
  const lines = allCopy()
  if (process.env.MB_DUMP_COPY) writeFileSync(process.env.MB_DUMP_COPY, lines.join('\n') + '\n')

  it('collects a few hundred distinct lines', () => {
    expect(lines.length).toBeGreaterThan(300)
  })
  it('has no em dashes, no leftover template text, and no doubled spaces', () => {
    for (const line of lines) {
      expect(line, line).not.toMatch(/—/)
      expect(line, line).not.toMatch(/undefined|NaN|\[object|\$\{/)
      expect(line, line).not.toMatch(/ {2}/)
      expect(line, line).not.toMatch(/\b0 of 0\b/)
    }
  })
  it('never gives an atom feelings or uses the phrases Sam has banned', () => {
    const banned = /\b(wants?|likes?|happy|prefers?|loves?|hates?|seamless|comprehensive|robust|leverage|delve|showcase|elevate|unlock|not only|not just|more than just|think of|tells a story|simply|just)\b|that's next|let's/i
    for (const line of lines) expect(line, line).not.toMatch(banned)
  })
  it('names the atom: no sentence starts with "It"', () => {
    for (const line of lines) expect(line, line).not.toMatch(/(^|\. )It /)
  })
  it('uses "1 electron", never "1 electrons", and the same for atoms, bonds, groups and pairs', () => {
    for (const line of lines) expect(line, line).not.toMatch(/\b1 (electrons|atoms|bonds|groups|lone pairs|valence electrons|bonded atoms)\b/)
  })
  it('ends full sentences with a period', () => {
    for (const line of lines) if (/^[A-Z].* .* /.test(line) && !/[.:”]$/.test(line) && !/^(Count|Place|Bond|Check|Shape|Put|Find|Next)/.test(line)) expect(line, line).toMatch(/[.?]$/)
  })
})
