// The key terms: which words are highlighted, what each card says, and that a card never works on
// the molecule on screen. Expected answers are written by hand from OpenStax Chemistry 2e (key
// terms of chapters 2, 6, 7 and 8, and section 7.6 for the shapes) and the course's chapter 7 and
// 8 slides, never copied from what the code returns.
import { describe, expect, it } from 'vitest'
import { ELEMENTS, type El } from '../src/chem/elements'
import { sigmaPi } from '../src/chem/orbitals'
import { bondPolarity, moleculePolarity } from '../src/chem/polarity'
import { PROBLEMS, speciesOf, type Problem } from '../src/chem/problems'
import { EMPTY } from '../src/chem/structure'
import type { ShapeName } from '../src/chem/vsepr'
import {
  ALL_TERMS,
  BASE_TERMS,
  SAMPLES,
  STEPS,
  coachText,
  countCoach,
  drawingOf,
  elementsOf,
  formsOf,
  formulaWord,
  hintsFor,
  inventory,
  middleChoices,
  middleFeedback,
  plainTerms,
  sampleShape,
  termCard,
  termFrom,
  termName,
  termPieces,
  totalCoach,
  totalMethod,
  totalParts,
  type BaseTermId,
  type Sample,
  type StepId,
  type TermId,
} from '../src/modules/lewis/guide'
import { star } from './helpers'

const elsOf = (m: Sample) => m.formula.map(([el]) => el)
const sameSpecies = (m: Sample, p: Problem) => m.charge === p.charge && JSON.stringify([...m.formula].sort()) === JSON.stringify([...p.formula].sort())
const terms = (text: string, plain: TermId[] = []) => termPieces(text, plain).filter((x) => x.term).map((x) => `${x.text}=${x.term}`)
const textOf = (id: TermId, p: Problem | null = null) => {
  const c = termCard(id, p)
  return [c.means, c.example, c.note ?? '', c.pictureLabel].join(' ')
}

