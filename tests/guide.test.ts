import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ELEMENTS, EL_ORDER, shellsOf, type El } from '../src/chem/elements'
import { PROBLEMS, speciesOf, type Problem } from '../src/chem/problems'
import { addAtom, addElectron, removeElectron, share, type Structure } from '../src/chem/structure'
import { ALL_SHAPES, classify, shapeCases } from '../src/chem/vsepr'
import {
  STEPS,
  bondInstruction,
  bondStatus,
  boardStepDone,
  checkCoach,
  checkGuidance,
  checkRows,
  coachText,
  countCoach,
  finishedNotes,
  formalChargeSum,
  groupFacts,
  groupsCoach,
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
  shellsWords,
  angleMarks,
  mixedOuter,
  titleOf,
  totalCoach,
  totalInWords,
  totalMethod,
  totalParts,
  totalSum,
  totalTally,
  type Coach,
} from '../src/modules/lewis/guide'
import { applyMove, nitrousOxide, solveLikeAStudent, star } from './helpers'

const P = (id: string): Problem => PROBLEMS.find((p) => p.id === id)!
const must = (op: ReturnType<typeof share>): Structure => {
  if (!op.ok) throw new Error(op.why)
  return op.s
}

describe('step 1: counting valence electrons', () => {
  it('the atomic number: says what the number is, why it is too many, and shows the shells', () => {
    expect(countCoach(P('CH4'), 'C', 6, 1)).toEqual({
      lead: "6 is carbon's atomic number.",
      why: "The atomic number counts all 6 of carbon's electrons, and 2 of them are in the inner shell.",
      ask: "Count only the electrons in carbon's outer shell.",
      show: { kind: 'shells', el: 'C' },
    })
    expect(countCoach(P('H2O'), 'O', 8, 1).lead).toBe("8 is oxygen's atomic number.")
    // an atom from period 3 has more than one inner shell (the stepper stops at 8, so the panel never shows this one)
    expect(countCoach(null, 'P', 15, 1).why).toMatch(/and 10 of them are in inner shells\.$/)
  })
  it('the number of atoms in the formula: says the count is for one atom', () => {
    expect(countCoach(P('CH4'), 'H', 4, 1)).toEqual({
      lead: '4 is the number of hydrogen atoms in methane.',
      why: 'Each hydrogen atom is counted on its own here.',
      ask: 'Set the valence electrons of 1 hydrogen atom.',
    })
    expect(countCoach(P('CO3 2-'), 'O', 3, 1).lead).toBe('3 is the number of oxygen atoms in the carbonate ion.')
    // where both readings fit, the formula comes first: CO2 has 2 oxygen atoms, and oxygen is 2 short of 8
    expect(countCoach(P('CO2'), 'O', 2, 1).lead).toBe('2 is the number of oxygen atoms in carbon dioxide.')
    expect(countCoach(P('H2O'), 'H', 2, 1).lead).toBe('2 is the number of hydrogen atoms in water.')
  })
  it('the electrons an atom is short of 8, and a full shell: says valence electrons are the ones the atom has', () => {
    expect(countCoach(P('H2O'), 'O', 2, 1)).toEqual({
      lead: '2 is how many electrons oxygen is short of 8.',
      why: 'Valence electrons are the ones oxygen already has in its outer shell.',
      ask: "Count the electrons in oxygen's outer shell.",
      show: { kind: 'shells', el: 'O' },
    })
    expect(countCoach(P('NH3'), 'N', 3, 1).lead).toBe('3 is how many electrons nitrogen is short of 8.')
    expect(countCoach(P('NH3'), 'N', 8, 1)).toMatchObject({ lead: '8 is a full outer shell.', why: 'On its own, nitrogen has fewer than 8 electrons in its outer shell.', show: { kind: 'shells', el: 'N' } })
    expect(countCoach(P('CH4'), 'H', 2, 1)).toMatchObject({ lead: '2 is a full outer shell for hydrogen.', why: 'Hydrogen gets to 2 by sharing electrons in a bond. On its own, hydrogen has fewer.' })
    // boron ends up with 6, so "gets to 8" would be wrong: 8 gets the plain line
    expect(coachText(countCoach(P('BF3'), 'B', 8, 1))).toBe("Boron doesn't have 8 valence electrons. Find boron's group on the periodic table.")
  })
  it('escalates: point at the table, then the group rule with the shells, then the answer', () => {
    expect(coachText(countCoach(P('NH3'), 'N', 4, 1))).toBe("Nitrogen doesn't have 4 valence electrons. Find nitrogen's group on the periodic table.")
    expect(countCoach(P('NH3'), 'N', 4, 1).show).toBeUndefined()
    expect(countCoach(P('NH3'), 'N', 4, 2)).toEqual({
      lead: "Nitrogen doesn't have 4 valence electrons.",
      why: '',
      ask: 'Nitrogen is in group 15. For groups 13 to 18, subtract 10 from the group number.',
      show: { kind: 'shells', el: 'N' },
    })
    // a recognized idea keeps its first two lines on the second miss
    expect(countCoach(P('NH3'), 'N', 7, 2)).toMatchObject({ lead: "7 is nitrogen's atomic number.", ask: 'Nitrogen is in group 15. For groups 13 to 18, subtract 10 from the group number.' })
    expect(countCoach(P('CH4'), 'H', 3, 2).ask).toBe('Hydrogen is in group 1. In groups 1 and 2, the group number is the number of valence electrons.')
    expect(countCoach(P('NH3'), 'N', 4, 3)).toEqual({ lead: 'Nitrogen has 5 valence electrons.', why: '', ask: '', show: { kind: 'shells', el: 'N' } })
    expect(countCoach(P('CH4'), 'H', 3, 3).lead).toBe('Hydrogen has 1 valence electron.')
    expect(coachText(countCoach(P('CH4'), 'C', 0, 1))).toBe("Set a number for carbon. Find carbon's group on the periodic table.")
  })
  it('never gives the count away before the third miss, for every atom and every wrong number', () => {
    for (const p of PROBLEMS) {
      for (const [el] of p.formula) {
        const v = ELEMENTS[el].valence
        for (let n = 0; n <= 8; n++) {
          if (n === v) continue
          for (const tries of [1, 2]) {
            const c = countCoach(p, el, n, tries)
            expect(c.lead, `${p.id} ${el} ${n}`).not.toBe('')
            expect(coachText(c), `${p.id} ${el} ${n}`).not.toMatch(new RegExp(`has ${v} valence`))
          }
          expect(countCoach(p, el, n, 3).lead).toMatch(new RegExp(`has ${v} valence electrons?\\.$`))
        }
      }
    }
  })
  it('the shells picture: the shells add up to the atomic number and the last one holds the valence electrons', () => {
    for (const el of EL_ORDER) {
      const shells = shellsOf(el)
      expect(shells.reduce((a, b) => a + b, 0), el).toBe(ELEMENTS[el].z)
      expect(shells[shells.length - 1], el).toBe(ELEMENTS[el].valence)
      expect(shells.length, el).toBe(ELEMENTS[el].period)
    }
    expect(shellsOf('C')).toEqual([2, 4])
    expect(shellsOf('Cl')).toEqual([2, 8, 7])
    expect(shellsOf('I')).toEqual([2, 8, 18, 18, 7])
    expect(shellsWords('C')).toEqual({ inner: 'Inner shell', outer: 'Outer shell', label: 'Carbon has 2 electrons in its inner shell and 4 in its outer shell.' })
    expect(shellsWords('H')).toEqual({ inner: null, outer: 'Outer shell', label: 'Hydrogen has 1 shell, with 1 electron in it.' })
    expect(shellsWords('Cl').label).toBe('Chlorine has 10 electrons in its 2 inner shells and 7 in its outer shell.')
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
  it('a wrong total is told what the total is made of, before any sum', () => {
    // ammonia, the example Sam gave: the words say which atoms bring what, and the picture shows them
    expect(totalCoach(P('NH3'), 7, 1)).toEqual({
      lead: 'The total is not 7.',
      why: 'The total is every valence electron in ammonia: the nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1.',
      ask: 'Add up what all 4 atoms bring.',
      show: { kind: 'tally', reveal: 'atoms' },
    })
    expect(totalCoach(P('H2O'), 5, 1).why).toBe('The total is every valence electron in water: each of the 2 hydrogen atoms brings 1 and the oxygen atom brings 6.')
    expect(totalCoach(P('CH2O'), 9, 1).why).toBe('The total is every valence electron in formaldehyde: the carbon atom brings 4, each of the 2 hydrogen atoms brings 1 and the oxygen atom brings 6.')
    // an ion: the charge is part of how the total is built
    expect(coachText(totalCoach(P('CO3 2-'), 27, 1))).toBe(
      'The total is not 27. The total is every valence electron in the carbonate ion: the carbon atom brings 4 and each of the 3 oxygen atoms brings 6. The 2− charge adds 2 more. Add up what all 4 atoms bring, then add 2 for the charge.',
    )
    expect(coachText(totalCoach(P('NH4+'), 7, 1))).toBe(
      'The total is not 7. The total is every valence electron in the ammonium ion: the nitrogen atom brings 5 and each of the 4 hydrogen atoms brings 1. The 1+ charge takes 1 away. Add up what all 5 atoms bring, then take 1 away for the charge.',
    )
  })
  it('the second miss adds up each kind of atom, and the third gives the total in words', () => {
    expect(totalCoach(P('NH3'), 7, 2)).toEqual({
      lead: 'The total is not 7.',
      why: 'The nitrogen atom brings 5. The 3 hydrogen atoms bring 1 each, which makes 3.',
      ask: 'Add those numbers.',
      show: { kind: 'tally', reveal: 'sums' },
    })
    expect(totalCoach(P('NH3'), 7, 3)).toEqual({ lead: 'Ammonia has 8 valence electrons.', why: '5 from nitrogen and 3 from hydrogen make 8.', ask: '', show: { kind: 'tally', reveal: 'total' } })
    expect(totalCoach(P('CO3 2-'), 27, 2).why).toBe('The carbon atom brings 4. The 3 oxygen atoms bring 6 each, which makes 18. The 2− charge adds 2 more.')
    expect(totalCoach(P('CO3 2-'), 27, 3)).toMatchObject({ lead: 'The carbonate ion has 24 valence electrons.', why: '4 from carbon, 18 from oxygen and 2 from the 2− charge make 24.' })
    expect(totalCoach(P('NH4+'), 7, 2)).toMatchObject({ why: 'The nitrogen atom brings 5. The 4 hydrogen atoms bring 1 each, which makes 4. The 1+ charge takes 1 away.', ask: "Add up the atoms' numbers, then take 1 away." })
    expect(totalCoach(P('NH4+'), 7, 3).why).toBe('5 from nitrogen and 4 from hydrogen make 9, and the 1+ charge takes 1 away.')
    // no rung is the bare sum
    for (const p of PROBLEMS) for (const tries of [1, 2, 3]) expect(coachText(totalCoach(p, 99, tries)), p.id).not.toMatch(/[×=]/)
  })
  it('targets the usual wrong totals, each with the picture of the atoms', () => {
    const atoms = { kind: 'tally', reveal: 'atoms' }
    expect(totalCoach(P('CO3 2-'), 22, 1)).toEqual({ lead: '22 is the count for the neutral atoms.', why: 'The 2− charge means the ion has 2 extra electrons.', ask: 'Add 2 to 22.', show: atoms })
    expect(totalCoach(P('CO3 2-'), 20, 1)).toEqual({ lead: '20 is 22 minus 2.', why: 'Electrons are negative, so an ion with a 2− charge has 2 more electrons than its atoms bring.', ask: 'Add 2 to 22.', show: atoms })
    expect(totalCoach(P('NH4+'), 9, 1)).toEqual({ lead: '9 is the count for the neutral atoms.', why: 'The 1+ charge means the ion is missing 1 electron.', ask: 'Subtract 1 from 9.', show: atoms })
    expect(totalCoach(P('NH4+'), 10, 1)).toEqual({ lead: '10 is 9 plus 1.', why: 'Electrons are negative, so an ion with a 1+ charge has 1 fewer electron than its atoms bring.', ask: 'Subtract 1 from 9.', show: atoms })
    expect(totalCoach(P('CH4'), 5, 1)).toEqual({ lead: '5 counts hydrogen once.', why: 'Methane has 4 hydrogen atoms, and each atom brings its own electrons.', ask: 'Count every atom.', show: atoms })
    expect(totalCoach(P('CO3 2-'), 10, 1).why).toBe('The carbonate ion has 3 oxygen atoms, and each atom brings its own electrons.')
    // 6 + 4 × 1: every electron in methane, inner shells too
    expect(totalCoach(P('CH4'), 10, 1)).toEqual({ lead: '10 adds up the atomic numbers.', why: 'That counts every electron, inner shells included. A Lewis structure shows only the valence electrons.', ask: 'Add up the valence electrons of every atom.', show: atoms })
    // 6 + 3 × 8, and the same with the 2 extra electrons
    expect(totalCoach(P('CO3 2-'), 30, 1).lead).toBe('30 adds up the atomic numbers.')
    expect(totalCoach(P('CO3 2-'), 32, 1).lead).toBe('32 counts every electron in the carbonate ion.')
    // a recognized idea keeps its first line on the second miss, and the rest adds up each kind of atom
    expect(totalCoach(P('CH4'), 5, 2)).toEqual({ lead: '5 counts hydrogen once.', why: 'The carbon atom brings 4. The 4 hydrogen atoms bring 1 each, which makes 4.', ask: 'Add those numbers.', show: { kind: 'tally', reveal: 'sums' } })
  })
  it('the picture of a total: a row for each kind of atom and the charge, filled in a step at a time', () => {
    expect(totalTally(P('NH3'), 'atoms')).toEqual({
      rows: [
        { el: 'N', count: 1, text: '1 nitrogen atom brings 5', sum: null },
        { el: 'H', count: 3, text: '3 hydrogen atoms bring 1 each', sum: null },
      ],
      totalLabel: 'Total',
      total: '?',
      label: 'The nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1.',
    })
    expect(totalTally(P('NH3'), 'sums')).toMatchObject({ rows: [{ sum: '5' }, { sum: '3' }], total: '?', label: 'The nitrogen atom brings 5. The 3 hydrogen atoms bring 1 each, which makes 3.' })
    expect(totalTally(P('NH3'), 'total')).toMatchObject({ total: '8', label: '5 from nitrogen and 3 from hydrogen make 8.' })
    expect(totalTally(P('CO3 2-'), 'sums').rows[2]).toEqual({ el: null, count: 0, text: '2− charge: 2 more electrons', sum: '+2' })
    expect(totalTally(P('NH4+'), 'sums').rows[2]).toEqual({ el: null, count: 0, text: '1+ charge: 1 electron fewer', sum: '−1' })
    // for every problem the rows cover every atom, and their sums add up to the total
    for (const p of PROBLEMS) {
      const t = totalTally(p, 'total')
      const want = p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].valence * k, 0) - p.charge
      expect(t.rows.filter((r) => r.el).reduce((n, r) => n + r.count, 0), p.id).toBe(p.formula.reduce((n, [, k]) => n + k, 0))
      expect(t.rows.reduce((n, r) => n + Number(r.sum!.replace('−', '-')), 0), p.id).toBe(want)
      expect(t.total, p.id).toBe(String(want))
      // the sentence versions name the same numbers
      expect(totalInWords(p), p.id).toMatch(new RegExp(`\\b${p.charge > 0 ? want + p.charge : want}\\b`))
      for (const [el, k] of p.formula) if (k > 1) expect(totalParts(p), p.id).toContain(`which makes ${ELEMENTS[el].valence * k}.`)
    }
  })
  it('the sums named in a wrong total are right for every problem', () => {
    for (const p of PROBLEMS) {
      const neutral = p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].valence * k, 0)
      if (p.charge === 0) continue
      const n = Math.abs(p.charge)
      const flipped = totalCoach(p, neutral + p.charge, 1)
      expect(flipped.lead, p.id).toBe(`${neutral + p.charge} is ${neutral} ${p.charge < 0 ? 'minus' : 'plus'} ${n}.`)
      // following the last line gives the real total
      expect(flipped.ask, p.id).toBe(p.charge < 0 ? `Add ${n} to ${neutral}.` : `Subtract ${n} from ${neutral}.`)
      expect(p.charge < 0 ? neutral + n : neutral - n, p.id).toBe(neutral - p.charge)
    }
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
  it('a wrong pick is told what is wrong with that atom in the middle', () => {
    expect(middleFeedback(P('NH3'), 'N').coach).toBeNull()
    expect(middleFeedback(P('NH3'), 'H').coach).toEqual({ lead: 'A hydrogen atom makes only 1 bond.', why: 'The middle atom of ammonia has to bond to 3 other atoms.', ask: 'Pick again.' })
    // water and hydrogen cyanide list hydrogen first
    expect(middleFeedback(P('H2O'), 'H').coach!.why).toBe("The order of the atoms in a formula doesn't say which atom is in the middle. The middle atom of water has to bond to 2 other atoms.")
    expect(middleFeedback(P('HCN'), 'H').coach!.why).toMatch(/^The order of the atoms in a formula/)
    // several atoms of the picked kind, one of the middle kind
    expect(middleFeedback(P('CO3 2-'), 'O').coach).toEqual({
      lead: 'The carbonate ion has 3 oxygen atoms, and only 1 atom is in the middle.',
      why: 'Oxygen pulls on shared electrons harder than carbon does (it is more electronegative). The middle atom is usually the least electronegative one.',
      ask: 'Pick again.',
    })
    // one atom of each kind: electronegativity alone
    expect(middleFeedback(P('CH2O'), 'O').coach).toEqual({ lead: 'Oxygen pulls on shared electrons harder than carbon does (it is more electronegative).', why: 'The middle atom is usually the least electronegative one.', ask: 'Pick again.' })
    for (const p of PROBLEMS) {
      for (const [el, k] of p.formula) {
        if (el === p.center) continue
        const r = middleFeedback(p, el)
        expect(r.right, p.id).toBe(false)
        expect(r.text, p.id).toBe(coachText(r.coach!))
        // "has k atoms" is only said when it is true
        if (/and only 1 atom is in the middle/.test(r.coach!.lead)) expect(r.coach!.lead, p.id).toContain(`has ${k} ${ELEMENTS[el].name.toLowerCase()} atoms`)
      }
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
    expect(checkGuidance(P('CO2'), s)).toBe('Drag oxygen onto carbon again. They share 1 more pair, which makes a double bond. A shared pair counts for both atoms.')
  })
  it('names the bond the move will make: double the first time, triple the second (HCN)', () => {
    const b = star(['C', 'H', 'N'], [1, 1])
    expect(checkGuidance(P('HCN'), b.s)).toBe('Drag nitrogen onto carbon again. They share 1 more pair, which makes a double bond. A shared pair counts for both atoms.')
    const dbl = must(share(b.s, b.ids[0]!, b.ids[2]!))
    expect(checkGuidance(P('HCN'), dbl)).toBe('Drag nitrogen onto carbon again. They share 1 more pair, which makes a triple bond. A shared pair counts for both atoms.')
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
  it('electrons added by hand to fill a shell: says the total is fixed, and what to do instead', () => {
    const b = star(['C', 'O', 'O'], [1, 1])
    // the board is only unfinished: nothing to explain yet
    expect(checkCoach(P('CO2'), b.s)).toBeNull()
    const added = must(addElectron(b.s, b.ids[1]!))
    expect(checkCoach(P('CO2'), added)).toEqual({
      lead: 'The board has 17 electrons, 1 more than carbon dioxide has.',
      why: "Carbon dioxide has the 16 valence electrons counted in step 1 and no others, so electrons can't be added to fill a shell.",
      ask: 'Tap oxygen, then “− electron”. An atom that is short after that can share 1 more pair with carbon.',
    })
    // carbon filled by hand as well: still the same advice, with the new count
    const more = must(addElectron(must(addElectron(added, b.ids[0]!)), b.ids[0]!))
    expect(checkCoach(P('CO2'), more)!.lead).toBe('The board has 19 electrons, 3 more than carbon dioxide has.')
    // the finished molecule with nothing left to share: no line about sharing
    const done = solveLikeAStudent('CO2')
    expect(checkCoach(P('CO2'), done)).toBeNull()
  })
  it('electrons taken off: says every counted electron belongs in the drawing', () => {
    const b = star(['C', 'O', 'O'], [1, 1])
    const fewer = must(removeElectron(b.s, b.ids[1]!))
    expect(checkCoach(P('CO2'), fewer)).toEqual({
      lead: 'The board has 15 electrons, 1 fewer than carbon dioxide has.',
      why: 'All 16 valence electrons counted in step 1 have to be in the drawing.',
      ask: 'Tap carbon, then “+ electron”.',
    })
  })
  it("an ion's charge that is not counted yet is unfinished work, with nothing to explain", () => {
    // carbonate with its atoms' own 22 electrons, ammonium with its atoms' own 9
    expect(checkCoach(P('CO3 2-'), star(['C', 'O', 'O', 'O'], [1, 1, 1]).s)).toBeNull()
    expect(checkCoach(P('NH4+'), star(['N', 'H', 'H', 'H', 'H'], [1, 1, 1]).s)).toBeNull()
    // one electron too many on carbonate is still caught: 25 on the board, 24 in the ion
    const b = star(['C', 'O', 'O', 'O'], [1, 1, 1])
    let s = b.s
    for (const o of b.ids.slice(1)) s = must(addElectron(s, o))
    expect(checkCoach(P('CO3 2-'), s)!.lead).toBe('The board has 25 electrons, 1 more than the carbonate ion has.')
  })
  it('full shells with formal charges that can be smaller: says which drawing is used', () => {
    const b = star(['C', 'O', 'O'], [3, 1])
    expect(checkCoach(P('CO2'), b.s)).toEqual({ lead: 'More than one drawing of carbon dioxide fills every shell.', why: 'The drawing with formal charges closest to 0 is the one that is used.', ask: '' })
  })
  it('the electron a coach says to tap is one the board lets go of, or takes, from many boards', () => {
    for (const p of PROBLEMS) {
      const sp = speciesOf(p)
      const b = star([sp.center, ...sp.terminals])
      let s = b.s
      for (const t of b.ids.slice(1)) {
        const op = share(s, b.ids[0]!, t)
        if (op.ok) s = op.s
      }
      for (const id of b.ids) {
        for (const change of [addElectron, removeElectron]) {
          const op = change(s, id)
          if (!op.ok) continue
          const c = checkCoach(p, op.s)
          const tap = c?.ask.match(/^Tap (\w+), then “([+−]) electron”\./)
          if (!tap) continue
          const atoms = op.s.atoms.filter((a) => ELEMENTS[a.el].name.toLowerCase() === tap[1])
          const move = tap[2] === '+' ? addElectron : removeElectron
          expect(atoms.some((a) => move(op.s, a.id).ok), `${p.id}: ${c!.ask}`).toBe(true)
        }
      }
    }
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
    expect(checkGuidance(P('SO2'), so2.s)).toBe('Drag oxygen onto sulfur again. They share 1 more pair, which makes a double bond. A shared pair counts for both atoms.')
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
  it('counts groups and names the usual miscounts, with the groups to ring on the board', () => {
    const co2 = solveLikeAStudent('CO2')
    const f = groupFacts(co2)!
    expect(f).toEqual({ bonded: 2, lonePairs: 0, groups: 2, bondPairs: 4, outerPairs: 4 })
    expect(groupsCoach('C', f, 4, 1)).toEqual({
      lead: '4 counts every shared pair as its own group.',
      why: 'The pairs in a double or triple bond sit between the same 2 atoms, so the whole bond points one way and is 1 group.',
      ask: 'Count each bond once.',
      show: { kind: 'groups', which: 'multiple' },
    })
    expect(groupsCoach('C', f, 6, 1)).toMatchObject({ lead: '6 counts the lone pairs on the outer atoms.', why: 'Only the groups on carbon set the shape around carbon.', show: { kind: 'groups', which: 'all' } })
    expect(groupsCoach('C', f, 3, 1)).toMatchObject({ lead: '3 counts carbon as a group.', why: 'The groups are the bonds and lone pairs around carbon.', show: { kind: 'groups', which: 'all' } })
    expect(coachText(groupsCoach('C', f, 5, 1))).toBe("Carbon doesn't have 5 groups around it. Count the atoms bonded to carbon, then the lone pairs on carbon.")
    expect(groupsCoach('C', f, 5, 1).show).toBeUndefined()
    expect(groupsRight('C', f)).toBe('2 groups: 2 bonded atoms and no lone pairs on carbon.')

    const nh3 = groupFacts(solveLikeAStudent('NH3'))!
    expect(groupsCoach('N', nh3, 3, 1)).toEqual({
      lead: '3 is the number of atoms bonded to nitrogen.',
      why: 'The lone pair on nitrogen takes up room around nitrogen as well, so the lone pair is a group.',
      ask: 'Count the lone pair on nitrogen too.',
      show: { kind: 'groups', which: 'lone' },
    })
    // the second miss lists what is there and rings every group
    expect(groupsCoach('N', nh3, 5, 2)).toEqual({ lead: "Nitrogen doesn't have 5 groups around it.", why: '', ask: 'Nitrogen has 3 bonded atoms and 1 lone pair.', show: { kind: 'groups', which: 'all' } })

    const h2o = groupFacts(solveLikeAStudent('H2O'))!
    expect(groupsCoach('O', h2o, 2, 1)).toMatchObject({ why: 'The 2 lone pairs on oxygen take up room around oxygen as well, so each lone pair is a group.', ask: 'Count the lone pairs on oxygen too.' })
    expect(groupsCoach('O', h2o, 3, 1)).toMatchObject({ lead: '3 counts the 2 lone pairs on oxygen as 1 group.', ask: 'Count every lone pair.', show: { kind: 'groups', which: 'lone' } })
  })
  it('what a group miscount is called is true of the molecule, for every problem and every wrong count', () => {
    for (const p of PROBLEMS) {
      const f = groupFacts(solveLikeAStudent(p.id))!
      for (let n = 2; n <= 6; n++) {
        if (n === f.groups) continue
        const c = groupsCoach(p.center, f, n, 1)
        if (/every shared pair/.test(c.lead)) expect(f.bondPairs + f.lonePairs, p.id).toBe(n)
        if (/is the number of atoms bonded/.test(c.lead)) expect(f.bonded, p.id).toBe(n)
        if (/lone pairs on the outer atoms/.test(c.lead)) expect(f.groups + f.outerPairs, p.id).toBe(n)
        if (/as 1 group\.$/.test(c.lead)) expect(f.bonded + 1, p.id).toBe(n)
        // ringing the lone pairs or the multiple bonds needs some to ring
        if (c.show?.kind === 'groups' && c.show.which === 'lone') expect(f.lonePairs, p.id).toBeGreaterThan(0)
        if (c.show?.kind === 'groups' && c.show.which === 'multiple') expect(f.bondPairs, p.id).toBeGreaterThan(f.bonded)
      }
    }
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
    expect(r.coach).toEqual({
      lead: 'Tetrahedral is the arrangement of all 4 groups around nitrogen, lone pairs included.',
      why: 'The 4 groups point to the corners of a tetrahedron, and 1 corner holds a lone pair. A shape is named for where the atoms are.',
      ask: 'The shape is trigonal pyramidal.',
    })
    expect(r.text).toBe(coachText(r.coach!))
    const xef4 = shapeInfoFor(solveLikeAStudent('XeF4'))!
    expect(shapeFeedback('Xe', xef4, 'octahedral').text).toMatch(/corners of an octahedron, and 2 corners hold lone pairs/)
    expect(shapeFeedback('N', info, 'trigonal pyramidal')).toEqual({ right: true, text: 'Trigonal pyramidal: 3 atoms and 1 lone pair around nitrogen.', coach: null })
  })
  it('a shape picked as if the lone pairs were not there says so', () => {
    const nh3 = shapeInfoFor(solveLikeAStudent('NH3'))!
    expect(shapeFeedback('N', nh3, 'trigonal planar').coach).toEqual({
      lead: 'Trigonal planar would be the shape if nitrogen had no lone pairs.',
      why: 'Nitrogen has 1 lone pair, and each lone pair takes up room around nitrogen too. The 4 groups point to the corners of a tetrahedron, and the bonded atoms sit at 3 of them.',
      ask: 'The shape is trigonal pyramidal.',
    })
    const h2o = shapeInfoFor(solveLikeAStudent('H2O'))!
    expect(shapeFeedback('O', h2o, 'linear').coach!.lead).toBe('Linear would be the shape if oxygen had no lone pairs.')
    expect(shapeFeedback('O', h2o, 'linear').coach!.why).toMatch(/^Oxygen has 2 lone pairs, .* the bonded atoms sit at 2 of them\.$/)
  })
  it('square planar for a tetrahedral molecule is the flat drawing; any other wrong shape is named by what it needs', () => {
    const ch4 = shapeInfoFor(solveLikeAStudent('CH4'))!
    expect(shapeFeedback('C', ch4, 'square planar').coach).toEqual({
      lead: 'Square planar is how the 4 bonds look in a flat drawing, 90° apart.',
      why: 'In 3D the 4 groups get further apart than that: 109.5°, at the corners of a tetrahedron.',
      ask: 'The shape is tetrahedral.',
    })
    expect(shapeFeedback('C', ch4, 'seesaw').coach).toEqual({
      lead: 'Seesaw is the shape for 4 atoms and 1 lone pair around the middle atom.',
      why: 'Carbon has 4 atoms and no lone pairs around it.',
      ask: 'The shape is tetrahedral.',
    })
    const xef2 = shapeInfoFor(solveLikeAStudent('XeF2'))!
    expect(shapeFeedback('Xe', xef2, 'bent').coach!.lead).toBe('Bent is the shape for 2 atoms and 1 or 2 lone pairs around the middle atom.')
    expect(shapeFeedback('C', ch4, 'linear').coach!.lead).toBe('Linear is the shape for 2 atoms and 0 or 3 lone pairs around the middle atom.')
  })
  it('every wrong shape, for every problem: the claim about the picked shape matches the shape table, and the right shape is given', () => {
    expect(shapeCases('bent')).toEqual([{ bonded: 2, lonePairs: 1 }, { bonded: 2, lonePairs: 2 }])
    expect(shapeCases('seesaw')).toEqual([{ bonded: 4, lonePairs: 1 }])
    for (const p of PROBLEMS) {
      const info = shapeInfoFor(solveLikeAStudent(p.id))!
      for (const pick of ALL_SHAPES) {
        const r = shapeFeedback(p.center, info, pick)
        if (pick === p.shape) {
          expect(r, p.id).toMatchObject({ right: true, coach: null })
          continue
        }
        const c = r.coach!
        expect(c.ask, `${p.id} ${pick}`).toBe(`The shape is ${p.shape}.`)
        expect(c.lead.toLowerCase().startsWith(pick.toLowerCase()), `${p.id} ${pick}: ${c.lead}`).toBe(true)
        if (/would be the shape if/.test(c.lead)) {
          expect(info.lonePairs, `${p.id} ${pick}`).toBeGreaterThan(0)
          expect(classify(info.bonded, 0)!.shape, `${p.id} ${pick}`).toBe(pick)
        }
        if (/is the arrangement of all/.test(c.lead)) expect(info.geometry, `${p.id} ${pick}`).toBe(pick)
        if (/is the shape for/.test(c.lead)) {
          // every count named in the line is in the shape table under the picked name, with the same number of atoms
          const cases = shapeCases(pick)
          for (const k of cases) expect(classify(k.bonded, k.lonePairs)!.shape, `${p.id} ${pick}`).toBe(pick)
          expect(new Set(cases.map((k) => k.bonded)).size, pick).toBe(1)
        }
      }
    }
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
  it('marks the angles on the 3D model with textbook values, never one read off the model', () => {
    const marks = (id: string) => {
      const s = solveLikeAStudent(id)
      return angleMarks(P(id), shapeInfoFor(s)!, mixedOuter(s))
    }
    expect(marks('CH4')).toEqual([{ near: 109.5, text: '109.5°', under: false }])
    expect(marks('CO2')).toEqual([{ near: 180, text: '180°', under: false }])
    expect(marks('BF3')).toEqual([{ near: 120, text: '120°', under: false }])
    expect(marks('SF6')).toEqual([{ near: 90, text: '90°', under: false }])
    // the two measured angles the textbook prints
    expect(marks('H2O')).toEqual([{ near: 109.5, text: '104.5°', under: true }])
    expect(marks('NH3')).toEqual([{ near: 109.5, text: '106.8°', under: true }])
    expect(marks('NO2-')).toEqual([{ near: 120, text: 'less than 120°', under: true }])
    // two different angles get one mark each
    expect(marks('PCl5')).toEqual([
      { near: 90, text: '90°', under: false },
      { near: 120, text: '120°', under: false },
    ])
    expect(marks('SF4')).toEqual([
      { near: 90, text: 'less than 90°', under: true },
      { near: 120, text: 'less than 120°', under: true },
    ])
    // hydrogen and oxygen around one carbon: close to 120°, not exactly on it
    expect(marks('CH2O')).toEqual([{ near: 120, text: 'about 120°', under: false }])
    const ch2o = solveLikeAStudent('CH2O')
    expect(shapeReadout(P('CH2O'), 'C', shapeInfoFor(ch2o)!, mixedOuter(ch2o)).angle).toBe('about 120°')
    // two groups are on a straight line whatever the atoms are
    expect(marks('HCN')).toEqual([{ near: 180, text: '180°', under: false }])
    // every mark's number is one the shape table prints
    for (const p of PROBLEMS) for (const m of marks(p.id)) expect([90, 109.5, 120, 180], p.id).toContain(m.near)
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
    expect(refusalText(b.s, 'shell-full', b.ids[1])).toBe('Hydrogen already has 2 electrons around it. Its outer shell holds 2, so a hydrogen atom makes only 1 bond.')
    expect(refusalText(b.s, 'shell-full', b.ids[0])).toBe('Oxygen has 7 electrons around it and its outer shell holds 8, so there is no room for 2 more.')
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
      // once every atom's count is right, the count step's hints are about the total
      expect(hintsFor('count', p, started, true), p.id).toEqual([totalMethod(p), totalParts(p)])
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
      const parts = (c: Coach | null) => (c ? [c.lead, c.why, c.ask] : [])
      for (const [el] of p.formula) {
        for (let n = 0; n <= 8; n++) if (n !== ELEMENTS[el].valence) for (let tries = 1; tries <= 3; tries++) out.push(...parts(countCoach(p, el, n, tries)))
        const words = shellsWords(el)
        out.push(words.inner ?? '', words.outer, words.label)
      }
      const neutral = p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].valence * k, 0)
      const once = p.formula.reduce((n, [el]) => n + ELEMENTS[el].valence, 0)
      const everyElectron = p.formula.reduce((n, [el, k]) => n + ELEMENTS[el].z * k, 0)
      for (const guess of [0, 5, 22, 99, neutral, neutral + p.charge, once, everyElectron]) {
        if (guess !== neutral - p.charge) for (let tries = 1; tries <= 3; tries++) out.push(...parts(totalCoach(p, guess, tries)))
      }
      out.push(totalMethod(p), totalParts(p), totalInWords(p))
      for (const reveal of ['atoms', 'sums', 'total'] as const) {
        const t = totalTally(p, reveal)
        out.push(t.label, t.totalLabel, ...t.rows.map((r) => r.text))
      }
      for (const [el] of p.formula) out.push(middleFeedback(p, el).text, ...parts(middleFeedback(p, el).coach))
      const empty = star([p.center]).s
      const loose = star([p.center, ...sp.terminals]).s
      const single = star([p.center, ...sp.terminals], sp.terminals.map(() => 1).slice(0, p.id === 'NH4+' ? 3 : undefined)).s
      const done = solveLikeAStudent(p.id)
      for (const s of [empty, loose, single, done]) {
        out.push(bondStatus(p, s).text, ...checkRows(p, s).map((r) => r.text), checkGuidance(p, s) ?? '', ...finishedNotes(p, s), ...parts(checkCoach(p, s)))
        // the same board with one electron added by hand, and with one taken off
        for (const a of s.atoms) {
          for (const change of [addElectron, removeElectron]) {
            const op = change(s, a.id)
            if (op.ok) out.push(...parts(checkCoach(p, op.s)))
          }
        }
        for (const step of STEPS) out.push(...hintsFor(step.id, p, s))
        for (const a of s.atoms) out.push(refusalText(s, 'shell-full', a.id), refusalText(s, 'no-electrons', a.id), formalChargeSum(s, a.id))
      }
      out.push(...checkRows(null, done).map((r) => r.text), refusalText(done, 'max-order'), refusalText(done, 'no-electrons'), refusalText(done, 'same-atom'))
      // carbon dioxide drawn with a triple and a single bond: full shells, formal charges that can be smaller
      out.push(...parts(checkCoach(P('CO2'), star(['C', 'O', 'O'], [3, 1]).s)))
      const info = shapeInfoFor(done)!
      const f = groupFacts(done)!
      for (let n = 2; n <= 6; n++) if (n !== f.groups) for (let tries = 1; tries <= 2; tries++) out.push(...parts(groupsCoach(p.center, f, n, tries)))
      out.push(groupsRight(p.center, f))
      for (const name of ALL_SHAPES) out.push(shapeFeedback(p.center, info, name).text, ...parts(shapeFeedback(p.center, info, name).coach))
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
