// App state and every action a student can take. The chemistry rules live in src/chem; this file
// only decides when a move is allowed in the current step and what to say when it is refused.
import { assess } from '../../chem/assess'
import { ELEMENTS, EL_ORDER, type El } from '../../chem/elements'
import type { P2 } from '../../chem/layout2d'
import { PROBLEMS, atomsOf, totalElectrons, type Problem } from '../../chem/problems'
import {
  EMPTY,
  addAtom,
  addElectron as addElectronOp,
  atomById,
  removeAtom as removeAtomOp,
  removeElectron as removeElectronOp,
  share,
  unshare,
  type Op,
  type Structure,
} from '../../chem/structure'
import { shapeOf, type ShapeName } from '../../chem/vsepr'
import {
  STEPS,
  boardStepDone,
  countFeedback,
  elementsOf,
  groupFacts,
  groupsFeedback,
  groupsRight,
  hintsFor,
  middleFeedback,
  middleNeeded,
  refusalText,
  shapeFeedback,
  shapeInfoFor,
  totalFeedback,
  type StepId,
} from './guide'

export type Mode = 'guided' | 'free'
export interface Selection {
  kind: 'atom' | 'bond'
  id: string
}
export interface Toast {
  text: string
  tone: 'info' | 'warn'
  n: number
}
export interface CountState {
  answers: Partial<Record<El, number>>
  right: Partial<Record<El, boolean>>
  tries: Partial<Record<El, number>>
  feedback: Partial<Record<El, string>>
  total: number | null
  totalRight: boolean
  totalTries: number
  totalFeedback: string | null
}
export interface ShapeState {
  groups: number | null
  groupsRight: boolean
  groupsTries: number
  groupsFeedback: string | null
  pick: ShapeName | null
  pickRight: boolean
  pickFeedback: string | null
}
export interface State {
  mode: Mode
  problem: number
  step: StepId
  count: CountState
  middle: { pick: El | null; right: boolean; text: string | null }
  shape: ShapeState
  s: Structure
  past: Structure[]
  selection: Selection | null
  view: 'flat' | 'shape'
  hints: number
  pickerOpen: boolean
  solved: string[]
  toast: Toast | null
}

const freshCount = (): CountState => ({ answers: {}, right: {}, tries: {}, feedback: {}, total: null, totalRight: false, totalTries: 0, totalFeedback: null })
const freshShape = (): ShapeState => ({ groups: null, groupsRight: false, groupsTries: 0, groupsFeedback: null, pick: null, pickRight: false, pickFeedback: null })

