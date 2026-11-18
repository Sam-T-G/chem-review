// Bond polarity, molecular polarity, sigma and pi bonds, hybridization. The expected answers are
// the worked examples on the course's chapter 7 and chapter 8 slides, and the polarity of each
// guided molecule as any general chemistry text gives it. None of them come from the code.
import { describe, expect, it } from 'vitest'
import { ELEMENTS, EL_ORDER, type El } from '../src/chem/elements'
import { HYBRIDS, domainsOf, hybridFor, sigmaPi } from '../src/chem/orbitals'
import { COURSE_EN, bondPolarity, courseEN, moleculePolarity, netAsSeen, type SeenBond } from '../src/chem/polarity'
import { PROBLEMS, speciesOf } from '../src/chem/problems'
import { idealDirs, type V3 } from '../src/chem/repulsion'
import { addElectron, formalCharge, netCharge, share, type Structure } from '../src/chem/structure'
import { shapeOf } from '../src/chem/vsepr'
import { drawn, solveLikeAStudent, star } from './helpers'

const must = (op: ReturnType<typeof share>): Structure => {
  if (!op.ok) throw new Error(op.why)
  return op.s
}

describe('bond polarity, with the table and the cutoffs on the chapter 7 slides', () => {
  it('has a table value for every atom, close to the Pauling value', () => {
    for (const el of EL_ORDER) {
      expect(COURSE_EN[el], el).toBeGreaterThan(0)
      // the slide table is the Pauling table rounded for arithmetic by hand
      expect(Math.abs(COURSE_EN[el] / 10 - ELEMENTS[el].en!), el).toBeLessThanOrEqual(0.2)
    }
    expect(courseEN('O')).toBe('3.5')
    expect(courseEN('H')).toBe('2.1')
  })
  it('works the slide examples: larger minus smaller, then the cutoff', () => {
    // HCl: 3.0 − 2.1 = 0.9, polar, chlorine is δ−
    expect(bondPolarity('H', 'Cl')).toEqual({ negative: 'Cl', positive: 'H', high: '3.0', low: '2.1', tenths: 9, delta: '0.9', kind: 'polar' })
    // CO2: 3.5 − 2.5 = 1.0, polar. H2O: 3.5 − 2.1 = 1.4, polar. NH3: 3.0 − 2.1 = 0.9, polar.
    expect(bondPolarity('C', 'O')).toMatchObject({ negative: 'O', delta: '1.0', kind: 'polar' })
    expect(bondPolarity('O', 'H')).toMatchObject({ negative: 'O', delta: '1.4', kind: 'polar' })
    expect(bondPolarity('N', 'H')).toMatchObject({ negative: 'N', delta: '0.9', kind: 'polar' })
    // CH2F2: C–F is 4.0 − 2.5 = 1.5, polar. C–H is 2.5 − 2.1 = 0.4, nonpolar.
    expect(bondPolarity('C', 'F')).toMatchObject({ negative: 'F', delta: '1.5', kind: 'polar' })
    expect(bondPolarity('C', 'H')).toMatchObject({ negative: 'C', positive: 'H', delta: '0.4', kind: 'nonpolar' })
  })
  it('puts the cutoffs where the slides do: 0.4 is still nonpolar, 2.0 is still polar', () => {
    expect(bondPolarity('F', 'F')).toMatchObject({ negative: null, positive: null, delta: '0.0', kind: 'nonpolar' })
    expect(bondPolarity('C', 'N')).toMatchObject({ delta: '0.5', kind: 'polar' })
    expect(bondPolarity('B', 'F')).toMatchObject({ delta: '2.0', kind: 'polar' })
    expect(bondPolarity('Be', 'F')).toMatchObject({ delta: '2.5', kind: 'ionic' })
  })
  it('agrees with the Pauling values about which atom is δ−, for every bond in the guided problems', () => {
    for (const p of PROBLEMS) {
      for (const el of new Set(speciesOf(p).terminals)) {
        const b = bondPolarity(p.center, el)
        if (b.negative === null) continue
        expect(ELEMENTS[b.negative].en!, `${p.id}: ${p.center}–${el}`).toBeGreaterThan(ELEMENTS[b.positive!].en!)
      }
    }
  })
})

