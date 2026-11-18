// The shapes quiz (src/modules/lewis/shapes/): the 13 rows of the shape table, the example
// molecules, the questions and their answers, and the deck that brings missed rows back until
// every row is known. Every expected answer below is written by hand from OpenStax Chemistry 2e,
// section 7.6 (Figures 7.16 and 7.19), as docs/chemistry/sources.md cites it. None is copied from
// what the code returns.
import { describe, expect, it } from 'vitest'
import { PROBLEMS } from '../src/chem/problems'
import { referenceStructure } from '../src/chem/exercises'
import { shapeOf } from '../src/chem/vsepr'
import {
  ANGLES,
  BACK_AFTER_MISS,
  GEOMETRIES,
  KINDS,
  KNOWN_AT,
  ROW_KEYS,
  TRIES,
  answerOf,
  choicesFor,
  draw,
  example,
  knownKeys,
  moleculesFor,
  nextQuestion,
  pick,
  practiceAgain,
  rowOf,
  startQuiz,
  structureOf,
  type RowKey,
} from '../src/modules/lewis/shapes/deck'
import { freshShapes, shapesBoard, type ShapesState } from '../src/modules/lewis/shapes/state'

// bonded atoms, lone pairs, electron geometry, molecular geometry, bond angle (OpenStax 2e, 7.6)
const TABLE: [RowKey, string, string, string][] = [
  ['2,0', 'linear', 'linear', '180°'],
  ['3,0', 'trigonal planar', 'trigonal planar', '120°'],
  ['2,1', 'trigonal planar', 'bent', 'less than 120°'],
  ['4,0', 'tetrahedral', 'tetrahedral', '109.5°'],
  ['3,1', 'tetrahedral', 'trigonal pyramidal', 'less than 109.5°'],
  ['2,2', 'tetrahedral', 'bent', 'less than 109.5°'],
  ['5,0', 'trigonal bipyramidal', 'trigonal bipyramidal', '90° and 120°'],
  ['4,1', 'trigonal bipyramidal', 'seesaw', 'less than 90° and less than 120°'],
  ['3,2', 'trigonal bipyramidal', 'T-shaped', 'less than 90°'],
  ['2,3', 'trigonal bipyramidal', 'linear', '180°'],
  ['6,0', 'octahedral', 'octahedral', '90°'],
  ['5,1', 'octahedral', 'square pyramidal', 'less than 90°'],
  ['4,2', 'octahedral', 'square planar', '90°'],
]

// one guided molecule per row, worked by hand: the middle atom's bonded atoms and lone pairs
const EXAMPLES: Record<RowKey, string> = {
  '2,0': 'CO2', // C=O double bonds on both sides, no lone pair on carbon
  '3,0': 'BF3', // boron has 6 electrons, 3 bonds
  '2,1': 'SO2', // 2 S=O bonds and 1 lone pair on sulfur
  '4,0': 'CH4',
  '3,1': 'NH3',
  '2,2': 'H2O',
  '5,0': 'PCl5',
  '4,1': 'SF4', // 4 bonds and 1 lone pair: 10 electrons on sulfur
  '3,2': 'ClF3',
  '2,3': 'XeF2',
  '6,0': 'SF6',
  '5,1': 'BrF5',
  '4,2': 'XeF4',
}

/** A deck driven by a fixed seed, as a student would see it. */
const begin = (seed = 7, saved: RowKey[] = []) => startQuiz({ ...freshShapes(), phase: 'quiz' }, new Set(saved), seed)
const answerRight = (st: ShapesState) => {
  let out = { st, known: null as RowKey | null }
  while (out.st.q && out.st.q.right === null) {
    const q = out.st.q
    const a = q.asks.find((x) => x.right === null)!
    out = pick(out.st, answerOf(a.ask, rowOf(q.row)))
  }
  return out
}
const answerWrong = (st: ShapesState) => {
  let out = { st, known: null as RowKey | null }
  while (out.st.q && out.st.q.right === null) {
    const q = out.st.q
    const a = q.asks.find((x) => x.right === null)!
    const wrong = a.choices.find((c) => c !== answerOf(a.ask, rowOf(q.row)) && !a.picks.includes(c))!
    out = pick(out.st, wrong)
  }
  return out
}

