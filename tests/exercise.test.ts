// The exercises: each part's answer, the checks, the locks, the reset on a board change, the
// next-molecule rule and what is saved. Wording is in exercise-words.test.ts.
import { describe, expect, it } from 'vitest'
import { EXERCISES, EXERCISE_SETS, referenceStructure } from '../src/chem/exercises'
import { lower } from '../src/modules/lewis/guide'
import { readTenths, readWhole, sheetOf, ANGLES, NO_ANGLE } from '../src/modules/lewis/exercise/sheet'
import {
  COME_BACK,
  answered,
  bondsDone,
  checkDeltas,
  checkStructure,
  checkValence,
  countFinished,
  directionOpen,
  exerciseBoardChanged,
  exerciseCanLift,
  freshExercise,
  goTo,
  netOpen,
  nextAt,
  pickAngle,
  pickBond,
  pickDirection,
  pickGeometry,
  pickNet,
  pickResonance,
  pickShape,
  poolOrder,
  savedId,
  sheetDone,
  typeDelta,
  typeValence,
  type ExerciseState,
} from '../src/modules/lewis/exercise/state'
import { directionLabel } from '../src/modules/lewis/exercise/words'
import { PART_IDS } from '../src/modules/lewis/store'
import { EMPTY, addElectron, removeElectron } from '../src/chem/structure'
import { star } from './helpers'
import { ALL, ENGINE_GAPS, WORKED, asProblem } from './exercise-pool'

const sheetFor = (id: string) => sheetOf(ALL.find((p) => p.id === id)!)

describe('the answers to each part, worked by hand', () => {
  for (const x of WORKED) {
    it(`${x.id}: ${x.total}, ${x.eg}, ${x.mg}, ${x.angle}, ${x.polar ? 'polar' : 'nonpolar'}`, () => {
      const sh = sheetOf(asProblem(x))
      expect(sh.total).toBe(x.total)
      expect(sh.resonance).toBe(x.resonance)
      expect(sh.info.geometry).toBe(x.eg)
      expect(sh.info.shape).toBe(x.mg)
      expect(sh.angle).toBe(x.angle === 'none' ? NO_ANGLE : x.angle)
      expect(Object.fromEntries(sh.bonds.map((k) => [k.b, [k.pol.delta, k.polar]]))).toEqual(x.bonds)
      expect(sh.m.polar).toBe(x.polar)
      expect(sh.directions ? directionLabel(sh, sh.directions.choices.find((c) => c.id === sh.directions!.right)!) : null).toBe(x.dir)
    })
  }
})

// no suite when the list is empty: a suite without a test is an error
if (ENGINE_GAPS.length) describe('where the engine and the hand-worked answer disagree', () => {
  for (const x of ENGINE_GAPS) {
    it(`${x.id}: still disagrees (move it into WORKED once src/chem/polarity.ts is fixed)`, () => {
      const sh = sheetOf(asProblem(x))
      const engine = Object.fromEntries(sh.bonds.map((k) => [k.b, [k.pol.delta, k.polar]]))
      expect(engine).not.toEqual(x.bonds)
    })
  }
})

describe('every molecule in the pool', () => {
  it('has a finished structure, every part answerable, and its right answer among the picks', () => {
    // the pool holds the worked molecules itself now, so the run covers the whole pool and at least 40 molecules
    expect(ALL.length).toBeGreaterThanOrEqual(Math.max(EXERCISES.length, 40))
    for (const p of EXERCISES) expect(ALL, p.id).toContain(p)
    for (const p of ALL) {
      const sh = sheetOf(p)
      expect(sh.geometryChoices, p.id).toContain(sh.info.geometry)
      expect(sh.shapeChoices, p.id).toContain(sh.info.shape)
      expect(sh.angleChoices, p.id).toContain(sh.angle)
      expect(sh.angleChoices.length, p.id).toBe(5)
      for (const a of sh.angleChoices) expect(ANGLES, p.id).toContain(a)
      // the course's bins are nonpolar, polar and ionic: the sheet asks only polar or nonpolar
      for (const k of sh.bonds) expect(k.pol.kind, `${p.id}: ${k.a}–${k.b} is ionic by the course table, and the sheet has no ionic pick`).not.toBe('ionic')
      // with five or six groups and unlike outer atoms the answer depends on which corners they take
      expect(sh.m.depends, `${p.id}: polarity depends on the arrangement`).toBe(false)
      if (sh.directions) {
        expect(sh.directions.choices.length, p.id).toBeGreaterThanOrEqual(2)
        expect(sh.directions.choices.map((c) => c.id), p.id).toContain(sh.directions.right)
        expect(new Set(sh.directions.choices.map((c) => directionLabel(sh, c))).size, p.id).toBe(sh.directions.choices.length)
      }
      // every polar molecule has a direction to pick
      expect(!!sh.directions, p.id).toBe(sh.m.polar)
    }
  })
  it('has every exercise in exactly one set', () => {
    const ids = EXERCISE_SETS.flatMap((s) => s.ids)
    expect([...ids].sort()).toEqual(EXERCISES.map((p) => p.id).sort())
    expect(poolOrder()).toHaveLength(EXERCISES.length)
  })
  it('keeps the middle atom the least electronegative atom other than hydrogen, as the structure card says', () => {
    // the course's rounded table, typed in from docs/chemistry/sources.md
    const EN: Record<string, number> = { H: 2.1, Be: 1.5, B: 2.0, C: 2.5, N: 3.0, O: 3.5, F: 4.0, Al: 1.5, Si: 1.8, P: 2.1, S: 2.5, Cl: 3.0, As: 2.0, Se: 2.4, Br: 2.8, Kr: 3.0, I: 2.5, Xe: 2.6 }
    for (const p of ALL) {
      if (sheetOf(p).diatomic) continue
      const others = p.formula.map(([el]) => el).filter((el) => el !== 'H')
      expect(Math.min(...others.map((el) => EN[el]!)), p.id).toBe(EN[p.center])
    }
  })
})