describe('molecular polarity: add the bond dipoles in the shape', () => {
  const POLAR = ['NH3', 'H2O', 'CH2O', 'HCN', 'SF4', 'ClF3', 'BrF5', 'SO2']
  const NONPOLAR = ['CH4', 'CO2', 'BF3', 'PCl5', 'XeF2', 'SF6', 'XeF4']
  // ions: whether the bond dipoles cancel (the slides do this for nitrate)
  const ION_CANCELS: Record<string, boolean> = { 'NH4+': true, 'NO2-': false, 'CO3 2-': true, 'SO4 2-': true, 'PO4 3-': true }

  it('covers every guided problem', () => {
    expect([...POLAR, ...NONPOLAR, ...Object.keys(ION_CANCELS)].sort()).toEqual(PROBLEMS.map((p) => p.id).sort())
  })
  it('gets each guided molecule right', () => {
    for (const id of POLAR) expect(moleculePolarity(solveLikeAStudent(id))!.polar, id).toBe(true)
    for (const id of NONPOLAR) expect(moleculePolarity(solveLikeAStudent(id))!.polar, id).toBe(false)
    for (const [id, cancels] of Object.entries(ION_CANCELS)) expect(moleculePolarity(solveLikeAStudent(id))!.polar, id).toBe(!cancels)
    for (const p of PROBLEMS) expect(moleculePolarity(solveLikeAStudent(p.id))!.depends, p.id).toBe(false)
  })
  it('says why, the way the slides reason', () => {
    const why = (id: string) => moleculePolarity(solveLikeAStudent(id))!.why
    // CO2: two polar bonds that cancel in the linear shape. SF6: all the same, so nonpolar.
    expect(why('CO2')).toBe('cancel')
    expect(why('SF6')).toBe('cancel')
    expect(why('XeF4')).toBe('cancel')
    // methane: C–H is 0.4, nonpolar, so there is nothing to add
    expect(why('CH4')).toBe('no-polar-bonds')
    // water and ammonia: the bonds cannot cancel in a bent or pyramidal shape
    expect(why('H2O')).toBe('shape')
    expect(why('NH3')).toBe('shape')
    expect(why('BrF5')).toBe('shape')
    // formaldehyde: "does NOT cancel", because the outer atoms differ
    expect(why('CH2O')).toBe('different')
    expect(why('HCN')).toBe('different')
  })
  it('lists the bond dipoles: which way each arrow points, and none for a nonpolar bond', () => {
    const water = moleculePolarity(solveLikeAStudent('H2O'))!
    expect(water.center.el).toBe('O')
    // oxygen is the more electronegative atom, so both arrows point in to it
    expect(water.bonds.map((b) => [b.el, b.out, b.size])).toEqual([['H', -1, 14], ['H', -1, 14]])
    expect(water.kinds).toMatchObject([{ center: 'O', terminal: 'H', count: 2 }])
    const co2 = moleculePolarity(solveLikeAStudent('CO2'))!
    expect(co2.bonds.map((b) => b.out)).toEqual([1, 1])
    expect(co2.net).toBeNull()
    // formaldehyde: an arrow on C=O, "no arrow for H because nonpolar"
    const ch2o = moleculePolarity(solveLikeAStudent('CH2O'))!
    expect(ch2o.bonds.map((b) => [b.el, b.out]).sort()).toEqual([['H', 0], ['H', 0], ['O', 1]])
    expect(ch2o.kinds.map((k) => `${k.center}-${k.terminal}:${k.polarity.kind}:${k.count}`).sort()).toEqual(['C-H:nonpolar:2', 'C-O:polar:1'])
  })
  it('works the other slide examples in free build', () => {
    // CH2F2: tetrahedral, C–F polar and C–H nonpolar, a net dipole
    expect(moleculePolarity(star(['C', 'F', 'F', 'H', 'H'], [1, 1, 1, 1]).s)).toMatchObject({ polar: true, why: 'different' })
    // HF is polar, F2 is nonpolar: a molecule with one bond follows that bond
    expect(moleculePolarity(star(['H', 'F'], [1]).s)).toMatchObject({ polar: true })
    expect(moleculePolarity(star(['F', 'F'], [1]).s)).toMatchObject({ polar: false, why: 'no-polar-bonds' })
    // nitrate: polar bonds that cancel (drawn here with nitrogen's octet: one double bond, two single)
    const b = star(['N', 'O', 'O', 'O'], [2, 1, 1])
    const nitrate = must(addElectron(b.s, b.ids[2]!)) // the ion's extra electron goes on the oxygen that is short
    expect(netCharge(nitrate)).toBe(-1)
    expect(shapeOf(nitrate)?.shape).toBe('trigonal planar')
    expect(moleculePolarity(nitrate)).toMatchObject({ polar: false, why: 'cancel' })
  })
  it('ozone, the odd case on the slides: ΔEN is 0, and the formal charges still make it polar', () => {
    // O=O–O: +1 on the middle oxygen, −1 on the single-bonded one
    const ozone = star(['O', 'O', 'O'], [2, 1]).s
    expect(ozone.atoms.map((a) => formalCharge(ozone, a.id))).toEqual([1, 0, -1])
    expect(shapeOf(ozone)?.shape).toBe('bent')
    const p = moleculePolarity(ozone)!
    expect(p.kinds[0]!.polarity).toMatchObject({ delta: '0.0', kind: 'nonpolar' })
    expect(p).toMatchObject({ polar: true, why: 'charges' })
  })
  it('ozone: the outer two oxygens share the −1, so the net dipole runs along the bisector, from the middle oxygen out', () => {
    // the slides: +1 on the middle oxygen, −1 shared by the outer two. Each outer oxygen counts −1/2, so both
    // bonds carry the same gap (1.5) and the two arrows are the same length, whichever drawing is on the board.
    for (const orders of [[2, 1], [1, 2]]) {
      // the middle oxygen keeps one lone pair; each outer oxygen fills to 8
      const ozone = drawn('O', ['O', 'O'], orders, 2).s
      expect(ozone.atoms.map((a) => formalCharge(ozone, a.id)), `${orders}`).toEqual(orders[0] === 2 ? [1, 0, -1] : [1, -1, 0])
      const p = moleculePolarity(ozone)!
      expect(p, `${orders}`).toMatchObject({ polar: true, why: 'charges' })
      expect(p.bonds.map((b) => b.out), `${orders}`).toEqual([1, 1])
      expect(p.bonds[0]!.size, `${orders}`).toBeCloseTo(p.bonds[1]!.size)
      // in the textbook seats: the net dipole lies along the sum of the two bond directions
      const [a, b] = idealDirs(2, 1)!
      const bisector = [a![0] + b![0], a![1] + b![1], a![2] + b![2]]
      const len = Math.hypot(bisector[0]!, bisector[1]!, bisector[2]!)
      for (let k = 0; k < 3; k++) expect(p.net![k], `${orders} axis ${k}`).toBeCloseTo(bisector[k]! / len)
      // as a viewer sees it: the outer oxygens hang below the middle one, 117° apart, so the arrow points straight down
      const seen: SeenBond[] = p.bonds.map((x, i) => ({ atomId: x.atomId, dir: [(i === 0 ? -1 : 1) * Math.sin((58.5 * Math.PI) / 180), -Math.cos((58.5 * Math.PI) / 180), 0] }))
      const net = netAsSeen(p, seen)!
      expect(net.x, `${orders}`).toBeCloseTo(0)
      expect(net.y, `${orders}`).toBeCloseTo(-1)
    }
  })
  it('gives no bond dipole to two different elements with the same table value (the ozone rule is for one element)', () => {
    // PH2−: P–H is 2.1 − 2.1 = 0.0, nonpolar. Phosphorus carries −1 (5 − 4 − 2), but P and H are different
    // elements, so there is no bond dipole and nothing to add.
    const ph2 = drawn('P', ['H', 'H'], [1, 1], 4).s
    expect(formalCharge(ph2, ph2.atoms[0]!.id)).toBe(-1)
    const p = moleculePolarity(ph2)!
    expect(p).toMatchObject({ polar: false, why: 'no-polar-bonds', net: null })
    expect(p.bonds.map((b) => b.out)).toEqual([0, 0])
    // CS3 2−: C–S is 2.5 − 2.5 = 0.0; one C=S and two C–S with −1 on each single-bonded sulfur, as carbonate
    // is drawn. No bond is polar, so the ion is nonpolar.
    const cs3 = drawn('C', ['S', 'S', 'S'], [2, 1, 1], 0).s
    expect(netCharge(cs3)).toBe(-2)
    expect(moleculePolarity(cs3)).toMatchObject({ polar: false, why: 'no-polar-bonds', net: null })
    // NCl4+: N–Cl is 3.0 − 3.0 = 0.0, nitrogen carries +1, and still no bond is polar
    const ncl4 = drawn('N', ['Cl', 'Cl', 'Cl', 'Cl'], [1, 1, 1, 1], 0).s
    expect(netCharge(ncl4)).toBe(1)
    expect(moleculePolarity(ncl4)).toMatchObject({ polar: false, why: 'no-polar-bonds' })
  })
  it('flags the cases where the answer depends on which seats unlike atoms take', () => {
    // PCl3F2: five groups, two kinds of outer atom
    const mixed = star(['P', 'Cl', 'Cl', 'Cl', 'F', 'F'], [1, 1, 1, 1, 1]).s
    expect(moleculePolarity(mixed)!.depends).toBe(true)
    expect(moleculePolarity(star(['C', 'F', 'F', 'H', 'H'], [1, 1, 1, 1]).s)!.depends).toBe(false)
  })
  it('has nothing to say about boards with no single middle atom', () => {
    expect(moleculePolarity(star(['C']).s)).toBeNull()
    expect(moleculePolarity(star(['C', 'H', 'H']).s)).toBeNull()
  })
})

