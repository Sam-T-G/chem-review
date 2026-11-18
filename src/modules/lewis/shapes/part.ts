// The shapes quiz as a part of the module (parts.ts has the contract): the series of all 13 rows
// of the shape table, and the quiz that brings missed rows back until every row is known. The
// rules are in deck.ts, the words in words.ts, and what the quiz remembers in state.ts.
//
// No top-level calls into ../ui.ts or ../store.ts (SQ2): the three files import each other.
import { formulaHtml } from '../../../chem/problems'
import type { ShapeInfo } from '../../../chem/vsepr'
import { lower, type Coach, type HowTo } from '../guide'
import type { Part } from '../parts'
import type { SceneInput } from '../scene'
import { PART_IDS, markSolved, update, type State } from '../store'
import { BUBBLES, ICON, esc, howBox, rich } from '../ui'
import { GEOMETRIES, ROW_KEYS, example, knownKeys, nextQuestion, pick, practiceAgain, problemById, rowOf, startQuiz, type RowKey } from './deck'
import type { Question, ShapesState } from './state'
import { SENTENCES, WORDS, angleReason, blockedTerms, feedbackFor, heldBack, howPick, knownLine, learnLines, questionLines, readoutRows, resultLine, rowCounts, rowLabel } from './words'

/** The rows the app has saved as known (`shape:<bonded>,<lonePairs>`). */
const savedOf = (s: State): Set<RowKey> =>
  new Set(s.solved.filter((id) => id.startsWith(PART_IDS.shapes)).map((id) => id.slice(PART_IDS.shapes.length)))
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
/** A seed for a new deck. Only the deck's start is random; everything after follows from it. */
const freshSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
const set = (shapes: ShapesState) => update({ shapes })
/** The middle atom's name for a model question, or "the middle atom" when only counts or names are given. */
const whoFor = (q: Question) => (q.kind === 'electron' || q.kind === 'molecular' ? lower(problemById(q.molecule).center) : 'the middle atom')
const open = (st: ShapesState) => st.phase === 'quiz' && !!st.q && st.q.right === null
const turnHow: HowTo[] = [{ gesture: 'drag', text: SENTENCES.howTurn }]
/** The key terms that stay plain and may not open while the question is open (COPY-1): none once it is finished. */
const blockedNow = (st: ShapesState): string[] => (open(st) ? blockedTerms(st.q!.asks.map((a) => a.ask), rowOf(st.q!.row), st.q!.molecule) : [])

// ---------------------------------------------------------------- pieces

function header(s: State): string {
  const st = s.shapes
  const known = knownKeys(st, savedOf(s)).length
  const tab = (phase: ShapesState['phase'], label: string) =>
    `<button role="tab" aria-selected="${st.phase === phase}" data-act="sq-phase" data-phase="${phase}" data-key="sq-phase-${phase}">${esc(label)}</button>`
  return `<header class="mb-head">${BUBBLES}<div><h1 class="mb-formula mb-formula-word">${esc(WORDS.title)}</h1><p class="mb-name">${esc(st.phase === 'learn' ? WORDS.learnName : WORDS.knownCount(known))}</p></div></header>
    <div class="mb-views sq-phases" role="tablist" aria-label="${esc(WORDS.phases)}">${tab('learn', WORDS.learnTab)}${tab('quiz', WORDS.quizTab)}</div>`
}

/** A row's names, counts and angle, with the example molecule when there is one. */
function readout(row: ShapeInfo, molecule: string | null, r: (text: string) => string): string {
  const p = molecule ? problemById(molecule) : null
  const rows = readoutRows(row).map((x, i) => `<div><dt>${r(x.label)}</dt><dd${i < 2 ? ' class="is-big"' : ''}>${esc(x.value)}</dd></div>`)
  if (p) rows.push(`<div><dt>${esc(WORDS.example)}</dt><dd><span class="sq-formula">${formulaHtml(p)}</span> ${esc(p.name)}</dd></div>`)
  return `<dl class="mb-readout sq-readout">${rows.join('')}</dl>`
}

/** A wrong answer explained, in the markup of the module's own card. `r` keeps the words whose
 *  cards would give the answer plain while the question is open. */
