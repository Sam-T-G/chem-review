import { beforeEach, describe, expect, it } from 'vitest'
import type { El } from '../src/chem/elements'
import type { SeenBond } from '../src/chem/polarity'
import { PROBLEMS } from '../src/chem/problems'
import type { V3 } from '../src/chem/repulsion'
import { polarity } from '../src/modules/lewis/guide'
import * as store from '../src/modules/lewis/store'

const idx = (id: string) => PROBLEMS.findIndex((p) => p.id === id)

/** Answer the count step for the current problem through the store's own actions. */
function finishCount() {
  const p = store.problemOf()
  const valence: Record<string, number> = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, Xe: 8 }
  for (const [el] of p.formula) store.setCount(el, valence[el]!)
  store.checkCounts()
  store.typeTotal(p.formula.reduce((n, [el, k]) => n + valence[el]! * k, 0) - p.charge)
  store.checkTotal()
}

/** The finished molecule on the board as a viewer sees it: x to the right, y up, z toward the
 *  viewer. `place` gives the direction from the middle atom to the k-th atom of an element. */
function seenAs(place: (el: El, k: number) => V3): SeenBond[] {
  const m = polarity(store.getState().s)!
  const count = new Map<El, number>()
  return m.bonds.map((b) => {
    const k = count.get(b.el) ?? 0
    count.set(b.el, k + 1)
    return { atomId: b.atomId, dir: place(b.el, k) }
  })
}
const rad = (degrees: number) => (degrees * Math.PI) / 180
// Water with the hydrogens below oxygen, 104.5° apart. Each O–H arrow points at oxygen, so the two
// add up to an arrow that points straight up.
const WATER = (_el: El, k: number): V3 => [(k === 0 ? -1 : 1) * Math.sin(rad(52.25)), -Math.cos(rad(52.25)), 0]
const UP = { x: 0, y: 1 }
// The same water seen from below the hydrogens: the net dipole points straight away from the viewer.
const WATER_END_ON = (_el: El, k: number): V3 => [(k === 0 ? -1 : 1) * Math.sin(rad(52.25)), 0, Math.cos(rad(52.25))]
// Formaldehyde with oxygen to the right of carbon: its one bond arrow, C to O, points right.
const FORMALDEHYDE = (el: El, k: number): V3 => (el === 'O' ? [1, 0, 0] : [-0.5, k === 0 ? 0.866 : -0.866, 0])
const RIGHT = { x: 1, y: 0 }
const turned = (v: { x: number; y: number }, degrees: number) => ({ x: v.x * Math.cos(rad(degrees)) - v.y * Math.sin(rad(degrees)), y: v.x * Math.sin(rad(degrees)) + v.y * Math.cos(rad(degrees)) })
const WORLD: V3 = [1, 0, 0]

/** Work a problem through the store's own actions up to the start of the given step, answering everything right. */
function toStep(id: string, step: 'shape' | 'polar' | 'orbitals') {
  store.selectProblem(idx(id))
  const p = store.problemOf()
  finishCount()
  store.next()
  store.pickMiddle(p.center)
  const c = store.place(p.center, null)!
  const outer = p.formula.flatMap(([el, k]) => new Array<typeof el>(el === p.center ? k - 1 : k).fill(el)).map((el) => store.place(el, null)!)
  store.next()
  for (const o of outer) store.bond(o, c)
  store.next()
  // CO2 and CH2O need second bonds: bond each outer atom again until the check step is done
  for (let guard = 0; guard < 8 && !store.stepDone('check'); guard++) {
    const short = outer.find((o) => {
      const before = store.getState().s
      store.bond(o, c)
      if (store.stepDone('check') || store.getState().s !== before) return true
      return false
    })
    if (!short) break
  }
  if (!store.stepDone('check')) throw new Error(`${id}: the check step is not finished`)
  store.next()
  const st = store.getState()
  const groups = st.s.bonds.length + Math.floor((st.s.atoms.find((a) => a.id === c)!.lone ?? 0) / 2)
  store.answerGroups(groups)
  store.pickShape(p.shape)
  if (step === 'shape') return
  store.next()
  if (step === 'polar') return
  for (const guess of ['nonpolar', ...p.formula.map(([el]) => el)] as const) {
    for (let k = 0; k < 4 && store.bondAsked(); k++) store.answerBond(store.bondAsked()!, guess)
  }
  while (store.bondAsked()) {
    const asked = store.bondAsked()!
    for (const guess of ['nonpolar', p.center, asked] as const) store.answerBond(asked, guess)
  }
  store.answerNet(true)
  // a polar molecule's net dipole is drawn before the step is done, and each test that needs one draws it
  if (store.drawing() === 'net') throw new Error(`${id}: the net dipole has to be drawn before step 7`)
  store.next()
}