describe('reading what is typed', () => {
  it('reads whole numbers and ΔEN values the way a student types them', () => {
    expect(readWhole('26')).toBe(26)
    expect(readWhole(' 8 ')).toBe(8)
    expect(readWhole('')).toBeNull()
    expect(readWhole('2.5')).toBeNull()
    expect(readTenths('0.9')).toBeCloseTo(9)
    expect(readTenths('.9')).toBeCloseTo(9)
    expect(readTenths('0.90')).toBeCloseTo(9)
    expect(readTenths('1')).toBeCloseTo(10)
    expect(readTenths('−0.9')).toBeCloseTo(-9)
    expect(readTenths('0,9')).toBeCloseTo(9)
    expect(readTenths('abc')).toBeNull()
    expect(readTenths('')).toBeNull()
  })
})

/** The state with the molecule `id` on screen. */
function on(id: string): ExerciseState {
  const at = EXERCISES.findIndex((p) => p.id === id)
  if (at < 0) throw new Error(`${id} is not in the pool`)
  return goTo(freshExercise(), at)
}
const pcl3 = () => on('PCl3')

describe('checking a part', () => {
  it('locks a right total and counts wrong ones; an empty box is not a try', () => {
    const sh = sheetFor('PCl3')
    let st = checkValence(pcl3(), sh)
    expect(st.valence.tries).toBe(0)
    st = checkValence(typeValence(st, '15'), sh)
    expect(st.valence).toMatchObject({ pick: 15, right: false, tries: 1 })
    expect(st.missed).toEqual(['valence'])
    st = checkValence(typeValence(st, '26'), sh)
    expect(st.valence.right).toBe(true)
    // locked: typing and checking change nothing
    expect(typeValence(st, '3')).toBe(st)
    expect(checkValence(st, sh)).toBe(st)
  })
  it('accepts a right pick for each chip part, counts a different wrong pick once, and locks', () => {
    const sh = sheetFor('PCl3')
    let st = pickGeometry(pcl3(), sh, 'trigonal planar')
    st = pickGeometry(st, sh, 'trigonal planar')
    expect(st.eg.tries).toBe(1)
    st = pickGeometry(st, sh, 'tetrahedral')
    expect(st.eg.right).toBe(true)
    expect(pickGeometry(st, sh, 'octahedral')).toBe(st)
    st = pickShape(st, sh, 'tetrahedral')
    st = pickShape(st, sh, 'trigonal pyramidal')
    expect(st.mg).toMatchObject({ right: true, tries: 1 })
    st = pickAngle(st, sh, '109.5°')
    st = pickAngle(st, sh, 'less than 109.5°')
    expect(st.angle).toMatchObject({ right: true, tries: 1 })
    expect(st.missed).toEqual(['eg', 'mg', 'angle'])
  })
  it('checks each ΔEN, then takes one final polar-or-nonpolar pick per bond once its ΔEN is right', () => {
    const sh = sheetFor('PCl3')
    let st = pickBond(pcl3(), sh, 'Cl', true)
    expect(st.bonds.Cl?.pick ?? null).toBeNull()
    st = checkDeltas(typeDelta(st, 'Cl', '5.1'), sh)
    expect(st.bonds.Cl!.den).toMatchObject({ right: false, tries: 1 })
    st = checkDeltas(typeDelta(st, 'Cl', '0.9'), sh)
    expect(st.bonds.Cl!.den.right).toBe(true)
    st = pickBond(st, sh, 'Cl', false)
    expect(st.bonds.Cl!.pick).toBe('nonpolar')
    // final: a second pick changes nothing
    expect(pickBond(st, sh, 'Cl', true)).toBe(st)
    expect(bondsDone(st, sh)).toBe(true)
    expect(st.missed).toEqual(['bonds'])
  })
  it('opens the net dipole only after the molecular geometry and every bond, and the direction after polar or nonpolar', () => {
    const sh = sheetFor('PCl3')
    let st = pcl3()
    expect(pickNet(st, sh, true)).toBe(st)
    st = pickShape(st, sh, 'trigonal pyramidal')
    st = checkDeltas(typeDelta(st, 'Cl', '0.9'), sh)
    expect(netOpen(st, sh)).toBe(false)
    st = pickBond(st, sh, 'Cl', true)
    expect(netOpen(st, sh)).toBe(true)
    expect(directionOpen(st, sh)).toBe(false)
    st = pickNet(st, sh, true)
    expect(directionOpen(st, sh)).toBe(true)
    const wrong = sh.directions!.choices.find((c) => c.id !== sh.directions!.right)!
    st = pickDirection(st, sh, wrong.id)
    expect(st.net.dir.tries).toBe(1)
    st = pickDirection(st, sh, sh.directions!.right)
    expect(st.net.dir.right).toBe(true)
  })
  it('asks about resonance only once the structure is right, and the first answer is final', () => {
    const sh = sheetFor('PCl3')
    const st = pcl3()
    expect(pickResonance(st, sh, false)).toBe(st)
    const right = checkStructure(st, sh, referenceStructure(sh.p)!)
    expect(right.structure.right).toBe(true)
    const said = pickResonance(right, sh, true)
    expect(said.resonance).toBe(true)
    expect(said.missed).toEqual(['resonance'])
    expect(pickResonance(said, sh, false)).toBe(said)
  })
})