describe('the 13 rows', () => {
  it('are the rows of the shape table, in table order: 2 to 6 electron groups', () => {
    expect(ROW_KEYS).toEqual(TABLE.map((r) => r[0]))
  })
  it('each answer matches the table written from OpenStax 2e, 7.6', () => {
    for (const [key, electron, molecular, angle] of TABLE) {
      const r = rowOf(key)
      expect(answerOf('electron', r), key).toBe(electron)
      expect(answerOf('molecular', r), key).toBe(molecular)
      expect(answerOf('angle', r), key).toBe(angle)
    }
  })
  it('lists the five electron geometries in order of electron groups', () => {
    expect(GEOMETRIES).toEqual(['linear', 'trigonal planar', 'tetrahedral', 'trigonal bipyramidal', 'octahedral'])
  })
})

describe('the example molecules', () => {
  it('are 13 different guided molecules, one per row, as worked by hand', () => {
    for (const key of ROW_KEYS) expect(example(key).id, key).toBe(EXAMPLES[key])
    expect(new Set(ROW_KEYS.map((k) => example(k).id)).size).toBe(13)
  })
  it('each finished structure has the bonded atoms and lone pairs of its row', () => {
    for (const key of ROW_KEYS) {
      const s = referenceStructure(example(key))!
      const info = shapeOf(s)!
      expect(`${info.bonded},${info.lonePairs}`, key).toBe(key)
    }
  })
  it('every molecule a model question can show has the counts of its row and one kind of outer atom', () => {
    for (const key of ROW_KEYS) {
      const pool = moleculesFor(key)
      expect(pool.map((p) => p.id), key).toContain(EXAMPLES[key])
      for (const p of pool) {
        const s = structureOf(p.id)
        const info = shapeOf(s)!
        expect(`${info.bonded},${info.lonePairs}`, p.id).toBe(key)
        expect(new Set(s.atoms.slice(1).map((a) => a.el)).size, p.id).toBe(1)
      }
    }
    // formaldehyde and hydrogen cyanide have two kinds of outer atom, so their angles are only "about" the table's
    expect(ROW_KEYS.flatMap((k) => moleculesFor(k).map((p) => p.id))).not.toContain('CH2O')
    expect(ROW_KEYS.flatMap((k) => moleculesFor(k).map((p) => p.id))).not.toContain('HCN')
  })
  it('the same molecule gives the same structure object, so the model does not lift again on every redraw', () => {
    expect(structureOf('NH3')).toBe(structureOf('NH3'))
  })
})

describe('the choices', () => {
  it('the electron geometry is picked from all five', () => {
    for (const key of ROW_KEYS) expect(choicesFor('electron', rowOf(key))).toEqual(GEOMETRIES)
  })
  it('the molecular geometry has six choices with the answer, the electron geometry and the shape with no lone pairs among them', () => {
    const noPairs: Record<number, string> = { 2: 'linear', 3: 'trigonal planar', 4: 'tetrahedral', 5: 'trigonal bipyramidal', 6: 'octahedral' }
    for (const [key, electron, molecular] of TABLE) {
      const c = choicesFor('molecular', rowOf(key))
      expect(c.length, key).toBe(6)
      expect(new Set(c).size, key).toBe(6)
      expect(c, key).toContain(molecular)
      expect(c, key).toContain(electron)
      expect(c, key).toContain(noPairs[rowOf(key).bonded])
    }
  })
  it('the bond angle has five choices with the answer and the angle with no lone pairs among them', () => {
    const ideal: Record<string, string> = { linear: '180°', 'trigonal planar': '120°', tetrahedral: '109.5°', 'trigonal bipyramidal': '90° and 120°', octahedral: '90°' }
    for (const [key, electron, , angle] of TABLE) {
      const c = choicesFor('angle', rowOf(key))
      expect(c.length, key).toBe(5)
      expect(new Set(c).size, key).toBe(5)
      expect(c, key).toContain(angle)
      expect(c, key).toContain(ideal[electron])
      for (const x of c) expect(ANGLES).toContain(x)
    }
  })
  it('never offers as a wrong pick an angle that two bonds of the row really make', () => {
    // Worked by hand from the drawings in OpenStax 2e, 7.6 (Figure 7.16): the top and bottom
    // positions of a trigonal bipyramid are on one line through the middle atom (180°), and so are
    // opposite corners of an octahedron. A label of two angles holds each of them alone, and a
    // seesaw's bonds are the trigonal bipyramid's bonds squeezed a little.
    const holds: Record<RowKey, string[]> = {
      '5,0': ['90°', '120°', '180°'],
      '4,1': ['less than 90°', 'less than 120°', '180°'],
      '3,2': ['180°'],
      '6,0': ['180°'],
      '5,1': ['180°'],
      '4,2': ['180°'],
    }
    for (const [key] of TABLE) {
      const c = choicesFor('angle', rowOf(key))
      expect(c.length, key).toBe(5)
      for (const x of holds[key] ?? []) expect(c, `${key} offers ${x}`).not.toContain(x)
    }
  })
})