beforeEach(() => {
  store.setMode('guided')
  store.selectProblem(0)
})

describe('guided steps', () => {
  it('keeps the board locked during the count step and opens each step in order', () => {
    expect(store.getState().step).toBe('count')
    expect(store.editable()).toBe(false)
    expect(store.place('C', null)).toBeNull()
    expect(store.unlocked()).toBe(0)
    store.next() // not done yet: nothing happens
    expect(store.getState().step).toBe('count')
    finishCount()
    expect(store.stepDone('count')).toBe(true)
    store.next()
    expect(store.getState().step).toBe('place')
    expect(store.editable()).toBe(true)
  })

  it('wrong counts add feedback and tries, and a right count locks the row', () => {
    store.setCount('C', 6)
    store.setCount('H', 1)
    store.checkCounts()
    const c = store.getState().count
    expect(c.right.H).toBe(true)
    expect(c.right.C).toBeUndefined()
    expect(c.feedback.C).toMatchObject({ lead: "6 is carbon's atomic number.", show: { kind: 'shells', el: 'C' } })
    expect(c.tries.C).toBe(1)
    store.setCount('H', 5) // locked: no change
    expect(store.getState().count.answers.H).toBe(1)
    // the explanation stays up while the number is changed, and the row stops showing as wrong
    store.setCount('C', 4)
    expect(store.getState().count.feedback.C).toMatchObject({ lead: "6 is carbon's atomic number." })
    expect(store.getState().count.changed.C).toBe(true)
    store.checkCounts()
    expect(store.getState().count.right.C).toBe(true)
  })

  it('offers only the atoms of the formula, and no more of each than the formula has', () => {
    finishCount()
    store.next()
    store.pickMiddle('C')
    expect(store.trayItems()).toEqual([{ el: 'C', n: 1 }, { el: 'H', n: 4 }])
    expect(store.place('O', null)).toBeNull()
    expect(store.place('C', null)).not.toBeNull()
    expect(store.place('C', null)).toBeNull()
    for (let i = 0; i < 4; i++) expect(store.place('H', null)).not.toBeNull()
    expect(store.place('H', null)).toBeNull()
    expect(store.stepDone('place')).toBe(true)
  })

  it('walks methane to the shape step, and a wrong shape pick still reveals the 3D view', () => {
    finishCount()
    store.next()
    store.pickMiddle('C')
    const c = store.place('C', null)!
    const hs = [0, 1, 2, 3].map(() => store.place('H', null)!)
    store.next()
    expect(store.getState().step).toBe('bond')
    for (const h of hs) store.bond(h, c)
    expect(store.stepDone('bond')).toBe(true)
    store.next()
    expect(store.stepDone('check')).toBe(true)
    store.next()
    expect(store.getState().step).toBe('shape')
    expect(store.editable()).toBe(false)
    store.pickShape('tetrahedral') // too early: the group count comes first
    expect(store.getState().shape.pick).toBeNull()
    store.answerGroups(5)
    expect(store.getState().shape.groupsRight).toBe(false)
    // a wrong count is explained, and each one gets a new number so the board rings the groups once per answer
    const first = store.getState().shape.groupsCoach!
    expect(first).toMatchObject({ lead: '5 counts carbon as a group.', show: { kind: 'groups', which: 'all' } })
    store.answerGroups(3)
    expect(store.getState().shape.groupsCoach!.n).toBeGreaterThan(first.n)
    store.answerGroups(4)
    expect(store.getState().shape).toMatchObject({ groupsRight: true, groupsCoach: null })
    store.pickShape('square planar')
    const s = store.getState()
    expect(s.shape.pickRight).toBe(false)
    expect(s.shape.pickFeedback).toBeNull()
    expect(s.shape.pickCoach).toMatchObject({ lead: 'Square planar is how the 4 bonds look in a flat drawing, 90° apart.', ask: 'The shape is tetrahedral.' })
    expect(s.view).toBe('shape')
    // the shape is not the end any more: polarity and bonding come first
    expect(s.solved).not.toContain('CH4')
    store.next()
    expect(store.getState()).toMatchObject({ step: 'polar', view: 'shape' })
    expect(store.editable()).toBe(false)
  })

  it('step 6: each kind of bond is answered until right, then one final answer for the molecule', () => {
    toStep('CO2', 'polar')
    expect(store.bondAsked()).toBe('O')
    store.answerNet(false) // too early: the bond comes first
    expect(store.getState().polar.net.pick).toBeNull()
    store.answerBond('O', 'C') // δ− on the wrong atom
    expect(store.getState().polar.bonds.O).toMatchObject({ right: false, tries: 1, pick: 'C', coach: { lead: 'That arrow points at carbon.' } })
    store.answerBond('O', 'nonpolar')
    expect(store.getState().polar.bonds.O).toMatchObject({ right: false, tries: 2 })
    store.answerBond('O', 'O')
    expect(store.getState().polar.bonds.O).toMatchObject({ right: true, coach: null, text: 'Polar. ΔEN = 3.5 − 2.5 = 1.0. Oxygen pulls the shared electrons harder, so oxygen is δ− and carbon is δ+.' })
    expect(store.bondAsked()).toBeNull()
    expect(store.stepDone('polar')).toBe(false)
    store.answerNet(true) // wrong: the dipoles cancel
    const net = store.getState().polar.net
    expect(net).toMatchObject({ pick: true, right: false, coach: { ask: 'Carbon dioxide is nonpolar.' } })
    store.answerNet(false) // the first answer was final
    expect(store.getState().polar.net).toBe(net)
    // the dipoles cancel, so there is no net dipole to draw
    expect(store.drawing()).toBeNull()
    expect(store.stepDone('polar')).toBe(true)
  })

  it('step 6: a bond is answered by drawing its arrow from one atom to the other', () => {
    toStep('CO2', 'polar')
    const st = store.getState()
    const c = st.s.atoms.find((a) => a.el === 'C')!.id
    const [o1, o2] = st.s.atoms.filter((a) => a.el === 'O').map((a) => a.id) as [string, string]
    expect(store.drawing()).toBe('bond')
    // between the two oxygens there is no bond: refused, and no try is counted
    store.drawBondArrow(o1, o2)
    expect(store.getState().polar.bonds.O).toBeUndefined()
    expect(store.getState().toast).toMatchObject({ tone: 'warn', text: 'This question is about the C–O bond. Draw the arrow from carbon to oxygen, or from oxygen to carbon.' })
    expect(store.getState().refused!.ids).toEqual([o1, o2])
    // from oxygen to carbon: the arrow points at carbon, the δ+ atom
    store.drawBondArrow(o1, c)
    expect(store.getState().polar.bonds.O).toMatchObject({ right: false, tries: 1, pick: 'C', drawn: { from: o1, to: c }, coach: { lead: 'That arrow points at carbon.', ask: 'Compare the two atoms in the table, then draw the arrow again.' } })
    expect(store.getState().refused!.ids).toEqual([o1, c])
    // the button for a nonpolar bond is wrong too, and leaves no arrow behind
    store.answerBond('O', 'nonpolar')
    expect(store.getState().polar.bonds.O).toMatchObject({ right: false, tries: 2, pick: 'nonpolar', drawn: null })
    // from carbon to the other oxygen: one right arrow answers both C–O bonds
    store.drawBondArrow(c, o2)
    expect(store.getState().polar.bonds.O).toMatchObject({ right: true, pick: 'O', drawn: null, coach: null })
    expect(store.bondAsked()).toBeNull()
    expect(store.drawing()).toBeNull()
    store.drawBondArrow(c, o1) // nothing is asked now
    expect(store.getState().polar.bonds.O!.tries).toBe(2)
  })

  it('step 6: without a drag, an arrow takes a tap on each atom, or Enter on each', () => {
    toStep('CO2', 'polar')
    const st = store.getState()
    const c = st.s.atoms.find((a) => a.el === 'C')!.id
    const o = st.s.atoms.find((a) => a.el === 'O')!.id
    expect(store.editable()).toBe(false)
    store.tapAtom(c, true)
    expect(store.getState().selection).toEqual({ kind: 'atom', id: c })
    store.tapAtom(c, true) // the same atom again takes the start back
    expect(store.getState().selection).toBeNull()
    store.tapAtom(c)
    store.tapAtom(o)
    expect(store.getState().selection).toBeNull()
    expect(store.getState().polar.bonds.O).toMatchObject({ right: true, pick: 'O' })
    // with no arrow to draw, a tap on the finished model does nothing
    store.tapAtom(c)
    expect(store.getState().selection).toBeNull()
  })

  it('step 6: the net dipole of a polar molecule is drawn, and only its direction is judged', () => {
    toStep('H2O', 'polar')
    const st = store.getState()
    const o = st.s.atoms.find((a) => a.el === 'O')!.id
    const h = st.s.atoms.find((a) => a.el === 'H')!.id
    store.drawBondArrow(h, o)
    expect(store.getState().polar.bonds.H).toMatchObject({ right: true, pick: 'O' })
    const seen = seenAs(WATER)
    const net = UP
    store.drawNetArrow(net, seen, WORLD) // too early: polar or nonpolar comes first
    expect(store.getState().polar.arrow.tries).toBe(0)
    expect(store.netArrowAsked()).toBe(false)
    store.moreHint()
    store.setView('flat')
    store.answerNet(true)
    // the question opens on the 3D model, with hints of its own
    expect(store.getState()).toMatchObject({ view: 'shape', hints: 0 })
    expect(store.netArrowAsked()).toBe(true)
    expect(store.drawing()).toBe('net')
    expect(store.stepDone('polar')).toBe(false)
    store.moreHint()
    expect(store.currentHints()).toEqual(['Each bond arrow points at its δ− atom. Bond arrows that point in opposite directions cancel.'])
    // drawn the opposite way
    store.drawNetArrow(turned(net, 180), seen, [0, 1, 0])
    expect(store.getState().polar.arrow).toMatchObject({ right: false, tries: 1, drawn: [0, 1, 0], coach: { lead: 'That arrow points against the bond arrows.' } })
    expect(store.getState().refused!.ids).toEqual([o])
    // drawn while the net dipole points away from the viewer: the model turns, and the try does not count
    store.drawNetArrow(net, seenAs(WATER_END_ON), WORLD)
    expect(store.getState().polar).toMatchObject({ aim: 1, arrow: { tries: 1 } })
    expect(store.getState().toast!.text).toBe('The net dipole pointed toward you or away from you, so the model turned. Draw the arrow again.')
    // 60° off is wrong, 30° off is right
    store.drawNetArrow(turned(net, 60), seen, WORLD)
    expect(store.getState().polar.arrow).toMatchObject({ right: false, tries: 2 })
    store.moreHint()
    expect(store.currentHints()).toHaveLength(2)
    store.drawNetArrow(turned(net, 30), seen, WORLD)
    expect(store.getState().polar.arrow).toMatchObject({ right: true, tries: 2, drawn: null, coach: null, text: 'The 2 O–H dipoles add up to a net dipole that points from the middle of the 2 hydrogen atoms toward oxygen.' })
    // the hints about adding the arrows close with the question, and the hints about a bond do not take their place
    expect(store.currentHints()).toEqual([])
    expect(store.drawing()).toBeNull()
    expect(store.stepDone('polar')).toBe(true)
    store.next()
    expect(store.getState().step).toBe('orbitals')
  })

  it('step 6: the net dipole is drawn on the 3D model only', () => {
    toStep('H2O', 'polar')
    const st = store.getState()
    store.drawBondArrow(st.s.atoms.find((a) => a.el === 'H')!.id, st.s.atoms.find((a) => a.el === 'O')!.id)
    store.answerNet(false) // wrong, and final: water is polar, so its net dipole is still asked for
    expect(store.getState().polar.net).toMatchObject({ right: false, coach: { ask: 'Water is polar.' } })
    expect(store.drawing()).toBe('net')
    store.setView('flat')
    expect(store.netArrowAsked()).toBe(true)
    expect(store.drawing()).toBeNull()
    store.drawNetArrow(UP, seenAs(WATER), WORLD)
    expect(store.getState().polar.arrow.right).toBe(false)
    store.setView('shape')
    store.drawNetArrow(UP, seenAs(WATER), WORLD)
    expect(store.getState().polar.arrow.right).toBe(true)
  })

  it('step 6: formaldehyde has two kinds of bond, asked one after the other', () => {
    toStep('CH2O', 'polar')
    expect(store.bondAsked()).toBe('H')
    store.answerBond('O', 'O') // not this bond's turn
    expect(store.getState().polar.bonds.O).toBeUndefined()
    // an arrow along the C–O bond is refused while the C–H bond is the question
    const st = store.getState()
    const c = st.s.atoms.find((a) => a.el === 'C')!.id
    const o = st.s.atoms.find((a) => a.el === 'O')!.id
    store.drawBondArrow(c, o)
    expect(store.getState().polar.bonds.O).toBeUndefined()
    expect(store.getState().toast!.text).toBe('This question is about the C–H bond. Draw the arrow from carbon to hydrogen, or from hydrogen to carbon.')
    // an arrow on the C–H bond says the bond is polar, and it is not
    store.drawBondArrow(st.s.atoms.find((a) => a.el === 'H')!.id, c)
    expect(store.getState().polar.bonds.H).toMatchObject({ right: false, tries: 1, pick: 'C', coach: { lead: 'Only a polar bond has a dipole arrow.' } })
    store.answerBond('H', 'nonpolar')
    expect(store.bondAsked()).toBe('O')
    store.drawBondArrow(c, o)
    expect(store.getState().polar.bonds.O).toMatchObject({ right: true })
    store.answerNet(true)
    expect(store.getState().polar.net).toMatchObject({ right: true, coach: null })
    // formaldehyde is polar: its net dipole is drawn before the step is done
    expect(store.stepDone('polar')).toBe(false)
    store.drawNetArrow(turned(RIGHT, 180), seenAs(FORMALDEHYDE), WORLD) // from oxygen toward carbon
    expect(store.getState().polar.arrow).toMatchObject({ right: false, tries: 1, coach: { lead: 'That arrow points against the C–O arrow.' } })
    store.drawNetArrow(RIGHT, seenAs(FORMALDEHYDE), WORLD)
    expect(store.getState().polar.arrow).toMatchObject({ right: true, text: 'The C–O dipole is the only bond dipole, so the net dipole points the same way: from carbon toward oxygen.' })
    expect(store.stepDone('polar')).toBe(true)
  })

  it('step 7: sigma and pi counts, then the hybridization, which finishes the molecule', () => {
    toStep('CO2', 'orbitals')
    expect(store.getState()).toMatchObject({ step: 'orbitals', view: 'shape' })
    store.pickHybrid('sp') // too early: the counts come first
    expect(store.getState().orbitals.hybrid.pick).toBeNull()
    for (let i = 0; i < 4; i++) store.setBondCount('sigma', store.getState().orbitals.sigma + 1)
    store.checkBondCounts()
    expect(store.getState().orbitals.counts).toMatchObject({ right: false, tries: 1, coach: { lead: '4 counts every line as a sigma bond.' } })
    store.setBondCount('sigma', 2)
    store.setBondCount('pi', 2)
    store.checkBondCounts()
    expect(store.getState().orbitals.counts).toMatchObject({ right: true, text: '2 sigma bonds and 2 pi bonds: each double bond is 1 sigma and 1 pi.' })
    store.setBondCount('pi', 5) // locked
    expect(store.getState().orbitals.pi).toBe(2)
    store.pickHybrid('sp3')
    expect(store.getState().orbitals.hybrid).toMatchObject({ right: false, tries: 1, coach: { lead: 'sp³ goes with 4 electron groups.' } })
    expect(store.getState().solved).not.toContain('CO2')
    store.pickHybrid('sp')
    expect(store.getState().orbitals.hybrid).toMatchObject({ right: true, text: 'sp: carbon has 2 electron groups.' })
    expect(store.getState().solved).toContain('CO2')
    expect(store.stepDone('orbitals')).toBe(true)
    store.next()
    expect(store.getState().problem).toBe(idx('CO2') + 1)
    expect(store.getState().step).toBe('count')
    expect(store.getState().s.atoms).toHaveLength(0)
  })

  it('a change to the board throws away the answers about the finished structure', () => {
    toStep('CO2', 'orbitals')
    store.goStep('check')
    const bond = store.getState().s.bonds[0]!
    store.unbond(bond.id)
    expect(store.getState().shape.pick).toBeNull()
    expect(store.getState().polar).toEqual({ bonds: {}, net: { right: false, tries: 0, text: null, coach: null, pick: null }, arrow: { right: false, tries: 0, text: null, coach: null, drawn: null }, aim: 0 })
    expect(store.unlocked()).toBeLessThan(5)
  })

  it('hints in the count step are about the atoms first, then about the total', () => {
    store.moreHint()
    store.moreHint()
    expect(store.currentHints()[0]).toMatch(/periodic table/)
    expect(store.totalNext()).toBe(false)
    store.setCount('C', 4)
    store.setCount('H', 1)
    store.checkCounts()
    // every count is right: the hints start over, and they say how the total is built
    expect(store.totalNext()).toBe(true)
    expect(store.currentHints()).toEqual([])
    expect(store.hintsLeft()).toBe(2)
    store.moreHint()
    expect(store.currentHints()).toEqual(['The total is every valence electron in methane: the carbon atom brings 4 and each of the 4 hydrogen atoms brings 1.'])
    store.typeTotal(7)
    store.checkTotal()
    expect(store.getState().count.totalFeedback).toMatchObject({ lead: 'The total is not 7.', show: { kind: 'tally', reveal: 'atoms' } })
  })

  it('a refused move leaves the board alone and shows the reason', () => {
    finishCount()
    store.next()
    store.pickMiddle('C')
    const c = store.place('C', null)!
    const h = store.place('H', null)!
    store.bond(h, c)
    const before = store.getState().s
    store.bond(h, c)
    expect(store.getState().s).toBe(before)
    expect(store.getState().toast?.text).toBe('Hydrogen already has 2 electrons around it. Its outer shell holds 2, so a hydrogen atom makes only 1 bond.')
  })

  it('undo steps back one move at a time, and editing resets the shape answers', () => {
    finishCount()
    store.next()
    store.pickMiddle('C')
    const c = store.place('C', null)!
    const h = store.place('H', null)!
    store.bond(h, c)
    expect(store.getState().s.bonds).toHaveLength(1)
    store.undo()
    expect(store.getState().s.bonds).toHaveLength(0)
    store.undo()
    expect(store.getState().s.atoms).toHaveLength(1)
    store.clearBoard()
    expect(store.getState().s.atoms).toHaveLength(0)
    store.undo()
    expect(store.getState().s.atoms).toHaveLength(1)
  })
})

