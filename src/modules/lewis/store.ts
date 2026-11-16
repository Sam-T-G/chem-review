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
  bondsOf,
  removeAtom as removeAtomOp,
  removeElectron as removeElectronOp,
  share,
  unshare,
  type Op,
  type Structure,
} from '../../chem/structure'
import { hybridFor, type Hybrid } from '../../chem/orbitals'
import type { SeenBond } from '../../chem/polarity'
import type { V3 } from '../../chem/repulsion'
import { shapeOf, type ShapeName } from '../../chem/vsepr'
import {
  AFTER_SHAPE,
  NET_SIDE,
  STEPS,
  boardStepDone,
  bondAnswerRight,
  bondCoach,
  bondCounts,
  bondRight,
  countCoach,
  drawRefusal,
  elementsOf,
  groupFacts,
  groupsCoach,
  groupsRight,
  hintsFor,
  hybridCoach,
  hybridRight,
  judgeNetArrow,
  middleFeedback,
  middleNeeded,
  netArrowCoach,
  netArrowRight,
  netFeedback,
  polarity,
  refusalText,
  shapeFeedback,
  shapeInfoFor,
  sigmaPiCoach,
  sigmaPiRight,
  totalCoach,
  type BondAnswer,
  type Coach,
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
  /** What the panel says about each atom's last wrong count. It stays up while the student changes
   *  the number, so a picture in it can be counted from; the next check replaces it. */
  feedback: Partial<Record<El, Coach>>
  /** The number was changed after its last check. */
  changed: Partial<Record<El, boolean>>
  total: number | null
  totalRight: boolean
  totalTries: number
  totalFeedback: Coach | null
}
export interface ShapeState {
  groups: number | null
  groupsRight: boolean
  groupsTries: number
  /** The line shown once the count is right. */
  groupsFeedback: string | null
  /** What the panel says about the last wrong count. `n` goes up with each wrong answer, so the board rings the groups once. */
  groupsCoach: (Coach & { n: number }) | null
  pick: ShapeName | null
  pickRight: boolean
  /** The line shown for a right pick. */
  pickFeedback: string | null
  /** What the panel says about a wrong pick. */
  pickCoach: Coach | null
}
/** One answered question: the line for a right answer, or the explanation of a wrong one. */
export interface Answered {
  right: boolean
  tries: number
  text: string | null
  coach: Coach | null
}
const unanswered = (): Answered => ({ right: false, tries: 0, text: null, coach: null })
/** Step 6: one answer for each kind of bond (named by its outer atom), then one for the whole
 *  molecule, then the net dipole of a polar molecule, drawn on the model. */
export interface PolarState {
  /** `pick` is 'nonpolar' or the atom the drawn arrow pointed at. `drawn` is the last arrow that was drawn wrong, which the board keeps showing. */
  bonds: Partial<Record<El, Answered & { pick: BondAnswer | null; drawn: { from: string; to: string } | null }>>
  /** `pick` is true for "polar" (or "they do not cancel"). The first pick is final. */
  net: Answered & { pick: boolean | null }
  /** The net dipole, drawn. `drawn` is the direction of the last arrow that was drawn wrong, in the board's own 3D frame. */
  arrow: Answered & { drawn: V3 | null }
  /** Goes up by one each time the model should turn until the net dipole lies across the screen. */
  aim: number
}
/** Step 7: the counts of sigma and pi bonds, then the middle atom's hybridization. */
export interface OrbitalState {
  sigma: number
  pi: number
  counts: Answered
  hybrid: Answered & { pick: Hybrid | null }
}
export interface State {
  mode: Mode
  problem: number
  step: StepId
  count: CountState
  /** `text` is the line for the right pick; `coach` explains a wrong one. */
  middle: { pick: El | null; right: boolean; text: string | null; coach: Coach | null }
  shape: ShapeState
  polar: PolarState
  orbitals: OrbitalState
  s: Structure
  past: Structure[]
  selection: Selection | null
  view: 'flat' | 'shape'
  hints: number
  pickerOpen: boolean
  solved: string[]
  toast: Toast | null
  /** The atoms in the last move the board refused. `n` goes up with each refusal, so the scene can shake them once. */
  refused: { ids: string[]; n: number } | null
  /** Set when Clear emptied a finished structure from the 3D model or a later step: the step, the
   *  view and the answers as they were, so that Undo puts all of it back with the atoms. Any other
   *  change to the board drops it. */
  cleared: { s: Structure; step: StepId; view: 'flat' | 'shape'; hints: number; shape: ShapeState; polar: PolarState; orbitals: OrbitalState } | null
}