describe('the net dipole as a viewer sees it', () => {
  // Each bond's direction from the middle atom, as a viewer sees the molecule: x to the right, y up,
  // z toward the viewer. `place` gives the direction of the k-th atom of an element.
  const seen = (s: Structure, place: (el: El, k: number) => V3): SeenBond[] => {
    const count = new Map<El, number>()
    return moleculePolarity(s)!.bonds.map((b) => {
      const k = count.get(b.el) ?? 0
      count.set(b.el, k + 1)
      return { atomId: b.atomId, dir: place(b.el, k) }
    })
  }
  const rad = (deg: number) => (deg * Math.PI) / 180
  const view = (id: string, place: (el: El, k: number) => V3) => {
    const s = solveLikeAStudent(id)
    return netAsSeen(moleculePolarity(s)!, seen(s, place))
  }
  /** Two atoms below the middle atom, `angle` degrees apart, one on each side. */
  const below = (angle: number) => (_el: El, k: number): V3 => [(k === 0 ? -1 : 1) * Math.sin(rad(angle / 2)), -Math.cos(rad(angle / 2)), 0]

  it('water: the net dipole points from the hydrogens toward oxygen', () => {
    // the hydrogens hang below oxygen, 104.5° apart: the oxygen end is δ−, so the arrow points up
    const net = view('H2O', below(104.5))!
    expect(net.x).toBeCloseTo(0)
    expect(net.y).toBeCloseTo(1)
    expect(net.across).toBeCloseTo(1)
  })
  it('sulfur dioxide: the net dipole points from sulfur toward the oxygens', () => {
    // the oxygens are δ−, so with both below sulfur the arrow points down
    const net = view('SO2', below(119))!
    expect(net.x).toBeCloseTo(0)
    expect(net.y).toBeCloseTo(-1)
  })
  it('ammonia: the net dipole points from the three hydrogens up through nitrogen', () => {
    // a pyramid with nitrogen on top: each N–H bond leans 68° away from the downward axis
    const lean = rad(68)
    const net = view('NH3', (_el, k) => [Math.sin(lean) * Math.cos(rad(120 * k)), -Math.cos(lean), Math.sin(lean) * Math.sin(rad(120 * k))])!
    expect(net.x).toBeCloseTo(0)
    expect(net.y).toBeCloseTo(1)
    expect(net.across).toBeCloseTo(1)
  })
  it('formaldehyde and hydrogen cyanide: the net dipole is the one polar bond, toward oxygen or nitrogen', () => {
    // oxygen to the right of carbon, the hydrogens up and down on the left
    const ch2o = view('CH2O', (el, k) => (el === 'O' ? [1, 0, 0] : [-0.5, k === 0 ? 0.866 : -0.866, 0]))!
    expect(ch2o.x).toBeCloseTo(1)
    expect(ch2o.y).toBeCloseTo(0)
    // H–C≡N on a line, nitrogen on the left
    const hcn = view('HCN', (el) => (el === 'N' ? [-1, 0, 0] : [1, 0, 0]))!
    expect(hcn.x).toBeCloseTo(-1)
    expect(hcn.y).toBeCloseTo(0)
  })
  it('says how much of the net dipole lies across the screen', () => {
    // water seen from below, with the hydrogens nearer the viewer: the dipole points straight away
    const away = view('H2O', (_el, k) => [(k === 0 ? -1 : 1) * Math.sin(rad(52.25)), 0, Math.cos(rad(52.25))])!
    expect(away.across).toBeCloseTo(0)
    // tipped 60° out of the screen: half of it is left across the screen
    const tipped = view('HCN', (el) => (el === 'N' ? [0.5, 0, 0.866] : [-0.5, 0, -0.866]))!
    expect(tipped.across).toBeCloseTo(0.5, 2)
    expect(tipped.x).toBeCloseTo(1)
  })
  it('has no net dipole to show when the bond dipoles cancel, or when a bond was left out', () => {
    expect(view('CO2', (_el, k) => [k === 0 ? -1 : 1, 0, 0])).toBeNull()
    expect(view('CH4', () => [1, 0, 0])).toBeNull()
    const water = solveLikeAStudent('H2O')
    expect(netAsSeen(moleculePolarity(water)!, seen(water, below(104.5)).slice(1))).toBeNull()
  })
})

