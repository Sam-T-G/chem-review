// Everything on screen that is not the 3D board: the guide panel, the electron counter, the atom
// tray and the buttons. Each region is rebuilt as an HTML string and only touched when it changes.
import { assess } from '../../chem/assess'
import { ELEMENTS, type El } from '../../chem/elements'
import { GROUPS, PROBLEMS, chargeLabel, formulaHtml, formulaText, speciesOf, totalElectrons, type Problem } from '../../chem/problems'
import { atomById, electronsOnBoard, sharedElectrons, shellCount, type Structure } from '../../chem/structure'
import { shapeOf, type ShapeInfo, type ShapeName } from '../../chem/vsepr'
import {
  STEPS,
  bondInstruction,
  bondStatus,
  cap,
  checkRows,
  elementsOf,
  finishedNotes,
  formalChargeSum,
  inventory,
  lower,
  middleChoices,
  middleNeeded,
  nextMove,
  placedCount,
  shapeChoices,
  shapeInfoFor,
  shapeReadout,
  titleOf,
  totalSum,
  type CheckRow,
  type StepId,
} from './guide'
import { cssVars } from '../../theme/tokens'
import { ballStyle } from './palette'
import { Scene, type SceneInput } from './scene'
import * as store from './store'
import type { State } from './store'

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ICON = {
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.6 3.6 7.4-8"/></svg>',
  cross: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>',
  undo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5L3.5 8.5l4 4"/><path d="M4 8.5h7.5a5 5 0 010 10H9"/></svg>',
  clear: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6"/></svg>',
  hint: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 14.5h5M8.3 17h3.4M10 3a5 5 0 00-2.8 9.1c.5.4.8.9.8 1.4h4c0-.5.3-1 .8-1.4A5 5 0 0010 3z"/></svg>',
  swap: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 8l4-4 4 4M6 12l4 4 4-4"/></svg>',
  back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg>',
}

export interface MountOptions {
  /** Leave the module (back to the app's list of modules). Shows a back button when given. */
  onExit?: () => void
  /** Problems the app already has down as finished. */
  solved?: string[]
  /** Called with every finished problem id each time one more is finished. */
  onSolved?: (ids: string[]) => void
}

const ball = (el: El, extra = '') => `<span class="mb-ball ${extra}" style="${ballStyle(el)}" aria-hidden="true">${el}</span>`
const fb = (text: string | null | undefined, tone: 'info' | 'warn' | 'good') =>
  text ? `<p class="mb-fb" role="status" data-tone="${tone}">${tone === 'good' ? ICON.check : tone === 'warn' ? ICON.cross : ''}<span>${esc(text)}</span></p>` : ''

// ---------------------------------------------------------------- panel pieces

function header(s: State): string {
  if (s.mode === 'free') {
    return `<header class="mb-head"><div><h1 class="mb-formula mb-formula-word">Free build</h1><p class="mb-name">Build any molecule or ion</p></div></header>`
  }
  const p = store.problemOf(s)
  return `<header class="mb-head">
    <div><h1 class="mb-formula" aria-label="${esc(formulaText(p))}">${formulaHtml(p)}</h1><p class="mb-name">${esc(titleOf(p))}</p></div>
    <button class="mb-btn mb-btn-quiet mb-change" data-act="picker" data-key="picker" aria-expanded="${s.pickerOpen}">${ICON.swap}<span>Change molecule</span></button>
  </header>`
}

function picker(s: State): string {
  const groups = GROUPS.map((g) => {
    const items = PROBLEMS.map((p, i) => ({ p, i }))
      .filter(({ p }) => p.group === g)
      .map(({ p, i }) => {
        const done = s.solved.includes(p.id)
        return `<li><button class="mb-pick" data-act="pick" data-i="${i}" data-key="pick-${i}" ${i === s.problem ? 'aria-current="true"' : ''}>
          <span class="mb-pick-f">${formulaHtml(p)}</span><span class="mb-pick-n">${esc(titleOf(p))}</span>${done ? `<span class="mb-pick-done" title="Finished">${ICON.check}<span class="mb-sr">finished</span></span>` : ''}
        </button></li>`
      })
      .join('')
    return `<section><h3>${esc(g)}</h3><ul>${items}</ul></section>`
  }).join('')
  return `<div class="mb-picker" role="dialog" aria-label="Choose a molecule">
    <div class="mb-picker-top"><h2>Choose a molecule</h2><button class="mb-btn mb-btn-quiet" data-act="picker" data-key="picker-close">Close</button></div>
    ${groups}
  </div>`
}