describe('clearing the board', () => {
  it('clears from the 3D model in free build, and comes back to the flat board', () => {
    store.setMode('free')
    const o = store.place('O', null)!
    for (let k = 0; k < 2; k++) store.bond(store.place('H', null)!, o)
    store.setView('shape')
    expect(store.getState().view).toBe('shape')
    expect(store.editable()).toBe(false)
    store.clearBoard()
    expect(store.getState()).toMatchObject({ view: 'flat', s: { atoms: [] } })
    // undo brings the atoms back, on the 3D model they were cleared from
    store.undo()
    expect(store.getState().s.atoms).toHaveLength(3)
    expect(store.getState().view).toBe('shape')
    store.clearBoard()
    store.setMode('guided')
  })
  it('clears from a later step of a guided molecule, back to the step where the atoms are put on the board', () => {
    toStep('CO2', 'polar')
    expect(store.editable()).toBe(false)
    store.clearBoard()
    expect(store.getState()).toMatchObject({ step: 'place', view: 'flat', s: { atoms: [] } })
    // the answers about the finished structure are gone, and the middle atom is still known
    expect(store.getState().shape.pick).toBeNull()
    expect(store.getState().middle.right).toBe(true)
    expect(store.cue()).toEqual({ kind: 'tray', el: 'C', demo: true })
    store.undo()
    expect(store.getState().s.atoms).toHaveLength(3)
    expect(store.stepDone('check')).toBe(true)
  })
  it('Undo straight after that Clear puts the step, the view and every answer back', () => {
    toStep('CO2', 'orbitals')
    store.setBondCount('sigma', 2)
    store.setBondCount('pi', 2)
    store.checkBondCounts()
    const before = store.getState()
    store.clearBoard()
    expect(store.getState().step).toBe('place')
    store.undo()
    const after = store.getState()
    expect(after).toMatchObject({ step: 'orbitals', view: 'shape', cleared: null })
    expect(after.s).toBe(before.s)
    expect(after.shape).toBe(before.shape)
    expect(after.polar).toBe(before.polar)
    expect(after.orbitals).toBe(before.orbitals)
    expect(store.stepDone('polar')).toBe(true)
    // a board change after the Clear drops what was kept: Undo then brings back the atoms only
    store.clearBoard()
    store.place('C', null)
    store.undo() // takes the new carbon off
    store.undo() // brings the old structure back
    expect(store.getState().s).toBe(before.s)
    expect(store.getState()).toMatchObject({ step: 'place', view: 'flat' })
    expect(store.getState().shape.pick).toBeNull()
  })
  it('does nothing in the count step, where the board shows sample atoms', () => {
    store.selectProblem(idx('CO2'))
    const before = store.getState()
    store.clearBoard()
    expect(store.getState()).toBe(before)
  })
})

