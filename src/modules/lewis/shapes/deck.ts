// The shapes quiz's rules: the 13 rows of the shape table, one example molecule per row, the
// questions and their choices, and the deck that decides which row is asked next. Pure: every
// function takes the state and returns a new one, and the only randomness is the seeded source
// `draw`, so a test can drive the deck one question at a time. The words are in words.ts.
//
// The rule for "known" (docs/learning/shapes-quiz.md): a row is known after KNOWN_AT questions on
// it in a row were answered right on the first try. A miss, or a right answer on the second try,
// starts the count again and brings the row back after one other question.
import { EXERCISES, referenceStructure } from '../../../chem/exercises'
import { PROBLEMS, type Problem } from '../../../chem/problems'
import type { Structure } from '../../../chem/structure'
import { ALL_CASES, ALL_SHAPES, classify, shapeOf, type Geometry, type ShapeInfo, type ShapeName } from '../../../chem/vsepr'
import type { AskState, Question, ShapesState } from './state'

/** A row of the shape table by its counts: `${bonded},${lonePairs}`. */
export type RowKey = string
/** What a question asks for. */
export type Ask = 'electron' | 'molecular' | 'angle'
/** The four kinds of question: a model is shown and one geometry is named; the counts are given
 *  in words and both geometries are named; both geometries are given and the bond angle is picked. */
export type Kind = 'electron' | 'molecular' | 'counts' | 'angle'
export const KINDS: Kind[] = ['electron', 'molecular', 'counts', 'angle']

/** Tries on each part of a question. The answer is shown after the last one. */
export const TRIES = 2
/** Right answers on the first try, on separate questions in a row, that make a row known. */
export const KNOWN_AT = 2
/** A missed row is due again this many questions later: one other question comes between. */
export const BACK_AFTER_MISS = 2
/** A row answered right is due again this many questions later, or GAP_AFTER_MISS once it has been missed. */
export const GAP_RIGHT = 5
export const GAP_AFTER_MISS = 3

export const rowKey = (r: { bonded: number; lonePairs: number }): RowKey => `${r.bonded},${r.lonePairs}`
/** The 13 rows in table order: 2 to 6 electron groups. */
export const ROW_KEYS: RowKey[] = ALL_CASES.map(rowKey)
const ROWS = new Map(ALL_CASES.map((r) => [rowKey(r), r]))
export function rowOf(key: RowKey): ShapeInfo {
  const r = ROWS.get(key)
  if (!r) throw new Error(`no row ${key} in the shape table`)
  return r
}

/** The five electron geometries, in order of electron groups. */
export const GEOMETRIES: Geometry[] = ['linear', 'trigonal planar', 'tetrahedral', 'trigonal bipyramidal', 'octahedral']
/** Every bond angle the table names, in table order. */
export const ANGLES: string[] = [...new Set(ALL_CASES.map((r) => r.angle))]

// ---------------------------------------------------------------- the molecules

/** One guided molecule per row for the series, 13 different ones. */
const EXAMPLE_IDS: Record<RowKey, string> = {
  '2,0': 'CO2',
  '3,0': 'BF3',
  '2,1': 'SO2',
  '4,0': 'CH4',
  '3,1': 'NH3',
  '2,2': 'H2O',
  '5,0': 'PCl5',
  '4,1': 'SF4',
  '3,2': 'ClF3',
  '2,3': 'XeF2',
  '6,0': 'SF6',
  '5,1': 'BrF5',
  '4,2': 'XeF4',
}
const ALL_MOLECULES: Problem[] = [...PROBLEMS, ...EXERCISES].filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i)
export function problemById(id: string): Problem {
  const p = ALL_MOLECULES.find((x) => x.id === id)
  if (!p) throw new Error(`no molecule ${id}`)
  return p
}
export const example = (key: RowKey): Problem => problemById(EXAMPLE_IDS[key]!)

const structures = new Map<string, Structure | null>()
const referenceOf = (p: Problem): Structure | null => {
  if (!structures.has(p.id)) structures.set(p.id, referenceStructure(p))
  return structures.get(p.id)!
}
/** The finished Lewis structure of a molecule, the same object every time, so the board does not
 *  lift the model again on every redraw. */
