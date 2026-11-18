// The exercises: what they remember between screens, and their rules for the board and the sheet.
// Pure: no DOM, and nothing from store.ts or ui.ts. Every function returns a new state.
import { assess } from '../../../chem/assess'
import { EXERCISES, EXERCISE_SETS } from '../../../chem/exercises'
import { speciesOf, type Problem } from '../../../chem/problems'
import type { Structure } from '../../../chem/structure'
import type { Geometry, ShapeName } from '../../../chem/vsepr'
import { readTenths, readWhole, sheetOf, type PartId, type Sheet } from './sheet'

/** An answer that is checked: the last answer checked, whether it was right, and how many wrong checks it had. */
export interface Tried<T> {
  pick: T | null
  right: boolean
  tries: number
}
const untried = <T>(): Tried<T> => ({ pick: null, right: false, tries: 0 })

/** One kind of bond in the bond polarity part: the ΔEN typed and checked, then polar or nonpolar. */
export interface BondRow {
  text: string
  /** ΔEN in tenths, as last checked. */
  den: Tried<number>
  /** Polar or nonpolar. The first pick is final: there are only two answers. */
  pick: 'polar' | 'nonpolar' | null
}

export interface ExerciseState {
  /** Index into EXERCISES of the molecule on screen. */
  at: number
  valence: Tried<number> & { text: string }
  /** `shown` is true while a check's result is on screen for the board as it is: a change to the board takes it away. */
  structure: { right: boolean; tries: number; shown: boolean }
  /** Yes or no. The first pick is final. */
  resonance: boolean | null
  eg: Tried<Geometry>
  mg: Tried<ShapeName>
  angle: Tried<string>
  /** Keyed by the outer atom's element. */
  bonds: Record<string, BondRow>
  /** Polar (or, for an ion, "does not cancel") is true. The first pick is final. Then, for a molecule with a net dipole, which way it points. */
  net: { pick: boolean | null; dir: Tried<string> }
  /** The parts of this molecule that had a wrong answer. */
  missed: PartId[]
  /** True once this molecule's sheet has been counted as finished. */
  counted: boolean
  /** Sheets finished since the exercises opened. */
  finished: number
  /** Molecules finished with a missed part. Each comes back once `finished` reaches `due`. */
  queue: { at: number; due: number }[]
}

/** The id a finished exercise is saved under. Its prefix is PART_IDS.exercise in store.ts. */
export const savedId = (p: Pick<Problem, 'id'>) => `ex:${p.id}`

/** A molecule finished with a missed part comes back after this many other molecules are finished. */
export const COME_BACK = 3

/** The pool in the order the picker lists it: the sets in order, then any molecule no set names. */
export function poolOrder(pool: Problem[] = EXERCISES, sets = EXERCISE_SETS): number[] {
  const order: number[] = []
  for (const set of sets) for (const id of set.ids) {
    const i = pool.findIndex((p) => p.id === id)
    if (i >= 0 && !order.includes(i)) order.push(i)
  }
  pool.forEach((_, i) => {
    if (!order.includes(i)) order.push(i)
  })
  return order
}

/** The answers of one molecule, all empty. */
function freshAnswers(at: number): Omit<ExerciseState, 'finished' | 'queue'> {
  return {
    at,
    valence: { ...untried<number>(), text: '' },
    structure: { right: false, tries: 0, shown: false },
    resonance: null,
    eg: untried(),
    mg: untried(),
    angle: untried(),
    bonds: {},
    net: { pick: null, dir: untried() },
    missed: [],
    counted: false,
  }
}
export const freshExercise = (): ExerciseState => ({ ...freshAnswers(poolOrder()[0] ?? 0), finished: 0, queue: [] })

/** The molecule the student is working on: its atoms fill the row under the board. */
export function exerciseProblem(st: ExerciseState): Problem {
  return EXERCISES[st.at] ?? EXERCISES[0]!
}
export const exerciseSheet = (st: ExerciseState): Sheet => sheetOf(exerciseProblem(st))

/** Another molecule: its answers start empty. What was finished and what comes back stay. */
export function goTo(st: ExerciseState, at: number): ExerciseState {
  return { ...freshAnswers(at), finished: st.finished, queue: st.queue }
}

/** A molecule chosen in the picker. The molecule already on screen keeps its sheet. */
export function pickAt(st: ExerciseState, at: number): ExerciseState {
  return at === st.at ? st : goTo(st, at)
}

/** True while nothing on the sheet has been answered or tried and nothing has been finished. */
function untouched(st: ExerciseState): boolean {
  return JSON.stringify(st) === JSON.stringify({ ...freshAnswers(st.at), finished: 0, queue: [] })
}
/** The molecule the exercises open on, once the saved list is known: the first one in the picker's
 *  order that is not finished. A sheet with anything on it stays, and so does the first molecule
 *  when every molecule is finished. */