describe('where the next action is', () => {
  it('follows carbon dioxide from the first counter to the last answer', () => {
    store.selectProblem(idx('CO2'))
    // count: the first counter still at 0, then the button that checks them
    expect(store.cue()).toEqual({ kind: 'ask', key: 'count-C' })
    store.setCount('C', 4)
    expect(store.cue()).toEqual({ kind: 'ask', key: 'count-O' })
    store.setCount('O', 5)
    expect(store.cue()).toEqual({ kind: 'ask', key: 'count-check' })
    store.checkCounts()
    // oxygen was wrong and has not been changed since: back to its counter
    expect(store.cue()).toEqual({ kind: 'ask', key: 'count-O' })
    store.setCount('O', 6)
    expect(store.cue()).toEqual({ kind: 'ask', key: 'count-check' })
    store.checkCounts()
    expect(store.cue()).toEqual({ kind: 'ask', key: 'total' })
    store.typeTotal(16)
    store.checkTotal()
    expect(store.cue()).toEqual({ kind: 'next' })
    store.next()
    // place: the question, then the middle atom in the row under the board, with the drag shown for the first atom only
    expect(store.cue()).toEqual({ kind: 'ask', key: 'middle' })
    store.pickMiddle('C')
    expect(store.cue()).toEqual({ kind: 'tray', el: 'C', demo: true })
    const c = store.place('C', null)!
    expect(store.cue()).toEqual({ kind: 'tray', el: 'O', demo: false })
    const o1 = store.place('O', null)!
    const o2 = store.place('O', null)!
    expect(store.cue()).toEqual({ kind: 'next' })
    store.next()
    // bond: the drag from an oxygen onto carbon until the first bond is made, then the atom still to bond
    expect(store.cue()).toEqual({ kind: 'drag', from: o1, to: c })
    store.bond(o1, c)
    expect(store.cue()).toEqual({ kind: 'atoms', ids: [o2] })
    store.bond(o2, c)
    expect(store.cue()).toEqual({ kind: 'next' })
    store.next()
    // check: the list of checks, until the structure is right
    expect(store.cue()).toEqual({ kind: 'ask', key: 'checks' })
    store.bond(o1, c)
    store.bond(o2, c)
    expect(store.stepDone('check')).toBe(true)
    expect(store.cue()).toEqual({ kind: 'next' })
    store.next()
    expect(store.cue()).toEqual({ kind: 'ask', key: 'groups' })
    store.answerGroups(2)
    expect(store.cue()).toEqual({ kind: 'ask', key: 'shapes' })
    store.pickShape('linear')
    expect(store.cue()).toEqual({ kind: 'next' })
    store.next()
    // polar: until the first try the hand takes the three answers in turn along one C–O bond (an arrow each way,
    // and the button for no arrow); after it, the atoms of that bond and the button are marked
    expect(store.cue()).toMatchObject({ kind: 'arrow', a: c, b: o1, also: [o2], key: 'no-arrow' })
    store.drawBondArrow(o1, c) // wrong way round
    expect(store.cue()).toEqual({ kind: 'atoms', ids: [c, o1, o2], key: 'no-arrow' })
    store.drawBondArrow(c, o1)
    expect(store.cue()).toEqual({ kind: 'ask', key: 'net' })
    store.answerNet(false)
    expect(store.cue()).toEqual({ kind: 'next' })
    store.next()
    expect(store.cue()).toEqual({ kind: 'ask', key: 'bond-counts' })
    store.setBondCount('sigma', 2)
    store.setBondCount('pi', 2)
    store.checkBondCounts()
    expect(store.cue()).toEqual({ kind: 'ask', key: 'hybrid' })
    store.pickHybrid('sp')
    expect(store.cue()).toEqual({ kind: 'next' })
  })
  it('points at the middle atom for the net dipole, and at the switch to the 3D model from the flat drawing', () => {
    toStep('H2O', 'polar')
    const st = store.getState()
    const o = st.s.atoms.find((a) => a.el === 'O')!.id
    const hs = st.s.atoms.filter((a) => a.el === 'H').map((a) => a.id)
    expect(store.cue()).toMatchObject({ kind: 'arrow', a: o, b: hs[0], also: [hs[1]], key: 'no-arrow' })
    store.drawBondArrow(hs[0]!, o)
    store.answerNet(true)
    // the net dipole: the drag out of oxygen is acted out until the first try
    expect(store.cue()).toEqual({ kind: 'aim', id: o })
    store.setView('flat')
    expect(store.cue()).toEqual({ kind: 'ask', key: 'view-shape' })
    store.setView('shape')
    store.drawNetArrow({ x: 0, y: -1 }, seenAs(WATER), WORLD) // the opposite way
    expect(store.cue()).toEqual({ kind: 'atoms', ids: [o] })
  })
  it('starts the bond arrow demonstration with a different answer from one molecule to the next', () => {
    // the first thing the hand shows must not always be the same answer: 0 is the arrow out, 1 the arrow back, 2 the button
    const firsts = new Set<number>()
    for (const id of ['CH4', 'NH3', 'H2O', 'CO2']) {
      toStep(id, 'polar')
      const c = store.cue()
      expect(c?.kind, id).toBe('arrow')
      if (c?.kind === 'arrow') firsts.add(c.first)
    }
    expect([...firsts].sort()).toEqual([0, 1, 2])
  })
  it('is off while the molecule picker is open, and in free build once an atom is on the board', () => {
    store.togglePicker(true)
    expect(store.cue()).toBeNull()
    store.togglePicker(false)
    store.setMode('free')
    expect(store.cue()).toEqual({ kind: 'tray', el: 'H', demo: true })
    store.place('H', null)
    expect(store.cue()).toBeNull()
    store.clearBoard()
    store.setMode('guided')
  })
})