const freshCount = (): CountState => ({ answers: {}, right: {}, tries: {}, feedback: {}, changed: {}, total: null, totalRight: false, totalTries: 0, totalFeedback: null })
const freshShape = (): ShapeState => ({ groups: null, groupsRight: false, groupsTries: 0, groupsFeedback: null, groupsCoach: null, pick: null, pickRight: false, pickFeedback: null, pickCoach: null })
const freshMiddle = (): State['middle'] => ({ pick: null, right: false, text: null, coach: null })
const freshPolar = (): PolarState => ({ bonds: {}, net: { ...unanswered(), pick: null }, arrow: { ...unanswered(), drawn: null }, aim: 0 })
const freshOrbitals = (): OrbitalState => ({ sigma: 0, pi: 0, counts: unanswered(), hybrid: { ...unanswered(), pick: null } })
/** Everything asked about the finished structure. A change to the board throws these answers away. */
const freshAnswers = () => ({ shape: freshShape(), polar: freshPolar(), orbitals: freshOrbitals() })

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
    middle: freshMiddle(),
    ...freshAnswers(),
    s: EMPTY,
    past: [],
    selection: null,
    view: 'flat',
    hints: 0,
    pickerOpen: false,
    solved: loadSolved(),
    toast: null,
    refused: null,
    cleared: null,
  }
}

let state: State = initial()
/** Where each atom sits on the board. The scene moves these every frame; they are not part of State. */
export const positions = new Map<string, P2>()
const listeners = new Set<(s: State) => void>()
type BoardSlice = Pick<State, 'problem' | 'step' | 'count' | 'middle' | 'shape' | 'polar' | 'orbitals' | 's' | 'past' | 'view' | 'hints'> & { positions: [string, P2][] }
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
  if (id === 'polar') return polarDone(s)
  if (id === 'orbitals') return s.orbitals.counts.right && s.orbitals.hybrid.right
  return boardStepDone(id, p, s.s)
}
/** Step 6 is finished when every kind of bond is right, the whole-molecule question is answered,
 *  and the net dipole of a polar molecule is drawn the right way. */
function polarDone(s: State): boolean {
  const m = polarity(s.s)
  return !!m && m.kinds.every((k) => s.polar.bonds[k.terminal]?.right) && s.polar.net.pick !== null && (!m.polar || s.polar.arrow.right)
}
/** The kind of bond step 6 is asking about now: the first one without a right answer. Null when all are right. */
export function bondAsked(s: State = state): El | null {
  return polarity(s.s)?.kinds.find((k) => !s.polar.bonds[k.terminal]?.right)?.terminal ?? null
}
/** Step 6 is asking for the net dipole to be drawn: the molecule is polar, the polar-or-nonpolar answer is in, and the arrow is not right yet. */
export function netArrowAsked(s: State = state): boolean {
  const m = polarity(s.s)
  return s.mode === 'guided' && s.step === 'polar' && !!m && m.polar && bondAsked(s) === null && s.polar.net.pick !== null && !s.polar.arrow.right
}
/** What a student can draw on the board now: a bond's dipole arrow from one atom to the other (on
 *  the flat drawing or the 3D model), or the net dipole from the middle atom (on the 3D model only). */