export function openingExercise(st: ExerciseState, solved: string[], pool: Problem[] = EXERCISES, sets = EXERCISE_SETS): ExerciseState {
  if (!untouched(st)) return st
  const open = poolOrder(pool, sets).find((i) => !solved.includes(savedId(pool[i]!)))
  return open === undefined || open === st.at ? st : goTo(st, open)
}

const miss = (st: ExerciseState, part: PartId): PartId[] => (st.missed.includes(part) ? st.missed : [...st.missed, part])

// ---------------------------------------------------------------- the parts

export function typeValence(st: ExerciseState, text: string): ExerciseState {
  if (st.valence.right) return st
  return { ...st, valence: { ...st.valence, text: text.replace(/\D/g, '').slice(0, 3) } }
}
/** Checks the typed total. An empty box is not a try. */
export function checkValence(st: ExerciseState, sh: Sheet): ExerciseState {
  const n = readWhole(st.valence.text)
  if (st.valence.right || n === null) return st
  if (n === sh.total) return { ...st, valence: { ...st.valence, pick: n, right: true } }
  return { ...st, valence: { ...st.valence, pick: n, tries: st.valence.tries + 1 }, missed: miss(st, 'valence') }
}

/** True when every atom is on the board and they make one piece: a check of that board is a real try. */
export function structureReady(p: Problem, s: Structure): boolean {
  const a = assess(s, speciesOf(p))
  return !a.issues.some((i) => i.kind === 'missing' || i.kind === 'loose')
}
export function structureRight(p: Problem, s: Structure): boolean {
  return assess(s, speciesOf(p)).complete
}
/** "Check my structure". A board with atoms still to place or loose atoms is told so, and that is not a try. */
export function checkStructure(st: ExerciseState, sh: Sheet, s: Structure): ExerciseState {
  if (st.structure.right) return st
  if (structureRight(sh.p, s)) return { ...st, structure: { ...st.structure, right: true, shown: true } }
  if (!structureReady(sh.p, s)) return { ...st, structure: { ...st.structure, shown: true } }
  return { ...st, structure: { right: false, tries: st.structure.tries + 1, shown: true }, missed: miss(st, 'structure') }
}

/** The resonance question opens once the structure is right. */
export const resonanceOpen = (st: ExerciseState) => st.structure.right
export function pickResonance(st: ExerciseState, sh: Sheet, yes: boolean): ExerciseState {
  if (st.resonance !== null || !resonanceOpen(st)) return st
  return { ...st, resonance: yes, missed: yes === sh.resonance ? st.missed : miss(st, 'resonance') }
}

function pickTried<T>(st: ExerciseState, part: 'eg' | 'mg' | 'angle', pick: T, truth: T): ExerciseState {
  const a = st[part] as unknown as Tried<T>
  if (a.right) return st
  if (pick === truth) return { ...st, [part]: { pick, right: true, tries: a.tries } }
  // the same wrong pick twice in a row is not a new try
  if (pick === a.pick) return st
  return { ...st, [part]: { pick, right: false, tries: a.tries + 1 }, missed: miss(st, part) }
}
export const pickGeometry = (st: ExerciseState, sh: Sheet, g: Geometry) => pickTried(st, 'eg', g, sh.info.geometry)
export const pickShape = (st: ExerciseState, sh: Sheet, name: ShapeName) => pickTried(st, 'mg', name, sh.info.shape)
export const pickAngle = (st: ExerciseState, sh: Sheet, angle: string) => pickTried(st, 'angle', angle, sh.angle)

const row = (st: ExerciseState, el: string): BondRow => st.bonds[el] ?? { text: '', den: untried(), pick: null }
export function typeDelta(st: ExerciseState, el: string, text: string): ExerciseState {
  const r = row(st, el)
  if (r.den.right) return st
  return { ...st, bonds: { ...st.bonds, [el]: { ...r, text: text.replace(/[^\d.,\-−]/g, '').slice(0, 5) } } }
}
/** Checks every ΔEN that is typed and not yet right. An empty box is not a try. */
export function checkDeltas(st: ExerciseState, sh: Sheet): ExerciseState {
  let next = st
  for (const k of sh.bonds) {
    const r = row(next, k.b)
    const v = readTenths(r.text)
    if (r.den.right || v === null) continue
    const right = Math.abs(v - k.pol.tenths) < 1e-6
    if (!right && r.den.pick !== null && Math.abs(r.den.pick - v) < 1e-6) continue
    next = { ...next, bonds: { ...next.bonds, [k.b]: { ...r, den: { pick: v, right, tries: r.den.tries + (right ? 0 : 1) } } }, missed: right ? next.missed : miss(next, 'bonds') }
  }
  return next
}
/** Polar or nonpolar for one kind of bond, once its ΔEN is right. */
export function pickBond(st: ExerciseState, sh: Sheet, el: string, polar: boolean): ExerciseState {
  const r = row(st, el)
  const k = sh.bonds.find((x) => x.b === el)
  if (!k || !r.den.right || r.pick !== null) return st
  return { ...st, bonds: { ...st.bonds, [el]: { ...r, pick: polar ? 'polar' : 'nonpolar' } }, missed: polar === k.polar ? st.missed : miss(st, 'bonds') }
}
export const bondsDone = (st: ExerciseState, sh: Sheet) => sh.bonds.every((k) => row(st, k.b).den.right && row(st, k.b).pick !== null)
export const bondRow = row