describe('placing with a tap', () => {
  it('puts the middle atom in the middle even when old positions are left over from the count step', () => {
    store.selectProblem(idx('CH2O'))
    // what the scene leaves behind: the count step's sample atoms, the middle one at the center of the board
    store.positions.set('spec-C', { x: -2.3, y: 0 })
    store.positions.set('spec-H', { x: 0, y: 0 })
    store.positions.set('spec-O', { x: 2.3, y: 0 })
    finishCount()
    store.next()
    store.pickMiddle('C')
    const c = store.place('C', null)!
    expect(store.positions.get(c)).toEqual({ x: 0, y: 0 })
    // the next atoms go around it, each on its own spot
    const h = store.place('H', null)!
    const o = store.place('O', null)!
    const ph = store.positions.get(h)!
    const po = store.positions.get(o)!
    expect(Math.hypot(ph.x, ph.y)).toBeGreaterThan(1.2)
    expect(Math.hypot(ph.x - po.x, ph.y - po.y)).toBeGreaterThan(1.2)
  })

  it('reuses the spot of an atom that was removed', () => {
    store.setMode('free')
    store.clearBoard()
    const a = store.place('C', null)!
    const spot = { ...store.positions.get(a)! }
    store.remove(a)
    const b = store.place('N', null)!
    expect(store.positions.get(b)).toEqual(spot)
    store.clearBoard()
  })
})

