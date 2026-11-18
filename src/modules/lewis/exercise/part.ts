// The exercises as a part of the module (parts.ts has the contract): the sheet in the panel, the
// counter and the strip of checks above the board, what the board draws, the presses and the
// keys. Every sentence comes from words.ts; this file only puts them on screen.
//
// No top-level calls into ui.ts or store.ts (EX2): the three files import each other.
import { assess } from '../../../chem/assess'
import { EXERCISES, EXERCISE_SETS } from '../../../chem/exercises'
import { formulaHtml, formulaText, speciesOf } from '../../../chem/problems'
import { EMPTY, electronsOnBoard, sharedElectrons } from '../../../chem/structure'
import type { Geometry, ShapeName } from '../../../chem/vsepr'
import { checkChips, elementsOf, howToFree, pairWords } from '../guide'
import type { Part } from '../parts'
import * as store from '../store'
import type { Cue, State } from '../store'
import { BUBBLES, ICON, ball, coach, enStrip, esc, howBox, rich } from '../ui'
import { PART_ORDER, sheetOf, type PartId, type Sheet } from './sheet'
import {
  answered,
  bondRow,
  checkDeltas,
  checkStructure,
  checkValence,
  countFinished,
  directionOpen,
  exerciseCanLift,
  exerciseProblem,
  goTo,
  netOpen,
  nextAt,
  pickAngle,
  pickAt,
  pickBond,
  pickDirection,
  pickGeometry,
  pickNet,
  pickResonance,
  pickShape,
  resonanceOpen,
  savedId,
  sheetDone,
  typeDelta,
  typeValence,
  COME_BACK,
  type ExerciseState,
} from './state'
import { plainTerms, unwrapTerms } from './terms'
import * as W from './words'

const sheetNow = (s: State): Sheet => sheetOf(exerciseProblem(s.exercise))
const slug = (text: string) => text.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

// ---------------------------------------------------------------- terms

const plainCache = new Map<string, Set<string>>()
/** The terms left plain on this sheet now (terms.ts), as a set. */
function plainNow(sh: Sheet, st: ExerciseState): Set<string> {
  const done = answered(st, sh)
  const open = new Set<PartId>(PART_ORDER.filter((id) => !done.has(id)))
  const key = `${sh.p.id}|${[...open].join(',')}`
  let hit = plainCache.get(key)
  if (!hit) {
    hit = new Set(plainTerms(sh, open))
    plainCache.set(key, hit)
  }
  return hit
}

/** Everything one render of the panel needs to print text: a key term opens its card once per
 *  screen, and a term left plain never does. */
function printer(sh: Sheet, st: ExerciseState) {
  const plain = plainNow(sh, st)
  const seen = new Set<string>(plain)
  const R = (text: string) => rich(text, seen)
  const fb = (text: string | null | undefined, tone: 'info' | 'warn' | 'good') =>
    text ? `<p class="mb-fb" role="status" data-tone="${tone}">${tone === 'good' ? ICON.check : tone === 'warn' ? ICON.cross : ''}<span>${R(text)}</span></p>` : ''
  const card = (c: Parameters<typeof coach>[0]) => unwrapTerms(coach(c, sh.p), plain)
  return { plain, R, fb, card }
}
type Printer = ReturnType<typeof printer>

// ---------------------------------------------------------------- the panel

function header(s: State, sh: Sheet): string {
  const p = sh.p
  const crew = `<span class="mb-crew" aria-hidden="true">${elementsOf(p).map((el) => ball(el)).join('')}</span>`
  const done = s.solved.includes(savedId(p)) ? `<span class="ex-done" data-k="ex-done" data-kv="">${ICON.check}<span>${esc(W.EX_WORDS.finished)}</span></span>` : ''
  return `<header class="mb-head">${BUBBLES}
    <div><h1 class="mb-formula" aria-label="${esc(formulaText(p))}">${formulaHtml(p)}</h1><p class="mb-name">${esc(p.name.charAt(0).toUpperCase() + p.name.slice(1))}</p>${done}</div>
    ${crew}
    <button class="mb-btn mb-btn-quiet mb-change" data-act="picker" data-key="picker" aria-expanded="${s.pickerOpen}">${ICON.swap}<span>${esc(W.EX_WORDS.change)}</span></button>
  </header>`
}