export function drawing(s: State = state): 'bond' | 'net' | null {
  if (s.mode !== 'guided' || s.step !== 'polar') return null
  if (bondAsked(s) !== null) return 'bond'
  return netArrowAsked(s) && s.view === 'shape' ? 'net' : null
}
/** True in the steps that work on the finished 3D model, once the shape has been revealed. */
export function onModel(s: State = state): boolean {
  return s.mode === 'guided' && (s.step === 'shape' || AFTER_SHAPE.includes(s.step)) && s.shape.pick !== null
}
/** Index of the furthest step the student may open: the first one that is not finished. */
export function unlocked(s: State = state): number {
  for (let i = 0; i < STEPS.length; i++) if (!stepDone(STEPS[i]!.id, s)) return i
  return STEPS.length - 1
}

// ---------------------------------------------------------------- where to look next

/** Where the student's next action is. The panel and the board make that place glow, and a
 *  pointing finger acts out a drag the first time one is needed.
 *  - 'ask': a question or control in the panel or under the board, named by its `data-cue`.
 *  - 'tray': an atom in the row under the board. `demo` shows the drag onto the board.
 *  - 'drag': an atom on the board to drag onto another one.
 *  - 'atoms': atoms on the board to press on. No direction is shown, because the direction is the
 *    answer. `key` names a control that answers the same question (the button for a nonpolar bond).
 *  - 'arrow': a bond whose dipole arrow is to be drawn, between atoms `a` and `b`. The hand takes
 *    the three answers in turn: the drag one way, the drag the other way, and the button `key` for
 *    a bond with no arrow. So it shows the gestures and not the answer. `first` says which of the
 *    three it starts with, and differs from one molecule to the next. `also` are the other atoms
 *    of that kind of bond.
 *  - 'aim': the middle atom, from which the net dipole is dragged toward one of the aim points.
 *  - 'next': the step is finished, and the button that leads on is the thing to press. */
export type Cue =
  | { kind: 'ask'; key: string }
  | { kind: 'tray'; el: El; demo: boolean }
  | { kind: 'drag'; from: string; to: string }
  | { kind: 'atoms'; ids: string[]; key?: string }
  | { kind: 'arrow'; a: string; b: string; also: string[]; key: string; first: number }
  | { kind: 'aim'; id: string }
  | { kind: 'next' }