function coachBox(c: Coach, r: (text: string) => string): string {
  return `<div class="mb-fb mb-coach" role="status" data-tone="warn">
    <p class="mb-coach-lead">${ICON.cross}<span>${r(c.lead)}</span></p>
    ${c.why ? `<p class="mb-coach-why">${r(c.why)}</p>` : ''}
    ${c.ask ? `<p class="mb-coach-ask">${r(c.ask)}</p>` : ''}
  </div>`
}
const good = (text: string, r: (text: string) => string, extra = '') =>
  `<p class="mb-fb${extra ? ` ${extra}` : ''}" role="status" data-tone="good">${ICON.check}<span>${r(text)}</span></p>`

/** One dot per row: known, missed the last time, right once, or not yet right. No names, so the
 *  dots say nothing about the question on screen. */
function pips(s: State, open = false): string {
  const st = s.shapes
  const known = new Set(knownKeys(st, savedOf(s)))
  const dots = ROW_KEYS.map((k) => {
    const r = st.rows[k]!
    const state = known.has(k) ? 'known' : r.streak > 0 ? 'half' : r.misses > 0 ? 'missed' : 'new'
    return `<li class="mb-chk sq-pip" data-k="pip-${k}" data-state="${state}"></li>`
  }).join('')
  return `<div class="sq-progress${open ? ' is-open' : ''}"><ol class="sq-pips" aria-label="${esc(WORDS.knownCount(known.size))}">${dots}</ol><b class="sq-count" aria-hidden="true">${known.size}<small>/13</small></b></div>`
}

/** The known rows by name, for the screens where no question is open. */
function knownList(s: State): string {
  const known = new Set(knownKeys(s.shapes, savedOf(s)))
  if (!known.size) return `<p class="mb-note">${rich(`${SENTENCES.noneKnown} ${SENTENCES.rule}`)}</p>`
  const items = ROW_KEYS.filter((k) => known.has(k))
    .map((k) => `<li>${ICON.check}<b>${esc(rowLabel(rowOf(k)))}</b><small>${esc(cap(rowOf(k).geometry))}</small></li>`)
    .join('')
  return `<h3 class="sq-h">${esc(WORDS.knownHeading)}</h3><ul class="sq-known" data-k="sq-known" data-kv="">${items}</ul>`
}

// ---------------------------------------------------------------- the series

function learnPanel(s: State): string {
  const st = s.shapes
  const key = ROW_KEYS[st.card]!
  const row = rowOf(key)
  const p = example(key)
  const l = learnLines(row, lower(p.center))
  const known = new Set(knownKeys(st, savedOf(s)))
  const groups = GEOMETRIES.map((g, gi) => {
    const chips = ROW_KEYS.map((k, i) => ({ k, i, r: rowOf(k) }))
      .filter((x) => x.r.geometry === g)
      .map(
        ({ k, i, r }) =>
          `<button class="sq-row" data-act="sq-go" data-row="${i}" data-key="sq-go-${i}"${i === st.card ? ' aria-current="true"' : ''}><b>${esc(rowLabel(r))}</b><small>${esc(rowCounts(r))}</small>${known.has(k) ? `<span class="sq-tick">${ICON.check}</span>` : ''}</button>`,
      )
      .join('')
    return `<div class="sq-group"><h4>${esc(WORDS.groupHeading(g, gi + 2))}</h4><div class="sq-rows">${chips}</div></div>`
  }).join('')
  const last = st.card === ROW_KEYS.length - 1
  return `${header(s)}
    <div class="mb-scroll"><div class="mb-step" tabindex="-1">
      <p class="sq-kicker">${esc(WORDS.cardNo(st.card + 1))}</p>
      <h2 class="mb-title sq-name">${rich(l.title)}</h2>
      <p class="mb-body">${rich(l.counts)}</p>
      ${readout(row, p.id, (t) => rich(t))}
      <p class="mb-note">${rich(l.difference)}</p>
      <p class="mb-note">${rich(l.reason)}</p>
      ${howBox(turnHow)}
      <section class="sq-list" data-k="sq-list" data-kv=""><h3 class="sq-h">${esc(WORDS.listHeading)}</h3>${groups}</section>
    </div></div>
    <footer class="mb-foot">
      <button class="mb-btn mb-btn-quiet" data-act="sq-prev" data-key="sq-prev" ${st.card === 0 ? 'disabled' : ''}>${ICON.back}<span>${esc(WORDS.back)}</span></button>
      <button class="mb-btn mb-btn-main" data-act="sq-fwd" data-key="sq-fwd">${esc(last ? WORDS.startQuiz : WORDS.nextTo(rowOf(ROW_KEYS[st.card + 1]!)))}</button>
    </footer>`
}