const SOLVED_KEY = 'chem-review:lewis:solved'
function loadSolved(): string[] {
  try {
    const raw = localStorage.getItem(SOLVED_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function saveSolved(list: string[]) {
  try {
    localStorage.setItem(SOLVED_KEY, JSON.stringify(list))
  } catch {
    // private browsing: progress just isn't remembered
  }
}

function initial(): State {
  return {
    mode: 'guided',
    problem: 0,
    step: 'count',
    count: freshCount(),
    middle: { pick: null, right: false, text: null },
    shape: freshShape(),
    s: EMPTY,
    past: [],
    selection: null,
    view: 'flat',
    hints: 0,
    pickerOpen: false,
    solved: loadSolved(),
    toast: null,
  }
}

let state: State = initial()
/** Where each atom sits on the board. The scene moves these every frame; they are not part of State. */
export const positions = new Map<string, P2>()
const listeners = new Set<(s: State) => void>()
type BoardSlice = Pick<State, 'problem' | 'step' | 'count' | 'middle' | 'shape' | 's' | 'past' | 'view' | 'hints'> & { positions: [string, P2][] }
const stash: Partial<Record<Mode, BoardSlice>> = {}
let toastSeq = 0

export function getState(): State {
  return state
}
export function subscribe(fn: (s: State) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state)
}

export function problemOf(s: State = state): Problem {
  return PROBLEMS[s.problem]!
}

// ---------------------------------------------------------------- derived

/** Count step: one sample atom per element, wearing as many dots as the student has set. */
export function specimen(s: State = state): Structure {
  const els = elementsOf(problemOf(s))
  return { atoms: els.map((el) => ({ id: `spec-${el}`, el, lone: s.count.answers[el] ?? 0 })), bonds: [], seq: 1 }
}
export function isSpecimen(s: State = state): boolean {
  return s.mode === 'guided' && s.step === 'count'
}
/** What the board shows. */
export function boardStructure(s: State = state): Structure {
  return isSpecimen(s) ? specimen(s) : s.s
}
/** Atoms can be moved, bonded and edited. Frozen in the count step and in the shape step. */
export function editable(s: State = state): boolean {
  if (s.view === 'shape') return false
  if (s.mode === 'free') return true
  return s.step === 'place' || s.step === 'bond' || s.step === 'check'
}

export function countDone(s: State = state): boolean {
  const p = problemOf(s)
  return elementsOf(p).every((el) => s.count.right[el]) && s.count.totalRight
}
export function stepDone(id: StepId, s: State = state): boolean {
  const p = problemOf(s)
  if (id === 'count') return countDone(s)
  if (id === 'place') return (!middleNeeded(p) || s.middle.right) && boardStepDone('place', p, s.s)
  if (id === 'shape') return s.shape.pick !== null
  return boardStepDone(id, p, s.s)
}
/** Index of the furthest step the student may open: the first one that is not finished. */
export function unlocked(s: State = state): number {
  for (let i = 0; i < STEPS.length; i++) if (!stepDone(STEPS[i]!.id, s)) return i
  return STEPS.length - 1
}

/** Free build tray: the atoms used most in first-year problems come first. */
const FREE_ORDER: El[] = ['H', 'C', 'N', 'O', 'F', 'Cl', 'S', 'P', 'B', 'Br', 'I', 'Si', 'Xe', 'Be', 'Al', 'As', 'Se', 'Kr']
if (FREE_ORDER.length !== EL_ORDER.length || EL_ORDER.some((el) => !FREE_ORDER.includes(el))) throw new Error('FREE_ORDER must list every element once')

/** Atoms still to place in a guided problem, by element. */
export function trayItems(s: State = state): { el: El; n: number }[] {
  if (s.mode === 'free') return FREE_ORDER.map((el) => ({ el, n: Infinity }))
  const p = problemOf(s)
  const left = new Map<El, number>()
  for (const el of atomsOf(p)) left.set(el, (left.get(el) ?? 0) + 1)
  for (const a of s.s.atoms) left.set(a.el, (left.get(a.el) ?? 0) - 1)
  return elementsOf(p).map((el) => ({ el, n: Math.max(0, left.get(el) ?? 0) }))
}

export function currentHints(s: State = state): string[] {
  if (s.mode !== 'guided') return []
  return hintsFor(s.step, problemOf(s), s.s).slice(0, s.hints)
}
export function hintsLeft(s: State = state): number {
  if (s.mode !== 'guided') return 0
  return Math.max(0, hintsFor(s.step, problemOf(s), s.s).length - s.hints)
}

// ---------------------------------------------------------------- navigation

function resetBoard(problem: number): Partial<State> {
  positions.clear()
  return { problem, step: 'count', count: freshCount(), middle: { pick: null, right: false, text: null }, shape: freshShape(), s: EMPTY, past: [], selection: null, view: 'flat', hints: 0, pickerOpen: false }
}

export function selectProblem(i: number) {
  if (i < 0 || i >= PROBLEMS.length) return
  set({ ...resetBoard(i), mode: 'guided' })
}

export function setMode(mode: Mode) {
  if (mode === state.mode) return
  const { problem, step, count, middle, shape, s, past, view, hints } = state
  stash[state.mode] = { problem, step, count, middle, shape, s, past, view, hints, positions: [...positions].map(([k, v]) => [k, { ...v }]) }
  const saved = stash[mode]
  positions.clear()
  if (saved) {
    for (const [k, v] of saved.positions) positions.set(k, { ...v })
    const { positions: _p, ...rest } = saved
    set({ ...rest, mode, selection: null, pickerOpen: false })
  } else {
    set({ ...resetBoard(state.problem), mode, step: mode === 'free' ? 'check' : 'count' })
  }
}

export function goStep(id: StepId) {
  const at = STEPS.findIndex((x) => x.id === id)
  if (at < 0 || at > unlocked()) return
  set({ step: id, hints: 0, selection: null, view: id === 'shape' && state.shape.pick ? 'shape' : 'flat' })
}

/** The big button at the bottom of the panel: on to the next step, or the next molecule. */
export function next() {
  if (state.mode !== 'guided' || !stepDone(state.step)) return
  const at = STEPS.findIndex((x) => x.id === state.step)
  if (at < STEPS.length - 1) {
    goStep(STEPS[at + 1]!.id)
    return
  }
  if (state.problem < PROBLEMS.length - 1) selectProblem(state.problem + 1)
  else setMode('free')
}

/** Add finished problems the app shell already knows about (its saved progress). */
export function mergeSolved(ids: string[]) {
  const known = new Set(PROBLEMS.map((p) => p.id))
  const merged = [...new Set([...state.solved, ...ids.filter((id) => known.has(id))])]
  if (merged.length === state.solved.length) return
  saveSolved(merged)
  set({ solved: merged })
}

export function togglePicker(open?: boolean) {
  set({ pickerOpen: open ?? !state.pickerOpen })
}
export function moreHint() {
  if (hintsLeft() > 0) set({ hints: state.hints + 1 })
}
export function toast(text: string, tone: Toast['tone'] = 'info') {
  set({ toast: { text, tone, n: ++toastSeq } })
}
export function clearToast() {
  if (state.toast) set({ toast: null })
}

// ---------------------------------------------------------------- step 1: count

export function setCount(el: El, n: number) {
  if (state.count.right[el]) return
  const value = Math.max(0, Math.min(8, Math.round(n)))
  const feedback = { ...state.count.feedback }
  delete feedback[el]
  set({ count: { ...state.count, answers: { ...state.count.answers, [el]: value }, feedback } })
}
export function checkCounts() {
  const c = state.count
  const right = { ...c.right }
  const tries = { ...c.tries }
  const feedback = { ...c.feedback }
  for (const el of elementsOf(problemOf())) {
    if (right[el]) continue
    const answer = c.answers[el] ?? 0
    if (answer === ELEMENTS[el].valence) {
      right[el] = true
      delete feedback[el]
    } else {
      tries[el] = (tries[el] ?? 0) + 1
      feedback[el] = countFeedback(el, answer, tries[el]!)
    }
  }
  set({ count: { ...c, right, tries, feedback } })
}
/** Typing in the total box: remembered without redrawing the panel. */
export function typeTotal(n: number | null) {
  state = { ...state, count: { ...state.count, total: n } }
}
export function checkTotal() {
  const c = state.count
  if (c.totalRight || c.total === null) return
  const p = problemOf()
  if (c.total === totalElectrons(p)) set({ count: { ...c, totalRight: true, totalFeedback: null } })
  else set({ count: { ...c, totalTries: c.totalTries + 1, totalFeedback: totalFeedback(p, c.total, c.totalTries + 1) } })
}

// ---------------------------------------------------------------- step 2: the middle atom

export function pickMiddle(el: El) {
  if (state.middle.right) return
  const r = middleFeedback(problemOf(), el)
  set({ middle: { pick: el, right: r.right, text: r.text } })
}

// ---------------------------------------------------------------- the board

function commit(s: Structure, extra: Partial<State> = {}) {
  set({ s, past: [...state.past.slice(-60), state.s], shape: freshShape(), ...extra })
}
function apply(op: Op, extra: Partial<State> = {}): boolean {
  if (op.ok) {
    commit(op.s, extra)
    return true
  }
  set({ toast: { text: refusalText(state.s, op.why, op.atomId), tone: 'warn', n: ++toastSeq } })
  return false
}

/** Half the board's width and height in board units. The scene keeps this current. */
export const board = { halfW: 5, halfH: 3.2 }
/** A free spot for an atom placed with a tap or the keyboard: the middle first, then two rings around it. */
function freeSpot(preferCenter: boolean): P2 {
  const rx = Math.min(2.5, board.halfW - 0.9)
  const ry = Math.min(2.1, board.halfH - 0.8)
  const ring = (k: number, n: number, sx: number, sy: number, turn: number): P2 => ({ x: sx * Math.cos(Math.PI / 2 - turn - (k * 2 * Math.PI) / n), y: sy * Math.sin(Math.PI / 2 - turn - (k * 2 * Math.PI) / n) })
  const spots: P2[] = [
    { x: 0, y: 0 },
    ...Array.from({ length: 6 }, (_, k) => ring(k, 6, rx, ry, 0)),
    ...Array.from({ length: 8 }, (_, k) => ring(k, 8, Math.min(4.1, board.halfW - 0.7), Math.min(2.9, board.halfH - 0.6), Math.PI / 8)),
  ]
  // only atoms that are on the board now: the count step's sample atoms and removed atoms leave old entries behind
  const taken = state.s.atoms.map((a) => positions.get(a.id)).filter((q): q is P2 => !!q)
  const far = (p: P2) => taken.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 1.25)
  const order = preferCenter ? spots : spots.slice(1)
  return { ...(order.find(far) ?? spots.find(far) ?? { x: (Math.random() - 0.5) * board.halfW, y: (Math.random() - 0.5) * board.halfH }) }
}

/** Put an atom on the board. `at` is where it was dropped; null picks a free spot. */
export function place(el: El, at: P2 | null): string | null {
  if (!editable()) return null
  if (state.mode === 'guided' && (trayItems().find((x) => x.el === el)?.n ?? 0) < 1) return null
  const isCenter = state.mode === 'guided' ? el === problemOf().center : state.s.atoms.length === 0
  const r = addAtom(state.s, el)
  positions.set(r.id, at ? { ...at } : freeSpot(isCenter))
  commit(r.s, { selection: null })
  return r.id
}
export function remove(id: string) {
  if (!editable() || !atomById(state.s, id)) return
  commit(removeAtomOp(state.s, id), { selection: null })
}
export function bond(a: string, b: string) {
  if (!editable()) return
  apply(share(state.s, a, b), { selection: null })
}
export function unbond(bondId: string) {
  if (!editable()) return
  const next = unshare(state.s, bondId)
  commit(next, { selection: next.bonds.some((x) => x.id === bondId) ? state.selection : null })
}
export function addBondOn(bondId: string) {
  const b = state.s.bonds.find((x) => x.id === bondId)
  if (!editable() || !b) return
  apply(share(state.s, b.a, b.b), { selection: state.selection })
}
export function plusElectron(id: string) {
  if (editable()) apply(addElectronOp(state.s, id), { selection: state.selection })
}
export function minusElectron(id: string) {
  if (editable()) apply(removeElectronOp(state.s, id), { selection: state.selection })
}
export function undo() {
  const prev = state.past[state.past.length - 1]
  if (!prev || !editable()) return
  set({ s: prev, past: state.past.slice(0, -1), selection: null, shape: freshShape() })
}
export function clearBoard() {
  if (!editable() || state.s.atoms.length === 0) return
  commit(EMPTY, { selection: null })
}

/** A tap or click on an atom selects it. From the keyboard, a second atom bonds to the selected one,
 *  because the keyboard has no way to drag one atom onto another. */
export function tapAtom(id: string, viaKeyboard = false) {
  if (!editable()) return
  const sel = state.selection
  if (viaKeyboard && sel?.kind === 'atom' && sel.id !== id) {
    bond(sel.id, id)
    return
  }
  set({ selection: sel?.kind === 'atom' && sel.id === id ? null : { kind: 'atom', id } })
}
export function tapBond(id: string) {
  if (!editable()) return
  set({ selection: state.selection?.kind === 'bond' && state.selection.id === id ? null : { kind: 'bond', id } })
}
export function clearSelection() {
  if (state.selection) set({ selection: null })
}

// ---------------------------------------------------------------- step 5: shape

export function answerGroups(n: number) {
  const f = groupFacts(state.s)
  if (!f || state.shape.groupsRight) return
  const center = problemOf().center
  if (n === f.groups) set({ shape: { ...state.shape, groups: n, groupsRight: true, groupsFeedback: groupsRight(center, f) } })
  else {
    const tries = state.shape.groupsTries + 1
    set({ shape: { ...state.shape, groups: n, groupsTries: tries, groupsFeedback: groupsFeedback(center, f, n, tries) } })
  }
}
/** The student commits to a shape; right or wrong, the model then lifts into 3D. */
export function pickShape(name: ShapeName) {
  const info = shapeInfoFor(state.s)
  if (!info || state.shape.pick || !state.shape.groupsRight) return
  const r = shapeFeedback(problemOf().center, info, name)
  const id = problemOf().id
  const solved = state.solved.includes(id) ? state.solved : [...state.solved, id]
  saveSolved(solved)
  set({ shape: { ...state.shape, pick: name, pickRight: r.right, pickFeedback: r.text }, view: 'shape', solved, selection: null })
}
export function setView(view: 'flat' | 'shape') {
  if (view === state.view) return
  if (view === 'shape') {
    const ok = state.mode === 'guided' ? state.step === 'shape' && state.shape.pick !== null : assess(state.s).complete && shapeOf(state.s) !== null
    if (!ok) return
  }
  set({ view, selection: null })
}