export function cue(s: State = state): Cue | null {
  if (s.pickerOpen) return null
  if (s.mode === 'free') {
    // free build has no questions: only an empty board points at the atoms
    const first = trayItems(s)[0]
    return s.s.atoms.length === 0 && first ? { kind: 'tray', el: first.el, demo: true } : null
  }
  const p = problemOf(s)
  if (stepDone(s.step, s)) return { kind: 'next' }
  if (s.step === 'count') {
    const els = elementsOf(p)
    if (els.every((el) => s.count.right[el])) return { kind: 'ask', key: 'total' }
    // a counter still at 0, or one that was checked wrong and not changed since; with none of those, the button that checks them
    const open = els.find((el) => !s.count.right[el] && ((s.count.answers[el] ?? 0) === 0 || (!!s.count.feedback[el] && !s.count.changed[el])))
    return { kind: 'ask', key: open ? `count-${open}` : 'count-check' }
  }
  if (s.step === 'place') {
    if (middleNeeded(p) && !s.middle.right) return { kind: 'ask', key: 'middle' }
    const left = trayItems(s).filter((x) => x.n > 0)
    const next = left.find((x) => x.el === p.center) ?? left[0]
    return next ? { kind: 'tray', el: next.el, demo: s.s.atoms.length === 0 } : null
  }
  if (s.step === 'bond') {
    const center = s.s.atoms.find((a) => a.el === p.center)
    const loose = s.s.atoms.filter((a) => a.id !== center?.id && bondsOf(s.s, a.id).length === 0)
    if (!center || loose.length === 0) return null
    // the drag is shown until the first bond is made; after that the atoms still to bond are ringed
    return s.s.bonds.length === 0 ? { kind: 'drag', from: loose[0]!.id, to: center.id } : { kind: 'atoms', ids: loose.map((a) => a.id) }
  }
  if (s.step === 'check') return { kind: 'ask', key: 'checks' }
  if (s.step === 'shape') return { kind: 'ask', key: s.shape.groupsRight ? 'shapes' : 'groups' }
  if (s.step === 'polar') {
    const m = polarity(s.s)
    const asked = bondAsked(s)
    if (!m) return null
    if (asked) {
      const outer = m.bonds.filter((b) => b.el === asked).map((b) => b.atomId)
      // until the first try, the drag is acted out along one of these bonds; after it, the atoms are ringed
      const tried = (s.polar.bonds[asked]?.tries ?? 0) > 0
      return tried || !outer[0] ? { kind: 'atoms', ids: [m.center.id, ...outer], key: 'no-arrow' } : { kind: 'arrow', a: m.center.id, b: outer[0], also: outer.slice(1), key: 'no-arrow', first: (s.problem + m.kinds.findIndex((k) => k.terminal === asked)) % 3 }
    }
    if (s.polar.net.pick === null) return { kind: 'ask', key: 'net' }
    // the net dipole is drawn on the 3D model: on the flat drawing, the switch to the model is the thing to press
    if (s.view !== 'shape') return { kind: 'ask', key: 'view-shape' }
    return s.polar.arrow.tries > 0 ? { kind: 'atoms', ids: [m.center.id] } : { kind: 'aim', id: m.center.id }
  }
  return { kind: 'ask', key: s.orbitals.counts.right ? 'hybrid' : 'bond-counts' }
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

/** Count step: every atom's count is right, so the total is the open question. */
export function totalNext(s: State = state): boolean {
  return s.step === 'count' && elementsOf(problemOf(s)).every((el) => s.count.right[el])
}
function stepHints(s: State): string[] {
  return hintsFor(s.step, problemOf(s), s.s, totalNext(s), netArrowAsked(s))
}
export function currentHints(s: State = state): string[] {
  if (s.mode !== 'guided') return []
  return stepHints(s).slice(0, s.hints)
}
export function hintsLeft(s: State = state): number {
  if (s.mode !== 'guided') return 0
  return Math.max(0, stepHints(s).length - s.hints)
}

// ---------------------------------------------------------------- navigation

function resetBoard(problem: number): Partial<State> {
  positions.clear()
  return { problem, step: 'count', count: freshCount(), middle: freshMiddle(), ...freshAnswers(), s: EMPTY, past: [], selection: null, view: 'flat', hints: 0, pickerOpen: false, cleared: null }
}

export function selectProblem(i: number) {
  if (i < 0 || i >= PROBLEMS.length) return
  set({ ...resetBoard(i), mode: 'guided' })
}

export function setMode(mode: Mode) {
  if (mode === state.mode) return
  const { problem, step, count, middle, shape, polar, orbitals, s, past, view, hints } = state
  stash[state.mode] = { problem, step, count, middle, shape, polar, orbitals, s, past, view, hints, positions: [...positions].map(([k, v]) => [k, { ...v }]) }
  const saved = stash[mode]
  positions.clear()
  if (saved) {
    for (const [k, v] of saved.positions) positions.set(k, { ...v })
    const { positions: _p, ...rest } = saved
    set({ ...rest, mode, selection: null, pickerOpen: false, cleared: null })
  } else {
    set({ ...resetBoard(state.problem), mode, step: mode === 'free' ? 'check' : 'count' })
  }
}

export function goStep(id: StepId) {
  const at = STEPS.findIndex((x) => x.id === id)
  if (at < 0 || at > unlocked()) return
  // the steps after the shape work on the lifted model
  set({ step: id, hints: 0, selection: null, view: (id === 'shape' || AFTER_SHAPE.includes(id)) && state.shape.pick ? 'shape' : 'flat' })
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
  set({ count: { ...state.count, answers: { ...state.count.answers, [el]: value }, changed: { ...state.count.changed, [el]: true } } })
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
      feedback[el] = countCoach(problemOf(), el, answer, tries[el]!)
    }
  }
  // once every count is right the hints are about the total, and they start over
  const allRight = elementsOf(problemOf()).every((el) => right[el])
  set({ count: { ...c, right, tries, feedback, changed: {} }, ...(allRight ? { hints: 0 } : {}) })
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
  else set({ count: { ...c, totalTries: c.totalTries + 1, totalFeedback: totalCoach(p, c.total, c.totalTries + 1) } })
}