function picker(s: State): string {
  const at = s.exercise.at
  const sets = EXERCISE_SETS.map((set) => {
    const items = set.ids
      .map((id) => EXERCISES.findIndex((p) => p.id === id))
      .filter((i) => i >= 0)
      .map((i) => {
        const p = EXERCISES[i]!
        const done = s.solved.includes(savedId(p))
        return `<li><button class="mb-pick" data-act="ex-pick" data-at="${i}" data-key="ex-pick-${i}" ${i === at ? 'aria-current="true"' : ''}>
          <span class="mb-pick-f">${formulaHtml(p)}</span><span class="mb-pick-n">${esc(p.name)}</span>${done ? `<span class="mb-pick-done" title="${esc(W.EX_WORDS.finished)}">${ICON.check}<span class="mb-sr">${esc(W.EX_WORDS.finished)}</span></span>` : ''}
        </button></li>`
      })
      .join('')
    return `<section><h3>${esc(set.title)}</h3><ul>${items}</ul></section>`
  }).join('')
  return `<div class="mb-picker" role="dialog" aria-label="${esc(W.EX_WORDS.pickTitle)}">
    <div class="mb-picker-top"><h2>${esc(W.EX_WORDS.pickTitle)}</h2><button class="mb-btn mb-btn-quiet" data-act="picker" data-key="picker-close">${esc(W.EX_WORDS.close)}</button></div>
    ${sets}
  </div>`
}

/** One part of the sheet: its column name with a mark, then what it holds. */
function section(id: PartId, state: 'open' | 'right' | 'given', body: string): string {
  const mark = state === 'open' ? '' : ICON.check
  return `<section class="ex-part" data-k="ex-${id}" data-kv="" data-part="${id}" data-state="${state}">
    <h3 class="ex-h"><span class="mb-mark" data-ok="${state !== 'open'}" data-wait="${state === 'open'}">${mark}</span>${esc(W.PART_TITLES[id])}<span class="mb-sr"> (${state === 'open' ? W.EX_WORDS.notYet : W.EX_WORDS.done})</span></h3>
    ${body}
  </section>`
}

function chips<T extends string>(act: string, cue: string, options: T[], label: (o: T) => string, a: { pick: T | null; right: boolean }): string {
  return `<div class="mb-choices" data-cue="${cue}">${options
    .map((o) => {
      const state = a.pick === o ? (a.right ? 'right' : 'wrong') : 'idle'
      return `<button class="mb-choice" data-act="${act}" data-v="${esc(o)}" data-key="${act}-${slug(o)}" data-state="${state}" ${a.right ? 'disabled' : ''}>${esc(label(o))}</button>`
    })
    .join('')}</div>`
}

function valencePart(sh: Sheet, st: ExerciseState, t: Printer): string {
  const v = st.valence
  if (v.right) return section('valence', 'right', t.fb(W.valenceRight(sh), 'good'))
  return section(
    'valence',
    'open',
    `<p class="mb-q">${t.R(W.prompts(sh).valence)}</p>
    <div class="mb-total-row" data-cue="ex-valence">
      <input id="ex-valence" class="mb-num" type="text" inputmode="numeric" autocomplete="off" maxlength="3" data-key="ex-valence" aria-label="${esc(W.EX_WORDS.valenceBox)}" value="${esc(v.text)}" />
      <button class="mb-btn mb-btn-soft" data-act="ex-valence" data-key="ex-valence-check">${esc(W.EX_WORDS.checkTotal)}</button>
    </div>
    ${v.pick !== null ? t.card(W.valenceCoach(sh, v.pick, v.tries)) : ''}`,
  )
}

function structurePart(s: State, sh: Sheet, st: ExerciseState, t: Printer, known: W.Known): string {
  const q = W.prompts(sh)
  if (!st.structure.right) {
    const result = st.structure.shown ? t.card(W.structureCoach(sh, s.s, Math.max(1, st.structure.tries), known)) : ''
    return section(
      'structure',
      'open',
      `<p class="mb-q">${t.R(q.structure)}</p>
      ${howBox(howToFree())}
      <button class="mb-btn mb-btn-soft" data-act="ex-structure" data-key="ex-structure" data-cue="ex-structure">${esc(W.EX_WORDS.checkStructure)}</button>
      ${result}`,
    )
  }
  let res: string
  if (st.resonance === null) {
    res = `<p class="mb-q">${t.R(q.resonance)}</p>${chips('ex-res', 'ex-resonance', ['yes', 'no'], (o) => (o === 'yes' ? W.EX_WORDS.yes : W.EX_WORDS.no), { pick: null, right: false })}`
  } else {
    const r = W.resonanceText(sh, st.resonance)
    res = r.right ? t.fb(r.text, 'good') : t.card(r.coach)
  }
  return section('structure', st.resonance === null ? 'open' : 'right', `${t.fb(W.structureRightText(sh), 'good')}${res}`)
}