// ---------------------------------------------------------------- the quiz

function quizBody(s: State, q: Question): string {
  const st = s.shapes
  const row = rowOf(q.row)
  const who = whoFor(q)
  const isOpen = q.right === null
  // while the question is open, a word whose card would give the answer stays plain
  const seen = new Set<string>(blockedNow(st))
  const r = (text: string) => (isOpen ? rich(text, seen) : rich(text))
  const lines = questionLines(q.kind, row, who)
  const model = q.kind === 'electron' || q.kind === 'molecular'
  // the choices come straight after the question, so on a phone they are in view without scrolling
  // once the question is finished, how it counts and a row that became known come first: the panel scrolls to its top for the result
  const all = knownKeys(st, savedOf(s)).length === ROW_KEYS.length
  const result = isOpen
    ? ''
    : `<p class="mb-fb sq-result" role="status" data-tone="${q.firstTry ? 'good' : 'info'}"><span>${esc(resultLine(!!q.right, q.firstTry))}</span></p>${q.madeKnown ? good(knownLine(row), r, 'sq-burst') : ''}${all ? good(SENTENCES.allKnown, r, 'sq-burst is-all') : ''}`
  let html = `${pips(s, isOpen)}${result}<p class="sq-kicker sq-qno">${esc(WORDS.questionNo(q.n))}</p>
    <h2 class="mb-title">${r(lines.title)}</h2>`
  const at = q.asks.findIndex((a) => a.right === null)
  q.asks.forEach((a, i) => {
    if (i > at && at >= 0) return
    const ask = lines.asks[i] ? `<p class="mb-q">${r(lines.asks[i]!)}</p>` : ''
    const lastPick = a.picks[a.picks.length - 1]
    // the molecular part of a counts question while the missed electron part's answer is held back
    const held = isOpen && i > 0 && q.asks[0]!.right === false
    const said = lastPick ? feedbackFor(a.ask, row, who, lastPick, a.picks.length, q.kind, held) : null
    if (a.right === null) {
      // the open part: its choices as plain text (a geometry's name opens a card that would describe it), and the card for the last wrong pick
      const chips = a.choices
        .map((c, n) => {
          const wrong = a.picks.includes(c)
          return `<button class="mb-choice" data-act="sq-pick" data-pick="${esc(c)}" data-key="sq-pick-${n}" data-state="${wrong ? 'wrong' : 'idle'}"${wrong ? ' disabled' : ''}>${esc(cap(c))}</button>`
        })
        .join('')
      html += `${ask}<div class="mb-choices sq-choices" data-cue="sq-q">${chips}</div>${said?.coach ? coachBox(said.coach, r) : ''}`
    } else if (a.right) {
      // a finished first part of a counts question keeps the name back while the second part is open: with no lone pairs it is the same name
      html += `${ask}${isOpen ? good(SENTENCES.electronRight, r) : good(said!.text, r)}`
    } else {
      // a missed first part of a counts question keeps its answer back while the second part is open: with no lone pairs it is the same name
      html += `${ask}${coachBox(isOpen ? heldBack(said!.coach!) : said!.coach!, r)}`
    }
  })
  html += `<p class="mb-body mb-sub sq-sub">${r(lines.sub)}</p>${isOpen && at >= 0 ? howBox([{ gesture: 'tap', text: howPick(q.asks[at]!.choices.length) }, ...(model ? turnHow : [])]) : ''}`
  if (isOpen) return html
  html += `${readout(row, q.molecule, r)}<p class="mb-note">${r(angleReason(row, who))}</p>${knownList(s)}`
  return html
}

function quizPanel(s: State): string {
  const st = s.shapes
  const q = st.q
  const all = knownKeys(st, savedOf(s)).length === ROW_KEYS.length
  let body: string
  let main: string
  if (!q) {
    body = `${pips(s)}<h2 class="mb-title">${esc(SENTENCES.allKnown)}</h2><p class="mb-body">${rich(SENTENCES.allKnownNext)}</p>${knownList(s)}`
    main = `<button class="mb-btn mb-btn-main" data-act="sq-again" data-key="sq-again">${esc(WORDS.practiceAgain)}</button>`
  } else {
    body = quizBody(s, q)
    main =
      q.right !== null && all
        ? `<button class="mb-btn mb-btn-main" data-act="sq-again" data-key="sq-again">${esc(WORDS.practiceAgain)}</button>`
        : `<button class="mb-btn mb-btn-main" data-act="sq-next" data-key="sq-next" ${q.right === null ? 'disabled' : ''}>${esc(WORDS.nextQuestion)}</button>`
  }
  return `${header(s)}<div class="mb-scroll"><div class="mb-step" tabindex="-1">${body}</div></div><footer class="mb-foot">${main}</footer>`
}