describe('the molecules the cards use as examples', () => {
  it('are never one of the guided problems', () => {
    for (const m of Object.values(SAMPLES)) for (const p of PROBLEMS) expect(sameSpecies(m, p), `${m.id} is the problem ${p.id}`).toBe(false)
  })

  it('have the Lewis structures the textbook gives them', () => {
    // [bond orders], unshared electrons on the first atom, unshared electrons on each other atom
    const expected: Record<string, [number[], number, number[]]> = {
      H2: [[1], 0, [0]],
      F2: [[1], 6, [6]],
      O2: [[2], 4, [4]],
      N2: [[3], 2, [2]],
      I2: [[1], 6, [6]],
      HCl: [[1], 0, [6]],
      H2S: [[1, 1], 4, [0, 0]],
      PH3: [[1, 1, 1], 2, [0, 0, 0]],
      SiH4: [[1, 1, 1, 1], 0, [0, 0, 0, 0]],
      'CN-': [[3], 2, [2]],
      BeCl2: [[1, 1], 0, [6, 6]],
      BCl3: [[1, 1, 1], 0, [6, 6, 6]],
      SCl2: [[1, 1], 4, [6, 6]],
      CCl4: [[1, 1, 1, 1], 0, [6, 6, 6, 6]],
      NF3: [[1, 1, 1], 2, [6, 6, 6]],
      PF3: [[1, 1, 1], 2, [6, 6, 6]],
      PF5: [[1, 1, 1, 1, 1], 0, [6, 6, 6, 6, 6]],
      SeF4: [[1, 1, 1, 1], 2, [6, 6, 6, 6]],
      BrF3: [[1, 1, 1], 4, [6, 6, 6]],
      SeF6: [[1, 1, 1, 1, 1, 1], 0, [6, 6, 6, 6, 6, 6]],
      IF5: [[1, 1, 1, 1, 1], 2, [6, 6, 6, 6, 6]],
      'ICl4-': [[1, 1, 1, 1], 4, [6, 6, 6, 6]],
      'OH-': [[1], 6, [0]],
      'BF4-': [[1, 1, 1, 1], 0, [6, 6, 6, 6]],
    }
    for (const m of Object.values(SAMPLES)) {
      if (m.id === 'O3' || m.id === 'NO3-') continue // the two with resonance structures, checked below
      const d = drawingOf(m)
      const want = expected[m.id]
      expect(want, `no expected drawing for ${m.id}`).toBeDefined()
      expect([d.outer.map((o) => o.order), d.lone, d.outer.map((o) => o.lone)], m.id).toEqual(want)
    }
  })

  it('give ozone two resonance structures, with the double bond on either side and +1 on the middle oxygen', () => {
    const a = drawingOf(SAMPLES.O3, 0)
    const b = drawingOf(SAMPLES.O3, 1)
    expect([a.outer.map((o) => o.order), b.outer.map((o) => o.order)].map(String).sort()).toEqual(['1,2', '2,1'])
    for (const d of [a, b]) {
      expect(d.lone).toBe(2)
      expect(d.fc).toBe(1)
      expect(d.outer.map((o) => o.fc).sort()).toEqual([-1, 0])
    }
  })

  it('give the nitrate ion three resonance structures, each with one double bond and +1 on nitrogen', () => {
    expect(formsOf(SAMPLES.NO3)).toBe(3)
    expect(formsOf(SAMPLES.O3)).toBe(2)
    const doubles = new Set<number>()
    for (let i = 0; i < 3; i++) {
      const d = drawingOf(SAMPLES.NO3, i)
      expect(d.outer.map((o) => o.order).sort()).toEqual([1, 1, 2])
      expect([d.lone, d.fc]).toEqual([0, 1]) // N: 5 − 0 − 4
      expect(d.outer.map((o) => o.fc).sort()).toEqual([-1, -1, 0])
      doubles.add(d.outer.findIndex((o) => o.order === 2))
    }
    expect(doubles.size).toBe(3)
  })

  it('have the formal charges worked by hand: −1 on oxygen in hydroxide, on boron in tetrafluoroborate and on carbon in cyanide', () => {
    const cn = drawingOf(SAMPLES.CN)
    expect([cn.fc, cn.outer[0]!.fc]).toEqual([-1, 0]) // C: 4 − 2 − 3, N: 5 − 2 − 3
    const oh = drawingOf(SAMPLES.OH)
    expect([oh.fc, oh.outer[0]!.fc]).toEqual([-1, 0]) // O: 6 − 6 − 1, H: 1 − 0 − 1
    const bf4 = drawingOf(SAMPLES.BF4)
    expect([bf4.fc, ...bf4.outer.map((o) => o.fc)]).toEqual([-1, 0, 0, 0, 0]) // B: 3 − 0 − 4, F: 7 − 6 − 1
  })

  it('have the shapes of section 7.6: bonded atoms and lone pairs on the middle atom, then the name', () => {
    const expected: Record<string, [number, number, ShapeName, string]> = {
      BeCl2: [2, 0, 'linear', '180°'],
      BCl3: [3, 0, 'trigonal planar', '120°'],
      O3: [2, 1, 'bent', 'less than 120°'],
      CCl4: [4, 0, 'tetrahedral', '109.5°'],
      NF3: [3, 1, 'trigonal pyramidal', 'less than 109.5°'],
      PF3: [3, 1, 'trigonal pyramidal', 'less than 109.5°'],
      SCl2: [2, 2, 'bent', 'less than 109.5°'],
      H2S: [2, 2, 'bent', 'less than 109.5°'],
      PH3: [3, 1, 'trigonal pyramidal', 'less than 109.5°'],
      SiH4: [4, 0, 'tetrahedral', '109.5°'],
      'NO3-': [3, 0, 'trigonal planar', '120°'],
      PF5: [5, 0, 'trigonal bipyramidal', '90° and 120°'],
      SeF4: [4, 1, 'seesaw', 'less than 90° and less than 120°'],
      BrF3: [3, 2, 'T-shaped', 'less than 90°'],
      SeF6: [6, 0, 'octahedral', '90°'],
      IF5: [5, 1, 'square pyramidal', 'less than 90°'],
      'ICl4-': [4, 2, 'square planar', '90°'],
    }
    for (const [id, want] of Object.entries(expected)) {
      const m = Object.values(SAMPLES).find((x) => x.id === id)!
      const info = sampleShape(m)
      expect([info.bonded, info.lonePairs, info.shape, info.angle], id).toEqual(want)
    }
  })

  it('are polar or nonpolar as the cards say', () => {
    const built = (m: Sample) => star([m.center, ...drawingOf(m).outer.map((o) => o.el)], drawingOf(m).outer.map((o) => o.order)).s
    // N–F: 4.0 − 3.0, S–Cl: 3.0 − 2.5, both polar, in shapes that do not spread the bonds evenly
    for (const m of [SAMPLES.NF3, SAMPLES.SCl2]) {
      const pol = moleculePolarity(built(m))!
      expect(pol.polar, m.id).toBe(true)
      expect(pol.bonds.every((b) => b.out === 1), `${m.id}: every arrow points at the outer atom`).toBe(true)
    }
    // Be–Cl 1.5, B–Cl 1.0: polar bonds, the same atoms spread evenly
    for (const m of [SAMPLES.BeCl2, SAMPLES.BCl3]) {
      const pol = moleculePolarity(built(m))!
      expect([pol.polar, pol.why], m.id).toEqual([false, 'cancel'])
    }
  })

  it('have the sigma and pi bonds the cards give them', () => {
    const count = (m: Sample) => sigmaPi(star([m.center, drawingOf(m).outer[0]!.el], [drawingOf(m).outer[0]!.order]).s)
    expect(count(SAMPLES.F2)).toEqual({ sigma: 1, pi: 0 })
    expect(count(SAMPLES.O2)).toEqual({ sigma: 1, pi: 1 })
    expect(count(SAMPLES.N2)).toEqual({ sigma: 1, pi: 2 })
  })

  it('are written with subscripts and a raised charge', () => {
    expect(formulaWord(SAMPLES.HCl)).toBe('HCl')
    expect(formulaWord(SAMPLES.H2S)).toBe('H₂S')
    expect(formulaWord(SAMPLES.SeF6)).toBe('SeF₆')
    expect(formulaWord(SAMPLES.OH)).toBe('OH⁻')
    expect(formulaWord(SAMPLES.BF4)).toBe('BF₄⁻')
    expect(formulaWord({ formula: [['S', 1], ['O', 4]], charge: -2 })).toBe('SO₄²⁻')
    expect(formulaWord({ formula: [['N', 1], ['H', 4]], charge: 1 })).toBe('NH₄⁺')
  })
})