/** The net dipole comes from the bond dipoles and the molecular geometry, so it opens once both are answered. */
export const netOpen = (st: ExerciseState, sh: Sheet) => st.mg.right && bondsDone(st, sh)
export function pickNet(st: ExerciseState, sh: Sheet, polar: boolean): ExerciseState {
  if (st.net.pick !== null || !netOpen(st, sh)) return st
  return { ...st, net: { ...st.net, pick: polar }, missed: polar === sh.m.polar ? st.missed : miss(st, 'net') }
}
/** The direction question opens after polar or nonpolar is answered, for a molecule whose dipoles do not cancel. */
export const directionOpen = (st: ExerciseState, sh: Sheet) => st.net.pick !== null && !!sh.directions
export function pickDirection(st: ExerciseState, sh: Sheet, id: string): ExerciseState {
  const d = st.net.dir
  if (!directionOpen(st, sh) || d.right || !sh.directions?.choices.some((c) => c.id === id)) return st
  if (id === sh.directions.right) return { ...st, net: { ...st.net, dir: { pick: id, right: true, tries: d.tries } } }
  if (id === d.pick) return st
  return { ...st, net: { ...st.net, dir: { pick: id, right: false, tries: d.tries + 1 } }, missed: miss(st, 'net') }
}

/** Which parts are answered: right, or final after one pick. */
export function answered(st: ExerciseState, sh: Sheet): Set<PartId> {
  const out = new Set<PartId>()
  if (st.valence.right) out.add('valence')
  if (st.structure.right) out.add('structure')
  if (st.resonance !== null) out.add('resonance')
  if (st.eg.right) out.add('eg')
  if (st.mg.right) out.add('mg')
  if (st.angle.right) out.add('angle')
  if (bondsDone(st, sh)) out.add('bonds')
  if (st.net.pick !== null && (!sh.directions || st.net.dir.right)) out.add('net')
  return out
}
export const sheetDone = (st: ExerciseState, sh: Sheet) => answered(st, sh).size === 8

/** Count a finished sheet once: a molecule with a missed part goes in the queue to come back. */
export function countFinished(st: ExerciseState, sh: Sheet): ExerciseState {
  if (st.counted || !sheetDone(st, sh)) return st
  const finished = st.finished + 1
  const queue = st.queue.filter((q) => q.at !== st.at)
  if (st.missed.length) queue.push({ at: st.at, due: finished + COME_BACK })
  return { ...st, counted: true, finished, queue }
}

/** The molecule "Next molecule" opens. In order:
 *  1. a molecule finished with a missed part whose turn has come (COME_BACK others finished since),
 *  2. the next molecule in the picker's order that is not finished yet,
 *  3. a molecule with a missed part, even if its turn has not come,
 *  4. the next molecule in order. */
export function nextAt(st: ExerciseState, solved: string[], pool: Problem[] = EXERCISES, sets = EXERCISE_SETS): number {
  const order = poolOrder(pool, sets)
  const due = st.queue.find((q) => q.at !== st.at && q.due <= st.finished)
  if (due) return due.at
  const from = Math.max(0, order.indexOf(st.at))
  const after = [...order.slice(from + 1), ...order.slice(0, from)]
  const open = after.find((i) => !solved.includes(savedId(pool[i]!)))
  if (open !== undefined) return open
  const waiting = st.queue.find((q) => q.at !== st.at)
  if (waiting) return waiting.at
  return after[0] ?? st.at
}

// ---------------------------------------------------------------- the board

/** The board changed (an atom, a bond or an electron). Returns the state with the answers that no
 *  longer stand thrown away: a right structure that is no longer right, and any check result shown
 *  for the old board. Every other part is about the molecule, not the board, and stays. */
export function exerciseBoardChanged(st: ExerciseState, s: Structure): ExerciseState {
  const p = exerciseProblem(st)
  if (st.structure.right && structureRight(p, s)) return st
  if (!st.structure.right && !st.structure.shown) return st
  return { ...st, structure: { ...st.structure, right: false, shown: false } }
}
/** True when the student may open the 3D shape of what is on the board: both geometries are
 *  answered and the board holds the finished structure. */
export function exerciseCanLift(st: ExerciseState, s: Structure): boolean {
  return st.eg.right && st.mg.right && structureRight(exerciseProblem(st), s)
}