function geometryParts(s: State, sh: Sheet, st: ExerciseState, t: Printer, known: W.Known): string {
  const q = W.prompts(sh)
  const eg = st.eg.right
    ? t.fb(W.geometryRight(sh), 'good')
    : `<p class="mb-q">${t.R(q.eg)}</p>${chips<Geometry>('ex-eg', 'ex-eg', sh.geometryChoices, W.geometryLabel, st.eg)}${st.eg.pick ? t.card(W.geometryCoach(sh, st.eg.pick, st.eg.tries, known)) : ''}`
  const mg = st.mg.right
    ? t.fb(W.shapeRight(sh), 'good')
    : `<p class="mb-q">${t.R(q.mg)}</p>${chips<ShapeName>('ex-mg', 'ex-mg', sh.shapeChoices, W.geometryLabel, st.mg)}${st.mg.pick ? t.card(W.shapeCoach(sh, st.mg.pick, st.mg.tries, known)) : ''}`
  // the 3D shape opens once both geometries are answered, on the finished structure
  let lift = ''
  if (st.eg.right && st.mg.right && s.view !== 'shape') {
    lift = exerciseCanLift(st, s.s)
      ? `<button class="mb-btn mb-btn-soft" data-act="view" data-view="shape" data-key="ex-see-shape" data-cue="ex-see-shape">${esc(W.EX_WORDS.seeShape)}</button>`
      : `<p class="mb-note">${t.R(q.liftWait)}</p>`
  }
  return `${section('eg', st.eg.right ? 'right' : 'open', eg)}${section('mg', st.mg.right ? 'right' : 'open', `${mg}${lift}`)}`
}

function anglePart(sh: Sheet, st: ExerciseState, t: Printer, known: W.Known): string {
  if (st.angle.right) return section('angle', 'right', t.fb(W.angleRight(sh), 'good'))
  return section(
    'angle',
    'open',
    `<p class="mb-q">${t.R(W.prompts(sh).angle)}</p>${chips('ex-angle', 'ex-angle', sh.angleChoices, W.angleLabel, st.angle)}${st.angle.pick ? t.card(W.angleCoach(sh, st.angle.pick, st.angle.tries, known)) : ''}`,
  )
}

function bondsPart(sh: Sheet, st: ExerciseState, t: Printer): string {
  const els = [...new Set(sh.bonds.flatMap((k) => [k.a, k.b]))]
  let rows = ''
  let open = false
  for (const k of sh.bonds) {
    const r = bondRow(st, k.b)
    const name = W.bondName(k)
    let line: string
    let after = ''
    if (!r.den.right) {
      open = true
      line = `<input class="mb-num ex-den" type="text" inputmode="decimal" autocomplete="off" maxlength="5" data-key="ex-den-${k.b}" data-el="${k.b}" aria-label="${esc(W.EX_WORDS.deltaBox(k))}" value="${esc(r.text)}" />`
      if (r.den.pick !== null) after = t.card(W.deltaCoach(k, r.den.pick, r.den.tries))
    } else if (r.pick === null) {
      line = `<span class="ex-den-v">${esc(W.deltaRight(k))}</span>${chips('ex-bond', `ex-bond-${k.b}`, ['polar', 'nonpolar'], (o) => (o === 'polar' ? W.EX_WORDS.polar : W.EX_WORDS.nonpolar), { pick: null, right: false }).replace(/data-act="ex-bond"/g, `data-act="ex-bond" data-el="${k.b}"`).replace(/data-key="ex-bond-/g, `data-key="ex-bond-${k.b}-`)}`
    } else {
      const f = W.bondPickText(k, r.pick === 'polar')
      line = ''
      after = f.right ? t.fb(f.text, 'good') : t.card(f.coach)
    }
    rows += `<div class="ex-bond" data-k="ex-bond-${k.b}" data-kv="" data-state="${r.pick !== null ? 'done' : 'open'}"><b class="ex-bond-name">${esc(name)}</b>${line}</div>${after}`
  }
  const done = sh.bonds.every((k) => bondRow(st, k.b).den.right && bondRow(st, k.b).pick !== null)
  const check = open ? `<button class="mb-btn mb-btn-soft" data-act="ex-den" data-key="ex-den-check">${esc(W.EX_WORDS.checkDeltas)}</button>` : ''
  return section('bonds', done ? 'right' : 'open', `${done ? '' : `<p class="mb-q">${t.R(W.prompts(sh).bonds)}</p>`}${unwrapTerms(enStrip(els), t.plain)}<div class="ex-bonds" data-cue="ex-bonds">${rows}</div>${check}`)
}