// ---------------------------------------------------------------- step 2: the middle atom

export function pickMiddle(el: El) {
  if (state.middle.right) return
  const r = middleFeedback(problemOf(), el)
  set({ middle: { pick: el, right: r.right, text: r.right ? r.text : null, coach: r.coach } })
}

// ---------------------------------------------------------------- the board

function commit(s: Structure, extra: Partial<State> = {}) {
  set({ s, past: [...state.past.slice(-60), state.s], ...freshAnswers(), cleared: null, ...extra })
}
function apply(op: Op, ids: string[], extra: Partial<State> = {}): boolean {
  if (op.ok) {
    commit(op.s, extra)
    return true
  }
  const n = ++toastSeq
  set({ toast: { text: refusalText(state.s, op.why, op.atomId), tone: 'warn', n }, refused: { ids, n } })
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
  apply(share(state.s, a, b), [a, b], { selection: null })
}
export function unbond(bondId: string) {
  if (!editable()) return
  const next = unshare(state.s, bondId)
  commit(next, { selection: next.bonds.some((x) => x.id === bondId) ? state.selection : null })
}
export function addBondOn(bondId: string) {
  const b = state.s.bonds.find((x) => x.id === bondId)
  if (!editable() || !b) return
  apply(share(state.s, b.a, b.b), [b.a, b.b], { selection: state.selection })
}
export function plusElectron(id: string) {
  if (editable()) apply(addElectronOp(state.s, id), [id], { selection: state.selection })
}
export function minusElectron(id: string) {
  if (editable()) apply(removeElectronOp(state.s, id), [id], { selection: state.selection })
}
export function undo() {
  const prev = state.past[state.past.length - 1]
  if (!prev || !editable()) return
  const was = state.cleared
  // straight after a Clear that emptied a finished structure: the step, the view and the answers come back with the atoms
  if (was && was.s === prev) {
    set({ s: prev, past: state.past.slice(0, -1), selection: null, step: was.step, view: was.view, hints: was.hints, shape: was.shape, polar: was.polar, orbitals: was.orbitals, cleared: null })
    return
  }
  set({ s: prev, past: state.past.slice(0, -1), selection: null, ...freshAnswers(), cleared: null })
}
/** Empties the board. On the flat board in a step that builds the structure, that is all. From
 *  the 3D model, or from a step that works on the finished structure, the flat board comes back
 *  too, and a guided molecule goes back to the step where its atoms are put on the board. Undo
 *  brings the atoms back. */
export function clearBoard() {
  if (isSpecimen() || state.s.atoms.length === 0) return
  if (editable()) commit(EMPTY, { selection: null })
  else {
    const { s, step, view, hints, shape, polar, orbitals } = state
    commit(EMPTY, { selection: null, view: 'flat', ...(state.mode === 'guided' ? { step: 'place' as const, hints: 0 } : {}), cleared: { s, step, view, hints, shape, polar, orbitals } })
  }
}

/** A tap or click on an atom selects it. From the keyboard, a second atom bonds to the selected one,
 *  because the keyboard has no way to drag one atom onto another. */