export function structureOf(id: string): Structure {
  const s = referenceOf(problemById(id))
  if (!s) throw new Error(`no finished structure for ${id}`)
  return s
}

let pools: Map<RowKey, Problem[]> | null = null
/** The molecules a model question can show for a row: guided molecules and exercises whose
 *  finished structure has the row's counts and only one kind of outer atom (with two kinds, an
 *  angle is only about the table's). */
export function moleculesFor(key: RowKey): Problem[] {
  if (!pools) {
    pools = new Map(ROW_KEYS.map((k) => [k, [] as Problem[]]))
    for (const p of ALL_MOLECULES) {
      const s = referenceOf(p)
      const info = s ? shapeOf(s) : null
      if (!s || !info || info.diatomic) continue
      if (new Set(s.atoms.slice(1).map((a) => a.el)).size !== 1) continue
      pools.get(rowKey(info))?.push(p)
    }
  }
  return pools.get(key) ?? []
}

// ---------------------------------------------------------------- questions

export function answerOf(ask: Ask, row: ShapeInfo): string {
  return ask === 'electron' ? row.geometry : ask === 'molecular' ? row.shape : row.angle
}
/** The angle the electron geometry has when every electron group is a bond. */
export const idealAngle = (row: ShapeInfo): string => classify(row.groups, 0)!.angle
/** The molecular geometry the bonded atoms would have with no lone pairs. */
export const shapeWithoutPairs = (row: ShapeInfo): ShapeName => classify(row.bonded, 0)!.shape

/** The choices for a part of a question, in a fixed order: all five electron geometries; six
 *  molecular geometries (the answer, the electron geometry, the one with no lone pairs, the others
 *  with as many atoms or as many groups); five bond angles (the answer, the angle with no lone
 *  pairs, the others of the same electron geometry, then the nearest rows). */
export function choicesFor(ask: Ask, row: ShapeInfo): string[] {
  if (ask === 'electron') return [...GEOMETRIES]
  const pool: string[] = []
  const add = (x: string, max: number) => {
    if (pool.length < max && !pool.includes(x)) pool.push(x)
  }
  if (ask === 'molecular') {
    for (const x of [row.shape, row.geometry, shapeWithoutPairs(row)]) add(x, 6)
    for (const r of ALL_CASES) if (r.bonded === row.bonded) add(r.shape, 6)
    for (const r of ALL_CASES) if (r.groups === row.groups) add(r.shape, 6)
    for (const x of ALL_SHAPES) add(x, 6)
    return ALL_SHAPES.filter((x) => pool.includes(x))
  }
  for (const x of [row.angle, idealAngle(row)]) add(x, 5)
  for (const r of ALL_CASES) if (r.groups === row.groups) add(r.angle, 5)
  const at = ANGLES.indexOf(row.angle)
  const near = [...ANGLES].sort((a, b) => Math.abs(ANGLES.indexOf(a) - at) - Math.abs(ANGLES.indexOf(b) - at))
  for (const x of near) add(x, 5)
  return ANGLES.filter((x) => pool.includes(x))
}

// ---------------------------------------------------------------- the random source

/** A number from 0 up to 1, and the next state of the source (mulberry32). */
export function draw(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}
function pickOne<T>(list: T[], seed: number): [T, number] {
  const [x, next] = draw(seed)
  return [list[Math.floor(x * list.length)]!, next]
}

// ---------------------------------------------------------------- the deck

/** The rows known in this round. In the first round the rows the app has saved count too. */
export function knownKeys(st: ShapesState, saved: ReadonlySet<RowKey>): RowKey[] {
  return ROW_KEYS.filter((k) => st.known.includes(k) || (st.round === 0 && saved.has(k)))
}

/** The next question: the rows not yet known that are due, a missed row first, then the one due
 *  longest, never the row just asked while another is open. Null when all 13 are known. */