function netPart(sh: Sheet, st: ExerciseState, t: Printer): string {
  const q = W.prompts(sh)
  if (!netOpen(st, sh)) return section('net', 'open', `<p class="mb-note">${t.R(q.netWait)}</p>`)
  if (st.net.pick === null) {
    const net = `<div class="mb-choices" data-cue="ex-net">${q.net.choices
      .map((c) => `<button class="mb-choice" data-act="ex-net" data-polar="${c.polar}" data-key="ex-net-${c.polar ? 'polar' : 'nonpolar'}" data-state="idle">${esc(c.label)}</button>`)
      .join('')}</div>`
    return section('net', 'open', `<p class="mb-q">${t.R(q.net.ask)}</p><p class="mb-body mb-sub">${t.R(q.net.sub)}</p>${net}`)
  }
  const f = W.netText(sh, st.net.pick)
  let body = f.right ? t.fb(f.text, 'good') : t.card(f.coach)
  let done = true
  if (directionOpen(st, sh) && sh.directions) {
    const d = st.net.dir
    if (d.right) body += t.fb(W.directionRight(sh), 'good')
    else {
      done = false
      const labels = new Map(sh.directions.choices.map((c) => [c.id, W.directionChip(sh, c)]))
      body += `<p class="mb-q">${t.R(q.direction)}</p>${chips('ex-dir', 'ex-dir', sh.directions.choices.map((c) => c.id), (id) => labels.get(id) ?? id, d)}${d.pick ? t.card(W.directionCoach(sh, d.pick, d.tries)) : ''}`
    }
  }
  return section('net', done ? 'right' : 'open', body)
}

