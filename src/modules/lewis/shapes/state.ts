// The shapes quiz: what it remembers between screens, and what the board shows for it.
// Pure: no DOM, and nothing from store.ts or ui.ts. The rules that change it are in deck.ts.
import { EMPTY, type Structure } from '../../../chem/structure'
import { ROW_KEYS, example, structureOf, type Ask, type Kind, type RowKey } from './deck'

/** How one row of the shape table is doing in the quiz. */
export interface RowProgress {
  /** Right answers on the first try in a row. A miss sets it back to 0. */
  streak: number
  /** The question number from which the row may be asked again. */
  due: number
  /** How many times the row has been asked. */
  asked: number
  /** How many questions on the row were missed. */
  misses: number
  /** The kind of the last question on the row, so the next one is a different kind. */
  lastKind: Kind | null
}

/** One part of a question: a list of choices and the student's picks, in order. */
export interface AskState {
  ask: Ask
  choices: string[]
  picks: string[]
  /** Null while it is open, then whether the last pick was right. */
  right: boolean | null
}

export interface Question {
  /** Its number in the quiz: 1 for the first question. */
  n: number
  row: RowKey
  kind: Kind
  /** The guided or exercise molecule whose model the board shows (for a counts or angle question, once it is answered). */
  molecule: string
  asks: AskState[]
  /** Null while open. Then true when every part ended right, on any try. */
  right: boolean | null
  /** True when every part was right on the first try: only this counts toward "known". */
  firstTry: boolean
  /** True when this question made its row known. */
  madeKnown: boolean
}

export interface ShapesState {
  /** The series of all 13 rows, or the quiz. */
  phase: 'learn' | 'quiz'
  /** The row the series shows, 0 to 12. */
  card: number
  /** What the series model shows: every electron group, or the atoms only. */
  view: 'all' | 'atoms'
  /** 0 for the first round, where the saved list counts as known. Practice again starts round 1, 2, ... */
  round: number
  /** The state of the random source. */
  seed: number
  /** The number of the last question asked. */
  turn: number
  rows: Record<string, RowProgress>
  q: Question | null
  /** Rows that became known in this round, in order. */
  known: RowKey[]
}

export const freshRows = (): Record<string, RowProgress> => Object.fromEntries(ROW_KEYS.map((k) => [k, { streak: 0, due: 0, asked: 0, misses: 0, lastKind: null }]))
export const freshShapes = (): ShapesState => ({ phase: 'learn', card: 0, view: 'all', round: 0, seed: 1, turn: 0, rows: freshRows(), q: null, known: [] })

/** The molecule the board shows in the shapes quiz, lifted into 3D: the series card's example, or
 *  the question's molecule. A counts or angle question shows nothing until it is answered, since
 *  the model would answer it. */
export function shapesBoard(st: ShapesState): Structure {
  if (st.phase === 'learn') return structureOf(example(ROW_KEYS[st.card] ?? ROW_KEYS[0]!).id)
  const q = st.q
  if (!q) return EMPTY
  const model = q.kind === 'electron' || q.kind === 'molecular'
  return model || q.right !== null ? structureOf(q.molecule) : EMPTY
}
