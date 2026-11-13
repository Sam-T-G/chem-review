import { beforeEach, describe, expect, it } from 'vitest'
import { PROBLEMS } from '../src/chem/problems'
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
    expect(c.feedback.C).toMatch(/atomic number/)
    store.setCount('H', 5) // locked: no change
    expect(store.getState().count.answers.H).toBe(1)
    store.setCount('C', 4)
    expect(store.getState().count.feedback.C).toBeUndefined()
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
    store.answerGroups(4)
    store.pickShape('square planar')
    const s = store.getState()
    expect(s.shape.pickRight).toBe(false)
    expect(s.shape.pickFeedback).toMatch(/^The shape is tetrahedral/)
    expect(s.view).toBe('shape')
    expect(s.solved).toContain('CH4')
    store.next()
    expect(store.getState().problem).toBe(1)
    expect(store.getState().step).toBe('count')
    expect(store.getState().s.atoms).toHaveLength(0)
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
    expect(store.getState().toast?.text).toBe('Hydrogen already has 2 electrons around it. Its outer shell holds 2.')
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