export function nextQuestion(st: ShapesState, saved: ReadonlySet<RowKey>): ShapesState {
  const known = new Set(knownKeys(st, saved))
  const open = ROW_KEYS.filter((k) => !known.has(k))
  if (!open.length) return { ...st, q: null }
  const turn = st.turn + 1
  const rows = st.rows
  const pool = open.length > 1 ? open.filter((k) => k !== st.q?.row) : open
  const due = (k: RowKey) => rows[k]!.due
  const ready = pool.filter((k) => due(k) <= turn)
  const soonest = Math.min(...pool.map(due))
  const from = ready.length ? ready : pool.filter((k) => due(k) === soonest)
  const missed = from.filter((k) => rows[k]!.streak === 0 && rows[k]!.misses > 0)
  const best = missed.length ? missed : from
  const first = Math.min(...best.map(due))
  let seed = st.seed
  let row: RowKey
  ;[row, seed] = pickOne(best.filter((k) => due(k) === first), seed)
  let kind: Kind
  ;[kind, seed] = pickOne(KINDS.filter((k) => k !== rows[row]!.lastKind), seed)
  let molecule: Problem
  ;[molecule, seed] = pickOne(moleculesFor(row), seed)
  const info = rowOf(row)
  const asks: Ask[] = kind === 'counts' ? ['electron', 'molecular'] : kind === 'angle' ? ['angle'] : [kind]
  const q: Question = {
    n: turn,
    row,
    kind,
    molecule: molecule.id,
    asks: asks.map((ask): AskState => ({ ask, choices: choicesFor(ask, info), picks: [], right: null })),
    right: null,
    firstTry: false,
    madeKnown: false,
  }
  return { ...st, turn, seed, q, rows: { ...rows, [row]: { ...rows[row]!, asked: rows[row]!.asked + 1, lastKind: kind } } }
}

/** Into the quiz: a first question, unless one is open already. */
export function startQuiz(st: ShapesState, saved: ReadonlySet<RowKey>, seed: number): ShapesState {
  const into = { ...st, phase: 'quiz' as const }
  if (st.q) return into
  return nextQuestion({ ...into, seed: st.turn === 0 ? seed >>> 0 : st.seed }, saved)
}

/** All 13 rows asked again from the start. The saved list stays as it is. */
export function practiceAgain(st: ShapesState, saved: ReadonlySet<RowKey>, seed: number): ShapesState {
  const rows = Object.fromEntries(ROW_KEYS.map((k) => [k, { streak: 0, due: 0, asked: 0, misses: 0, lastKind: null }]))
  return nextQuestion({ ...st, phase: 'quiz', round: st.round + 1, known: [], rows, q: null, seed: seed >>> 0 }, saved)
}

/** A pick on the open part of the question. `known` is the row this answer made known. */
export function pick(st: ShapesState, value: string): { st: ShapesState; known: RowKey | null } {
  const q = st.q
  const same = { st, known: null }
  if (!q || q.right !== null) return same
  const at = q.asks.findIndex((a) => a.right === null)
  const a = q.asks[at]
  if (!a || !a.choices.includes(value) || a.picks.includes(value)) return same
  const right = value === answerOf(a.ask, rowOf(q.row))
  const picks = [...a.picks, value]
  const asks = q.asks.map((x, i) => (i === at ? { ...x, picks, right: right || picks.length >= TRIES ? right : null } : x))
  if (asks.some((x) => x.right === null)) return { st: { ...st, q: { ...q, asks } }, known: null }
  // the question is finished
  const firstTry = asks.every((x) => x.right && x.picks.length === 1)
  const r = st.rows[q.row]!
  const streak = firstTry ? r.streak + 1 : 0
  const misses = firstTry ? r.misses : r.misses + 1
  const due = q.n + (firstTry ? (misses ? GAP_AFTER_MISS : GAP_RIGHT) : BACK_AFTER_MISS)
  const madeKnown = firstTry && streak >= KNOWN_AT && !st.known.includes(q.row)
  return {
    st: {
      ...st,
      q: { ...q, asks, right: asks.every((x) => x.right), firstTry, madeKnown },
      rows: { ...st.rows, [q.row]: { ...r, streak, misses, due } },
      known: madeKnown ? [...st.known, q.row] : st.known,
    },
    known: madeKnown ? q.row : null,
  }
}