describe('the structure and the board', () => {
  const sh = () => sheetFor('PCl3')
  it('does not count a check while atoms are missing or loose', () => {
    let st = checkStructure(pcl3(), sh(), EMPTY)
    expect(st.structure).toMatchObject({ right: false, tries: 0, shown: true })
    st = checkStructure(st, sh(), star(['P', 'Cl', 'Cl', 'Cl'], [1, 1]).s)
    expect(st.structure.tries).toBe(0)
  })
  it('counts a check of a whole board that is wrong', () => {
    const s = star(['P', 'Cl', 'Cl', 'Cl'], [1, 1, 1]).s
    const op = addElectron(s, s.atoms[1]!.id)
    if (!op.ok) throw new Error(op.why)
    const st = checkStructure(pcl3(), sh(), op.s)
    expect(st.structure).toMatchObject({ right: false, tries: 1, shown: true })
    expect(st.missed).toEqual(['structure'])
  })
  it('takes the result away when the board changes, and a right structure unlocks when the board stops being right', () => {
    const ref = referenceStructure(sh().p)!
    let st = checkStructure(pcl3(), sh(), ref)
    expect(exerciseBoardChanged(st, ref)).toBe(st)
    const op = removeElectron(ref, ref.atoms[0]!.id)
    if (!op.ok) throw new Error(op.why)
    st = exerciseBoardChanged(st, op.s)
    expect(st.structure).toMatchObject({ right: false, shown: false })
    // the parts about the molecule stay
    const answeredFirst = pickGeometry(pcl3(), sh(), 'tetrahedral')
    expect(exerciseBoardChanged(answeredFirst, EMPTY).eg.right).toBe(true)
  })
  it('lifts into 3D only with both geometries right and the finished structure on the board', () => {
    const ref = referenceStructure(sh().p)!
    let st = pcl3()
    expect(exerciseCanLift(st, ref)).toBe(false)
    st = pickGeometry(st, sh(), 'tetrahedral')
    expect(exerciseCanLift(st, ref)).toBe(false)
    st = pickShape(st, sh(), 'trigonal pyramidal')
    expect(exerciseCanLift(st, ref)).toBe(true)
    expect(exerciseCanLift(st, star(['P', 'Cl', 'Cl', 'Cl'], [1, 1]).s)).toBe(false)
  })
})