// ---------------------------------------------------------------- actions

function goCard(st: ShapesState, card: number) {
  if (card < 0 || card >= ROW_KEYS.length || card === st.card) return
  set({ ...st, card })
}
function choose(s: State, value: string) {
  const out = pick(s.shapes, value)
  if (out.st === s.shapes) return
  set(out.st)
  if (out.known && !savedOf(s).has(out.known)) markSolved(`${PART_IDS.shapes}${out.known}`)
}

export const shapesPart: Part = {
  tab: WORDS.tab,
  screen: (s) => (s.shapes.phase === 'learn' ? `learn:${s.shapes.card}` : `quiz:${s.shapes.round}:${s.shapes.q?.n ?? 'all'}`),
  panel: (s) => (s.shapes.phase === 'learn' ? learnPanel(s) : quizPanel(s)),
  ledger: () => '',
  checks: () => '',
  // the switch between the two geometries sits under the model in the series; a question never offers it
  dock: (s) =>
    s.shapes.phase === 'learn'
      ? `<div class="mb-views sq-views" role="tablist" aria-label="${esc(WORDS.viewLabel)}">${(['all', 'atoms'] as const)
          .map((v) => `<button role="tab" aria-selected="${s.shapes.view === v}" data-act="sq-view" data-view="${v}" data-key="sq-view-${v}">${esc(v === 'all' ? WORDS.viewAll : WORDS.viewAtoms)}</button>`)
          .join('')}</div>`
      : '',
  scene: (s, base): SceneInput => {
    const st = s.shapes
    return {
      ...base,
      editable: false,
      showCounts: false,
      showCharges: false,
      // an open question shows no angle: the angle is one of the answers
      angles: open(st) ? [] : base.angles,
      groupsView: st.phase === 'learn' ? st.view : 'all',
    }
  },
  act: (el, s) => {
    const st = s.shapes
    switch (el.dataset.act) {
      case 'sq-phase':
        if (el.dataset.phase === 'quiz') set(startQuiz(st, savedOf(s), freshSeed()))
        else if (st.phase !== 'learn') set({ ...st, phase: 'learn' })
        return true
      case 'sq-go':
        goCard(st, Number(el.dataset.row))
        return true
      case 'sq-prev':
        goCard(st, st.card - 1)
        return true
      case 'sq-fwd':
        if (st.card === ROW_KEYS.length - 1) set(startQuiz(st, savedOf(s), freshSeed()))
        else goCard(st, st.card + 1)
        return true
      case 'sq-view':
        if (el.dataset.view === 'all' || el.dataset.view === 'atoms') set({ ...st, view: el.dataset.view })
        return true
      case 'sq-pick':
        choose(s, el.dataset.pick ?? '')
        return true
      case 'sq-next':
        if (st.q?.right !== null) set(nextQuestion(st, savedOf(s)))
        return true
      case 'sq-again':
        set(practiceAgain(st, savedOf(s), freshSeed()))
        return true
    }
    return false
  },
  key: (e, s) => {
    const t = e.target as HTMLElement | null
    if (e.altKey || e.ctrlKey || e.metaKey || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return false
    const st = s.shapes
    if (st.phase === 'learn' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      // the arrows inside a row of tabs belong to the tabs
      if (t?.closest('[role="tablist"]')) return false
      e.preventDefault()
      goCard(st, st.card + (e.key === 'ArrowRight' ? 1 : -1))
      return true
    }
    if (open(st) && /^[1-9]$/.test(e.key)) {
      const a = st.q!.asks.find((x) => x.right === null)!
      const value = a.choices[Number(e.key) - 1]
      if (!value) return false
      e.preventDefault()
      choose(s, value)
      return true
    }
    return false
  },
  cue: (s) => (open(s.shapes) ? { kind: 'ask', key: 'sq-q' } : { kind: 'next' }),
  blockedTerms: (s) => new Set(s.mode === 'shapes' ? blockedNow(s.shapes) : []),
  done: (s) => s.shapes.phase === 'quiz' && s.shapes.q?.right === true,
}