describe('what the cards say', () => {
  it('gives every term a name, a meaning, an example and a picture', () => {
    expect(BASE_TERMS.length).toBe(29)
    expect(ALL_TERMS.length).toBe(40)
    for (const id of ALL_TERMS) {
      const c = termCard(id)
      expect(c.name.length, id).toBeGreaterThan(1)
      for (const line of [c.means, c.example, c.pictureLabel, ...(c.note ? [c.note] : [])]) expect(line, `${id}: ${line}`).toMatch(/^[A-Z0-9ΔδA-Za-z].*\.$/)
      expect(c.related.length, id).toBeGreaterThan(0)
      for (const r of c.related) {
        expect(ALL_TERMS, `${id} links to ${r.id}`).toContain(r.id)
        expect(r.id, id).not.toBe(id)
        expect(r.name).toBe(termName(r.id))
      }
    }
  })

  it('counts an atom’s shells and valence electrons as the periodic table does', () => {
    // nitrogen: Z = 7, shells 2 and 5; chlorine: Z = 17, shells 2, 8 and 7
    expect(termCard('valence').example).toBe('Nitrogen has 7 electrons in 2 shells: 2 and 5. The 5 in the outer shell are its valence electrons.')
    expect(termCard('shell').example).toBe("Chlorine's 17 electrons are in 3 shells. The inner shells hold 2 and 8, and the outer shell holds 7.")
    expect(termCard('atomic-number').example).toBe("Nitrogen's atomic number is 7, so a nitrogen atom has 7 electrons. 2 of them are in the inner shell, and 5 are valence electrons.")
    // group 16: oxygen, sulfur and selenium, 6 valence electrons each
    expect(termCard('group').example).toBe('Oxygen, sulfur and selenium are all in group 16, and each has 6 valence electrons.')
    // with oxygen on screen the card moves to group 17, and "an" goes before a vowel
    const water = PROBLEMS.find((p) => p.id === 'H2O')!
    expect(termCard('group', water).example).toBe('Fluorine, chlorine and bromine are all in group 17, and each has 7 valence electrons.')
    expect(termCard('atomic-number', PROBLEMS.find((p) => p.id === 'NH3')!).example).toBe("Oxygen's atomic number is 8, so an oxygen atom has 8 electrons. 2 of them are in the inner shell, and 6 are valence electrons.")
    // phosphate has oxygen and phosphorus, so group 16 is out and group 17 is the next choice
    expect(termCard('group', PROBLEMS.find((p) => p.id === 'PO4 3-')!).example).toBe('Fluorine, chlorine and bromine are all in group 17, and each has 7 valence electrons.')
  })

  it('describes each Lewis drawing as the engine draws it', () => {
    expect(termCard('lewis').example).toBe('In the Lewis structure of hydrogen chloride, HCl, 1 line joins hydrogen and chlorine. Chlorine has 6 dots around it, and hydrogen has no dots.')
    expect(termCard('lone-pair').example).toBe('In hydrogen chloride, HCl, chlorine has 3 lone pairs, and hydrogen has none.')
    expect(termCard('full-shell').example).toBe('In hydrogen chloride, HCl, chlorine has 6 unshared electrons and 2 in its bond, which makes 8. Hydrogen has the 2 in its bond.')
    expect(termCard('bond').example).toBe('In a hydrogen molecule, H₂, each hydrogen atom puts 1 electron into the bond. The line between the atoms stands for those 2 shared electrons.')
    expect(termCard('middle').example).toBe('In carbon tetrachloride, CCl₄, carbon is the middle atom, and the 4 chlorine atoms are the outer atoms.')
    expect(termCard('formal-charge').example).toBe('In the hydroxide ion, OH⁻, oxygen brings 6 valence electrons. In the drawing, oxygen has 6 unshared electrons and 1 bond: 6 − 6 − 1 = −1.')
    expect(termCard('expanded').example).toBe('In selenium hexafluoride, SeF₆, selenium has 6 bonds, so 12 electrons are around it.')
    expect(termCard('ion').example).toBe('The hydroxide ion, OH⁻, has a charge of 1−. The ion holds 1 more electron than its neutral atoms bring.')
    // the second choice of each, used when the first shares an atom with the molecule on screen
    const methane = PROBLEMS.find((p) => p.id === 'CH4')!
    expect(termCard('lone-pair', methane).example).toBe('In an iodine molecule, I₂, each iodine atom has 3 lone pairs.')
    expect(termCard('full-shell', methane).example).toBe('In an iodine molecule, I₂, each iodine atom has 6 unshared electrons and 2 in the bond, which makes 8.')
    expect(termCard('lewis', methane).example).toBe('In the Lewis structure of an iodine molecule, I₂, 1 line joins the 2 iodine atoms, and each has 6 dots around it.')
    expect(termCard('bond', methane).example).toBe('In a fluorine molecule, F₂, each fluorine atom puts 1 electron into the bond. The line between the atoms stands for those 2 shared electrons.')
    expect(termCard('formal-charge', methane).example).toBe('In the tetrafluoroborate ion, BF₄⁻, boron brings 3 valence electrons. In the drawing, boron has 0 unshared electrons and 4 bonds: 3 − 0 − 4 = −1.')
    const pcl5 = PROBLEMS.find((p) => p.id === 'PCl5')!
    expect(termCard('lone-pair', pcl5).example).toBe('In hydrogen sulfide, H₂S, sulfur has 2 lone pairs, and each hydrogen atom has none.')
    expect(termCard('full-shell', pcl5).example).toBe('In hydrogen sulfide, H₂S, sulfur has 4 unshared electrons and 4 in its 2 bonds, which makes 8. Each hydrogen atom has the 2 in its bond.')
  })

  it('works ΔEN with the course table: chlorine 3.0, hydrogen 2.1, oxygen 3.5, carbon 2.5', () => {
    expect(termCard('delta-en').example).toBe('For an H–Cl bond, ΔEN = 3.0 − 2.1 = 0.9. That is above 0.4, so the bond is polar.')
    expect(termCard('electronegativity').example).toBe('Chlorine has an electronegativity of 3.0, and hydrogen has 2.1. In an H–Cl bond, chlorine pulls the shared electrons harder.')
    expect(termCard('partial').example).toBe('In an H–Cl bond, chlorine has the larger electronegativity, so chlorine is δ− and hydrogen is δ+.')
    expect(termCard('dipole').example).toBe('For an H–Cl bond, the arrow starts at hydrogen and points at chlorine.')
    // ammonia's N–H bond is also 3.0 − 2.1, so the card moves to C–O
    const ammonia = PROBLEMS.find((p) => p.id === 'NH3')!
    expect(termCard('delta-en', ammonia).example).toBe('For a C–O bond, ΔEN = 3.5 − 2.5 = 1.0. That is above 0.4, so the bond is polar.')
    expect(termCard('polar', ammonia).example).toBe('A C–O bond is polar, because oxygen pulls the shared electrons harder than carbon. An F–F bond is nonpolar, because the 2 fluorine atoms pull equally.')
    expect(termCard('delta-en').note).toBe('A ΔEN of 0.4 or less is a nonpolar bond. Above 0.4 and up to 2.0 is a polar bond. Above 2.0 the bond is ionic.')
    // water has hydrogen and oxygen, which rules out H–Cl, C–O, H–O and S–O: phosphorus 2.1, fluorine 4.0
    const water = PROBLEMS.find((p) => p.id === 'H2O')!
    expect(termCard('delta-en', water).example).toBe('For a P–F bond, ΔEN = 4.0 − 2.1 = 1.9. That is above 0.4, so the bond is polar.')
    // chlorine trifluoride: Cl–F is 1.0, as C–O is, so the card moves on to H–O: 3.5 − 2.1, and its nonpolar bond is H–H
    const clf3 = PROBLEMS.find((p) => p.id === 'ClF3')!
    expect(termCard('delta-en', clf3).example).toBe('For an H–O bond, ΔEN = 3.5 − 2.1 = 1.4. That is above 0.4, so the bond is polar.')
    expect(termCard('polar', clf3).example).toBe('An H–O bond is polar, because oxygen pulls the shared electrons harder than hydrogen. An H–H bond is nonpolar, because the 2 hydrogen atoms pull equally.')
    // methane: sulfur 2.5, oxygen 3.5
    expect(termCard('electronegativity', PROBLEMS[0]!).example).toBe('Oxygen has an electronegativity of 3.5, and sulfur has 2.5. In an S–O bond, oxygen pulls the shared electrons harder.')
    expect(termCard('electronegativity').note).toBe('Electronegativity gets larger from left to right across a period of the periodic table, and smaller going down a group.')
    expect(bondPolarity('F', 'F').kind).toBe('nonpolar')
  })

  it('names shapes, groups, angles and hybrid orbitals as section 7.6 and the chapter 8 slides do', () => {
    expect(termCard('electron-group').example).toBe('In nitrogen trifluoride, NF₃, nitrogen has 3 bonded atoms and 1 lone pair, which is 4 electron groups.')
    expect(termCard('shape').example).toBe('In nitrogen trifluoride, NF₃, nitrogen has 3 bonded atoms and 1 lone pair. The 4 groups spread out, and the atoms make a trigonal pyramidal shape.')
    expect(termCard('bond-angle').example).toBe('In boron trichloride, BCl₃, the angle between any 2 B–Cl bonds is 120°.')
    expect(termCard('hybridization').example).toBe('In boron trichloride, BCl₃, boron has 3 electron groups. Boron mixes 1 s orbital and 2 p orbitals into 3 sp² orbitals, so boron is sp².')
    // with a molecule of 3 groups on screen the card shows 2 groups
    const bf3 = PROBLEMS.find((p) => p.id === 'BF3')!
    expect(termCard('hybridization', bf3).example).toBe('In beryllium chloride, BeCl₂, beryllium has 2 electron groups. Beryllium mixes 1 s orbital and 1 p orbital into 2 sp orbitals, so beryllium is sp.')
    expect(termCard('bond-angle', bf3).example).toBe('In carbon tetrachloride, CCl₄, the angle between any 2 C–Cl bonds is 109.5°.')
    expect(termCard('cancel').example).toBe('In beryllium chloride, BeCl₂, the 2 Be–Cl arrows are the same size and point in opposite directions, so they cancel.')
    expect(termCard('cancel', PROBLEMS.find((p) => p.id === 'CO2')!).example).toBe('In boron trichloride, BCl₃, the 3 B–Cl arrows are the same size and are 120° apart in a flat triangle, so they cancel.')
    expect(termCard('net-dipole', PROBLEMS.find((p) => p.id === 'NH3')!).example).toBe('In sulfur dichloride, SCl₂, each of the 2 S–Cl arrows points at chlorine. In the bent shape the arrows all lean toward the same side, so they add up to a net dipole.')
    expect(termCard('shape:bent').means).toBe('2 atoms sit on the same side of the middle atom, so the 3 atoms make a V. A middle atom with 2 bonded atoms and 1 lone pair, or with 2 bonded atoms and 2 lone pairs, has this shape.')
    expect(termCard('shape:square planar').example).toBe('The shape of the tetrachloroiodate ion, ICl₄⁻, is square planar. The bond angle is 90°.')
    expect(termCard('shape:trigonal bipyramidal').example).toBe('The shape of phosphorus pentafluoride, PF₅, is trigonal bipyramidal. The bond angles are 90° and 120°.')
    expect(termCard('shape:tetrahedral').note).toBeNull()
  })
})

