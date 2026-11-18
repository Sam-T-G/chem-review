// The board's own controls (package BOARD, D-0036): the switch on the lifted model between the
// electron geometry and the molecular geometry. What the switch draws is checked in the browser by
// scripts/check-board.mjs; this file holds the words and the state behind it.
import { describe, expect, it } from 'vitest'
import { EXERCISES, referenceStructure } from '../src/chem/exercises'
import { GROUPS_VIEW_WORDS } from '../src/modules/lewis/guide'
import * as store from '../src/modules/lewis/store'

describe('the switch between the two geometries', () => {
  it('names the two choices the way the course does', () => {
    expect(GROUPS_VIEW_WORDS.all).toBe('Electron geometry')
    expect(GROUPS_VIEW_WORDS.atoms).toBe('Molecular geometry')
  })

  it('follows the voice rules', () => {
    for (const line of Object.values(GROUPS_VIEW_WORDS)) {
      expect(line, line).not.toMatch(/[—–]|  |\{|\}/)
      expect(line, line).not.toMatch(/\b(wants?|likes?|simply|just|not only|think of)\b/i)
    }
  })

  // A reviewer found the first build kept the pick across molecules and steps: step 6 then asked a student to aim
  // at lone pairs the model did not draw, and step 7 asked for a count of groups with the lone pairs hidden.
  it('is offered only on a lifted model in free build and in step 5, and the pick ends with that model', () => {
    const water = referenceStructure(EXERCISES.find((p) => p.id === 'H2O')!)!
    expect(store.getState().groupsView).toBe('all')
    // on the flat drawing there is no switch, and a press changes nothing
    store.setMode('free')
    store.update({ s: water, view: 'flat' })
    expect(store.canSwitchGroups()).toBe(false)
    store.setGroupsView('atoms')
    expect(store.getState().groupsView).toBe('all')
    // on the lifted model in free build the pick is kept and drawn
    store.update({ view: 'shape' })
    expect(store.canSwitchGroups()).toBe(true)
    store.setGroupsView('atoms')
    expect(store.getState().groupsView).toBe('atoms')
    expect(store.groupsViewShown()).toBe('atoms')
    // the model comes down: every group again
    store.setView('flat')
    expect(store.getState().groupsView).toBe('all')
    // a change to the board, another mode and another molecule each end the pick too
    store.update({ view: 'shape' })
    store.setGroupsView('atoms')
    store.setMode('guided')
    expect(store.getState().groupsView).toBe('all')
    store.selectProblem(1)
    expect(store.getState().groupsView).toBe('all')
  })

  it('draws every electron group in steps 6 and 7 and in the parts, whatever was picked in step 5', () => {
    const water = referenceStructure(EXERCISES.find((p) => p.id === 'H2O')!)!
    store.setMode('guided')
    store.update({ s: water, step: 'shape', view: 'shape' })
    store.setGroupsView('atoms')
    expect(store.groupsViewShown()).toBe('atoms')
    for (const step of ['polar', 'orbitals'] as const) {
      store.update({ step, view: 'shape' })
      expect(store.canSwitchGroups(), step).toBe(false)
      expect(store.groupsViewShown(), step).toBe('all')
      expect(store.getState().groupsView, step).toBe('all')
    }
    for (const mode of ['exercise', 'shapes'] as const) {
      store.setMode(mode)
      store.update({ view: 'shape' })
      expect(store.canSwitchGroups(), mode).toBe(false)
      expect(store.groupsViewShown(), mode).toBe('all')
    }
    store.setMode('guided')
    store.selectProblem(0)
  })

  it('does not redraw when the pick does not change', () => {
    let calls = 0
    const off = store.subscribe(() => calls++)
    store.setGroupsView('all')
    expect(calls).toBe(0)
    off()
  })
})