/** Every part answered right on the first try. */
function solve(st: ExerciseState): ExerciseState {
  const sh = sheetOf(EXERCISES[st.at]!)
  st = checkValence(typeValence(st, String(sh.total)), sh)
  st = checkStructure(st, sh, referenceStructure(sh.p)!)
  st = pickResonance(st, sh, sh.resonance)
  st = pickGeometry(st, sh, sh.info.geometry)
  st = pickShape(st, sh, sh.info.shape)
  st = pickAngle(st, sh, sh.angle)
  for (const k of sh.bonds) st = typeDelta(st, k.b, k.pol.delta)
  st = checkDeltas(st, sh)
  for (const k of sh.bonds) st = pickBond(st, sh, k.b, k.polar)
  st = pickNet(st, sh, sh.m.polar)
  if (sh.directions) st = pickDirection(st, sh, sh.directions.right)
  return st
}

describe('a finished sheet', () => {
  it('is finished for every molecule of the pool once every part is right', () => {
    for (let at = 0; at < EXERCISES.length; at++) {
      const st = solve(goTo(freshExercise(), at))
      const sh = sheetOf(EXERCISES[at]!)
      expect(sheetDone(st, sh), EXERCISES[at]!.id).toBe(true)
      expect(answered(st, sh).size).toBe(8)
      expect(st.missed).toEqual([])
    }
  })
  it('is saved under the exercise prefix the store uses', () => {
    expect(savedId(EXERCISES[0]!)).toBe(`${PART_IDS.exercise}${EXERCISES[0]!.id}`)
  })
  it('clears the answers when the molecule changes, and keeps what comes back', () => {
    const st = countFinished(solve(pcl3()), sheetFor('PCl3'))
    const moved = goTo(st, 0)
    expect(moved.valence.right).toBe(false)
    expect(moved.missed).toEqual([])
    expect(moved.finished).toBe(1)
  })
})

describe('the next molecule', () => {
  // a pool of 6 in 2 sets, so the rule is tested with more molecules than the placeholder pool has
  const pool = WORKED.slice(0, 6).map(asProblem)
  const sets = [
    { id: 'a', title: 'A', ids: [pool[2]!.id, pool[0]!.id, pool[1]!.id] },
    { id: 'b', title: 'B', ids: [pool[3]!.id, pool[4]!.id, pool[5]!.id] },
  ]
  const base = (at: number, extra: Partial<ExerciseState> = {}): ExerciseState => ({ ...goTo(freshExercise(), at), ...extra })
  const ids = (list: number[]) => list.map((i) => savedId(pool[i]!))

  it('follows the picker order: the sets in order', () => {
    expect(poolOrder(pool, sets)).toEqual([2, 0, 1, 3, 4, 5])
  })
  it('goes to the next molecule that is not finished, wrapping round', () => {
    expect(nextAt(base(2), [], pool, sets)).toBe(0)
    expect(nextAt(base(2), ids([0, 1]), pool, sets)).toBe(3)
    expect(nextAt(base(5), ids([2]), pool, sets)).toBe(0)
  })
  it(`brings back a molecule with a missed part once ${COME_BACK} more are finished, before the unfinished ones`, () => {
    const queue = [{ at: 0, due: 1 + COME_BACK }]
    expect(nextAt(base(1, { finished: COME_BACK, queue }), ids([2, 0]), pool, sets)).toBe(3)
    expect(nextAt(base(1, { finished: 1 + COME_BACK, queue }), ids([2, 0]), pool, sets)).toBe(0)
  })
  it('brings back a waiting molecule early once every molecule is finished', () => {
    const queue = [{ at: 4, due: 99 }]
    expect(nextAt(base(1, { finished: 2, queue }), ids([0, 1, 2, 3, 4, 5]), pool, sets)).toBe(4)
    expect(nextAt(base(1, { finished: 2 }), ids([0, 1, 2, 3, 4, 5]), pool, sets)).toBe(3)
  })
  it('puts a sheet with a missed part in the queue when it is finished, and takes it out when it is finished clean', () => {
    const sh = sheetFor('PCl3')
    const missed = countFinished({ ...solve(pcl3()), missed: ['eg'] }, sh)
    expect(missed.queue).toEqual([{ at: missed.at, due: 1 + COME_BACK }])
    expect(countFinished(missed, sh)).toBe(missed)
    const clean = countFinished(solve(goTo(missed, missed.at)), sh)
    expect(clean.queue).toEqual([])
    expect(clean.finished).toBe(2)
  })
})

describe('names', () => {
  it('names elements in lowercase inside a sentence', () => {
    expect(lower('Cl')).toBe('chlorine')
  })
})