describe('a card never works on the molecule on screen', () => {
  // electron groups around each problem's middle atom, counted by hand from its Lewis structure
  const GROUPS: Record<string, number> = {
    CH4: 4, NH3: 4, H2O: 4, CO2: 2, CH2O: 3, HCN: 2, 'NH4+': 4, 'NO2-': 3, 'CO3 2-': 3, BF3: 3, PCl5: 5, SF4: 5, ClF3: 5, XeF2: 5, SF6: 6, BrF5: 6, XeF4: 6, SO2: 3, 'SO4 2-': 4, 'PO4 3-': 4,
  }
  /** Cards whose picture shows every dot of a molecule, or whose example gives an atom's own numbers. */
  const APART: BaseTermId[] = ['valence', 'shell', 'group', 'atomic-number', 'ion', 'lewis', 'middle', 'bond', 'lone-pair', 'full-shell', 'formal-charge']

  // Atoms in one column of the periodic table have the same number of valence electrons, so a card
  // that counts chlorine's 7 would give away fluorine's. These cards keep to other columns.
  const columnsOf = (p: Problem) => new Set(elementsOf(p).map((el) => ELEMENTS[el].group))
  const usedBy = (id: TermId, p: Problem) => {
    const c = termCard(id, p)
    return [...c.about.els, ...c.about.samples.flatMap(elsOf)]
  }

  it('uses an example from other columns of the periodic table, wherever the card gives an atom’s electrons', () => {
    for (const p of PROBLEMS) {
      const mine = columnsOf(p)
      for (const id of APART) {
        const c = termCard(id, p)
        const used = usedBy(id, p)
        expect(used.length, `${id} for ${p.id}`).toBeGreaterThan(0)
        expect(used.filter((el) => mine.has(ELEMENTS[el].group)), `${id} for ${p.id} uses an atom from a column of the molecule on screen`).toEqual([])
        // and the example names no atom of those columns either (the definition may: "Hydrogen is full with 2")
        for (const el of Object.keys(ELEMENTS) as El[]) {
          if (mine.has(ELEMENTS[el].group)) expect(`${c.example} ${c.pictureLabel}`.toLowerCase(), `${id} for ${p.id}`).not.toContain(ELEMENTS[el].name.toLowerCase())
        }
      }
    }
    // chlorine has 7 valence electrons, as fluorine does: with boron trifluoride on screen the shell card counts sulfur's
    expect(termCard('shell', PROBLEMS.find((p) => p.id === 'BF3')!).example).toBe("Sulfur's 16 electrons are in 3 shells. The inner shells hold 2 and 8, and the outer shell holds 6.")
    // nitrogen has 5, as phosphorus does: with phosphorus pentachloride on screen the valence card counts oxygen's
    expect(termCard('valence', PROBLEMS.find((p) => p.id === 'PCl5')!).example).toBe('Oxygen has 8 electrons in 2 shells: 2 and 6. The 6 in the outer shell are its valence electrons.')
    // sulfur tetrafluoride takes columns 16 and 17, which leaves phosphine, silane and the cyanide ion
    const sf4 = PROBLEMS.find((p) => p.id === 'SF4')!
    expect(termCard('lone-pair', sf4).example).toBe('In phosphine, PH₃, phosphorus has 1 lone pair, and each hydrogen atom has none.')
    expect(termCard('lewis', sf4).example).toBe('In the Lewis structure of phosphine, PH₃, 3 lines join phosphorus to the 3 hydrogen atoms. Phosphorus has 2 dots around it, and each hydrogen atom has no dots.')
    expect(termCard('middle', sf4).example).toBe('In silane, SiH₄, silicon is the middle atom, and the 4 hydrogen atoms are the outer atoms.')
    expect(termCard('formal-charge', sf4).example).toBe('In the cyanide ion, CN⁻, carbon brings 4 valence electrons. In the drawing, carbon has 2 unshared electrons and 3 bonds: 4 − 2 − 3 = −1.')
    expect(termCard('ion', sf4).example).toBe('The cyanide ion, CN⁻, has a charge of 1−. The ion holds 1 more electron than its neutral atoms bring.')
  })

  it('holds every card the count step’s own sentences can open to that rule', () => {
    // every sentence the count step can show: each wrong count, each wrong total, the hints
    const opened = new Set<TermId>()
    const read = (line: string) => termPieces(line, plainTerms('count')).forEach((x) => x.term && opened.add(x.term))
    read("Valence electrons are the electrons in an atom's outer shell. Set the number for each atom.")
    for (const p of PROBLEMS) {
      for (const el of elementsOf(p)) for (let answer = 0; answer <= 8; answer++) for (let tries = 1; tries <= 3; tries++) read(coachText(countCoach(p, el, answer, tries)))
      for (let answer = 0; answer <= 99; answer++) for (let tries = 1; tries <= 3; tries++) read(coachText(totalCoach(p, answer, tries)))
      for (const h of [...hintsFor('count', p, EMPTY, false), ...hintsFor('count', p, EMPTY, true)]) read(h)
      for (const line of [totalMethod(p), totalParts(p), inventory(p)]) read(line)
    }
    // and every card those cards link to in that step
    const walk = (id: TermId) => termCard(id, PROBLEMS[0]!, 'count').related.forEach((r) => { if (!opened.has(r.id)) { opened.add(r.id); walk(r.id) } })
    for (const id of [...opened]) walk(id)
    expect([...opened].sort()).toEqual(['atomic-number', 'bond', 'full-shell', 'group', 'ion', 'lewis', 'shell', 'valence'])
    for (const id of opened) expect(APART as TermId[], `${id} opens in the count step`).toContain(id)
  })

  it('holds every card the middle-atom question can open to it too', () => {
    const opened = new Set<TermId>()
    const read = (line: string) => termPieces(line, plainTerms('place')).forEach((x) => x.term && opened.add(x.term))
    for (const p of PROBLEMS) {
      for (const el of middleChoices(p)) {
        const f = middleFeedback(p, el)
        read(f.text)
        if (f.coach) read(coachText(f.coach))
      }
      for (const h of hintsFor('place', p, EMPTY)) read(h)
    }
    expect([...opened].sort()).toEqual(['bond', 'electronegativity', 'ion', 'middle'])
    // the electronegativity card is held to its own rule below; the other three are in the list above
    for (const id of opened) if (id !== 'electronegativity') expect(APART as TermId[], id).toContain(id)
  })

  it('draws lines without dots in the other cards that show a Lewis drawing next to the count step’s terms', () => {
    for (const p of [null, ...PROBLEMS]) {
      for (const id of ['multiple', 'resonance', 'expanded'] as const) {
        const pic = termCard(id, p).picture
        expect(pic.kind === 'lewis' && pic.mark, id).toBe('lines')
      }
    }
  })

  it('opens the cards for resonance and for more than 8 electrons only from a sentence that uses the words', () => {
    // Their sentences come after the structure is finished, or in a hint. No other card links to them,
    // so a student in the check step cannot reach them from "formal charges".
    for (const id of BASE_TERMS) {
      const links = termCard(id).related.map((r) => r.id)
      expect(links, id).not.toContain('resonance')
      expect(links, id).not.toContain('expanded')
    }
    // and neither names an atom: sulfur, phosphorus, chlorine and xenon are middle atoms of guided problems
    for (const p of PROBLEMS) {
      const c = termCard('expanded', p)
      for (const el of elementsOf(p)) expect(`${c.means} ${c.note}`.toLowerCase(), p.id).not.toContain(ELEMENTS[el].name.toLowerCase())
    }
    expect(termCard('full-shell').note).toBe('A few middle atoms end up with fewer than 8 electrons, and atoms from period 3 onward can hold more than 8.')
  })

  it('shows ozone’s two drawings, or nitrate’s three when the molecule on screen is bent as ozone is', () => {
    expect(termCard('resonance').example).toBe('Ozone, O₃, has 2 resonance structures. The double bond is on one side in the first drawing and on the other side in the second.')
    const nitrite = PROBLEMS.find((p) => p.id === 'NO2-')!
    const c = termCard('resonance', nitrite)
    expect(c.example).toBe('The nitrate ion, NO₃⁻, has 3 resonance structures. The double bond goes to a different oxygen atom in each drawing.')
    expect(c.picture.kind === 'lewis' && c.picture.forms).toEqual([0, 1, 2])
    expect(termCard('resonance', PROBLEMS.find((p) => p.id === 'CO3 2-')!).about.samples[0]!.id).toBe('O3')
  })

  it('never shows a guided problem or names the molecule on screen', () => {
    for (const p of PROBLEMS) {
      for (const id of ALL_TERMS) {
        const c = termCard(id, p)
        for (const m of c.about.samples) for (const q of PROBLEMS) expect(sameSpecies(m, q), `${id} shows ${q.id}`).toBe(false)
        expect(textOf(id, p), `${id} for ${p.id}`).not.toContain(p.name.replace(/^the /, ''))
      }
    }
  })

  it('shows another count of electron groups than the middle atom has, in the cards about groups and hybridization', () => {
    expect(Object.keys(GROUPS).sort()).toEqual(PROBLEMS.map((p) => p.id).sort())
    for (const p of PROBLEMS) {
      for (const id of ['electron-group', 'hybridization'] as const) {
        const m = termCard(id, p).about.samples[0]!
        expect(sampleShape(m).groups, `${id} for ${p.id}`).not.toBe(GROUPS[p.id])
      }
    }
  })

  it('shows another shape than the molecule has, in the cards about shape, angles and dipoles', () => {
    for (const p of PROBLEMS) {
      for (const id of ['shape', 'bond-angle', 'net-dipole', 'polar-molecule', 'cancel', 'resonance'] as const) {
        const m = termCard(id, p).about.samples[0]!
        expect(sampleShape(m).shape, `${id} for ${p.id}`).not.toBe(p.shape)
      }
    }
  })

  it('never gives the electronegativity of an atom of the molecule, or does the subtraction the student is asked to do', () => {
    for (const p of PROBLEMS) {
      const sp = speciesOf(p)
      const mine = [...new Set(sp.terminals)].map((el) => bondPolarity(sp.center, el))
      for (const id of ['electronegativity', 'delta-en', 'polar', 'polar-bond', 'partial', 'dipole'] as const) {
        const c = termCard(id, p)
        const pic = c.picture
        if (pic.kind !== 'pair') throw new Error(`${id} has no pair picture`)
        const card = bondPolarity(pic.a, pic.b)
        expect(card.kind, `${id} for ${p.id}`).toBe('polar')
        // step 2 asks which atom is the least electronegative, so neither atom of the card's bond is one of the molecule's
        expect([pic.a, pic.b].filter((el) => elementsOf(p).includes(el)), `${id} for ${p.id}`).toEqual([])
        for (const el of elementsOf(p)) expect(`${c.example} ${c.note} ${c.pictureLabel}`.toLowerCase(), `${id} for ${p.id}`).not.toContain(ELEMENTS[el].name.toLowerCase())
        for (const b of mine) expect(card.delta, `${id} for ${p.id}: the same ΔEN as a bond of the molecule`).not.toBe(b.delta)
      }
    }
  })

  it('links only to terms the student has met by the step they are in', () => {
    const at = (step: StepId) => STEPS.findIndex((s) => s.id === step)
    for (const step of STEPS) {
      for (const id of ALL_TERMS) {
        for (const r of termCard(id, PROBLEMS[0]!, step.id).related) expect(at(termFrom(r.id)), `${id} links to ${r.id} in step ${step.id}`).toBeLessThanOrEqual(at(step.id))
      }
    }
    // free build links to everything
    expect(termCard('multiple').related.map((r) => r.id)).toEqual(['bond', 'sigma', 'pi'])
    expect(termCard('multiple', PROBLEMS[0]!, 'bond').related.map((r) => r.id)).toEqual(['bond'])
  })
})

