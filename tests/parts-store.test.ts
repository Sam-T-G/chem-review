// Where the module's store meets its two parts (the shapes quiz and the exercises): which saved ids
// are kept, which exercise opens first, and what Undo brings back after a Clear on a finished exercise.
// The parts' own rules are in shapes.test.ts and exercise.test.ts.
import { beforeEach, describe, expect, it } from 'vitest'
import { EXERCISES, referenceStructure } from '../src/chem/exercises'
import { PROBLEMS } from '../src/chem/problems'
import { ALL_CASES } from '../src/chem/vsepr'
import { PART_IDS } from '../src/modules/lewis/contract'
import { sheetOf } from '../src/modules/lewis/exercise/sheet'
import { freshExercise, goTo, poolOrder, savedId, structureRight } from '../src/modules/lewis/exercise/state'
import { PARTS } from '../src/modules/lewis/parts'
import * as store from '../src/modules/lewis/store'

const ex = PARTS.exercise!
const el = (data: Record<string, string>) => ({ dataset: data }) as unknown as HTMLElement
const press = (data: Record<string, string>) => ex.act!(el(data), store.getState())
const atIndex = (id: string) => EXERCISES.findIndex((p) => p.id === id)

/** Puts the finished structure on the board and answers every part right, through the part's own presses. */
function answerAll(id: string) {
  const p = EXERCISES[atIndex(id)]!
  const sh = sheetOf(p)
  store.update({ s: referenceStructure(p)! })
  store.update({ exercise: { ...store.getState().exercise, valence: { ...store.getState().exercise.valence, text: String(sh.total) } } })
  press({ act: 'ex-valence' })
  press({ act: 'ex-structure' })
  press({ act: 'ex-res', v: sh.resonance ? 'yes' : 'no' })
  press({ act: 'ex-eg', v: sh.info.geometry })
  press({ act: 'ex-mg', v: sh.info.shape })
  press({ act: 'ex-angle', v: sh.angle })
  for (const k of sh.bonds) {
    const st = store.getState().exercise
    store.update({ exercise: { ...st, bonds: { ...st.bonds, [k.b]: { text: (k.pol.tenths / 10).toFixed(1), den: { pick: null, right: false, tries: 0 }, pick: null } } } })
  }
  press({ act: 'ex-den' })
  for (const k of sh.bonds) press({ act: 'ex-bond', el: k.b, v: k.polar ? 'polar' : 'nonpolar' })
  press({ act: 'ex-net', polar: String(sh.m.polar) })
  if (sh.directions) press({ act: 'ex-dir', v: sh.directions.right })
}

beforeEach(() => {
  store.setMode('guided')
  store.selectProblem(0)
})

describe('saved ids', () => {
  it('keeps an id only when it names a guided problem, a row of the shape table or an exercise', () => {
    const before = store.getState().solved.length
    // a row that is not in the table, an exercise that is not in the pool, a bare prefix, and a word
    store.mergeSolved(['shape:9,9', 'ex:NOPE', 'shape:', 'ex:', 'BOGUS'])
    expect(store.getState().solved.length).toBe(before)
    // one real id of each kind is kept: water (a guided problem), 2 bonded atoms and 2 lone pairs (a row), water (an exercise)
    expect(PROBLEMS.some((p) => p.id === 'H2O')).toBe(true)
    expect(ALL_CASES.some((r) => r.bonded === 2 && r.lonePairs === 2)).toBe(true)
    expect(EXERCISES.some((p) => p.id === 'H2O')).toBe(true)
    store.mergeSolved(['H2O', `${PART_IDS.shapes}2,2`, `${PART_IDS.exercise}H2O`])
    const solved = store.getState().solved
    expect(solved).toContain('H2O')
    expect(solved).toContain('shape:2,2')
    expect(solved).toContain('ex:H2O')
    expect(solved.filter((id) => /9,9|NOPE|BOGUS|^shape:$|^ex:$/.test(id))).toEqual([])
  })
})

describe('the exercise that opens', () => {
  it('moves an untouched sheet to the first unfinished molecule when saved progress arrives', () => {
    // the store is shared by the tests in this file, so "unfinished" is read from it
    const order = poolOrder()
    const unfinished = () => order.filter((i) => !store.getState().solved.includes(savedId(EXERCISES[i]!)))
    const [a, b] = unfinished()
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    // an untouched sheet on the first unfinished molecule, with the student somewhere else in the module
    store.update({ exercise: goTo(freshExercise(), a!) })
    expect(store.getState().exercise.at).toBe(a)
    // saved progress arrives and says that molecule is finished: the sheet moves on to the next unfinished one
    store.mergeSolved([savedId(EXERCISES[a!]!)])
    expect(store.getState().exercise.at).toBe(b)
  })

  it('leaves a sheet with an answer on it where it is', () => {
    store.setMode('exercise')
    const at = store.getState().exercise.at
    const p = EXERCISES[at]!
    store.update({ exercise: { ...store.getState().exercise, valence: { ...store.getState().exercise.valence, text: '8' } } })
    store.mergeSolved([savedId(p)])
    expect(store.getState().exercise.at).toBe(at)
    expect(store.getState().exercise.valence.text).toBe('8')
  })
})

describe('Clear on a finished exercise, then Undo', () => {
  it('brings back the atoms, the lifted model and the finished sheet', () => {
    store.setMode('exercise')
    // phosphorus trichloride: on the class worksheet, with a lone pair on the middle atom
    const id = 'PCl3'
    expect(atIndex(id)).toBeGreaterThanOrEqual(0)
    press({ act: 'ex-pick', at: String(atIndex(id)) })
    answerAll(id)
    const before = store.getState()
    expect(before.view).toBe('shape')
    expect(ex.done!(before)).toBe(true)
    store.clearBoard()
    expect(store.getState().s.atoms.length).toBe(0)
    expect(store.getState().exercise.structure.right).toBe(false)
    store.undo()
    const after = store.getState()
    expect(after.s.atoms.length).toBe(before.s.atoms.length)
    expect(structureRight(EXERCISES[atIndex(id)]!, after.s)).toBe(true)
    expect(after.view).toBe('shape')
    // the sheet is as it was: the structure part is answered and the molecule is still finished
    expect(after.exercise.structure.right).toBe(true)
    expect(ex.done!(after)).toBe(true)
    expect(after.exercise).toEqual(before.exercise)
  })
})