export function tapAtom(id: string, viaKeyboard = false) {
  if (drawing() === 'bond') {
    // without a drag, a dipole arrow takes two taps (or Enter on two atoms): where it starts, then the atom it points at
    const from = state.selection?.kind === 'atom' ? state.selection.id : null
    if (from && from !== id) drawBondArrow(from, id)
    else set({ selection: from === id ? null : { kind: 'atom', id } })
    return
  }
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
  if (n === f.groups) set({ shape: { ...state.shape, groups: n, groupsRight: true, groupsFeedback: groupsRight(center, f), groupsCoach: null } })
  else {
    const tries = state.shape.groupsTries + 1
    set({ shape: { ...state.shape, groups: n, groupsTries: tries, groupsCoach: { ...groupsCoach(center, f, n, tries), n: ++toastSeq } } })
  }
}
/** The student commits to a shape; right or wrong, the model then lifts into 3D. */
export function pickShape(name: ShapeName) {
  const info = shapeInfoFor(state.s)
  if (!info || state.shape.pick || !state.shape.groupsRight) return
  const r = shapeFeedback(problemOf().center, info, name)
  set({ shape: { ...state.shape, pick: name, pickRight: r.right, pickFeedback: r.right ? r.text : null, pickCoach: r.coach }, view: 'shape', selection: null })
}

// ---------------------------------------------------------------- step 6: polar bonds and the net dipole

/** An answer for one kind of bond: 'nonpolar', or the atom that is δ−. `terminal` names the bond by its outer atom. */
export function answerBond(terminal: El, answer: BondAnswer, drawn: { from: string; to: string } | null = null) {
  const m = polarity(state.s)
  const kind = m?.kinds.find((k) => k.terminal === terminal)
  const was = state.polar.bonds[terminal]
  // one kind of bond is asked at a time, in the order the molecule lists them
  if (state.step !== 'polar' || !kind || was?.right || terminal !== bondAsked()) return
  const right = bondAnswerRight(kind.polarity, answer)
  const tries = (was?.tries ?? 0) + (right ? 0 : 1)
  const entry = right
    ? { pick: answer, right: true, tries, text: bondRight(kind.center, kind.terminal, kind.polarity), coach: null, drawn: null }
    : { pick: answer, right: false, tries, text: null, coach: bondCoach(kind.center, kind.terminal, kind.polarity, answer, tries), drawn }
  // the atoms of a wrong arrow shake their heads
  const shake = !right && drawn ? { refused: { ids: [drawn.from, drawn.to], n: ++toastSeq } } : {}
  set({ polar: { ...state.polar, bonds: { ...state.polar.bonds, [terminal]: entry } }, selection: null, ...shake })
}
/** A dipole arrow drawn on the board from one atom to another. The arrow points at `to`, so it
 *  says the bond is polar and `to` is δ−. An arrow that is not along the bond in question is refused. */
export function drawBondArrow(from: string, to: string) {
  const m = polarity(state.s)
  const asked = bondAsked()
  const kind = m?.kinds.find((k) => k.terminal === asked)
  if (drawing() !== 'bond' || !m || !asked || !kind) return
  const head = atomById(state.s, to)
  const outerId = from === m.center.id ? to : to === m.center.id ? from : null
  const outer = outerId ? m.bonds.find((b) => b.atomId === outerId) : undefined
  if (!head || from === to || !outer || outer.el !== asked) {
    const n = ++toastSeq
    set({ toast: { text: drawRefusal(kind.center, kind.terminal), tone: 'warn', n }, refused: { ids: [from, to], n }, selection: null })
    return
  }
  answerBond(asked, head.el, { from, to })
}
/** The whole-molecule answer. It is final: right or wrong, the model then shows the bond dipoles and what they add up to. */
export function answerNet(saidPolar: boolean) {
  const m = polarity(state.s)
  if (state.step !== 'polar' || !m || bondAsked() !== null || state.polar.net.pick !== null) return
  const r = netFeedback(problemOf(), m, shapeInfoFor(state.s), saidPolar)
  // a polar molecule's net dipole is drawn next, on the 3D model, with hints of its own
  set({ polar: { ...state.polar, net: { pick: saidPolar, right: r.right, tries: r.right ? 0 : 1, text: r.right ? r.text : null, coach: r.coach } }, ...(m.polar ? { view: 'shape' as const, hints: 0 } : {}) })
}
/** The net dipole drawn on the 3D model. `drawn` is its direction on screen (x to the right, y up),
 *  `seen` is each bond as the viewer sees it at that moment, and `world` is the same direction in
 *  the board's 3D frame, which the board uses to keep showing a wrong arrow. */