describe('which words are highlighted', () => {
  it('finds each term in the sentences the app shows', () => {
    expect(terms("Valence electrons are the electrons in an atom's outer shell. Set the number for each atom.")).toEqual(['Valence electrons=valence', 'outer shell=shell'])
    expect(terms('A lone pair (2 unshared electrons on one atom) is 1 group. A bond is 1 group, even a double or triple bond.')).toEqual(['lone pair=lone-pair', 'unshared electrons=lone-pair', 'bond=bond', 'triple bond=multiple'])
    expect(terms('Subtract the smaller electronegativity from the larger. The difference is ΔEN: 0.4 or less is a nonpolar bond, and above 0.4 is a polar bond.')).toEqual(['electronegativity=electronegativity', 'ΔEN=delta-en', 'nonpolar bond=polar-bond', 'polar bond=polar-bond'])
    expect(terms('Oxygen pulls the shared electrons harder, so oxygen is δ− and carbon is δ+.')).toEqual(['shared electrons=bond', 'δ−=partial', 'δ+=partial'])
    expect(terms('The first bond between two atoms is a sigma bond. A second or third bond between the same two atoms is a pi bond.')).toEqual(['bond=bond', 'sigma bond=sigma', 'bond=bond', 'pi bond=pi'])
    expect(terms('How many electron groups are around carbon?')).toEqual(['electron groups=electron-group'])
    expect(terms('Every atom has a full shell. The formal charges are as small as they can be.')).toEqual(['full shell=full-shell', 'formal charges=formal-charge'])
    expect(terms('Nitrogen is in group 15. For groups 13 to 18, subtract 10 from the group number.')).toEqual(['group 15=group', 'groups 13 to 18=group', 'group number=group'])
    expect(terms('Atoms from period 3 onward can hold more than 8.')).toEqual(['period 3=group', 'more than 8=expanded'])
    expect(terms('The real ion is an average of the 2 drawings, which are called resonance structures.')).toEqual(['ion=ion', 'resonance structures=resonance'])
    expect(terms('Each bond arrow points at its δ− atom. Bond arrows that point in opposite directions cancel.')).toEqual(['bond arrow=dipole', 'δ−=partial', 'Bond arrows=dipole', 'cancel=cancel'])
    expect(terms('What is the hybridization of carbon?')).toEqual(['hybridization=hybridization'])
    expect(terms('Is carbon dioxide polar or nonpolar?')).toEqual(['polar=polar', 'nonpolar=polar'])
    expect(terms('The net dipole is the bond dipoles added up.')).toEqual(['net dipole=net-dipole', 'bond dipoles=dipole'])
  })

  it('reads a shape’s name as that shape’s term, the longest name first', () => {
    expect(terms('Trigonal bipyramidal, with bond angles of 90° and 120°.')).toEqual(['Trigonal bipyramidal=shape:trigonal bipyramidal', 'bond angles=bond-angle'])
    expect(terms('A T-shaped molecule and a square planar ion.')).toEqual(['T-shaped=shape:T-shaped', 'square planar=shape:square planar', 'ion=ion'])
    expect(terms('What shape do the atoms make?')).toEqual(['shape=shape'])
  })

  it('leaves "bond" plain where it is the verb, and "cancel" plain where the sentence is not about dipoles', () => {
    expect(terms('Bond each hydrogen atom to carbon. Each bond is 2 shared electrons, one from each atom.')).toEqual(['bond=bond', 'shared electrons=bond'])
    expect(terms('Drag it onto the atom it should bond to.')).toEqual([])
    expect(terms('Drop it on another atom to bond the two.')).toEqual([])
    expect(terms('A hydrogen atom makes only 1 bond.')).toEqual(['bond=bond'])
    expect(terms('The 2 lone pairs sit on opposite sides, so their pushes cancel.')).toEqual(['lone pairs=lone-pair'])
    expect(terms('The 3 N–H dipoles do not cancel.')).toEqual(['dipoles=dipole', 'cancel=cancel'])
  })

  it('leaves a word alone when it is part of a longer word', () => {
    expect(terms('The cation is shaped by its bonded atoms and their pivot.')).toEqual([])
    expect(terms('3 bonded atoms and 1 lone pair on nitrogen.')).toEqual(['lone pair=lone-pair'])
  })

  it('gives back the sentence unchanged when the pieces are joined', () => {
    for (const line of ['Is the C–O bond polar?', 'δ+', '', 'No terms here at all.', 'A lone pair (2 unshared electrons on one atom) is 1 group.']) {
      expect(termPieces(line).map((x) => x.text).join('')).toBe(line)
    }
  })

  it('leaves the first steps’ words plain once the Lewis structure is finished', () => {
    expect(plainTerms('count')).toEqual([])
    expect(plainTerms('check')).toEqual([])
    expect(plainTerms(null)).toEqual([])
    for (const step of ['shape', 'polar', 'orbitals'] as const) {
      expect(plainTerms(step).sort()).toEqual(['bond', 'ion', 'lewis', 'middle', 'shell', 'valence'])
      expect(terms('Is the C–O bond polar in the ammonium ion?', plainTerms(step))).toEqual(['polar=polar'])
    }
  })
})