function finished(sh: Sheet, st: ExerciseState, t: Printer): string {
  const rows = W.finishedRows(sh)
    .map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`)
    .join('')
  return `<section class="ex-row" data-k="ex-row" data-kv=""><h3 class="ex-h">${esc(W.finishedTitle(sh))}</h3><dl class="mb-readout">${rows}</dl><p class="mb-note">${esc(W.finishedNote(sh, st.missed, COME_BACK))}</p></section>`
}

/** "Next molecule" is always there, so a student can skip. It is the main button only once the sheet
 *  is done: when an answer takes its control away, the module moves the focus to the main button,
 *  and a second Enter there would skip the molecule and empty its sheet. Before that it is a quiet
 *  button, so the focus parks on the sheet, where Enter does nothing. */
function nextButton(done: boolean): string {
  return `<button class="mb-btn ${done ? 'mb-btn-main' : 'mb-btn-quiet'} ex-next" data-act="ex-next" data-key="ex-next" data-cue="ex-next">${esc(W.EX_WORDS.next)}</button>`
}

function panel(s: State): string {
  const st = s.exercise
  const sh = sheetNow(s)
  if (s.pickerOpen) return `${header(s, sh)}<div class="mb-scroll"><div class="mb-step" tabindex="-1">${picker(s)}</div></div>`
  const t = printer(sh, st)
  const known = answered(st, sh)
  const done = sheetDone(st, sh)
  const body = [
    done ? finished(sh, st, t) : '',
    valencePart(sh, st, t),
    structurePart(s, sh, st, t, known),
    geometryParts(s, sh, st, t, known),
    anglePart(sh, st, t, known),
    bondsPart(sh, st, t),
    netPart(sh, st, t),
  ].join('')
  return `${header(s, sh)}
    <div class="mb-scroll ex-scroll"><div class="mb-step ex-sheet" tabindex="-1" data-ex-plain="${[...t.plain].join('|')}">${body}</div></div>
    <footer class="mb-foot">${nextButton(done)}</footer>`
}

// ---------------------------------------------------------------- above the board

const tile = (label: string, value: string, extra = '', lead = '') =>
  `<div class="mb-tile" data-k="tile-box-${label}" data-kv="" data-state=""><span class="mb-tile-l">${esc(label)}</span><span class="mb-tile-v">${lead}<b data-k="tile-${label}">${value}</b>${extra}</span></div>`
/** The electron counter: what is on the board, never the total the molecule needs. */
function ledger(s: State): string {
  const have = electronsOnBoard(s.s)
  const shared = sharedElectrons(s.s)
  const pairs = pairWords(s.s)
  const more = (text: string) => (text ? `<i class="mb-tile-more">${esc(text)}</i>` : '')
  return `${tile(W.EX_WORDS.onBoard, String(have), '', '<i class="mb-bead" aria-hidden="true"></i>')}${tile(W.EX_WORDS.inBonds, String(shared), more(pairs.bonded))}${tile(W.EX_WORDS.unshared, String(have - shared), more(pairs.lone))}`
}
/** The strip of checks. Until the valence electrons are answered it judges the board as free build
 *  does, with no electron total, so it cannot confirm or deny the total. */
function checks(s: State): string {
  const st = s.exercise
  const p = exerciseProblem(st)
  return checkChips(st.valence.right ? p : null, s.s)
    .map(
      (c) =>
        `<li class="mb-chk" data-k="chk-${c.id}" data-kv="${c.state}" data-state="${c.state}" title="${esc(c.says)}"><span class="mb-mark" data-ok="${c.state === 'pass'}" data-wait="${c.state === 'wait'}">${
          c.state === 'pass' ? ICON.check : c.state === 'fail' ? ICON.cross : ''
        }</span><span class="mb-chk-l" aria-hidden="true">${esc(c.label)}</span><span class="mb-chk-s" aria-hidden="true">${esc(c.short)}</span>${c.value ? `<b aria-hidden="true">${esc(c.value)}</b>` : ''}<span class="mb-sr">${esc(c.says)}</span></li>`,
    )
    .join('')
}

// ---------------------------------------------------------------- actions

/** Another molecule: an empty board and empty answers. */
function go(at: number) {
  const s = store.getState()
  store.positions.clear()
  store.update({ exercise: goTo(s.exercise, at), s: EMPTY, past: [], selection: null, view: 'flat', cleared: null, pickerOpen: false, refused: null })
}

/** Put the new answers in, and when they finish the sheet: count it, save it, and lift the model. */
function commit(next: ExerciseState) {
  const s = store.getState()
  if (next === s.exercise) return
  const sh = sheetOf(exerciseProblem(next))
  const counted = countFinished(next, sh)
  store.update({ exercise: counted })
  if (counted.counted && !next.counted) {
    store.markSolved(savedId(sh.p))
    if (exerciseCanLift(counted, store.getState().s)) store.setView('shape')
  }
}

function act(el: HTMLElement, s: State): boolean {
  const a = el.dataset.act ?? ''
  if (!a.startsWith('ex-')) return false
  const st = s.exercise
  const sh = sheetNow(s)
  const v = el.dataset.v ?? ''
  switch (a) {
    case 'ex-next':
      go(nextAt(st, s.solved))
      return true
    case 'ex-pick': {
      // the molecule already on screen: the picker closes and the sheet stays
      const at = Number(el.dataset.at)
      if (pickAt(st, at) === st) store.update({ pickerOpen: false })
      else go(at)
      return true
    }
    case 'ex-valence':
      commit(checkValence(st, sh))
      return true
    case 'ex-structure':
      commit(checkStructure(st, sh, s.s))
      return true
    case 'ex-res':
      commit(pickResonance(st, sh, v === 'yes'))
      return true
    case 'ex-eg':
      commit(pickGeometry(st, sh, v as Geometry))
      return true
    case 'ex-mg':
      commit(pickShape(st, sh, v as ShapeName))
      return true
    case 'ex-angle':
      commit(pickAngle(st, sh, v))
      return true
    case 'ex-den':
      commit(checkDeltas(st, sh))
      return true
    case 'ex-bond':
      commit(pickBond(st, sh, el.dataset.el ?? '', v === 'polar'))
      return true
    case 'ex-net':
      commit(pickNet(st, sh, el.dataset.polar === 'true'))
      return true
    case 'ex-dir':
      commit(pickDirection(st, sh, v))
      return true
  }
  return false
}

function input(el: HTMLInputElement, s: State): boolean {
  const key = el.dataset.key ?? ''
  let next: ExerciseState
  if (key === 'ex-valence') next = typeValence(s.exercise, el.value)
  else if (key.startsWith('ex-den-')) next = typeDelta(s.exercise, el.dataset.el ?? '', el.value)
  else return false
  const shown = key === 'ex-valence' ? next.valence.text : (next.bonds[el.dataset.el ?? '']?.text ?? '')
  if (el.value !== shown) el.value = shown
  if (next !== s.exercise) store.update({ exercise: next })
  return true
}

function key(e: KeyboardEvent, s: State): boolean {
  const target = e.target as HTMLElement
  if (e.key !== 'Enter' || !(target instanceof HTMLInputElement)) return false
  const k = target.dataset.key ?? ''
  if (k === 'ex-valence') commit(checkValence(s.exercise, sheetNow(s)))
  else if (k.startsWith('ex-den-')) commit(checkDeltas(s.exercise, sheetNow(s)))
  else return false
  // without this, the same key press would also press whichever button takes the focus next
  e.preventDefault()
  return true
}

/** The next action, in the sheet's order: the first part not answered yet. */
function cue(s: State): Cue | null {
  if (s.pickerOpen) return null
  const st = s.exercise
  const sh = sheetNow(s)
  if (sheetDone(st, sh)) return { kind: 'next' }
  if (!st.valence.right) return { kind: 'ask', key: 'ex-valence' }
  if (!st.structure.right) return structureCue(s, sh)
  if (resonanceOpen(st) && st.resonance === null) return { kind: 'ask', key: 'ex-resonance' }
  if (!st.eg.right) return { kind: 'ask', key: 'ex-eg' }
  if (!st.mg.right) return { kind: 'ask', key: 'ex-mg' }
  if (!st.angle.right) return { kind: 'ask', key: 'ex-angle' }
  if (!netOpen(st, sh)) return { kind: 'ask', key: 'ex-bonds' }
  if (st.net.pick === null) return { kind: 'ask', key: 'ex-net' }
  return { kind: 'ask', key: 'ex-dir' }
}
/** On the board: the next atom in the row under it, then a loose atom onto the middle atom, then the check button. */
function structureCue(s: State, sh: Sheet): Cue {
  if (s.view === 'shape') return { kind: 'ask', key: 'ex-structure' }
  const left = store.trayItems(s).filter((x) => x.n > 0)
  if (left.length) {
    const next = left.find((x) => x.el === sh.p.center) ?? left[0]!
    return { kind: 'tray', el: next.el, demo: s.s.atoms.length === 0 }
  }
  const a = assess(s.s, speciesOf(sh.p))
  const loose = a.issues.find((i) => i.kind === 'loose')
  const mid = s.s.atoms.find((x) => x.el === sh.p.center)
  if (loose && loose.kind === 'loose' && mid) {
    const from = loose.ids.find((id) => id !== mid.id)
    if (from) return s.s.bonds.length === 0 ? { kind: 'drag', from, to: mid.id } : { kind: 'atoms', ids: loose.ids.filter((id) => id !== mid.id) }
  }
  return { kind: 'ask', key: 'ex-structure' }
}

export const exercisePart: Part = {
  tab: W.EX_WORDS.tab,
  screen: (s) => (s.pickerOpen ? 'picker' : `m${s.exercise.at}`),
  panel,
  ledger,
  checks,
  // bond-angle labels go on the model only once the bond angle is answered
  scene: (s, base) => (s.exercise.angle.right ? base : { ...base, angles: [] }),
  act,
  input,
  key,
  cue,
  done: (s) => sheetDone(s.exercise, sheetNow(s)),
  // the same terms the panel prints plain: their cards would give an open part away
  blockedTerms: (s) => plainNow(sheetNow(s), s.exercise),
}