function rail(s: State): string {
  const open = store.unlocked(s)
  const items = STEPS.map((step, i) => {
    const done = store.stepDone(step.id, s) && i < open
    const current = step.id === s.step
    const locked = i > open
    return `<li><button class="mb-rail-step" data-act="step" data-step="${step.id}" data-key="step-${step.id}" ${locked ? 'disabled' : ''} ${current ? 'aria-current="step"' : ''} data-done="${done}">
      <span class="mb-rail-dot">${done && !current ? ICON.check : i + 1}</span><span class="mb-rail-label">${step.label}</span>
    </button></li>`
  }).join('')
  return `<ol class="mb-rail" aria-label="Steps">${items}</ol>`
}

/** Main-group columns of the periodic table, periods 1 to 5, with this problem's atoms marked. */
function periodicTable(p: Problem, withValence: boolean): string {
  const groups = [1, 2, 13, 14, 15, 16, 17, 18]
  const rows = [
    ['H', '', '', '', '', '', '', 'He'],
    ['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
    ['K', 'Ca', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
    ['Rb', 'Sr', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
  ]
  const mine = new Set<string>(elementsOf(p))
  const head = `<tr><th scope="row">Group</th>${groups.map((g) => `<th scope="col">${g}</th>`).join('')}</tr>`
  const val = withValence ? `<tr class="mb-pt-val"><th scope="row">Valence electrons</th>${groups.map((_, i) => `<td>${i + 1}</td>`).join('')}</tr>` : ''
  const body = rows.map((r) => `<tr><th scope="row"></th>${r.map((sym) => `<td${mine.has(sym) ? ' class="is-mine"' : ''}>${sym}</td>`).join('')}</tr>`).join('')
  return `<figure class="mb-pt"><table><thead>${head}${val}</thead><tbody>${body}</tbody></table>${withValence ? '<figcaption>Helium is the exception in group 18: it has 2.</figcaption>' : ''}</figure>`
}

function hints(s: State): string {
  const shown = store.currentHints(s)
  if (!shown.length) return ''
  const p = store.problemOf(s)
  const table = s.step === 'count' ? periodicTable(p, shown.length >= 2) : ''
  return `<div class="mb-hints">${shown.map((h) => `<p class="mb-hint">${ICON.hint}<span>${esc(h)}</span></p>`).join('')}${table}</div>`
}

function stepCount(s: State, p: Problem): string {
  const c = s.count
  const els = elementsOf(p)
  const allRight = els.every((el) => c.right[el])
  const rows = els
    .map((el) => {
      const right = !!c.right[el]
      const n = c.answers[el] ?? 0
      const name = lower(el)
      return `<div class="mb-row" data-state="${right ? 'right' : c.feedback[el] ? 'wrong' : 'idle'}">
        ${ball(el)}<span class="mb-row-name">${cap(name)}</span>
        ${
          right
            ? `<span class="mb-row-val">${n}</span><span class="mb-mark" data-ok="true">${ICON.check}<span class="mb-sr">correct</span></span>`
            : `<div class="mb-stepper" role="group" aria-label="Valence electrons of ${name}">
                <button data-act="count" data-el="${el}" data-d="-1" data-key="dec-${el}" aria-label="One fewer for ${name}" ${n <= 0 ? 'disabled' : ''}>−</button>
                <output aria-live="polite">${n}</output>
                <button data-act="count" data-el="${el}" data-d="1" data-key="inc-${el}" aria-label="One more for ${name}" ${n >= 8 ? 'disabled' : ''}>+</button>
              </div>`
        }
      </div>${fb(c.feedback[el], 'warn')}`
    })
    .join('')

  let total = ''
  if (allRight) {
    total = c.totalRight
      ? `<div class="mb-total is-right"><p class="mb-total-big"><b>${totalElectrons(p)}</b> valence electrons</p><p class="mb-eq">${esc(totalSum(p))} = ${totalElectrons(p)}</p></div>`
      : `<div class="mb-total">
          <label for="mb-total">${formulaHtml(p)} has ${esc(inventory(p))}. How many valence electrons is that in total?</label>
          <div class="mb-total-row">
            <input id="mb-total" class="mb-num" type="text" inputmode="numeric" autocomplete="off" maxlength="2" data-key="total" value="${c.total ?? ''}" />
            <button class="mb-btn mb-btn-soft" data-act="total-check" data-key="total-check">Check the total</button>
          </div>
          ${fb(c.totalFeedback, 'warn')}
        </div>`
  }
  return `<p class="mb-body">Valence electrons are the electrons in an atom's outer shell. Set the number for each atom.</p>
    <div class="mb-rows">${rows}</div>
    ${allRight ? '' : `<button class="mb-btn mb-btn-soft" data-act="count-check" data-key="count-check">Check my counts</button>`}
    ${total}`
}

function stepPlace(s: State, p: Problem): string {
  const c = lower(p.center)
  let question = ''
  if (middleNeeded(p)) {
    const chips = middleChoices(p)
      .map((el) => {
        const picked = s.middle.pick === el
        const state = picked ? (s.middle.right ? 'right' : 'wrong') : 'idle'
        return `<button class="mb-choice" data-act="middle" data-el="${el}" data-key="mid-${el}" data-state="${state}" ${s.middle.right ? 'disabled' : ''}>${ball(el, 'is-small')}<span>${cap(lower(el))}</span></button>`
      })
      .join('')
    question = `<p class="mb-q">Which atom goes in the middle?</p><div class="mb-choices">${chips}</div>${fb(s.middle.text, s.middle.right ? 'good' : 'warn')}`
  }
  const ready = !middleNeeded(p) || s.middle.right
  const { placed, of } = placedCount(p, s.s)
  const done = placed === of
  return `${question}
    ${
      ready
        ? `<p class="mb-body">${middleNeeded(p) ? `Drag each atom onto the board, with ${c} in the middle.` : 'Drag each atom onto the board.'}</p>
           ${fb(done ? `All ${of} atoms are on the board, each with its own valence electrons.` : `${placed} of ${of} atoms on the board.`, done ? 'good' : 'info')}`
        : ''
    }`
}

function stepBond(s: State, p: Problem): string {
  const st = bondStatus(p, s.s)
  return `<p class="mb-body">${esc(bondInstruction(p))}</p>${fb(st.text, st.tone)}`
}

function checklist(rows: CheckRow[]): string {
  return `<ul class="mb-checks">${rows
    .map(
      (r) =>
        `<li data-state="${r.state}"><span class="mb-mark" data-ok="${r.state === 'pass'}" data-wait="${r.state === 'wait'}">${r.state === 'pass' ? ICON.check : r.state === 'fail' ? ICON.cross : ''}</span><span>${esc(r.text)}<span class="mb-sr">${r.state === 'pass' ? ' (done)' : r.state === 'fail' ? ' (not yet)' : ''}</span></span></li>`,
    )
    .join('')}</ul>`
}

function stepCheck(s: State, p: Problem): string {
  const notes = finishedNotes(p, s.s)
  const done = store.stepDone('check', s)
  return `<p class="mb-body">Count the electrons around each atom. Shared electrons count for both atoms in the bond.</p>
    ${checklist(checkRows(p, s.s))}
    ${done ? fb(`This is the Lewis structure of ${p.name}.`, 'good') : ''}
    ${notes.map((n) => `<p class="mb-note">${esc(n)}</p>`).join('')}`
}

function readout(p: Problem | null, center: El, info: ShapeInfo): string {
  const r = shapeReadout(p, center, info)
  return `<dl class="mb-readout">
      <div><dt>Shape</dt><dd class="is-big">${esc(cap(r.shape))}</dd></div>
      <div><dt>Electron groups</dt><dd>${esc(r.groups)}</dd></div>
      <div><dt>Bond angle</dt><dd>${esc(r.angle)}</dd></div>
    </dl>
    ${r.why ? `<p class="mb-note">${esc(r.why)}</p>` : ''}
    <p class="mb-body mb-try">Drag an atom or a lone pair, then let go. The other groups move out of the way.</p>`
}

function stepShape(s: State, p: Problem): string {
  const info = shapeInfoFor(s.s)
  if (!info) return `<p class="mb-body">Finish the Lewis structure first.</p>`
  const c = lower(p.center)
  const sh = s.shape
  // each question folds down to its answer once it is settled, so the result stays in view
  if (!sh.groupsRight) {
    const groupChips = [2, 3, 4, 5, 6]
      .map((n) => `<button class="mb-choice is-num" data-act="groups" data-n="${n}" data-key="grp-${n}" data-state="${sh.groups === n ? 'wrong' : 'idle'}">${n}</button>`)
      .join('')
    return `<p class="mb-q">How many electron groups are around ${c}?</p>
      <p class="mb-body mb-sub">A lone pair (2 unshared electrons on one atom) is 1 group. A bond is 1 group, even a double or triple bond.</p>
      <div class="mb-choices">${groupChips}</div>
      ${fb(sh.groupsFeedback, 'warn')}`
  }
  if (!sh.pick) {
    const chips = shapeChoices(info)
      .map((name) => `<button class="mb-choice" data-act="shape" data-name="${name}" data-key="shp-${name}" data-state="idle">${cap(name)}</button>`)
      .join('')
    return `${fb(sh.groupsFeedback, 'good')}
      <p class="mb-q">The groups push each other as far apart as they can get. What shape do the atoms make?</p>
      <div class="mb-choices">${chips}</div>`
  }
  return `${fb(sh.pickFeedback, sh.pickRight ? 'good' : 'warn')}${readout(p, p.center, info)}`
}

function freePanel(s: State): string {
  const a = assess(s.s)
  const info = a.complete ? shapeOf(s.s) : null
  const center = a.topology.kind === 'star' ? atomById(s.s, a.topology.center) : undefined
  const charge = a.charge === 0 ? '0' : chargeLabel(a.charge).replace(/^([+−])$/, '1$1')
  // a middle atom from period 3 onward that holds more than 8
  const held = center ? shellCount(s.s, center.id) : 0
  const note = a.complete && center && held > 8 ? `<p class="mb-note">${cap(lower(center.el))} has ${held} electrons around it. Atoms from period 3 onward can hold more than 8.</p>` : ''
  const shapeBlock =
    s.view === 'shape' && info && center
      ? readout(null, center.el, info)
      : `<button class="mb-btn mb-btn-soft" data-act="view" data-view="shape" data-key="see-shape" ${info ? '' : 'disabled'}>See the 3D shape</button>
         ${
           a.complete && !info && s.s.atoms.length > 1
             ? `<p class="mb-note">${a.topology.kind === 'star' ? `This demo has no 3D shape for ${a.topology.terminals.length + Math.floor((center?.lone ?? 0) / 2)} electron groups.` : 'This demo shows 3D shapes only for molecules with one middle atom.'}</p>`
             : ''
         }`
  return `<p class="mb-body">Drag atoms onto the board. Drag one atom onto another to bond them. Tap an atom or a bond to change it.</p>
    ${checklist(checkRows(null, s.s))}
    ${s.s.atoms.length ? `<p class="mb-charge">Charge of everything on the board: <b>${charge}</b></p>` : ''}
    ${note}
    ${shapeBlock}`
}

function panel(s: State): string {
  if (s.mode === 'guided' && s.pickerOpen) return `${header(s)}${picker(s)}`
  if (s.mode === 'free') {
    return `${header(s)}<div class="mb-scroll"><div class="mb-step" tabindex="-1">${freePanel(s)}</div></div>`
  }
  const p = store.problemOf(s)
  const step = STEPS.find((x) => x.id === s.step)!
  const body = s.step === 'count' ? stepCount(s, p) : s.step === 'place' ? stepPlace(s, p) : s.step === 'bond' ? stepBond(s, p) : s.step === 'check' ? stepCheck(s, p) : stepShape(s, p)
  const done = store.stepDone(s.step, s)
  const last = s.step === 'shape'
  const nextLabel = last ? (s.problem < PROBLEMS.length - 1 ? `<span>Next molecule: ${formulaHtml(PROBLEMS[s.problem + 1]!)}</span>` : 'Open free build') : step.next
  const left = store.hintsLeft(s)
  return `${header(s)}${rail(s)}
    <div class="mb-scroll"><div class="mb-step" tabindex="-1">
      <h2 class="mb-title">${esc(step.title)}</h2>
      ${body}
      ${hints(s)}
    </div></div>
    <footer class="mb-foot">
      <button class="mb-btn mb-btn-quiet" data-act="hint" data-key="hint" ${left > 0 && !done ? '' : 'disabled'}>${ICON.hint}<span>Hint</span></button>
      <button class="mb-btn mb-btn-main" data-act="next" data-key="next" ${done ? '' : 'disabled'}>${nextLabel}</button>
    </footer>`
}

// ---------------------------------------------------------------- stage chrome

function topbar(s: State, canExit: boolean): string {
  const tab = (mode: store.Mode, label: string) => `<button role="tab" aria-selected="${s.mode === mode}" data-act="mode" data-mode="${mode}" data-key="mode-${mode}">${label}</button>`
  const back = canExit ? `<button class="mb-back" data-act="exit" data-key="exit" aria-label="Back to all modules">${ICON.back}<span>Modules</span></button>` : ''
  return `<div class="mb-lead">${back}<div class="mb-brand"><b>Lewis structures and shapes</b></div></div>
    <div class="mb-modes" role="tablist" aria-label="Mode">${tab('guided', 'Guided')}${tab('free', 'Free build')}</div>`
}

function ledger(s: State): string {
  if (store.isSpecimen(s)) return ''
  const have = electronsOnBoard(s.s)
  const shared = sharedElectrons(s.s)
  const tile = (label: string, value: string, extra = '', state = '') => `<div class="mb-tile" data-state="${state}"><span class="mb-tile-l">${label}</span><span class="mb-tile-v"><b>${value}</b>${extra}</span></div>`
  let first: string
  if (s.mode === 'guided') {
    const p = store.problemOf(s)
    const need = totalElectrons(p)
    const { placed, of } = placedCount(p, s.s)
    const state = placed < of ? '' : have === need ? 'ok' : 'warn'
    first = tile('Electrons on the board', String(have), `<i>of ${need}</i>`, state)
  } else first = tile('Electrons on the board', String(have), '', '')
  const a = s.mode === 'free' && s.s.atoms.length ? assess(s.s) : null
  const chargeTile = a ? tile('Charge', a.charge === 0 ? '0' : `${Math.abs(a.charge)}${a.charge > 0 ? '+' : '−'}`) : ''
  return `${first}${tile('In bonds', String(shared))}${tile('Unshared', String(have - shared))}${chargeTile}`
}

function selectionCard(s: State, st: Structure): string {
  const sel = s.selection
  if (!sel) return ''
  if (sel.kind === 'atom') {
    const atom = atomById(st, sel.id)
    if (!atom) return ''
    const report = assess(st).atoms.find((x) => x.id === atom.id)
    const name = ELEMENTS[atom.el].name
    const showCharge = s.mode === 'free' || s.step === 'check'
    return `<div class="mb-sel">
      ${ball(atom.el)}
      <div class="mb-sel-text"><b>${name}</b><span>${report && report.count > report.target && report.status === 'full' ? report.count : `${report?.count ?? 0} of ${report?.target ?? 8}`} electrons${showCharge ? `<span class="mb-sel-fc">, formal charge ${esc(formalChargeSum(st, atom.id))}</span>` : ''}</span></div>
      <div class="mb-sel-acts">
        <button class="mb-btn mb-btn-soft" data-act="e-plus" data-key="e-plus">+ electron</button>
        <button class="mb-btn mb-btn-soft" data-act="e-minus" data-key="e-minus">− electron</button>
        <button class="mb-btn mb-btn-quiet" data-act="remove" data-key="remove">Remove</button>
      </div>
    </div>`
  }
  const bond = st.bonds.find((b) => b.id === sel.id)
  const A = bond ? atomById(st, bond.a) : undefined
  const B = bond ? atomById(st, bond.b) : undefined
  if (!bond || !A || !B) return ''
  const kind = bond.order === 1 ? 'single' : bond.order === 2 ? 'double' : 'triple'
  return `<div class="mb-sel">
    <div class="mb-sel-text"><b>${ELEMENTS[A.el].name}–${ELEMENTS[B.el].name.toLowerCase()} ${kind} bond</b><span>${bond.order * 2} shared electrons</span></div>
    <div class="mb-sel-acts">
      <button class="mb-btn mb-btn-soft" data-act="bond-plus" data-key="bond-plus" ${bond.order >= 3 ? 'disabled' : ''}>Add a bond</button>
      <button class="mb-btn mb-btn-soft" data-act="bond-minus" data-key="bond-minus">Remove a bond</button>
    </div>
  </div>`
}

function dock(s: State): string {
  if (store.isSpecimen(s)) return ''
  const canEdit = store.editable(s)
  const tools = `<div class="mb-tools">
      <button class="mb-icon" data-act="undo" data-key="undo" ${canEdit && s.past.length ? '' : 'disabled'} aria-label="Undo">${ICON.undo}<span>Undo</span></button>
      <button class="mb-icon" data-act="clear" data-key="clear" ${canEdit && s.s.atoms.length ? '' : 'disabled'} aria-label="Clear the board">${ICON.clear}<span>Clear</span></button>
    </div>`
  // Guided: the switch appears once the shape has been revealed. Free build: only while the 3D
  // shape is showing (the panel's "See the 3D shape" button opens it), so the tray keeps its room.
  const canShape = s.mode === 'guided' ? s.step === 'shape' && s.shape.pick !== null : s.view === 'shape'
  const views = canShape
    ? `<div class="mb-views" role="tablist" aria-label="View">
        <button role="tab" aria-selected="${s.view === 'flat'}" data-act="view" data-view="flat" data-key="view-flat">Flat drawing</button>
        <button role="tab" aria-selected="${s.view === 'shape'}" data-act="view" data-view="shape" data-key="view-shape">3D shape</button>
      </div>`
    : ''
  let middle = ''
  if (s.selection && canEdit) middle = selectionCard(s, s.s)
  else if (canEdit) {
    const items = store.trayItems(s).filter((x) => x.n > 0)
    if (items.length) {
      middle = `<div class="mb-tray" role="group" aria-label="Atoms to put on the board">${items
        .map(
          ({ el, n }) =>
            `<button class="mb-chip" data-tray="${el}" data-key="tray-${el}" aria-label="Put ${n === Infinity ? 'a' : n === 1 ? 'the' : 'a'} ${lower(el)} atom on the board${Number.isFinite(n) && n > 1 ? ` (${n} left)` : ''}">${ball(el)}${Number.isFinite(n) && n > 1 ? `<span class="mb-chip-n">×${n}</span>` : ''}</button>`,
        )
        .join('')}</div>`
    }
  }
  return `${tools}<div class="mb-dock-mid" data-kind="${s.selection && canEdit ? 'selection' : 'tray'}">${middle}</div>${views}`
}

// ---------------------------------------------------------------- mount

/** Put the module on the page inside `root`. Returns a function that takes it down again. */
export function mount(root: HTMLElement, opts: MountOptions = {}): () => void {
  root.classList.add('mb')
  for (const [name, value] of Object.entries(cssVars())) root.style.setProperty(name, value)
  const off = new AbortController()
  const on = { signal: off.signal }
  if (opts.solved?.length) store.mergeSolved(opts.solved)
  let solvedTold = store.getState().solved.length
  root.innerHTML = `
    <section class="mb-stage" aria-label="Board">
      <div class="mb-canvas-wrap"></div>
      <div class="mb-overlay"></div>
      <div class="mb-top"></div>
      <div class="mb-center"><div class="mb-ledger" role="group" aria-label="Electrons"></div><p class="mb-toast" role="status"></p></div>
      <div class="mb-dock"></div>
    </section>
    <aside class="mb-panel" aria-label="Guide"></aside>`
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const stage = q('.mb-stage')
  const wrap = q('.mb-canvas-wrap')
  const regions = { top: q('.mb-top'), ledger: q('.mb-ledger'), dock: q('.mb-dock'), panel: q('.mb-panel') }
  const toastEl = q('.mb-toast')
  const lastHtml: Record<string, string> = {}

  let scene: Scene
  try {
    scene = new Scene(wrap, q('.mb-overlay'), store.positions, {
      tapAtom: (id, key) => store.tapAtom(id, key),
      tapBond: (id) => store.tapBond(id),
      tapEmpty: () => store.clearSelection(),
      bond: (a, b) => store.bond(a, b),
      place: (el, at) => store.place(el, at),
      remove: (id) => store.remove(id),
    })
  } catch {
    wrap.innerHTML = '<p class="mb-nogl">This browser could not start 3D graphics. Try the latest Chrome, Safari or Firefox.</p>'
    return () => {
      root.replaceChildren()
      root.classList.remove('mb')
    }
  }

  scene.onBoardSize = (halfW, halfH) => {
    store.board.halfW = halfW
    store.board.halfH = halfH
  }

  const paint = (name: keyof typeof regions, html: string) => {
    if (lastHtml[name] === html) return
    lastHtml[name] = html
    const el = regions[name]
    const active = document.activeElement instanceof HTMLElement && el.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null
    const scroll = el.querySelector('.mb-scroll')?.scrollTop ?? 0
    el.innerHTML = html
    const sc = el.querySelector('.mb-scroll')
    if (sc) sc.scrollTop = scroll
    if (active) {
      const again = el.querySelector<HTMLElement>(`[data-key="${active}"]`)
      if (again && !(again as HTMLButtonElement).disabled) {
        again.focus({ preventScroll: true })
        // a redraw while typing keeps the caret at the end of what was typed
        if (again instanceof HTMLInputElement) again.setSelectionRange(again.value.length, again.value.length)
      } else if (name === 'panel') {
        // The control that had the focus is gone or switched off (an answer was accepted, the hints
        // ran out). Move to the step's main button when it is ready. Otherwise park the focus on
        // the step itself, which does nothing on Enter, so a repeated key press can't answer a question.
        const main = el.querySelector<HTMLElement>('.mb-btn-main:not([disabled])')
        ;(main ?? el.querySelector<HTMLElement>('.mb-step'))?.focus({ preventScroll: true })
      }
    }
    if (name === 'panel' && selectTotal) {
      // a total was just checked and was wrong: put the focus back in the box with the old answer
      // selected, so the next digits replace it
      const box = el.querySelector<HTMLInputElement>('#mb-total')
      if (box) {
        box.focus({ preventScroll: true })
        box.select()
      }
    }
  }

  let toastTimer = 0
  let toastSeen = 0
  let lastStep: string | null = null
  let lastPanel = ''
  /** Set just before a total is checked: if the check fails, the box comes back with its text selected. */
  let selectTotal = false
  let dockRest = 0
  const measure = () => {
    const sr = stage.getBoundingClientRect()
    const lr = regions.ledger.getBoundingClientRect()
    const tr = regions.top.getBoundingClientRect()
    const dr = regions.dock.getBoundingClientRect()
    const top = Math.max(lr.height ? lr.bottom : 0, tr.bottom) - sr.top + 14
    // The board keeps clear of the dock at its resting height. The card for a selected atom can be
    // taller; it is allowed to overlap the board's edge so the board does not jump when it opens.
    if (!regions.dock.querySelector('.mb-sel')) dockRest = dr.height ? sr.bottom - dr.top : 0
    scene.setInsets({ top, bottom: dockRest + 18, left: 14, right: 14 })
  }

  const render = (s: State) => {
    paint('top', topbar(s, !!opts.onExit))
    paint('ledger', ledger(s))
    paint('dock', dock(s))
    paint('panel', panel(s))
    root.dataset.mode = s.mode
    root.dataset.view = s.view
    root.dataset.step = s.mode === 'guided' ? s.step : 'free'

    const stepKey = `${s.mode}:${s.problem}:${s.step}`
    const panelChanged = lastHtml.panel !== lastPanel
    lastPanel = lastHtml.panel ?? ''
    if (stepKey !== lastStep) {
      lastStep = stepKey
      regions.panel.querySelector('.mb-scroll')?.scrollTo({ top: 0 })
    } else if (panelChanged) {
      // same step, new content (feedback, the next question, a hint): bring the newest part into view
      const scroller = regions.panel.querySelector('.mb-scroll')
      if (regions.panel.querySelector('.mb-readout')) scroller?.scrollTo({ top: 0, behavior: 'smooth' }) // the shape result reads from its first line
      else {
        const parts = regions.panel.querySelectorAll('.mb-step > :is(.mb-fb, .mb-choices, .mb-total, .mb-hints, .mb-note, .mb-btn)')
        parts[parts.length - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    const st = store.boardStructure(s)
    const report = store.isSpecimen(s) ? null : assess(st)
    const input: SceneInput = {
      s: st,
      editable: store.editable(s),
      selection: s.selection,
      view: s.view,
      specimen: store.isSpecimen(s),
      showCounts: s.mode === 'free' || s.step === 'bond' || s.step === 'check',
      showCharges: s.mode === 'free' || s.step === 'check' || s.step === 'shape',
      shells: new Map((report?.atoms ?? []).map((a) => [a.id, { count: a.count, target: a.target, status: a.status }])),
    }
    scene.sync(input)

    if (s.toast && s.toast.n !== toastSeen) {
      toastSeen = s.toast.n
      toastEl.textContent = s.toast.text
      toastEl.dataset.tone = s.toast.tone
      toastEl.classList.add('is-on')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => {
        toastEl.classList.remove('is-on')
        store.clearToast()
      }, 5200)
    } else if (!s.toast) toastEl.classList.remove('is-on')
    selectTotal = false
    if (s.solved.length !== solvedTold) {
      solvedTold = s.solved.length
      opts.onSolved?.(s.solved)
    }
    measure()
  }

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!t || (t as HTMLButtonElement).disabled) return
    const s = store.getState()
    const sel = s.selection
    switch (t.dataset.act) {
      case 'exit':
        opts.onExit?.()
        break
      case 'mode':
        store.setMode(t.dataset.mode as store.Mode)
        break
      case 'picker':
        store.togglePicker()
        break
      case 'pick':
        store.selectProblem(Number(t.dataset.i))
        break
      case 'step':
        store.goStep(t.dataset.step as StepId)
        break
      case 'next':
        store.next()
        break
      case 'hint':
        store.moreHint()
        break
      case 'count':
        store.setCount(t.dataset.el as El, (s.count.answers[t.dataset.el as El] ?? 0) + Number(t.dataset.d))
        break
      case 'count-check':
        store.checkCounts()
        break
      case 'total-check':
        selectTotal = true
        store.checkTotal()
        break
      case 'middle':
        store.pickMiddle(t.dataset.el as El)
        break
      case 'groups':
        store.answerGroups(Number(t.dataset.n))
        break
      case 'shape':
        store.pickShape(t.dataset.name as ShapeName)
        break
      case 'view':
        store.setView(t.dataset.view as 'flat' | 'shape')
        break
      case 'undo':
        store.undo()
        break
      case 'clear':
        store.clearBoard()
        break
      case 'e-plus':
        if (sel?.kind === 'atom') store.plusElectron(sel.id)
        break
      case 'e-minus':
        if (sel?.kind === 'atom') store.minusElectron(sel.id)
        break
      case 'remove':
        if (sel?.kind === 'atom') store.remove(sel.id)
        break
      case 'bond-plus':
        if (sel?.kind === 'bond') store.addBondOn(sel.id)
        break
      case 'bond-minus':
        if (sel?.kind === 'bond') store.unbond(sel.id)
        break
    }
  }, on)

  // tray chips: press and drag an atom onto the board, or click to drop it on a free spot
  root.addEventListener('pointerdown', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-tray]')
    if (!chip || e.button !== 0) return
    e.preventDefault()
    scene.beginPlace(chip.dataset.tray as El, e)
  }, on)
  root.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement
    const chip = target.closest<HTMLElement>('[data-tray]')
    if (chip && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      store.place(chip.dataset.tray as El, null)
      return
    }
    if (target.id === 'mb-total' && e.key === 'Enter') {
      // without this, the same key press would also activate whichever button receives the focus next
      e.preventDefault()
      selectTotal = true
      store.checkTotal()
      return
    }
    const s = store.getState()
    if (e.key === 'Escape') {
      if (s.pickerOpen) store.togglePicker(false)
      else store.clearSelection()
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection?.kind === 'atom' && target.tagName !== 'INPUT') store.remove(s.selection.id)
  }, on)
  root.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement
    if (input.id !== 'mb-total') return
    const digits = input.value.replace(/\D/g, '').slice(0, 2)
    if (digits !== input.value) input.value = digits
    store.typeTotal(digits === '' ? null : Number(digits))
  }, on)

  const ro = new ResizeObserver(measure)
  ro.observe(stage)
  const unsubscribe = store.subscribe(render)
  render(store.getState())

  // a handle for scripts/check-browser.mjs: screen positions of what is on the board, the state, and the checker
  const handle = { scene, store, report: () => assess(store.getState().s, store.getState().mode === 'guided' ? speciesOf(store.problemOf()) : undefined), nextMove: () => nextMove(store.getState().mode === 'guided' ? store.problemOf() : null, store.getState().s) }
  ;(window as unknown as { __mb?: unknown }).__mb = handle

  return () => {
    off.abort()
    unsubscribe()
    ro.disconnect()
    window.clearTimeout(toastTimer)
    scene.dispose()
    root.replaceChildren()
    root.classList.remove('mb')
    const w = window as unknown as { __mb?: unknown }
    if (w.__mb === handle) delete w.__mb
  }
}