describe('the random source', () => {
  it('gives the same numbers for the same seed, between 0 and 1', () => {
    const a = draw(42)
    expect(draw(42)).toEqual(a)
    expect(a[0]).toBeGreaterThanOrEqual(0)
    expect(a[0]).toBeLessThan(1)
    expect(draw(a[1])[0]).not.toBe(a[0])
  })
})

describe('the deck', () => {
  it('asks a question at once, with one ask per kind and two for the counts question', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = begin(seed).q!
      expect(ROW_KEYS).toContain(q.row)
      expect(KINDS).toContain(q.kind)
      expect(q.asks.map((a) => a.ask)).toEqual(q.kind === 'counts' ? ['electron', 'molecular'] : q.kind === 'angle' ? ['angle'] : [q.kind])
      expect(moleculesFor(q.row).map((p) => p.id)).toContain(q.molecule)
    }
  })
  it('is the same deck for the same seed', () => {
    const a = answerRight(answerRight(begin(9)).st).st
    const b = answerRight(answerRight(begin(9)).st).st
    expect(nextQuestion(a, new Set()).q).toEqual(nextQuestion(b, new Set()).q)
  })
  it('asks every row before any row comes back, when every answer is right', () => {
    let st = begin(3)
    const seen: RowKey[] = []
    for (let i = 0; i < 13; i++) {
      seen.push(st.q!.row)
      st = nextQuestion(answerRight(st).st, new Set())
    }
    expect(new Set(seen).size).toBe(13)
  })
  it('never asks the same row twice in a row while another row is open', () => {
    let st = begin(5)
    for (let i = 0; i < 40 && st.q; i++) {
      const before = st.q.row
      st = nextQuestion((i % 3 ? answerRight(st) : answerWrong(st)).st, new Set())
      if (st.q && knownKeys(st, new Set()).length < 12) expect(st.q.row).not.toBe(before)
    }
  })
  it('a missed row comes back after one other question', () => {
    for (let seed = 1; seed < 30; seed++) {
      let st = begin(seed)
      const missed = st.q!.row
      st = nextQuestion(answerWrong(st).st, new Set())
      expect(st.q!.row, `seed ${seed}`).not.toBe(missed)
      expect(BACK_AFTER_MISS).toBe(2)
      st = nextQuestion(answerRight(st).st, new Set())
      expect(st.q!.row, `seed ${seed}`).toBe(missed)
    }
  })
  it('a row answered right goes to the back: the rows not yet asked come first', () => {
    let st = begin(11)
    const first = st.q!.row
    const order: RowKey[] = []
    for (let i = 0; i < 12; i++) {
      st = nextQuestion(answerRight(st).st, new Set())
      order.push(st.q!.row)
    }
    expect(order).not.toContain(first)
  })
  it(`a row is known after ${KNOWN_AT} right answers on the first try, on separate questions, and is saved once`, () => {
    let st = begin(2)
    const counts: Record<string, number> = {}
    const madeKnown: RowKey[] = []
    for (let i = 0; i < 26; i++) {
      const row = st.q!.row
      counts[row] = (counts[row] ?? 0) + 1
      const out = answerRight(st)
      if (out.known) {
        expect(out.known).toBe(row)
        expect(counts[row]).toBe(KNOWN_AT)
        madeKnown.push(out.known)
      } else expect(counts[row]).toBeLessThan(KNOWN_AT)
      st = nextQuestion(out.st, new Set())
    }
    expect(madeKnown.length).toBe(13)
    expect(new Set(madeKnown).size).toBe(13)
    expect(st.q).toBeNull()
    expect(knownKeys(st, new Set()).length).toBe(13)
  })
  it('a miss starts the count again, and a right answer on the second try counts as a miss', () => {
    let st = begin(4)
    const row = st.q!.row
    st = answerRight(st).st
    expect(st.rows[row]!.streak).toBe(1)
    // bring the row back and miss it on the first try, then get it right
    for (let i = 0; i < 40 && !(st.q?.row === row && st.q.right === null); i++) st = nextQuestion(st.q?.right === null ? answerRight(st).st : st, new Set())
    expect(st.q!.row).toBe(row)
    const a = st.q!.asks[0]!
    const wrong = a.choices.find((c) => c !== answerOf(a.ask, rowOf(row)))!
    st = pick(st, wrong).st
    expect(st.q!.right).toBeNull()
    const out = answerRight(st)
    expect(out.known).toBeNull()
    expect(out.st.rows[row]!.streak).toBe(0)
    expect(out.st.rows[row]!.misses).toBe(1)
    expect(out.st.q!.right).toBe(true)
    expect(out.st.q!.firstTry).toBe(false)
  })
  it(`gives ${TRIES} tries for each ask, then closes it`, () => {
    let st = begin(6)
    const a = st.q!.asks[0]!
    const wrongs = a.choices.filter((c) => c !== answerOf(a.ask, rowOf(st.q!.row)))
    st = pick(st, wrongs[0]!).st
    expect(st.q!.asks[0]!.right).toBeNull()
    // the same wrong pick twice is not a second try
    expect(pick(st, wrongs[0]!).st).toBe(st)
    st = pick(st, wrongs[1]!).st
    expect(st.q!.asks[0]!.right).toBe(false)
    expect(st.q!.asks[0]!.picks.length).toBe(TRIES)
  })
  it('a pick that is not a choice, or a pick after the question is closed, changes nothing', () => {
    const st = begin(8)
    expect(pick(st, 'not a choice').st).toBe(st)
    const done = answerRight(st).st
    expect(pick(done, answerOf(done.q!.asks[0]!.ask, rowOf(done.q!.row))).st).toBe(done)
  })
  it('rows the app has saved as known are not asked, and count as known', () => {
    const saved: RowKey[] = ['2,0', '3,0', '4,0', '5,0', '6,0', '3,1', '2,2', '4,1', '3,2', '2,3', '5,1', '4,2']
    let st = begin(12, saved)
    expect(knownKeys(st, new Set(saved)).length).toBe(12)
    for (let i = 0; i < 6 && st.q; i++) {
      expect(st.q.row).toBe('2,1')
      st = nextQuestion(answerRight(st).st, new Set(saved))
    }
    expect(st.q).toBeNull()
    expect(knownKeys(st, new Set(saved)).length).toBe(13)
  })
  it('practice again asks all 13 rows again and leaves the saved list alone', () => {
    const saved = new Set<RowKey>(ROW_KEYS)
    const st = practiceAgain(begin(1, [...saved]), saved, 99)
    expect(st.round).toBe(1)
    expect(knownKeys(st, saved)).toEqual([])
    expect(st.q).not.toBeNull()
  })
  it('asks a row a different kind of question each time it comes back', () => {
    let st = begin(21)
    const kinds: Record<string, string[]> = {}
    for (let i = 0; i < 26 && st.q; i++) {
      ;(kinds[st.q.row] ??= []).push(st.q.kind)
      st = nextQuestion(answerRight(st).st, new Set())
    }
    for (const list of Object.values(kinds)) for (let i = 1; i < list.length; i++) expect(list[i]).not.toBe(list[i - 1])
  })
})

describe('the board', () => {
  it('shows the example of the card in the series', () => {
    const st = { ...freshShapes(), card: 4 }
    expect(shapesBoard(st)).toBe(structureOf('NH3'))
  })
  it('shows the model during a model question, and nothing during a counts or angle question until it is answered', () => {
    for (let seed = 1; seed < 40; seed++) {
      const st = begin(seed)
      const q = st.q!
      const model = q.kind === 'electron' || q.kind === 'molecular'
      expect(shapesBoard(st).atoms.length > 0, `${q.kind}`).toBe(model)
      expect(shapesBoard(answerRight(st).st)).toBe(structureOf(q.molecule))
    }
  })
  it('every row of the series shows its example molecule', () => {
    expect(PROBLEMS.length).toBeGreaterThan(13)
    ROW_KEYS.forEach((key, card) => expect(shapesBoard({ ...freshShapes(), card })).toBe(structureOf(EXAMPLES[key]!)))
  })
})