describe('switching between Guided and Free build', () => {
  it('keeps each board, with its positions, while the other is open', () => {
    finishCount()
    store.next()
    store.pickMiddle('C')
    const c = store.place('C', { x: 1, y: 0.5 })!
    store.setMode('free')
    expect(store.getState().s.atoms).toHaveLength(0)
    expect(store.editable()).toBe(true)
    const o = store.place('O', { x: -2, y: 1 })!
    expect(store.getState().s.atoms.map((x) => x.el)).toEqual(['O'])
    store.setMode('guided')
    expect(store.getState().step).toBe('place')
    expect(store.getState().s.atoms.map((x) => x.el)).toEqual(['C'])
    expect(store.positions.get(c)).toEqual({ x: 1, y: 0.5 })
    store.setMode('free')
    expect(store.getState().s.atoms.map((x) => x.el)).toEqual(['O'])
    expect(store.positions.get(o)).toEqual({ x: -2, y: 1 })
    store.clearBoard()
  })

  it('free build opens the 3D shape only for a finished molecule with one middle atom', () => {
    store.setMode('free')
    store.clearBoard()
    const o = store.place('O', null)!
    const h1 = store.place('H', null)!
    store.setView('shape')
    expect(store.getState().view).toBe('flat')
    const h2 = store.place('H', null)!
    store.bond(h1, o)
    store.bond(h2, o)
    store.setView('shape')
    expect(store.getState().view).toBe('shape')
    expect(store.editable()).toBe(false)
    store.setView('flat')
    store.clearBoard()
  })
})