describe('sigma and pi bonds, and hybridization (chapter 8 slides)', () => {
  it('the first bond is always a sigma bond; the rest are pi bonds', () => {
    // H–Cl: one sigma. O=O: one sigma, one pi. N≡N: one sigma, two pi.
    expect(sigmaPi(star(['H', 'Cl'], [1]).s)).toEqual({ sigma: 1, pi: 0 })
    expect(sigmaPi(star(['O', 'O'], [2]).s)).toEqual({ sigma: 1, pi: 1 })
    expect(sigmaPi(star(['N', 'N'], [3]).s)).toEqual({ sigma: 1, pi: 2 })
    expect(sigmaPi(solveLikeAStudent('CH4'))).toEqual({ sigma: 4, pi: 0 })
    expect(sigmaPi(solveLikeAStudent('CO2'))).toEqual({ sigma: 2, pi: 2 })
    expect(sigmaPi(solveLikeAStudent('HCN'))).toEqual({ sigma: 2, pi: 2 })
    expect(sigmaPi(solveLikeAStudent('CH2O'))).toEqual({ sigma: 3, pi: 1 })
    // sulfate as this app draws it: four bonds to oxygen, two of them double
    expect(sigmaPi(solveLikeAStudent('SO4 2-'))).toEqual({ sigma: 4, pi: 2 })
  })
  it('hybridization follows the number of electron domains', () => {
    expect([2, 3, 4, 5, 6].map(hybridFor)).toEqual(['sp', 'sp2', 'sp3', 'sp3d', 'sp3d2'])
    expect(hybridFor(1)).toBeNull()
    expect(hybridFor(7)).toBeNull()
    for (const h of HYBRIDS) expect(hybridFor(domainsOf(h))).toBe(h)
    const of = (id: string) => hybridFor(shapeOf(solveLikeAStudent(id))!.groups)
    // 4 domains: methane, ammonia and water are all sp3. 3 domains: sp2. 2 domains: sp.
    expect(['CH4', 'NH3', 'H2O'].map(of)).toEqual(['sp3', 'sp3', 'sp3'])
    expect(['CH2O', 'BF3', 'SO2', 'CO3 2-'].map(of)).toEqual(['sp2', 'sp2', 'sp2', 'sp2'])
    // a double or triple bond is one domain
    expect(['CO2', 'HCN'].map(of)).toEqual(['sp', 'sp'])
    expect(['PCl5', 'SF4', 'ClF3', 'XeF2'].map(of)).toEqual(['sp3d', 'sp3d', 'sp3d', 'sp3d'])
    expect(['SF6', 'BrF5', 'XeF4'].map(of)).toEqual(['sp3d2', 'sp3d2', 'sp3d2'])
  })
})