export function drawNetArrow(drawn: { x: number; y: number }, seen: SeenBond[], world: V3) {
  const m = polarity(state.s)
  if (drawing() !== 'net' || !m) return
  const verdict = judgeNetArrow(m, seen, drawn)
  if (!verdict) return
  const a = state.polar.arrow
  if (verdict.kind === 'side') {
    // seen end-on, no direction on screen is right: the model turns and the try does not count
    set({ polar: { ...state.polar, aim: state.polar.aim + 1 }, toast: { text: NET_SIDE, tone: 'info', n: ++toastSeq } })
  } else if (verdict.kind === 'right') {
    // the hints were about adding the arrows: with the arrow right there is nothing left to hint at
    set({ polar: { ...state.polar, arrow: { right: true, tries: a.tries, text: netArrowRight(m), coach: null, drawn: null } }, hints: 0 })
  } else {
    const tries = a.tries + 1
    set({ polar: { ...state.polar, arrow: { right: false, tries, text: null, coach: netArrowCoach(m, verdict.idea, tries), drawn: world } }, refused: { ids: [m.center.id], n: ++toastSeq } })
  }
}

// ---------------------------------------------------------------- step 7: sigma and pi bonds, hybridization

export function setBondCount(kind: 'sigma' | 'pi', n: number) {
  if (state.orbitals.counts.right) return
  set({ orbitals: { ...state.orbitals, [kind]: Math.max(0, Math.min(9, Math.round(n))) } })
}
export function checkBondCounts() {
  const o = state.orbitals
  if (state.step !== 'orbitals' || o.counts.right) return
  const c = bondCounts(state.s)
  if (o.sigma === c.sigma && o.pi === c.pi) set({ orbitals: { ...o, counts: { right: true, tries: o.counts.tries, text: sigmaPiRight(c), coach: null } } })
  else {
    const tries = o.counts.tries + 1
    set({ orbitals: { ...o, counts: { right: false, tries, text: null, coach: sigmaPiCoach(problemOf(), c, o.sigma, o.pi, tries) } } })
  }
}
/** The middle atom's hybridization. A right answer finishes the molecule. */
export function pickHybrid(h: Hybrid) {
  const o = state.orbitals
  const f = groupFacts(state.s)
  if (state.step !== 'orbitals' || !f || !o.counts.right || o.hybrid.right) return
  const center = problemOf().center
  if (h === hybridFor(f.groups)) {
    const id = problemOf().id
    const solved = state.solved.includes(id) ? state.solved : [...state.solved, id]
    saveSolved(solved)
    set({ orbitals: { ...o, hybrid: { pick: h, right: true, tries: o.hybrid.tries, text: hybridRight(center, h, f), coach: null } }, solved })
  } else {
    const tries = o.hybrid.tries + 1
    set({ orbitals: { ...o, hybrid: { pick: h, right: false, tries, text: null, coach: hybridCoach(center, f, h, tries) } } })
  }
}
export function setView(view: 'flat' | 'shape') {
  if (view === state.view) return
  if (view === 'shape') {
    const ok = state.mode === 'guided' ? onModel() : assess(state.s).complete && shapeOf(state.s) !== null
    if (!ok) return
  }
  set({ view, selection: null })
}
