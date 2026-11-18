// Everything on screen that is not the 3D board: the guide panel, the electron counter, the atom
// tray and the buttons. Each region is rebuilt as an HTML string and only touched when it changes.
import { assess } from '../../chem/assess'
import { ELEMENTS, shellsOf, type El } from '../../chem/elements'
import { GROUPS, PROBLEMS, chargeLabel, chargeWord, formulaHtml, formulaText, speciesOf, totalElectrons, type Problem } from '../../chem/problems'
import { bondPolarity, courseEN } from '../../chem/polarity'
import { idealDirs, type V3 } from '../../chem/repulsion'
import { atomById, electronsOnBoard, sharedElectrons, shellCount, type Structure } from '../../chem/structure'
import { shapeOf, type ShapeInfo, type ShapeName } from '../../chem/vsepr'
import {
  ALL_TERMS,
  BIN_WORDS,
  GROUPS_VIEW_WORDS,
  FREE_POLAR_WORDS,
  bondKindsOn,
  freeBondLine,
  freeNetLine,
  geometryPicks,
  PICKS_NAME,
  geometryQuestion,
  groupsQuestion,
  shapeQuestion,
  twoAtomsLine,
  DIPOLE_WORDS,
  HYBRIDS,
  STEPS,
  TERM_WORDS,
  aimWords,
  angleMarks,
  arrowCaption,
  arrowLabel,
  bondInstruction,
  bondQuestion,
  bondStatus,
  cap,
  checkChips,
  checkCoach,
  checkRows,
  drawingOf,
  elementsOf,
  finishedLine,
  finishedNotes,
  formalChargeSum,
  groupFacts,
  howTo,
  howToFree,
  hybridLabel,
  hybridQuestion,
  inventory,
  lower,
  middleChoices,
  middleNeeded,
  mixedOuter,
  netArrowLabel,
  netArrowQuestion,
  netQuestion,
  nextMove,
  pairWords,
  placeInstruction,
  placedCount,
  plainTerms,
  polarity,
  bondName,
  profile,
  sampleShape,
  shapeChoices,
  shapeInfoFor,
  shapeReadout,
  shellsWords,
  sigmaPiQuestion,
  termCard,
  termPieces,
  titleOf,
  totalSum,
  totalTally,
  type BondAnswer,
  type CheckRow,
  type Coach,
  type HowTo,
  type Hybrid,
  type LewisMark,
  type Sample,
  type TallyReveal,
  type StepId,
  type TermCard,
  type TermId,
  type TermPicture,
} from './guide'
import { cssVars } from '../../theme/tokens'
import { BALL, ballStyle } from './palette'
import { OPEN_PARTS, PARTS } from './parts'
import { Scene, type SceneInput } from './scene'
import * as store from './store'
import type { State } from './store'

// A bond's name ("S–F") must not break across two lines at its dash, so a word joiner follows the dash.
export const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/–(?=[A-Z])/g, '–\u2060')

export const ICON = {
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
  /** Called when something happens that a phone can answer with a tap of its motor. */
  onFeel?: (kind: Feel) => void
  /** The mode the module opens in. Left out: the mode it was last in (the guided steps the first time). */
  start?: store.Mode
}
export type Feel = 'land' | 'bond' | 'refuse' | 'done'

/** The pointing hand: a white glove with a grape cuff, drawn pointing up. The finger that points
 *  at things on the page is this drawing, and so are the two small pictures beside a how-to line. */
const HAND = `<path class="mb-hand-cuff" d="M17 50h21a2.500 2.500 0 0 1 2.500 2.500v3A2.500 2.500 0 0 1 38 58H17a2.500 2.500 0 0 1-2.500-2.500v-3A2.500 2.500 0 0 1 17 50z"/><path class="mb-hand-skin" d="M16 30V8.500a5.500 5.500 0 0 1 11 0V21c.6-2.400 5.600-2.600 6 .6.8-2 5.400-1.800 6 1.200 1-1.600 5-1 5 2V38c0 9-6 15-15 15h-5c-5 0-8.500-2.500-11-7L6 36.500c-2-3.200 2.200-6.400 5-3.800l5 4.300z"/><path class="mb-hand-line" d="M27 21v6M33 22v5M39 23.500v4"/><path class="mb-hand-shine" d="M20 10.500v8"/>`
const GESTURE: Record<HowTo['gesture'], string> = {
  // the hand with an arrow beside it: press, move, let go
  drag: `<svg class="mb-how-icon" viewBox="-2 0 72 60" aria-hidden="true"><path class="mb-how-mark" d="M50 30h14M58 23l7 7-7 7"/>${HAND}</svg>`,
  // the hand with two short arcs over the fingertip: a tap
  tap: `<svg class="mb-how-icon" viewBox="-2 -8 72 68" aria-hidden="true"><path class="mb-how-mark" d="M9 4a13 13 0 0 1 25 0M3 0a20 20 0 0 1 37 0"/>${HAND}</svg>`,
  // the hand beside a line with a stroke through it: a swipe across a bond
  swipe: `<svg class="mb-how-icon" viewBox="-2 0 72 60" aria-hidden="true"><path class="mb-how-mark is-bond" d="M58 6v44"/><path class="mb-how-mark" d="M48 38l20-18"/>${HAND}</svg>`,
}
/** How the board is worked in this step: one line for each gesture, with a small picture of it. */
export function howBox(lines: HowTo[]): string {
  if (!lines.length) return ''
  return `<ul class="mb-how" data-k="how" data-kv="">${lines.map((h) => `<li>${GESTURE[h.gesture]}<span>${esc(h.text)}</span></li>`).join('')}</ul>`
}

// An atom as drawn in the panel and the tray: its symbol under a pale patch with two eyes, like the balls on the board.
// Each element blinks on its own beat.
export const ball = (el: El, extra = '') =>
  `<span class="mb-ball ${extra}" style="${ballStyle(el)};--blink:${((el.charCodeAt(0) * 37 + el.length * 11) % 50) / 10}s" aria-hidden="true"><i class="mb-eyes"></i><b>${el}</b></span>`
export const BUBBLES = '<span class="mb-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'
export const fb = (text: string | null | undefined, tone: 'info' | 'warn' | 'good') =>
  text ? `<p class="mb-fb" role="status" data-tone="${tone}">${tone === 'good' ? ICON.check : tone === 'warn' ? ICON.cross : ''}<span>${rich(text)}</span></p>` : ''

/** An atom's electron shells as rings around its symbol. The inner shells and their electrons
 *  are gray; the outer shell is the colored ring, with its electrons drawn like the ones on the board. */
function shellsFigure(el: El): string {
  const shells = shellsOf(el)
  const words = shellsWords(el)
  const gap = shells.length > 3 ? 11 : 13
  const radii = shells.map((_, i) => 24 + i * gap)
  const half = radii[radii.length - 1]! + 9
  // atoms with few shells are drawn larger, so the picture is about the same size for every atom
  const zoom = shells.length > 3 ? 1.05 : 1.3
  const ring = (r: number, n: number, outer: boolean) => {
    const dots = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 - Math.PI / 2
      return `<circle class="${outer ? 'mb-sh-e' : 'mb-sh-core'}" cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="${outer ? 4.4 : 2.3}"/>`
    }).join('')
    return `<circle class="${outer ? 'mb-sh-outer' : 'mb-sh-inner'}" r="${r}"/>${dots}`
  }
  const ball = BALL[el]
  const key = `${words.inner ? `<li><i class="is-inner"></i>${esc(words.inner)}</li>` : ''}<li><i class="is-outer"></i>${esc(words.outer)}</li>`
  return `<figure class="mb-shells" data-el="${el}" data-outer="${shells[shells.length - 1]}">
    <svg viewBox="${-half} ${-half} ${half * 2} ${half * 2}" width="${Math.round(half * 2 * zoom)}" height="${Math.round(half * 2 * zoom)}" role="img" aria-label="${esc(words.label)}">
      ${shells.map((n, i) => ring(radii[i]!, n, i === shells.length - 1)).join('')}
      <circle class="mb-sh-nucleus" r="13" fill="#${ball.color.toString(16).padStart(6, '0')}"/>
      <text class="mb-sh-sym" y="${el.length > 1 ? 4 : 4.6}" font-size="${el.length > 1 ? 11.5 : 13.5}" fill="${ball.ink}">${el}</text>
    </svg>
    <ul class="mb-shells-key" aria-hidden="true">${key}</ul>
  </figure>`
}

/** How a molecule's total is built: a row for each kind of atom, with one ball for every atom of
 *  that kind and what each brings, a row for an ion's charge, and the total. `reveal` says how
 *  much is filled in: the atoms alone, then each row's sum, then the total. */
function tallyFigure(p: Problem, reveal: TallyReveal): string {
  const t = totalTally(p, reveal)
  const rows = t.rows
    .map((r) => {
      const atoms = r.el ? Array.from({ length: r.count }, () => ball(r.el!, 'is-small')).join('') : `<b class="mb-tally-charge">${esc(chargeWord(p.charge))}</b>`
      return `<li><span class="mb-tally-atoms">${atoms}</span><span class="mb-tally-text">${esc(r.text)}</span><span class="mb-tally-sum">${r.sum === null ? '' : esc(r.sum)}</span></li>`
    })
    .join('')
  return `<figure class="mb-tally" data-reveal="${reveal}" role="img" aria-label="${esc(t.label)}">
    <ul>${rows}</ul>
    <p class="mb-tally-total"><span>${esc(t.totalLabel)}</span><b>${esc(t.total)}</b></p>
  </figure>`
}

/** A wrong answer explained: what the answer is, why it does not fit, what to do next, and a picture when there is one. */
export const coach = (c: Coach | null | undefined, p?: Problem): string => {
  if (!c) return ''
  const picture = c.show?.kind === 'shells' ? shellsFigure(c.show.el) : c.show?.kind === 'tally' && p ? tallyFigure(p, c.show.reveal) : ''
  // a card keeps its own list of highlighted terms: a student who is stuck on it finds each word in it
  const seen = new Set<string>()
  return `<div class="mb-fb mb-coach" role="status" data-tone="warn">
    <p class="mb-coach-lead">${ICON.cross}<span>${rich(c.lead, seen)}</span></p>
    ${c.why ? `<p class="mb-coach-why">${rich(c.why, seen)}</p>` : ''}
    ${c.ask ? `<p class="mb-coach-ask">${rich(c.ask, seen)}</p>` : ''}
    ${picture}
  </div>`
}

// ---------------------------------------------------------------- key terms

/** The terms already highlighted on the screen being built, the ones this step leaves plain, and
 *  a running number that gives each highlighted word its own key. */
let termsSeen = new Set<string>()
let termsPlain: TermId[] = []
let termsMade = 0
/** A sentence as HTML. The first use of each key term on a screen is a button that opens the
 *  term's card. `seen` is the set a card or a list of hints keeps for itself. */
export function rich(text: string, seen: Set<string> = termsSeen): string {
  return termPieces(text, termsPlain)
    .map((piece) => {
      if (!piece.term || seen.has(piece.term)) return esc(piece.text)
      seen.add(piece.term)
      return `<button type="button" class="mb-term" data-term="${piece.term}" data-key="term-${termsMade++}" aria-haspopup="dialog" aria-expanded="false" title="${TERM_WORDS.opens}">${esc(piece.text)}</button>`
    })
    .join('')
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const f1 = (n: number) => String(Math.round(n * 10) / 10)
const signedText = (n: number) => (n > 0 ? `+${n}` : `−${-n}`)
/** How big an atom is drawn in a card's picture. */
const picR = (el: El) => (ELEMENTS[el].period === 1 ? 12 : 16)
const picAtom = (el: El, x: number, y: number, r = picR(el)) =>
  `<g transform="translate(${f1(x)} ${f1(y)})"><circle class="mb-pic-atom" r="${f1(r)}" fill="${hex(BALL[el].color)}"/><text class="mb-pic-sym" y="${f1(r * 0.36)}" font-size="${f1(r * (el.length > 1 ? 0.86 : 1.02))}" fill="${BALL[el].ink}">${el}</text></g>`
/** A small round label with a number or a sign in it. */
const picBadge = (x: number, y: number, text: string, kind: string) => `<g class="mb-pic-badge ${kind}" transform="translate(${f1(x)} ${f1(y)})"><circle r="8.6"/><text y="3.7">${text}</text></g>`
const picDots = (x: number, y: number, u: { x: number; y: number }) =>
  `<circle class="mb-pic-dot" cx="${f1(x - u.y * 3.9)}" cy="${f1(y + u.x * 3.9)}" r="2.5"/><circle class="mb-pic-dot" cx="${f1(x + u.y * 3.9)}" cy="${f1(y - u.x * 3.9)}" r="2.5"/>`
/** A dipole arrow as the board draws one: a shaft, a head, and a short cross near its tail. */
function picArrow(x1: number, y1: number, x2: number, y2: number, kind: 'is-bond' | 'is-net'): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const head = kind === 'is-net' ? 10 : 7
  const bx = x2 - ux * head
  const by = y2 - uy * head
  const cx = x1 + ux * 6
  const cy = y1 + uy * 6
  const w = head * 0.6
  return `<g class="mb-pic-arrow ${kind}"><path d="M${f1(x1)} ${f1(y1)}L${f1(bx)} ${f1(by)}M${f1(cx - uy * 4.2)} ${f1(cy + ux * 4.2)}L${f1(cx + uy * 4.2)} ${f1(cy - ux * 4.2)}"/><path class="is-head" d="M${f1(x2)} ${f1(y2)}L${f1(bx - uy * w)} ${f1(by + ux * w)}L${f1(bx + uy * w)} ${f1(by - ux * w)}z"/></g>`
}
interface PicBox {
  x0: number
  x1: number
  y0: number
  y1: number
}
const picBox = (): PicBox => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity })
const grow = (b: PicBox, x: number, y: number, pad: number) => {
  b.x0 = Math.min(b.x0, x - pad)
  b.x1 = Math.max(b.x1, x + pad)
  b.y0 = Math.min(b.y0, y - pad)
  b.y1 = Math.max(b.y1, y + pad)
}
const picFrame = (inner: string, b: PicBox, zoom = 1.2) =>
  `<svg class="mb-pic-svg" viewBox="${f1(b.x0 - 5)} ${f1(b.y0 - 5)} ${f1(b.x1 - b.x0 + 10)} ${f1(b.y1 - b.y0 + 10)}" width="${Math.round((b.x1 - b.x0 + 10) * zoom)}" height="${Math.round((b.y1 - b.y0 + 10) * zoom)}" aria-hidden="true">${inner}</svg>`

/** One flat Lewis drawing: the middle atom at the origin, each outer atom on a seat around it, and
 *  each lone pair on a seat of its own. A molecule of two atoms lies left to right. */
function lewisGroup(m: Sample, mark: LewisMark, form: number): { svg: string; box: PicBox } {
  const d = drawingOf(m, form)
  const dots = mark !== 'lines' && mark !== 'sigma-pi'
  // a longer bond where something is marked on it
  const L = mark === 'sigma-pi' ? 104 : mark === 'bond' ? 84 : mark === 'shell' ? 72 : 58
  const n = d.outer.length
  const pairs = Math.floor(d.lone / 2)
  const k = n + pairs
  const angles = n === 1 ? Array.from({ length: k }, (_, i) => (i * 360) / k) : k === 2 ? [180, 0] : Array.from({ length: k }, (_, i) => 90 + (i * 360) / k)
  // lone pairs take the top seat first, and seats spread evenly when there are two
  const loneSeats = n === 1 ? Array.from({ length: pairs }, (_, j) => j + 1) : Array.from({ length: pairs }, (_, j) => Math.round((j * k) / pairs))
  const atomSeats = angles.map((_, i) => i).filter((i) => !loneSeats.includes(i))
  const rc = picR(d.center)
  const box = picBox()
  grow(box, 0, 0, rc + 2)
  const dir = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180), y: -Math.sin((deg * Math.PI) / 180) })
  const pair = (cx: number, cy: number, r: number, deg: number, ring: boolean) => {
    const u = dir(deg)
    const px = cx + u.x * (r + 7)
    const py = cy + u.y * (r + 7)
    grow(box, px, py, ring ? 11 : 6.5)
    return `${ring ? `<ellipse class="mb-pic-ring" cx="${f1(px)}" cy="${f1(py)}" rx="9.6" ry="6.2" transform="rotate(${f1(90 - deg)} ${f1(px)} ${f1(py)})"/>` : ''}${picDots(px, py, u)}`
  }
  let back = ''
  let lines = ''
  let atoms = picAtom(d.center, 0, 0)
  let front = ''
  let groupNo = 0
  d.outer.forEach((o, i) => {
    const deg = angles[atomSeats[i]!]!
    const u = dir(deg)
    const ro = picR(o.el)
    const ax = u.x * L
    const ay = u.y * L
    grow(box, ax, ay, ro + 2)
    const gap = mark === 'sigma-pi' ? 11 : 5
    const from = rc + 1.5
    const to = L - ro - 1.5
    const mid = (from + to) / 2
    // of a double or triple bond's lines, the one in the middle (or the lower one) is the sigma bond
    const sigmaAt = Math.floor(o.order / 2)
    for (let b = 0; b < o.order; b++) {
      const off = (b - (o.order - 1) / 2) * gap
      const ox = -u.y * off
      const oy = u.x * off
      lines += `<line class="mb-pic-bond" x1="${f1(u.x * from + ox)}" y1="${f1(u.y * from + oy)}" x2="${f1(u.x * to + ox)}" y2="${f1(u.y * to + oy)}"/>`
      if (mark === 'sigma-pi') {
        const t = mid + (b - (o.order - 1) / 2) * 20
        front += `<g class="mb-pic-tag" transform="translate(${f1(u.x * t + ox)} ${f1(u.y * t + oy)})"><rect x="-8" y="-8" width="16" height="16" rx="5"/><text y="4.2">${b === sigmaAt ? 'σ' : 'π'}</text></g>`
      }
    }
    if (mark === 'bond') front += `<ellipse class="mb-pic-ring" cx="${f1(u.x * mid)}" cy="${f1(u.y * mid)}" rx="10.5" ry="7" transform="rotate(${f1(90 - deg)} ${f1(u.x * mid)} ${f1(u.y * mid)})"/>`
    if (mark === 'bond' || mark === 'shell') front += picDots(u.x * mid, u.y * mid, u)
    if (mark === 'groups') front += picBadge(u.x * mid - u.y * 12, u.y * mid + u.x * 12, String(++groupNo), 'is-count')
    if (dots) {
      const p = Math.floor(o.lone / 2)
      for (let j = 1; j <= p; j++) front += pair(ax, ay, ro, deg + 180 + (j * 360) / (p + 1), mark === 'lone')
    }
    atoms += picAtom(o.el, ax, ay)
    if (mark === 'charges' && o.fc !== 0) {
      front += picBadge(ax + (ro + 9) * 0.72, ay - (ro + 9) * 0.72, signedText(o.fc), 'is-charge')
      grow(box, ax + (ro + 9) * 0.72, ay - (ro + 9) * 0.72, 10)
    }
  })
  if (dots) {
    for (const i of loneSeats) {
      front += pair(0, 0, rc, angles[i]!, mark === 'lone')
      if (mark === 'groups') {
        const u = dir(angles[i]!)
        front += picBadge(u.x * (rc + 23), u.y * (rc + 23), String(++groupNo), 'is-count')
        grow(box, u.x * (rc + 23), u.y * (rc + 23), 10)
      }
    }
  }
  if (mark === 'middle') {
    back += `<circle class="mb-pic-halo" r="${f1(rc + 6.5)}"/>`
    grow(box, 0, 0, rc + 9)
  }
  if (mark === 'charges' && d.fc !== 0) {
    front += picBadge((rc + 9) * 0.72, -(rc + 9) * 0.72, signedText(d.fc), 'is-charge')
    grow(box, (rc + 9) * 0.72, -(rc + 9) * 0.72, 10)
  }
  if (mark === 'shell') {
    // a ring around everything that counts for one atom: its own dots and both electrons of each of its bonds
    const o = d.outer[0]!
    const own = d.lone > 0
    const u = dir(angles[atomSeats[0]!]!)
    const hx = own ? 0 : u.x * L
    const hy = own ? 0 : u.y * L
    const mid = (rc + L - picR(o.el)) / 2
    const R = (own ? mid : L - mid) + 7.5
    const count = own ? d.lone + 2 * d.outer.reduce((sum, x) => sum + x.order, 0) : o.lone + 2 * o.order
    back += `<circle class="mb-pic-shell" cx="${f1(hx)}" cy="${f1(hy)}" r="${f1(R)}"/>`
    front += picBadge(hx + R * 0.72, hy - R * 0.72, String(count), 'is-count')
    grow(box, hx, hy, R + 2)
    grow(box, hx + R * 0.72, hy - R * 0.72, 10)
  }
  let svg = back + lines + atoms + front
  if (mark === 'ion') {
    const x0 = box.x0 - 5
    const x1 = box.x1 + 5
    const y0 = box.y0 - 3
    const y1 = box.y1 + 3
    svg += `<path class="mb-pic-bracket" d="M${f1(x0 + 6)} ${f1(y0)}H${f1(x0)}V${f1(y1)}H${f1(x0 + 6)}M${f1(x1 - 6)} ${f1(y0)}H${f1(x1)}V${f1(y1)}H${f1(x1 - 6)}"/><text class="mb-pic-charge" x="${f1(x1 + 4)}" y="${f1(y0 + 9)}">${chargeLabel(m.charge)}</text>`
    grow(box, x0, y0, 2)
    grow(box, x1 + 18, y1, 2)
  }
  return { svg, box }
}

function lewisFigure(pic: Extract<TermPicture, { kind: 'lewis' }>): string {
  const groups = pic.samples.map((m, i) => lewisGroup(m, pic.mark, pic.forms?.[i] ?? 0))
  if (pic.mark === 'sigma-pi') {
    // the labels on the lines are small, so these drawings go one under the other at full size
    let y = 0
    let svg = ''
    for (const g of groups) {
      svg += `<g transform="translate(${f1(-(g.box.x0 + g.box.x1) / 2)} ${f1(y - g.box.y0)})">${g.svg}</g>`
      y += g.box.y1 - g.box.y0 + 12
    }
    const half = Math.max(...groups.map((g) => (g.box.x1 - g.box.x0) / 2))
    return picFrame(svg, { x0: -half, x1: half, y0: 0, y1: y - 12 })
  }
  const gap = pic.forms ? 36 : 22
  const top = Math.min(...groups.map((g) => g.box.y0))
  const bottom = Math.max(...groups.map((g) => g.box.y1))
  let x = 0
  let svg = ''
  groups.forEach((g, i) => {
    const dx = x - g.box.x0
    svg += `<g transform="translate(${f1(dx)} 0)">${g.svg}</g>`
    const caption = pic.captions?.[i]
    if (caption) svg += `<text class="mb-pic-cap" x="${f1(dx + (g.box.x0 + g.box.x1) / 2)}" y="${f1(bottom + 15)}">${esc(caption)}</text>`
    x += g.box.x1 - g.box.x0
    if (i < groups.length - 1) {
      // two drawings of the same molecule get the double arrow chemists put between resonance structures
      if (pic.forms) svg += `<text class="mb-pic-swap" x="${f1(x + gap / 2)}" y="${f1((top + bottom) / 2 + 6)}">↔</text>`
      x += gap
    }
  })
  return picFrame(svg, { x0: 0, x1: x, y0: top, y1: bottom + (pic.captions ? 20 : 0) })
}

/** Two bonded atoms with the course table's electronegativity under each. The shared pair sits
 *  nearer the atom that pulls harder. */
function pairFigure(pic: Extract<TermPicture, { kind: 'pair' }>): string {
  const pol = bondPolarity(pic.a, pic.b)
  const L = 108
  const ra = picR(pic.a) + 3
  const rb = picR(pic.b) + 3
  const hiRight = pol.negative === pic.b
  const from = ra + 1.5
  const to = L - rb - 1.5
  const at = from + (to - from) * (hiRight ? 0.7 : 0.3)
  const below = Math.max(ra, rb) + 18
  let svg = `<line class="mb-pic-bond" x1="${f1(from)}" y1="0" x2="${f1(to)}" y2="0"/>${picDots(at, 0, { x: 1, y: 0 })}${picAtom(pic.a, 0, 0, ra)}${picAtom(pic.b, L, 0, rb)}`
  svg += `<text class="mb-pic-num" x="0" y="${below}">${courseEN(pic.a)}</text><text class="mb-pic-num" x="${L}" y="${below}">${courseEN(pic.b)}</text>`
  const box: PicBox = { x0: -ra - 16, x1: L + rb + 16, y0: -Math.max(ra, rb) - 3, y1: below + 5 }
  if (pic.arrow) {
    const y = box.y0 - 8
    svg += picArrow(hiRight ? 8 : L - 8, y, hiRight ? L - 8 : 8, y, 'is-bond')
    svg += `<text class="mb-pic-delta" x="${hiRight ? 0 : L}" y="${f1(y - 9)}">δ+</text><text class="mb-pic-delta" x="${hiRight ? L : 0}" y="${f1(y - 9)}">δ−</text>`
    box.y0 = y - 24
  }
  if (pic.sum) {
    svg += `<text class="mb-pic-sum" x="${L / 2}" y="${below + 22}">${esc(pic.sum)}</text>`
    box.y1 = below + 28
  }
  return picFrame(svg, box)
}

const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
const rotY = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
const rotZ = (p: V3, a: number): V3 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]]
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit3 = (a: V3): V3 => {
  const len = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / len, a[1] / len, a[2] / len]
}
/** The textbook seats for a shape, turned so the drawing reads well on a page: x to the right, y
 *  up, z toward the reader. Lone pairs go to the top where the shape allows it, one bond comes
 *  toward the reader, and the whole thing is tipped forward a little. Bonded atoms first. */
function viewSeats(bonded: number, lonePairs: number, steep = false): V3[] {
  const seats = idealDirs(bonded, lonePairs) ?? []
  const n = bonded + lonePairs
  const deg = Math.PI / 180
  if (n <= 2) return seats
  if (n === 3) {
    // the three seats lie flat: turn their plane to face the reader, then put the lone pair, or the first atom, on top
    const flat = seats.map((p) => rotX(p, -90 * deg))
    const up = flat[lonePairs > 0 ? n - 1 : 0]!
    const turn = Math.PI / 2 - Math.atan2(up[1], up[0])
    return flat.map((p) => rotZ(p, turn))
  }
  if (n === 4) {
    const lone = seats.slice(bonded)
    const up = unit3(lone.length ? lone.reduce<V3>((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]) : seats[0]!)
    const ref = seats[lone.length ? 0 : 1]!
    const along = dot3(ref, up)
    const ex = unit3([ref[0] - along * up[0], ref[1] - along * up[1], ref[2] - along * up[2]])
    const ez: V3 = [ex[1] * up[2] - ex[2] * up[1], ex[2] * up[0] - ex[0] * up[2], ex[0] * up[1] - ex[1] * up[0]]
    const spin = (lonePairs === 2 ? 205 : 200) * deg
    // seen from higher up when arrows are drawn beside the bonds, so the bond that comes forward is long enough for one
    return seats.map((p) => rotX(rotY([dot3(p, ex), dot3(p, up), dot3(p, ez)], -spin), (steep ? 35 : 14) * deg))
  }
  // Five or six seats: the ones on the axis stay upright. The ring around the middle is turned so that no atom
  // sits straight in front of the middle atom, and tipped far enough forward to tell front from back.
  // With five seats a single lone pair goes to the left, and two lone pairs go to the left, front and back.
  const spin = (n === 5 ? (lonePairs === 2 ? 0 : 300) : 30) * deg
  return seats.map((p) => rotX(rotY(p, -spin), (n === 5 ? 28 : 30) * deg))
}

/** A molecule drawn in its 3D shape: nearer atoms larger and on top, lone pairs as pale lobes. */
function modelFigure(pic: Extract<TermPicture, { kind: 'model' }>): string {
  const d = drawingOf(pic.sample)
  const info = sampleShape(pic.sample)
  const seats = viewSeats(info.bonded, info.lonePairs, pic.arrows !== 'none' && info.lonePairs === 1)
  const S = 62
  const rc = picR(d.center)
  const box = picBox()
  grow(box, 0, 0, rc + 2)
  const items: { z: number; svg: string }[] = [{ z: 0, svg: picAtom(d.center, 0, 0) }]
  let over = ''
  const sum: V3 = [0, 0, 0]
  d.outer.forEach((o, i) => {
    const p = seats[i]!
    const x = p[0] * S
    const y = -p[1] * S
    const len = Math.hypot(x, y)
    const u = len > 1 ? { x: x / len, y: y / len } : { x: 0, y: 1 }
    const ro = picR(o.el) * (1 + 0.14 * p[2])
    grow(box, x, y, ro + 2)
    if (len > rc + ro) items.push({ z: p[2] / 2, svg: `<line class="mb-pic-bond" x1="${f1(u.x * (rc - 1))}" y1="${f1(u.y * (rc - 1))}" x2="${f1(x - u.x * (ro - 1))}" y2="${f1(y - u.y * (ro - 1))}"/>` })
    items.push({ z: p[2], svg: picAtom(o.el, x, y, ro) })
    const pol = bondPolarity(d.center, o.el)
    if (pic.arrows === 'none' || pol.kind === 'nonpolar') return
    const out = pol.negative === o.el ? 1 : -1
    for (let k = 0; k < 3; k++) sum[k]! += p[k]! * out * pol.tenths
    // the arrow runs beside the bond, between the two atoms, on the side that is higher on the page
    let nx = -u.y
    let ny = u.x
    if (ny > 0.01 || (Math.abs(ny) <= 0.01 && nx < 0)) {
      nx = -nx
      ny = -ny
    }
    const side = 13
    const a = rc
    const b = len - ro * 0.75
    if (b - a < 16) return
    const [s, e] = out === 1 ? [a, b] : [b, a]
    over += picArrow(u.x * s + nx * side, u.y * s + ny * side, u.x * e + nx * side, u.y * e + ny * side, 'is-bond')
    grow(box, u.x * a + nx * side, u.y * a + ny * side, 6)
    grow(box, u.x * b + nx * side, u.y * b + ny * side, 6)
  })
  for (let i = info.bonded; i < seats.length; i++) {
    const p = seats[i]!
    const x = p[0] * S * 0.64
    const y = -p[1] * S * 0.64
    grow(box, x, y, 12)
    items.push({ z: p[2] / 2, svg: `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1((Math.atan2(y, x) * 180) / Math.PI + 90)})"><ellipse class="mb-pic-lobe" rx="10" ry="6.6"/><circle class="mb-pic-dot" cx="-3.9" r="2.5"/><circle class="mb-pic-dot" cx="3.9" r="2.5"/></g>` })
  }
  if (pic.arrows === 'net') {
    const len = Math.hypot(sum[0], sum[1])
    if (len > 1e-6) {
      // the sum of the bond arrows, drawn beside the molecule so that it covers no atom
      const ux = sum[0] / len
      const uy = -sum[1] / len
      const px = Math.abs(ux) > Math.abs(uy) ? 0 : box.x1 + 20
      const py = Math.abs(ux) > Math.abs(uy) ? box.y1 + 20 : (box.y0 + box.y1) / 2
      over += picArrow(px - ux * 27, py - uy * 27, px + ux * 27, py + uy * 27, 'is-net')
      grow(box, px - ux * 27, py - uy * 27, 8)
      grow(box, px + ux * 27, py + uy * 27, 8)
    }
  }
  if (pic.angle && d.outer.length >= 2) {
    // the angle between the first two bonds, with the shape table's number beside it
    const flat = (p: V3) => {
      const len = Math.hypot(p[0], p[1]) || 1
      return { x: p[0] / len, y: -p[1] / len }
    }
    const a = flat(seats[0]!)
    const b = flat(seats[1]!)
    const r = rc + 9
    const mid = { x: a.x + b.x, y: a.y + b.y }
    const ml = Math.hypot(mid.x, mid.y) || 1
    over += `<path class="mb-pic-arc" d="M${f1(a.x * r)} ${f1(a.y * r)}A${r} ${r} 0 0 ${a.x * b.y - a.y * b.x > 0 ? 1 : 0} ${f1(b.x * r)} ${f1(b.y * r)}"/><text class="mb-pic-angle" x="${f1((mid.x / ml) * (r + 17))}" y="${f1((mid.y / ml) * (r + 17) + 4)}">${esc(info.angle)}</text>`
    grow(box, (mid.x / ml) * (r + 17), (mid.y / ml) * (r + 17), 18)
  }
  return picFrame(items.sort((p, q) => p.z - q.z).map((it) => it.svg).join('') + over, box)
}

/** The picture in a term's card, with its description for a screen reader. */
function termPicture(pic: TermPicture, label: string): string {
  const inner =
    pic.kind === 'shells' ? shellsFigure(pic.el) : pic.kind === 'table' ? periodicTable(new Set(pic.els), false) : pic.kind === 'lewis' ? lewisFigure(pic) : pic.kind === 'pair' ? pairFigure(pic) : modelFigure(pic)
  return `<div class="mb-term-pic" data-pic="${pic.kind}" role="img" aria-label="${esc(label)}">${inner}</div>`
}

/** A term's card: its name, what the word means, an example with a picture, one thing to keep in mind, and the terms next to it. */
function termCardHtml(c: TermCard): string {
  return `<div class="mb-termcard-in">
    <div class="mb-termcard-top"><h3 id="mb-term-name">${esc(c.name)}</h3><button type="button" class="mb-termcard-x" data-term-close data-key="term-close" aria-label="${TERM_WORDS.close}">${ICON.cross}</button></div>
    ${c.also ? `<p class="mb-term-also">${esc(c.also)}</p>` : ''}
    <p class="mb-term-means">${esc(c.means)}</p>
    <section class="mb-term-ex"><h4>${TERM_WORDS.example}</h4>${termPicture(c.picture, c.pictureLabel)}<p>${esc(c.example)}</p></section>
    ${c.note ? `<section class="mb-term-note"><h4>${TERM_WORDS.note}</h4><p>${esc(c.note)}</p></section>` : ''}
    ${c.related.length ? `<nav class="mb-term-rel" aria-label="${TERM_WORDS.related}"><h4>${TERM_WORDS.related}</h4><div>${c.related.map((r) => `<button type="button" class="mb-term-go" data-term-go="${r.id}" data-key="term-go-${r.id}">${esc(r.name)}</button>`).join('')}</div></nav>` : ''}
  </div>`
}

// ---------------------------------------------------------------- panel pieces

function header(s: State): string {
  if (s.mode === 'free') {
    return `<header class="mb-head">${BUBBLES}<div><h1 class="mb-formula mb-formula-word">Free build</h1><p class="mb-name">Build any molecule or ion</p></div></header>`
  }
  const p = store.problemOf(s)
  // one atom of each kind in the molecule, in the order the formula names them
  const crew = `<span class="mb-crew" aria-hidden="true">${elementsOf(p).map((el) => ball(el)).join('')}</span>`
  return `<header class="mb-head">${BUBBLES}
    <div><h1 class="mb-formula" aria-label="${esc(formulaText(p))}">${formulaHtml(p)}</h1><p class="mb-name">${esc(titleOf(p))}</p></div>
    ${crew}
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
  return `<ol class="mb-rail" aria-label="Steps" style="--n:${STEPS.length};--p:${Math.min(open, STEPS.length - 1) / (STEPS.length - 1)}">${items}</ol>`
}

/** Main-group columns of the periodic table, periods 1 to 5, with the atoms in `mine` marked. */
export function periodicTable(mine: Set<string>, withValence: boolean): string {
  const groups = [1, 2, 13, 14, 15, 16, 17, 18]
  const rows = [
    ['H', '', '', '', '', '', '', 'He'],
    ['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
    ['K', 'Ca', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
    ['Rb', 'Sr', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
  ]
  const head = `<tr><th scope="row">Group</th>${groups.map((g) => `<th scope="col">${g}</th>`).join('')}</tr>`
  const val = withValence ? `<tr class="mb-pt-val"><th scope="row">Valence electrons</th>${groups.map((_, i) => `<td>${i + 1}</td>`).join('')}</tr>` : ''
  const body = rows.map((r) => `<tr><th scope="row"></th>${r.map((sym) => `<td${mine.has(sym) ? ' class="is-mine"' : ''}>${sym}</td>`).join('')}</tr>`).join('')
  return `<figure class="mb-pt"><table><thead>${head}${val}</thead><tbody>${body}</tbody></table>${withValence ? '<figcaption>Helium is the exception in group 18: it has 2.</figcaption>' : ''}</figure>`
}

function hints(s: State): string {
  const shown = store.currentHints(s)
  if (!shown.length) return ''
  const p = store.problemOf(s)
  // the periodic table goes with the hints about one atom's count; the hints about the total have no table
  const table = s.step === 'count' && !store.totalNext(s) ? periodicTable(new Set<string>(elementsOf(p)), shown.length >= 2) : ''
  const seen = new Set<string>()
  return `<div class="mb-hints" data-k="hints" data-kv="">${shown.map((h) => `<p class="mb-hint">${ICON.hint}<span>${rich(h, seen)}</span></p>`).join('')}${table}</div>`
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
      return `<div class="mb-row" data-k="row-${el}" data-kv="${c.tries[el] ?? 0}" data-state="${right ? 'right' : c.feedback[el] && !c.changed[el] ? 'wrong' : 'idle'}">
        ${ball(el)}<span class="mb-row-name">${cap(name)}</span>
        ${
          right
            ? `<span class="mb-row-val" data-k="value-${el}">${n}</span><span class="mb-mark" data-ok="true">${ICON.check}<span class="mb-sr">correct</span></span>`
            : `<div class="mb-stepper" role="group" aria-label="Valence electrons of ${name}" data-cue="count-${el}">
                <button data-act="count" data-el="${el}" data-d="-1" data-key="dec-${el}" aria-label="One fewer for ${name}" ${n <= 0 ? 'disabled' : ''}>−</button>
                <output aria-live="polite" data-k="count-${el}">${n}</output>
                <button data-act="count" data-el="${el}" data-d="1" data-key="inc-${el}" aria-label="One more for ${name}" ${n >= 8 ? 'disabled' : ''}>+</button>
              </div>`
        }
      </div>${coach(c.feedback[el])}`
    })
    .join('')

  let total = ''
  if (allRight) {
    total = c.totalRight
      ? `<div class="mb-total is-right" data-k="total" data-kv="right"><p class="mb-total-big"><b data-k="total-value">${totalElectrons(p)}</b> valence electrons</p><p class="mb-eq">${esc(totalSum(p))} = ${totalElectrons(p)}</p></div>`
      : `<div class="mb-total" data-k="total" data-kv="open">
          <label for="mb-total">${formulaHtml(p)} has ${esc(inventory(p))}. How many valence electrons is that in total?</label>
          <div class="mb-total-row" data-cue="total">
            <input id="mb-total" class="mb-num" type="text" inputmode="numeric" autocomplete="off" maxlength="2" data-key="total" value="${c.total ?? ''}" />
            <button class="mb-btn mb-btn-soft" data-act="total-check" data-key="total-check">Check the total</button>
          </div>
          ${coach(c.totalFeedback, p)}
        </div>`
  }
  return `<p class="mb-body">${rich("Valence electrons are the electrons in an atom's outer shell. Set the number for each atom.")}</p>
    <div class="mb-rows" data-k="rows" data-kv="">${rows}</div>
    ${allRight ? '' : `<button class="mb-btn mb-btn-soft" data-act="count-check" data-key="count-check" data-cue="count-check">Check my counts</button>`}
    ${total}`
}

function stepPlace(s: State, p: Problem): string {
  let question = ''
  if (middleNeeded(p)) {
    const chips = middleChoices(p)
      .map((el) => {
        const picked = s.middle.pick === el
        const state = picked ? (s.middle.right ? 'right' : 'wrong') : 'idle'
        return `<button class="mb-choice" data-act="middle" data-el="${el}" data-key="mid-${el}" data-state="${state}" ${s.middle.right ? 'disabled' : ''}>${ball(el, 'is-small')}<span>${cap(lower(el))}</span></button>`
      })
      .join('')
    question = `<p class="mb-q">Which atom goes in the middle?</p><div class="mb-choices" data-cue="middle">${chips}</div>${s.middle.right ? fb(s.middle.text, 'good') : coach(s.middle.coach)}`
  }
  const ready = !middleNeeded(p) || s.middle.right
  const { placed, of } = placedCount(p, s.s)
  const done = placed === of
  return `${question}
    ${
      ready
        ? `<p class="mb-body">${rich(placeInstruction(p))}</p>
           ${done ? '' : howBox(howTo('place', p))}
           ${fb(done ? `All ${of} atoms are on the board, each with its own valence electrons.` : `${placed} of ${of} atoms on the board.`, done ? 'good' : 'info')}`
        : ''
    }`
}

function stepBond(s: State, p: Problem): string {
  const st = bondStatus(p, s.s)
  return `<p class="mb-body">${rich(bondInstruction(p))}</p>${st.done ? '' : howBox(howTo('bond', p))}${fb(st.text, st.tone)}`
}

export function checklist(rows: CheckRow[]): string {
  return `<ul class="mb-checks" data-k="checks" data-kv="" data-cue="checks">${rows
    .map(
      (r) =>
        `<li data-state="${r.state}"><span class="mb-mark" data-ok="${r.state === 'pass'}" data-wait="${r.state === 'wait'}">${r.state === 'pass' ? ICON.check : r.state === 'fail' ? ICON.cross : ''}</span><span>${rich(r.text)}<span class="mb-sr">${r.state === 'pass' ? ' (done)' : r.state === 'fail' ? ' (not yet)' : ''}</span></span></li>`,
    )
    .join('')}</ul>`
}

function stepCheck(s: State, p: Problem): string {
  const notes = finishedNotes(p, s.s)
  const done = store.stepDone('check', s)
  return `<p class="mb-body">${rich('Count the electrons around each atom. Shared electrons count for both atoms in the bond.')}</p>
    ${checklist(checkRows(p, s.s))}
    ${done ? fb(`This is the Lewis structure of ${p.name}.`, 'good') : coach(checkCoach(p, s.s))}
    ${done ? '' : howBox(howTo('check', p))}
    ${notes.map((n) => `<p class="mb-note">${rich(n)}</p>`).join('')}`
}

/** The table of what is known about the molecule. `more` adds rows under the shape's three (polarity, bonds, hybridization). */
/** The table of results for a finished molecule. `pair` names the two atoms of a molecule of two
 *  atoms, which has no middle atom: its table leaves out the electron groups. */
export function readout(p: Problem | null, center: El, info: ShapeInfo, mixed: boolean, more: { label: string; value: string }[] = [], tryIt = true, pair: [El, El] | null = null): string {
  const r = shapeReadout(p, center, info, mixed, pair)
  return `<dl class="mb-readout">
      <div><dt>${rich('Molecular geometry')}</dt><dd class="is-big">${rich(cap(r.shape))}</dd></div>
      <div><dt>${rich('Electron geometry')}</dt><dd>${rich(cap(r.arrangement))}</dd></div>
      ${r.groups ? `<div><dt>${rich('Electron groups')}</dt><dd>${esc(r.groups)}</dd></div>` : ''}
      <div><dt>${rich('Bond angle')}</dt><dd>${esc(r.angle)}</dd></div>
      ${more.map((row) => `<div><dt>${rich(row.label)}</dt><dd>${esc(row.value)}</dd></div>`).join('')}
    </dl>
    ${r.why ? `<p class="mb-note" data-k="readout-why" data-kv="">${rich(r.why)}</p>` : ''}
    ${tryIt && !info.diatomic ? '<p class="mb-body mb-try">Drag an atom or a lone pair, then let go. The other groups move out of the way.</p>' : ''}`
}

/** The atoms of the bonds in question with the course table's electronegativity under each. */
export function enStrip(els: El[]): string {
  return `<figure class="mb-en" data-k="en" data-kv=""><figcaption>${rich(DIPOLE_WORDS.table)}</figcaption><ul>${els
    .map((el) => `<li>${ball(el, 'is-small')}<span>${esc(cap(lower(el)))}</span><b>${courseEN(el)}</b></li>`)
    .join('')}</ul></figure>`
}
/** A small dipole arrow, beside the line that says how to draw one. */
const DRAW_ICON = '<svg class="mb-draw-icon" viewBox="0 0 34 16" aria-hidden="true"><path d="M3 8h24M8 3.5v9"/><path class="is-head" d="M31.5 8l-8-4.6v9.2z"/></svg>'
/** What the arrows on the board are. */
function dipoleKey(net: boolean): string {
  return `<ul class="mb-key" data-k="dipole-key" data-kv="${net}"><li><i class="is-bond"></i>${rich(DIPOLE_WORDS.bondKey)}</li>${net ? `<li><i class="is-net"></i>${rich(DIPOLE_WORDS.netKey)}</li>` : ''}</ul>`
}

function stepPolar(s: State, p: Problem): string {
  const m = polarity(s.s)
  if (!m) return `<p class="mb-body">Finish the Lewis structure first.</p>`
  const asked = store.bondAsked(s)
  let html = enStrip([...new Set([m.center.el, ...m.kinds.map((k) => k.terminal)])])
  // each kind of bond folds down to its answer once it is right, so the answers stay in view
  for (const k of m.kinds) {
    const a = s.polar.bonds[k.terminal]
    if (a?.right) html += fb(a.text, 'good')
    else if (k.terminal === asked) {
      // a polar bond is answered on the board, by drawing its arrow; a nonpolar bond with the button
      const q = bondQuestion(k.center, k.terminal)
      const none = `<button class="mb-choice" data-act="bond-polar" data-el="${k.terminal}" data-answer="nonpolar" data-key="pol-${k.terminal}-nonpolar" data-cue="no-arrow" data-state="${a?.pick === 'nonpolar' ? 'wrong' : 'idle'}">${esc(q.none)}</button>`
      html += `<p class="mb-q">${rich(q.ask)}</p><p class="mb-body mb-sub">${rich(q.sub)}</p><p class="mb-body mb-draw">${DRAW_ICON}<span>${rich(q.draw)}</span></p><div class="mb-choices">${none}</div>${coach(a?.coach)}`
    }
  }
  if (asked !== null) return html
  const net = s.polar.net
  const shown = m.bonds.some((b) => b.out !== 0)
  if (net.pick === null) {
    const q = netQuestion(p)
    const chips = q.choices.map((c) => `<button class="mb-choice" data-act="net-polar" data-polar="${c.polar}" data-key="net-${c.polar ? 'polar' : 'nonpolar'}" data-state="idle">${esc(c.label)}</button>`).join('')
    return `${html}${shown ? dipoleKey(false) : ''}<p class="mb-q">${rich(q.ask)}</p><p class="mb-body mb-sub">${rich(q.sub)}</p><div class="mb-choices" data-cue="net">${chips}</div>`
  }
  html += net.right ? fb(net.text, 'good') : coach(net.coach)
  if (!m.polar) return `${html}${shown ? dipoleKey(false) : ''}`
  // a polar molecule: the student draws the net dipole on the 3D model
  const arrow = s.polar.arrow
  if (arrow.right) return `${html}${fb(arrow.text, 'good')}${dipoleKey(true)}`
  const q = netArrowQuestion(p)
  return `${html}${dipoleKey(false)}<p class="mb-q">${rich(q.ask)}</p><p class="mb-body mb-draw is-net">${DRAW_ICON}<span>${rich(q.draw)}</span></p>${coach(arrow.coach)}`
}

function stepOrbitals(s: State, p: Problem): string {
  const o = s.orbitals
  const info = shapeInfoFor(s.s)
  const f = groupFacts(s.s)
  if (!info || !f) return `<p class="mb-body">Finish the Lewis structure first.</p>`
  const q = sigmaPiQuestion(p)
  if (!o.counts.right) {
    const row = (kind: 'sigma' | 'pi', label: string, n: number) => `<div class="mb-row" data-k="row-${kind}" data-kv="${o.counts.tries}" data-state="idle">
        <span class="mb-row-name">${esc(label)}</span>
        <div class="mb-stepper" role="group" aria-label="${esc(label)}">
          <button data-act="bond-count" data-kind="${kind}" data-d="-1" data-key="dec-${kind}" aria-label="One fewer" ${n <= 0 ? 'disabled' : ''}>−</button>
          <output aria-live="polite" data-k="count-${kind}">${n}</output>
          <button data-act="bond-count" data-kind="${kind}" data-d="1" data-key="inc-${kind}" aria-label="One more" ${n >= 9 ? 'disabled' : ''}>+</button>
        </div>
      </div>`
    return `<p class="mb-q">${rich(q.ask)}</p><p class="mb-body mb-sub">${rich(q.sub)}</p>
      <div class="mb-rows" data-k="rows" data-kv="" data-cue="bond-counts">${row('sigma', q.sigma, o.sigma)}${row('pi', q.pi, o.pi)}</div>
      <button class="mb-btn mb-btn-soft" data-act="bonds-check" data-key="bonds-check">${esc(q.check)}</button>
      ${coach(o.counts.coach)}`
  }
  if (!o.hybrid.right) {
    const chips = HYBRIDS.map((h) => `<button class="mb-choice is-num" data-act="hybrid" data-h="${h}" data-key="hyb-${h}" data-state="${o.hybrid.pick === h ? 'wrong' : 'idle'}">${esc(hybridLabel(h))}</button>`).join('')
    return `${fb(o.counts.text, 'good')}<p class="mb-q">${rich(hybridQuestion(p.center))}</p><div class="mb-choices" data-cue="hybrid">${chips}</div>${coach(o.hybrid.coach)}`
  }
  return `${fb(o.counts.text, 'good')}${fb(o.hybrid.text, 'good')}${readout(p, p.center, info, mixedOuter(s.s), profile(p, s.s), false)}${fb(finishedLine(p), 'good')}`
}


function stepShape(s: State, p: Problem): string {
  const info = shapeInfoFor(s.s)
  if (!info) return `<p class="mb-body">Finish the Lewis structure first.</p>`
  const sh = s.shape
  // each question folds down to its answer once it is settled, so the result stays in view
  if (!sh.groupsRight) {
    const q = groupsQuestion(p.center)
    const groupChips = [2, 3, 4, 5, 6]
      .map((n) => `<button class="mb-choice is-num" data-act="groups" data-n="${n}" data-key="grp-${n}" data-state="${sh.groups === n ? 'wrong' : 'idle'}">${n}</button>`)
      .join('')
    return `<p class="mb-q">${rich(q.ask)}</p>
      <p class="mb-body mb-sub">${rich(q.sub)}</p>
      <div class="mb-choices" data-cue="groups">${groupChips}</div>
      ${coach(sh.groupsCoach)}`
  }
  if (!sh.geometryRight) {
    // the electron geometry: the student picks until it is right, and a wrong pick stays marked
    const q = geometryQuestion(p.center)
    const chips = geometryPicks(info)
      .map((name) => `<button class="mb-choice" data-act="geometry" data-name="${name}" data-key="geo-${name}" data-state="${sh.geometry === name ? 'wrong' : 'idle'}">${cap(name)}</button>`)
      .join('')
    return `${fb(sh.groupsFeedback, 'good')}
      <p class="mb-q">${rich(q.ask)}</p>
      <p class="mb-body mb-sub">${rich(q.sub)}</p>
      <div class="mb-choices" data-cue="geometry"><span class="mb-choices-name">${PICKS_NAME.geometry}</span>${chips}</div>
      ${coach(sh.geometryCoach)}`
  }
  if (!sh.pick) {
    const q = shapeQuestion(p.center)
    const chips = shapeChoices(info)
      .map((name) => `<button class="mb-choice" data-act="shape" data-name="${name}" data-key="shp-${name}" data-state="idle">${cap(name)}</button>`)
      .join('')
    return `${fb(sh.groupsFeedback, 'good')}${fb(sh.geometryFeedback, 'good')}
      <p class="mb-q">${rich(q.ask)}</p>
      <p class="mb-body mb-sub">${rich(q.sub)}</p>
      <div class="mb-choices" data-cue="shapes"><span class="mb-choices-name">${PICKS_NAME.shapes}</span>${chips}</div>`
  }
  return `${sh.pickRight ? fb(sh.pickFeedback, 'good') : coach(sh.pickCoach)}${readout(p, p.center, info, mixedOuter(s.s))}`
}

function freePanel(s: State): string {
  const a = assess(s.s)
  const info = a.complete ? shapeOf(s.s) : null
  const center = a.topology.kind === 'star' ? atomById(s.s, a.topology.center) : undefined
  const charge = a.charge === 0 ? '0' : chargeLabel(a.charge).replace(/^([+−])$/, '1$1')
  // a middle atom from period 3 onward that holds more than 8
  const held = center ? shellCount(s.s, center.id) : 0
  const note = a.complete && center && held > 8 ? `<p class="mb-note">${rich(`${cap(lower(center.el))} has ${held} electrons around it. Atoms from period 3 onward can hold more than 8.`)}</p>` : ''
  // a molecule of two atoms has no middle atom: the panel says so on the flat board, and the 3D table says it in place of the groups
  const pair: [El, El] | null = info?.diatomic && s.s.atoms.length === 2 ? [s.s.atoms[0]!.el, s.s.atoms[1]!.el] : null
  // the less electronegative atom first, as the bond is named
  const ordered: [El, El] | null = pair && bondPolarity(pair[0], pair[1]).positive === pair[1] ? [pair[1], pair[0]] : pair
  const shapeBlock =
    s.view === 'shape' && info && center
      ? `${readout(null, center.el, info, mixedOuter(s.s), profile(null, s.s), true, ordered)}`
      : `${ordered ? `<p class="mb-note" data-k="two-atoms" data-kv="">${rich(twoAtomsLine(ordered[0], ordered[1]))}</p>` : ''}
         <button class="mb-btn mb-btn-soft" data-act="view" data-view="shape" data-key="see-shape" ${info ? '' : 'disabled'}>See the 3D shape</button>
         ${
           a.complete && !info && s.s.atoms.length > 1
             ? `<p class="mb-note">${a.topology.kind === 'star' ? `This demo has no 3D shape for ${a.topology.terminals.length + Math.floor((center?.lone ?? 0) / 2)} electron groups.` : 'This demo shows 3D shapes only for molecules with one middle atom.'}</p>`
             : ''
         }`
  return `${howBox(howToFree())}
    ${checklist(checkRows(null, s.s))}
    ${s.s.atoms.length ? `<p class="mb-charge">Charge of everything on the board: <b>${charge}</b></p>` : ''}
    ${note}
    ${shapeBlock}
    ${freePolar(s, a.complete, info)}`
}

/** Free build: each element's electronegativity, each kind of bond worked from the table, and once
 *  every shell is full, whether the whole molecule is polar. Nothing is asked (D-0029). */
function freePolar(s: State, complete: boolean, info: ShapeInfo | null): string {
  if (!s.s.atoms.length) return ''
  const els = [...new Set(s.s.atoms.map((x) => x.el))]
  let html = enStrip(els)
  const kinds = bondKindsOn(s.s)
  if (!kinds.length) return html
  html += `<h3 class="mb-h3">${esc(FREE_POLAR_WORDS.bonds)}</h3><ul class="mb-pol" data-k="free-bonds" data-kv="${kinds.map((k) => `${k.a}${k.b}`).join(' ')}">${kinds
    .map((k) => `<li data-pol="${k.byCharge ? 'charge' : k.pol.kind}"><b>${esc(bondName(k.a, k.b))}</b><span>${rich(freeBondLine(k.a, k.b, k.pol, k.byCharge))}</span></li>`)
    .join('')}</ul>`
  const m = polarity(s.s)
  html += `<h3 class="mb-h3">${esc(FREE_POLAR_WORDS.net)}</h3>`
  // one middle atom with an odd electron has no dipoles worked out yet: that is a shell to fill, not a chain
  if (!m) return `${html}<p class="mb-note" data-k="free-wait" data-kv="">${rich(assess(s.s).topology.kind === 'star' ? FREE_POLAR_WORDS.notFull : FREE_POLAR_WORDS.notStar)}</p>`
  const arrows = m.bonds.some((b) => b.out !== 0)
  if (!complete) return `${html}<p class="mb-note" data-k="free-wait" data-kv="">${rich(FREE_POLAR_WORDS.notFull)}</p>${arrows ? dipoleKey(false) : ''}`
  return `${html}<p class="mb-body" data-k="free-net" data-kv="${m.depends ? 'depends' : m.polar}">${rich(freeNetLine(m, info))}</p>${arrows ? dipoleKey(freeNetShown(s, s.s)) : ''}`
}

function panel(s: State): string {
  // each screen highlights a term where it first appears
  termsSeen = new Set()
  termsPlain = plainTerms(s.mode === 'guided' ? s.step : null, s.mode === 'guided' && !s.shape.pick)
  termsMade = 0
  const part = PARTS[s.mode]
  if (part) return part.panel(s)
  if (s.mode === 'guided' && s.pickerOpen) return `${header(s)}${picker(s)}`
  if (s.mode === 'free') {
    return `${header(s)}<div class="mb-scroll"><div class="mb-step" tabindex="-1">${freePanel(s)}</div></div>`
  }
  const p = store.problemOf(s)
  const step = STEPS.find((x) => x.id === s.step)!
  const screens: Record<StepId, (s: State, p: Problem) => string> = { count: stepCount, place: stepPlace, bond: stepBond, check: stepCheck, shape: stepShape, polar: stepPolar, orbitals: stepOrbitals }
  const body = screens[s.step](s, p)
  const done = store.stepDone(s.step, s)
  const last = s.step === STEPS[STEPS.length - 1]!.id
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

/** True in the two guided steps that are about dipoles and bonding, where the board shows arrows in place of angle marks. */
const showsDipoles = (s: State) => s.mode === 'guided' && (s.step === 'polar' || s.step === 'orbitals')
/** The bond dipoles the board draws in those steps: each bond's arrow appears once that bond is
 *  answered right, and the net dipole once the student has drawn it the right way. Free build gives
 *  polarity as a row of its table and draws no arrows. */
function dipolesFor(s: State, st: Structure): SceneInput['dipoles'] {
  if (s.mode === 'free') {
    // free build: every polar bond's arrow as soon as it is on the board, and the net dipole on the 3D shape of a finished polar molecule
    const f = polarity(st)
    if (!f) return null
    const bonds = f.bonds.filter((b) => b.out !== 0).map((b) => ({ atomId: b.atomId, out: b.out as -1 | 1, size: b.size }))
    return bonds.length ? { center: f.center.id, bonds, net: freeNetShown(s, st), plus: DIPOLE_WORDS.plus, minus: DIPOLE_WORDS.minus, netLabel: DIPOLE_WORDS.net } : null
  }
  const m = showsDipoles(s) ? polarity(st) : null
  if (!m) return null
  const bonds = m.bonds.filter((b) => b.out !== 0 && s.polar.bonds[b.el]?.right).map((b) => ({ atomId: b.atomId, out: b.out as -1 | 1, size: b.size }))
  return { center: m.center.id, bonds, net: m.polar && s.polar.arrow.right, plus: DIPOLE_WORDS.plus, minus: DIPOLE_WORDS.minus, netLabel: DIPOLE_WORDS.net }
}
/** Free build draws the net dipole on the 3D shape of a finished polar molecule. Not when the answer
 *  depends on which corners unlike outer atoms take. */
function freeNetShown(s: State, st: Structure): boolean {
  if (s.mode !== 'free' || s.view !== 'shape') return false
  const m = polarity(st)
  return !!m && m.polar && !m.depends && assess(st).complete
}
/** What a student can draw on the board now, the last arrow that was drawn wrong, and what a
 *  screen reader says for each atom an arrow can start or end on. */
function drawFor(s: State, st: Structure): SceneInput['draw'] {
  const kind = store.drawing(s)
  const m = kind ? polarity(st) : null
  if (!kind || !m) return null
  const labels: Record<string, string> = {}
  if (kind === 'net') {
    labels[m.center.id] = netArrowLabel(m.center.el)
    return { kind, center: m.center.id, aim: s.polar.aim, wrong: s.polar.arrow.drawn ? { dir: s.polar.arrow.drawn } : null, labels, captions: {}, aims: aimWords(m) }
  }
  const started = s.selection?.kind === 'atom' ? s.selection.id : null
  const captions: Record<string, string> = {}
  for (const a of st.atoms) {
    labels[a.id] = arrowLabel(a.el, started !== null && started !== a.id)
    captions[a.id] = arrowCaption(a.el)
  }
  const asked = store.bondAsked(s)
  return { kind, center: m.center.id, aim: s.polar.aim, wrong: (asked && s.polar.bonds[asked]?.drawn) || null, labels, captions, aims: null }
}

/** The groups the board should ring after a wrong group count, while that question is still open. */
function ringGroups(s: State): SceneInput['point'] {
  const at = s.mode === 'guided' && s.step === 'shape' ? s.shape : null
  const c = !at ? null : !at.groupsRight ? at.groupsCoach : !at.geometryRight ? at.geometryCoach : null
  return c?.show?.kind === 'groups' ? { n: c.n, which: c.show.which } : null
}

// ---------------------------------------------------------------- stage chrome

function topbar(s: State, canExit: boolean): string {
  const tab = (mode: store.Mode, label: string) => `<button role="tab" aria-selected="${s.mode === mode}" data-act="mode" data-mode="${mode}" data-key="mode-${mode}">${label}</button>`
  const back = canExit ? `<button class="mb-back" data-act="exit" data-key="exit" aria-label="Back to all modules">${ICON.back}<span>Modules</span></button>` : ''
  return `<div class="mb-lead">${back}<div class="mb-brand"><b>Lewis structures and shapes</b></div></div>
    <div class="mb-modes" role="tablist" aria-label="Mode">${tab('guided', 'Guided')}${tab('free', 'Free build')}${OPEN_PARTS.map((mode) => tab(mode, PARTS[mode]!.tab)).join('')}</div>`
}

function ledger(s: State): string {
  const part = PARTS[s.mode]
  if (part?.ledger) return part.ledger(s)
  if (store.isSpecimen(s)) return ''
  const have = electronsOnBoard(s.s)
  const shared = sharedElectrons(s.s)
  const tile = (label: string, value: string, extra = '', state = '', lead = '') => `<div class="mb-tile" data-k="tile-box-${label}" data-kv="" data-state="${state}"><span class="mb-tile-l">${label}</span><span class="mb-tile-v">${lead}<b data-k="tile-${label}">${value}</b>${extra}</span></div>`
  const bead = '<i class="mb-bead" aria-hidden="true"></i>'
  let first: string
  if (s.mode === 'guided') {
    const p = store.problemOf(s)
    const need = totalElectrons(p)
    const { placed, of } = placedCount(p, s.s)
    const state = placed < of ? '' : have === need ? 'ok' : 'warn'
    first = tile('Electrons on the board', String(have), `<i>of ${need}</i>`, state, bead)
  } else first = tile('Electrons on the board', String(have), '', '', bead)
  const a = s.mode === 'free' && s.s.atoms.length ? assess(s.s) : null
  const chargeTile = a ? tile('Charge', a.charge === 0 ? '0' : `${Math.abs(a.charge)}${a.charge > 0 ? '+' : '−'}`) : ''
  const pairs = pairWords(s.s)
  const more = (text: string) => (text ? `<i class="mb-tile-more">${esc(text)}</i>` : '')
  return `${first}${tile('In bonds', String(shared), more(pairs.bonded))}${tile('Unshared', String(have - shared), more(pairs.lone))}${chargeTile}`
}

/** The three checks, in a strip that stays under the counter in every step that has a board:
 *  a mark, a name, and a count where the check has one. The full sentence is there for a screen
 *  reader and as a tooltip. */
function checkbar(s: State): string {
  const part = PARTS[s.mode]
  if (part?.checks) return part.checks(s)
  if (store.isSpecimen(s)) return ''
  // before the check step an ion's charge has not been dealt with yet, so its electron total waits
  return checkChips(s.mode === 'guided' ? store.problemOf(s) : null, s.s, s.mode === 'guided' && (s.step === 'place' || s.step === 'bond'))
    .map(
      (c) =>
        `<li class="mb-chk" data-k="chk-${c.id}" data-kv="${c.state}" data-state="${c.state}" title="${esc(c.says)}"><span class="mb-mark" data-ok="${c.state === 'pass'}" data-wait="${c.state === 'wait'}">${
          c.state === 'pass' ? ICON.check : c.state === 'fail' ? ICON.cross : ''
        }</span><span class="mb-chk-l" aria-hidden="true">${esc(c.label)}</span><span class="mb-chk-s" aria-hidden="true">${esc(c.short)}</span>${c.value ? `<b aria-hidden="true">${esc(c.value)}</b>` : ''}<span class="mb-sr">${esc(c.says)}${
          c.state === 'pass' ? ' (done)' : c.state === 'fail' ? ' (not yet)' : ''
        }</span></li>`,
    )
    .join('')
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
    return `<div class="mb-sel" data-k="selection" data-kv="${atom.id}">
      ${ball(atom.el)}
      <div class="mb-sel-text"><b>${name}</b><span>${report && report.count > report.target && report.status === 'full' ? report.count : `${report?.count ?? 0} of ${report?.target ?? 8}`} electrons${showCharge ? `<span class="mb-sel-fc">, formal charge ${esc(formalChargeSum(st, atom.id))}</span>` : ''}${s.mode === 'free' ? `<span class="mb-sel-fc">, electronegativity ${courseEN(atom.el)}</span>` : ''}</span></div>
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
  return `<div class="mb-sel" data-k="selection" data-kv="${bond.id}">
    <div class="mb-sel-text"><b>${ELEMENTS[A.el].name}–${ELEMENTS[B.el].name.toLowerCase()} ${kind} bond</b><span>${bond.order * 2} shared electrons${s.mode === 'free' ? `, ΔEN ${bondPolarity(A.el, B.el).delta}` : ''}</span></div>
    <div class="mb-sel-acts">
      <button class="mb-btn mb-btn-soft" data-act="bond-plus" data-key="bond-plus" ${bond.order >= 3 ? 'disabled' : ''}>Add a bond</button>
      <button class="mb-btn mb-btn-soft" data-act="bond-minus" data-key="bond-minus">Remove a bond</button>
    </div>
  </div>`
}

function dock(s: State): string {
  const part = PARTS[s.mode]
  if (part?.dock) return part.dock(s)
  if (store.isSpecimen(s)) return ''
  const canEdit = store.editable(s)
  const tools = `<div class="mb-tools">
      <button class="mb-icon" data-act="undo" data-key="undo" ${canEdit && s.past.length ? '' : 'disabled'} aria-label="Undo">${ICON.undo}<span>Undo</span></button>
      <button class="mb-icon" data-act="clear" data-key="clear" data-bin="${esc(BIN_WORDS)}" ${s.s.atoms.length ? '' : 'disabled'} aria-label="Clear the board">${ICON.clear}<span>Clear</span></button>
    </div>`
  // Guided: the switch appears once the shape has been revealed. Free build: only while the 3D
  // shape is showing (the panel's "See the 3D shape" button opens it), so the tray keeps its room.
  const canShape = s.mode === 'guided' ? store.onModel(s) : s.view === 'shape'
  const views = canShape
    ? `<div class="mb-views" role="tablist" aria-label="View">
        <button role="tab" aria-selected="${s.view === 'flat'}" data-act="view" data-view="flat" data-key="view-flat">Flat drawing</button>
        <button role="tab" aria-selected="${s.view === 'shape'}" data-act="view" data-view="shape" data-key="view-shape" data-cue="view-shape">3D shape</button>
      </div>`
    : ''
  let middle = ''
  let kind = s.selection && canEdit ? 'selection' : 'tray'
  // On the lifted model, a middle atom with a lone pair has two geometries, and the switch shows
  // either one. It waits for the lift, so it never answers a question asked before the lift.
  const lifted = canShape && s.view === 'shape' ? shapeOf(store.boardStructure(s)) : null
  if (lifted && !lifted.diatomic && lifted.lonePairs > 0 && store.canSwitchGroups(s)) {
    const choice = (v: 'all' | 'atoms') =>
      `<button role="tab" aria-selected="${s.groupsView === v}" data-act="groups-view" data-groups="${v}" data-key="groups-${v}">${GROUPS_VIEW_WORDS[v]}</button>`
    middle = `<div class="mb-views mb-groups" role="tablist" aria-label="${GROUPS_VIEW_WORDS.label}">${choice('all')}${choice('atoms')}</div>`
    kind = 'groups'
  } else if (s.selection && canEdit) middle = selectionCard(s, s.s)
  else if (canEdit) {
    const items = store.trayItems(s).filter((x) => x.n > 0)
    if (items.length) {
      middle = `<div class="mb-tray" data-k="tray" data-kv="" role="group" aria-label="Atoms to put on the board">${items
        .map(
          ({ el, n }) =>
            `<button class="mb-chip" data-tray="${el}" data-key="tray-${el}" aria-label="Put ${n === Infinity ? 'a' : n === 1 ? 'the' : 'a'} ${lower(el)} atom on the board${Number.isFinite(n) && n > 1 ? ` (${n} left)` : ''}">${ball(el)}${Number.isFinite(n) && n > 1 ? `<span class="mb-chip-n">×${n}</span>` : ''}</button>`,
        )
        .join('')}</div>`
    }
  }
  return `${tools}<div class="mb-dock-mid" data-kind="${kind}">${middle}</div>${views}`
}

/** Everything in a redrawn region that moves once when it appears: numbers that pop, boxes that
 *  rise, answers and cards that shake or flash. */
const ONE_SHOT = '.mb-stepper output, .mb-row, .mb-row-val, .mb-tile-v b, .mb-total-big b, .mb-fb, .mb-choice, .mb-sel, .mb-picker, .mb-chk'
/** The pieces of each redrawn region that leave and arrive like bubbles: in the panel, each chunk
 *  of a step's text, each row of the checklist, each hint, and the cards under the counters. Above
 *  the board, the tiles of the electron counter. Under it, the atom tray or the card for a
 *  selected atom, and the switch between the flat drawing and the 3D shape. */
const PIECES: Record<string, string> = {
  panel: '.mb-step > *, .mb-checks > li, .mb-rows > .mb-fb, .mb-total > .mb-fb, .mb-hints > *',
  ledger: '.mb-tile',
  dock: '.mb-dock-mid > *, .mb-views',
}
/** Counter rows sit between pieces (a card can open under one), so they slide with the pieces when the text around them grows or shrinks. */
const SLIDES_TOO = ', .mb-rows > .mb-row'
const MARKS = new Set(['is-same', 'is-new'])
/** What kind of thing an element is. `data-k` names an element that has twins (the count for
 *  carbon, the count for hydrogen) or whose text changes in place (the list of checks). */
const kindOf = (node: HTMLElement) => node.dataset.k ?? [...node.classList].filter((c) => !MARKS.has(c)).join(' ')
/** What an element is and what it shows: its kind, its state and its text. `data-kv` stands in
 *  for the text when the value is something else, and an empty `data-kv` marks a box that stays
 *  the same box whatever is inside it (the row of counters, the checklist, a tile). */
const stamp = (node: HTMLElement) => (node.dataset.kv === '' ? kindOf(node) : `${kindOf(node)}|${node.dataset.state ?? ''}|${node.dataset.kv ?? node.textContent ?? ''}`)
/** Of the listed elements, the ones that are not inside another one in the list. */
const outermost = <T extends { node: HTMLElement }>(list: T[]) => list.filter((x) => !list.some((y) => y !== x && y.node.contains(x.node)))

// ---------------------------------------------------------------- mount

/** Put the module on the page inside `root`. Returns a function that takes it down again. */
export function mount(root: HTMLElement, opts: MountOptions = {}): () => void {
  root.classList.add('mb')
  for (const [name, value] of Object.entries(cssVars())) root.style.setProperty(name, value)
  const off = new AbortController()
  const on = { signal: off.signal }
  if (opts.solved?.length) store.mergeSolved(opts.solved)
  // a part that is not open yet starts in the guided steps
  if (opts.start && (!PARTS[opts.start] || OPEN_PARTS.includes(opts.start))) store.setMode(opts.start)
  let solvedTold = store.getState().solved.length
  root.innerHTML = `
    <section class="mb-stage" aria-label="Board">
      <div class="mb-sky" aria-hidden="true"><i class="mb-blob"></i><i class="mb-blob"></i><i class="mb-blob"></i>${[
        [7, 22, 19, 0],
        [18, 12, 24, -9],
        [31, 30, 17, -4],
        [46, 14, 22, -15],
        [63, 24, 20, -11],
        [78, 16, 26, -2],
        [90, 34, 18, -7],
      ]
        .map(([x, d, sec, wait]) => `<i class="mb-bub" style="--x:${x}%;--d:${d}px;--t:${sec}s;--w:${wait}s"></i>`)
        .join('')}</div>
      <div class="mb-canvas-wrap"></div>
      <div class="mb-overlay"></div>
      <div class="mb-top"></div>
      <div class="mb-center"><div class="mb-ledger" role="group" aria-label="Electrons"></div><ul class="mb-checkbar" aria-label="Checks"></ul><p class="mb-toast" role="status"></p></div>
      <div class="mb-dock"></div>
    </section>
    <aside class="mb-panel" aria-label="Guide"></aside>
    <div class="mb-fx" aria-hidden="true"></div>
    <div class="mb-termscrim" hidden></div>
    <div class="mb-termcard" role="dialog" aria-modal="false" aria-labelledby="mb-term-name" tabindex="-1" hidden></div>`
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const stage = q('.mb-stage')
  const wrap = q('.mb-canvas-wrap')
  const regions = { top: q('.mb-top'), ledger: q('.mb-ledger'), checks: q('.mb-checkbar'), dock: q('.mb-dock'), panel: q('.mb-panel') }
  const toastEl = q('.mb-toast')
  const fx = q('.mb-fx')
  const lastHtml: Record<string, string> = {}
  const opened = performance.now()
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const termEl = q('.mb-termcard')
  const termScrim = q('.mb-termscrim')
  /** The key term whose card is open, and the highlighted word it was opened from. */
  let termOpen: { id: TermId; from: HTMLElement | null } | null = null

  // The atoms drawn in the panel and the tray look toward the pointer, like the ones on the board.
  let pointerAt: { x: number; y: number } | null = null
  let aiming = 0
  const aimEyes = () => {
    aiming = 0
    for (const eyes of root.querySelectorAll<HTMLElement>('.mb-eyes')) {
      let lx = 0
      let ly = 0
      if (pointerAt) {
        const r = eyes.getBoundingClientRect()
        const dx = pointerAt.x - (r.left + r.width / 2)
        const dy = pointerAt.y - (r.top + r.height / 2)
        const far = Math.hypot(dx, dy)
        if (far > 1) {
          const reach = Math.min(1, far / 90)
          lx = (dx / far) * reach
          ly = (dy / far) * reach
        }
      }
      eyes.style.setProperty('--lx', lx.toFixed(2))
      eyes.style.setProperty('--ly', ly.toFixed(2))
    }
  }
  const aimSoon = () => {
    if (!aiming) aiming = requestAnimationFrame(aimEyes)
  }
  root.addEventListener('pointermove', (e) => {
    pointerAt = { x: e.clientX, y: e.clientY }
    aimSoon()
  }, on)
  root.addEventListener('pointerleave', () => {
    pointerAt = null
    aimSoon()
  }, on)

  /** Throw `n` paper pieces up from a point on the page. */
  const confetti = (x: number, y: number, n: number, spread: number) => {
    if (calm) return
    const box = root.getBoundingClientRect()
    const colors = ['var(--butter)', 'var(--straw)', 'var(--grape)', 'var(--mint-deep)', 'var(--sky-blue)', 'var(--butter-deep)']
    for (let i = 0; i < n; i++) {
      const piece = document.createElement('i')
      const dx = (Math.random() - 0.5) * 2 * spread
      const up = -(60 + Math.random() * spread * 0.9)
      piece.style.cssText = `left:${x - box.left}px;top:${y - box.top}px;background:${colors[i % colors.length]};--dx:${dx.toFixed(0)}px;--up:${up.toFixed(0)}px;--down:${(up + 150 + Math.random() * 130).toFixed(0)}px;--rot:${((Math.random() - 0.5) * 900).toFixed(0)}deg;animation-delay:${(Math.random() * 90).toFixed(0)}ms`
      piece.addEventListener('animationend', () => piece.remove(), { once: true })
      fx.appendChild(piece)
    }
  }
  /** A step was just finished: the atoms hop, paper flies from the button that leads on, and the button bounces. */
  const celebrate = (last: boolean) => {
    opts.onFeel?.('done')
    scene.cheer()
    if (calm) return
    const next = regions.panel.querySelector<HTMLElement>('.mb-btn-main')
    if (next) {
      const r = next.getBoundingClientRect()
      confetti(r.left + r.width / 2, r.top + 8, last ? 34 : 14, last ? 240 : 130)
      next.animate([{ scale: '1 1' }, { scale: '1.06 0.9', offset: 0.3 }, { scale: '0.97 1.08', offset: 0.6 }, { scale: '1 1' }], { duration: 520, easing: 'ease-out' })
    }
    if (last) {
      const s = stage.getBoundingClientRect()
      confetti(s.left + s.width / 2, s.top + s.height * 0.45, 40, Math.min(360, s.width * 0.45))
    }
  }

  /** True when a point on the page is on the bin (the Clear button), with some room around it. */
  const overBin = (x: number, y: number) => {
    const r = regions.dock.querySelector('[data-key="clear"]')?.getBoundingClientRect()
    return !!r && r.width > 0 && x >= r.left - 18 && x <= r.right + 18 && y >= r.top - 18 && y <= r.bottom + 18
  }
  let scene: Scene
  try {
    scene = new Scene(wrap, q('.mb-overlay'), store.positions, {
      tapAtom: (id, key) => store.tapAtom(id, key),
      tapBond: (id) => store.tapBond(id),
      tapEmpty: () => store.clearSelection(),
      bond: (a, b) => store.bond(a, b),
      cut: (id) => store.unbond(id),
      // the bin: while an atom is carried, the Clear button opens up as the place to drop it
      carry: (id, x, y) => {
        regions.dock.classList.toggle('is-binning', id !== null)
        regions.dock.classList.toggle('is-bin-hot', id !== null && overBin(x, y))
      },
      drop: (id, x, y) => {
        if (!overBin(x, y)) return false
        store.remove(id)
        return true
      },
      drawBond: (from, to) => store.drawBondArrow(from, to),
      drawNet: (drawn, seen, world) => store.drawNetArrow(drawn, seen, world),
      place: (el, at) => store.place(el, at),
      remove: (id) => store.remove(id),
      feel: (kind) => opts.onFeel?.(kind),
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

  // ---------------------------------------------------------------- where to look next
  //
  // The place of the student's next action glows, and a pointing hand shows it: it points at a
  // question in the panel, and on the board it acts out the drag the step needs. All of it is
  // drawn in the layer over the page, so no control's own styles or animations are touched, and
  // it is placed again on every frame, because the model turns and the panel scrolls.
  const halos: HTMLElement[] = []
  const hand = document.createElement('span')
  hand.className = 'mb-finger'
  hand.innerHTML = `<svg viewBox="0 0 48 60" aria-hidden="true">${HAND}</svg>`
  const carried = document.createElement('span')
  carried.className = 'mb-cue-ball'
  const trail = document.createElement('span')
  trail.className = 'mb-cue-line'
  fx.append(trail, carried, hand)
  /** The fingertip inside the hand's 38 by 48 box. */
  const TIP = { x: 17.2, y: 2.6 }
  let cueNow: store.Cue | null = null
  let cueKey = ''
  let cueAt = performance.now()
  let cueRaf = 0
  let pressed = false
  /** For tests: what the layer showed on its last frame. */
  let cueShown: { halos: { x: number; y: number; w: number; h: number }[]; hand: 'off' | 'point' | 'demo' } = { halos: [], hand: 'off' }
  const radii = new WeakMap<Element, number>()
  const arrived = new WeakSet<Element>()
  /** The cue whose question was last scrolled fully into view, so the panel scrolls once for it and leaves the student's own scrolling alone. */
  let cueBrought = ''

  const setCue = (c: store.Cue | null) => {
    const key = JSON.stringify(c)
    if (key !== cueKey) {
      cueKey = key
      cueAt = performance.now()
      // a new cue may scroll its question into view again, even when it repeats an earlier one (the next molecule's)
      cueBrought = ''
    }
    cueNow = c
  }
  /** A glow around a box on the page, in the layer's own coordinates. */
  const glow = (i: number, left: number, top: number, width: number, height: number, radius: number) => {
    let el = halos[i]
    if (!el) {
      el = document.createElement('span')
      el.className = 'mb-halo'
      fx.prepend(el)
      halos[i] = el
    }
    // styles are written only when the box has moved or changed size: most frames nothing has
    const box = `${left.toFixed(1)},${top.toFixed(1)},${width.toFixed(1)},${height.toFixed(1)},${radius.toFixed(1)}`
    if (el.dataset.box !== box) {
      el.dataset.box = box
      el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
      el.style.width = `${width.toFixed(1)}px`
      el.style.height = `${height.toFixed(1)}px`
      el.style.borderRadius = `${radius.toFixed(1)}px`
    }
    el.classList.add('is-on')
    cueShown.halos.push({ x: left, y: top, w: width, h: height })
  }
  /** The hand with its fingertip at a point, pointing along `deg` (0 is to the right, 90 is down). */
  const pointAt = (x: number, y: number, deg: number, how: 'point' | 'demo', scale = 1, opacity = 1) => {
    const at = `translate(${(x - TIP.x).toFixed(1)}px, ${(y - TIP.y).toFixed(1)}px) rotate(${(deg + 90).toFixed(1)}deg) scale(${scale.toFixed(3)})`
    if (hand.style.transform !== at) hand.style.transform = at
    const seen = opacity.toFixed(2)
    if (hand.style.opacity !== seen) hand.style.opacity = seen
    hand.classList.toggle('is-poking', how === 'point')
    cueShown.hand = how
  }
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
  /** One round of a drag acted out by the hand, from A to B: it comes down on A, presses, moves to
   *  B, lets go and fades. `t` is seconds into the round. Returns how far along the way it is, 0 to 1. */
  const actOut = (t: number, a: { x: number; y: number }, b: { x: number; y: number }, size = 1): number => {
    const go = t < 0.75 ? 0 : t > 1.95 ? 1 : ease((t - 0.75) / 1.2)
    const x = a.x + (b.x - a.x) * go
    const y = a.y + (b.y - a.y) * go
    const fade = t < 0.3 ? t / 0.3 : t > 2.35 ? Math.max(0, 1 - (t - 2.35) / 0.35) : 1
    const down = t > 0.45 && t < 2.1
    // the hand comes in from the lower right, so it never covers what it presses on
    pointAt(x, y + (t < 0.45 ? (0.45 - t) * 30 : 0), -118, 'demo', size * (down ? 0.9 : 1), fade)
    return go
  }
  /** The hand's size beside an atom drawn with this radius: smaller on a phone, where the atoms are small. */
  const sized = (r: number) => Math.max(0.62, Math.min(1.25, r / 30))
  const ROUND = 3.3

  const tickCue = (now: number) => {
    cueRaf = requestAnimationFrame(tickCue)
    cueShown = { halos: [], hand: 'off' }
    const box = root.getBoundingClientRect()
    const age = (now - cueAt) / 1000
    const c = cueNow
    let handOn = false
    let carry: { x: number; y: number; size: number; el: El } | null = null
    let line: { a: { x: number; y: number }; b: { x: number; y: number }; go: number } | null = null
    // the hand waits for the new step's text to arrive, and stays away while the student is acting
    const handFree = age > 0.7 && !pressed && !scene.busy && !termOpen
    const round = calm ? 1.2 : ((age - 0.7) % ROUND + ROUND) % ROUND
    const circle = (at: { x: number; y: number; r: number }, pad = 7) => glow(cueShown.halos.length, at.x - box.left - at.r - pad, at.y - box.top - at.r - pad, (at.r + pad) * 2, (at.r + pad) * 2, at.r + pad)
    const rel = (p: { x: number; y: number }) => ({ x: p.x - box.left, y: p.y - box.top })
    const elOf = (id: string) => store.getState().s.atoms.find((a) => a.id === id)?.el

    /** The glow on a control in the panel or under the board, and with `withHand` the hand that
     *  points at it from the left. False when the control is not there to point at. */
    const controlGlow = (el: HTMLElement | null, withHand: boolean): boolean => {
      const r = el?.getBoundingClientRect()
      // inside the panel the text scrolls: a question that is scrolled out of view gets no glow
      const view = el?.closest('.mb-scroll')?.getBoundingClientRect()
      // a piece that is still blowing up into place is not there to point at yet: settle() marks it,
      // and while its entrance runs it is not fully opaque
      let arriving = false
      for (let up: HTMLElement | null = el; up && up !== root && !arriving; up = up.parentElement) arriving = up.style.pointerEvents === 'none'
      const piece = el?.closest<HTMLElement>('.is-new')
      if (piece && !arriving && !arrived.has(piece)) {
        arriving = parseFloat(getComputedStyle(piece).opacity) < 0.95
        // once a piece has arrived it is not measured again
        if (!arriving) arrived.add(piece)
      }
      if (!el || !r || r.width === 0 || arriving || (view && (r.bottom < view.top + 12 || r.top > view.bottom - 12))) return false
      // the panel scrolled to the question while it was still growing into place, so a tall block of
      // choices can end up cut off at the bottom (5 long names on a phone): once it has arrived, bring all of it into view
      // with a margin, so its glow is not cut by the edge
      const margin = 12
      if (view && withHand && cueBrought !== cueKey && r.height < view.height - margin * 2 && (r.top < view.top + 2 || r.bottom > view.bottom - margin)) {
        cueBrought = cueKey
        const by = r.top < view.top + 2 ? r.top - view.top - margin : r.bottom - view.bottom + margin
        el.closest('.mb-scroll')?.scrollBy({ top: by, behavior: 'smooth' })
      }
      let radius = radii.get(el)
      if (radius === undefined) {
        radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14, r.height / 2)
        radii.set(el, radius)
      }
      const pad = 5
      const top = Math.max(r.top - pad, view ? view.top + 2 : -Infinity)
      const bottom = Math.min(r.bottom + pad, view ? view.bottom - 2 : Infinity)
      glow(cueShown.halos.length, r.left - pad - box.left, top - box.top, r.width + pad * 2, bottom - top, radius + pad)
      // The hand points at a control from the left, where there is room beside the panel. On a phone
      // the panel fills the width and the hand would cover the words beside the control: the glow
      // does the job there.
      if (!withHand || !handFree || box.width <= 880 || r.left - pad - box.left <= 34) return true
      const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 24), top + 8), bottom - 8)
      pointAt(r.left - pad - 2 - box.left, y - box.top, 0, 'point')
      handOn = true
      return true
    }

    if (c && age > 0.25) {
      if (c.kind === 'ask' || c.kind === 'next') {
        controlGlow(c.kind === 'next' ? regions.panel.querySelector<HTMLElement>('.mb-btn-main:not([disabled])') : root.querySelector<HTMLElement>(`[data-cue="${c.key}"]`), c.kind === 'ask')
      } else if (c.kind === 'tray') {
        const chip = regions.dock.querySelector<HTMLElement>(`[data-tray="${c.el}"]`)
        const r = chip?.getBoundingClientRect()
        // on a phone, free build's row of atoms scrolls sideways: a chip that is scrolled out of the row is not pointed at
        const row = chip?.closest('.mb-tray')?.getBoundingClientRect()
        if (r && r.width > 0 && (!row || (r.left >= row.left - 4 && r.right <= row.right + 4))) {
          const at = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }
          circle(at, 5)
          if (handFree) {
            if (c.demo && !calm) {
              const go = actOut(round, rel(at), rel(scene.boardOnPage()), sized(at.r))
              if (round > 0.45 && round < 2.35) carry = { ...rel({ x: at.x + (scene.boardOnPage().x - at.x) * go, y: at.y + (scene.boardOnPage().y - at.y) * go }), size: r.width * 0.86, el: c.el }
            } else pointAt(at.x - box.left, r.top - 4 - box.top, 90, 'point', sized(at.r))
            handOn = true
          }
        }
      } else if (c.kind === 'drag' || c.kind === 'arrow') {
        const a = scene.atomOnPage(c.kind === 'drag' ? c.from : c.a)
        const b = scene.atomOnPage(c.kind === 'drag' ? c.to : c.b)
        if (a && b) {
          circle(a)
          circle(b)
          if (c.kind === 'arrow') for (const id of c.also) { const o = scene.atomOnPage(id); if (o) circle(o) }
          // a bond's question has a third answer, the button for a bond with no arrow: it glows with the atoms
          const button = c.kind === 'arrow' ? root.querySelector<HTMLElement>(`[data-cue="${c.key}"]`) : null
          // the hand takes the answers in turn: the arrow one way, the arrow the other way, the button
          const turn = c.kind === 'arrow' ? (Math.floor(Math.max(0, age - 0.7) / ROUND) + c.first) % 3 : 0
          const atButton = turn === 2 && !calm && !!button && controlGlow(button, true)
          if (button && turn !== 2) controlGlow(button, false)
          if (handFree && !atButton) {
            if (calm) pointAt(a.x + a.r * 0.7 - box.left, a.y + a.r * 0.7 - box.top, -135, 'point', sized(a.r))
            else if (c.kind === 'drag') {
              const go = actOut(round, rel(a), rel(b), sized(a.r))
              const el = elOf(c.from)
              if (el && round > 0.45 && round < 2.35) carry = { x: a.x + (b.x - a.x) * go - box.left, y: a.y + (b.y - a.y) * go - box.top, size: a.r * 2, el }
            } else {
              // a bond's arrow: one round from the middle atom out, another one back, so neither way is shown as the answer
              // (on a phone, or with the button out of view, the button's turn is one more arrow)
              const back = turn === 1 || (turn === 2 && Math.floor(Math.max(0, age - 0.7) / ROUND) % 2 === 1)
              const [from, to] = back ? [b, a] : [a, b]
              const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
              const ux = (to.x - from.x) / len
              const uy = (to.y - from.y) / len
              const start = { x: from.x + ux * from.r * 0.5, y: from.y + uy * from.r * 0.5 }
              const end = { x: to.x - ux * to.r * 0.5, y: to.y - uy * to.r * 0.5 }
              const go = actOut(round, rel(start), rel(end), sized(a.r))
              if (round > 0.6 && round < 2.6) line = { a: rel(start), b: rel(end), go }
            }
            handOn = true
          }
        }
      } else if (c.kind === 'atoms' || c.kind === 'aim') {
        const ids = c.kind === 'aim' ? [c.id] : c.ids
        const at = ids.map((id) => scene.atomOnPage(id)).filter((x): x is { x: number; y: number; r: number } => !!x)
        for (const a of at) circle(a)
        if (c.kind === 'atoms' && c.key) controlGlow(root.querySelector<HTMLElement>(`[data-cue="${c.key}"]`), false)
        const first = at[0]
        if (first && handFree) {
          const aims = c.kind === 'aim' && !calm ? scene.aimsOnPage() : []
          if (aims.length) {
            // the net dipole: the hand drags from the middle atom to each aim point in turn
            const to = aims[Math.floor((age - 0.7) / ROUND) % aims.length]!
            const go = actOut(round, rel(first), rel(to), sized(first.r))
            if (round > 0.6 && round < 2.6) line = { a: rel(first), b: rel(to), go }
          } else pointAt(first.x + first.r * 0.72 - box.left, first.y + first.r * 0.72 - box.top, -135, 'point', sized(first.r))
          handOn = true
        }
      }
    }
    for (let i = cueShown.halos.length; i < halos.length; i++) halos[i]!.classList.remove('is-on')
    hand.classList.toggle('is-on', handOn)
    if (!handOn) hand.style.opacity = ''
    carried.classList.toggle('is-on', !!carry)
    if (carry) {
      if (carried.dataset.el !== carry.el) {
        carried.dataset.el = carry.el
        carried.innerHTML = ball(carry.el)
      }
      carried.style.transform = `translate(${(carry.x - 23).toFixed(1)}px, ${(carry.y - 23).toFixed(1)}px) scale(${(carry.size / 46).toFixed(3)})`
    }
    trail.classList.toggle('is-on', !!line)
    if (line) {
      const dx = line.b.x - line.a.x
      const dy = line.b.y - line.a.y
      trail.style.width = `${(Math.hypot(dx, dy) * Math.max(0.02, line.go)).toFixed(1)}px`
      trail.style.transform = `translate(${line.a.x.toFixed(1)}px, ${(line.a.y - 2.5).toFixed(1)}px) rotate(${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1)}deg)`
    }
  }
  cueRaf = requestAnimationFrame(tickCue)
  root.addEventListener('pointerdown', () => (pressed = true), on)
  window.addEventListener('pointerup', () => (pressed = false), on)
  window.addEventListener('pointercancel', () => (pressed = false), on)
  window.addEventListener('blur', () => (pressed = false), on)
  // a mouse button let go outside the window never sends its pointerup here: the next move shows it is up
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) pressed = false
  }, on)

  /** The module's style rules, copied once into a sheet a shadow root can use. Null where the browser can't do that. */
  let ghostSheet: CSSStyleSheet | null | undefined
  const ghostStyles = (): CSSStyleSheet | null => {
    if (ghostSheet !== undefined) return ghostSheet
    ghostSheet = null
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules = ''
        try {
          rules = Array.from(sheet.cssRules, (r) => r.cssText).join('\n')
        } catch {
          continue // a sheet from another site can't be read
        }
        if (!rules.includes('.mb-step')) continue
        const copy = new CSSStyleSheet()
        copy.replaceSync(rules)
        ghostSheet = copy
        break
      }
    } catch {
      ghostSheet = null
    }
    return ghostSheet
  }
  /** Pieces that just left a region. Each one is drawn once more where it was, sags and shrinks
   *  to nothing, and a few small bubbles burst out of it. The old pieces are moved into a closed
   *  shadow root for this, so nothing that looks for the page's text (a test, a screen reader,
   *  this file) can find them. `view` is the part of the region that was on screen. */
  const deflate = (el: HTMLElement, gone: { node: HTMLElement; rect: DOMRect }[], view: DOMRect) => {
    const box = root.getBoundingClientRect()
    const sheet = ghostStyles()
    if (sheet) {
      const host = document.createElement('span')
      host.className = 'mb-ghost'
      // a picture of text that is already gone: nothing for a screen reader or the keyboard
      host.setAttribute('aria-hidden', 'true')
      host.inert = true
      host.style.cssText = `left:${view.left - box.left}px;top:${view.top - box.top}px;width:${view.width}px;height:${view.height}px`
      const shadow = host.attachShadow({ mode: 'closed' })
      shadow.adoptedStyleSheets = [sheet]
      // An empty copy of each ancestor the piece had, so the same style rules still reach it. The
      // copies take up the whole picture and draw nothing themselves.
      const bare = 'position:absolute;left:0;top:0;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;display:block;overflow:visible;min-width:0;min-height:0;max-width:none;max-height:none;animation:none;transform:none;translate:none;scale:none;opacity:1;list-style:none'
      const shell = (tag: string, cls: string) => {
        const node = document.createElement(tag)
        node.className = cls
        node.style.cssText = bare
        return node
      }
      const top = shell('div', 'mb')
      shadow.appendChild(top)
      gone.forEach(({ node, rect }, i) => {
        const chain: HTMLElement[] = []
        for (let up = node.parentElement; up; up = up.parentElement) chain.unshift(shell(up.tagName, up.className))
        chain.unshift(shell(el.tagName, el.className))
        let at: HTMLElement = top
        for (const link of chain) {
          at.appendChild(link)
          at = link
        }
        node.classList.remove('is-new', 'is-same')
        node.style.cssText += `;position:absolute;margin:0;left:${rect.left - view.left}px;top:${rect.top - view.top}px;width:${rect.width}px;height:${rect.height}px;transform-origin:18% 50%;animation:mb-deflate 0.2s cubic-bezier(0.4, 0, 0.9, 0.6) ${i * 12}ms both`
        at.appendChild(node)
      })
      fx.appendChild(host)
      window.setTimeout(() => host.remove(), 200 + gone.length * 12 + 80)
    }
    // small bubbles burst from each piece as it goes
    const drop = (css: string, life: number) => {
      const node = document.createElement('span')
      node.className = 'mb-drop'
      node.style.cssText = css
      fx.appendChild(node)
      window.setTimeout(() => node.remove(), life)
    }
    gone.forEach(({ rect }, i) => {
      const top = Math.max(rect.top, view.top)
      const height = Math.min(rect.bottom, view.bottom) - top
      if (height < 6) return
      const wait = i * 12 + 80
      const drops = Math.min(6, 2 + Math.round(rect.width / 130))
      for (let k = 0; k < drops; k++) {
        const size = 6 + Math.random() * 9
        const x = rect.left - box.left + ((k + 0.5) / drops) * rect.width * 0.8 + (Math.random() - 0.5) * 14
        const y = top - box.top + height * (0.3 + Math.random() * 0.4)
        drop(`left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;--dx:${((Math.random() - 0.5) * 44).toFixed(0)}px;--dy:${(-12 - Math.random() * 30).toFixed(0)}px;animation-delay:${(wait + Math.random() * 60).toFixed(0)}ms`, wait + 640)
      }
    })
  }
  /** After a region is redrawn, every piece of it that changed gets the same treatment: what left
   *  deflates and bursts, and what is new blows up into place, one piece after another. A piece
   *  whose words changed counts as one that left and one that is new. `all` is a move to another
   *  step, where the whole step leaves and the whole new step arrives. */
  const bubbles = (el: HTMLElement, pieces: string, olds: { node: HTMLElement; key: string; rect: DOMRect }[], view: DOMRect, all: boolean) => {
    const news = [...el.querySelectorAll<HTMLElement>(pieces)].map((node) => ({ node, key: stamp(node) }))
    const before = new Set(olds.map((c) => c.key))
    const after = new Set(news.map((c) => c.key))
    const gone = outermost(olds.filter((c) => all || !after.has(c.key)))
      .filter((c) => c.rect.height > 0 && c.rect.bottom > view.top && c.rect.top < view.bottom)
      .slice(0, 8)
    if (gone.length) deflate(el, gone, view)
    // the new pieces wait a beat while the old ones go
    el.style.setProperty('--wait', gone.length ? '0.14s' : '0s')
    outermost(news.filter((c) => all || !before.has(c.key))).forEach(({ node }, i) => {
      node.classList.add('is-new')
      node.style.setProperty('--i', String(Math.min(i, 7)))
      settle(node)
    })
  }
  /** A piece that is still growing into place has buttons that are moving, and a tap aimed at
   *  one of them can land on its neighbor. So a piece takes no taps until its entrance has ended. */
  const settle = (node: HTMLElement) => {
    if (calm) return
    node.style.pointerEvents = 'none'
    const done = (e?: Event) => {
      if (e && e.target !== node) return // an animation of something inside it
      node.style.pointerEvents = ''
      node.removeEventListener('animationend', done)
      window.clearTimeout(timer)
    }
    node.addEventListener('animationend', done)
    // in case the entrance never runs (the piece is hidden, or the styles have not loaded)
    const timer = window.setTimeout(done, 1200)
  }
  /** Where each thing that can slide is: a piece by what it shows, a counter row by its name. */
  const places = (el: HTMLElement, pieces: string) => {
    const at = new Map<string, { node: HTMLElement; top: number }>()
    for (const node of el.querySelectorAll<HTMLElement>(pieces + SLIDES_TOO)) at.set(node.matches('.mb-row') ? `row:${node.dataset.k}` : stamp(node), { node, top: node.getBoundingClientRect().top })
    return at
  }
  /** Text that stayed but now sits higher or lower (something above it left, arrived or changed
   *  size) slides to its new place instead of jumping there. */
  const slide = (el: HTMLElement, pieces: string, was: Map<string, { top: number }>, wait: number) => {
    for (const [key, now] of places(el, pieces)) {
      const dy = (was.get(key)?.top ?? now.top) - now.top
      if (Math.abs(dy) < 1 || Math.abs(dy) > 700 || now.node.classList.contains('is-new')) continue
      now.node.animate([{ translate: `0 ${dy.toFixed(1)}px` }, { translate: '0 0' }], { duration: 260, delay: wait, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' })
    }
  }

  const paint = (name: keyof typeof regions, html: string, swap = false) => {
    if (lastHtml[name] === html) return
    lastHtml[name] = html
    const el = regions[name]
    const pieces = calm ? undefined : PIECES[name]
    const olds = pieces ? [...el.querySelectorAll<HTMLElement>(pieces)].map((node) => ({ node, key: stamp(node), rect: node.getBoundingClientRect() })) : []
    // the part of the region its pieces show in: the panel's text scrolls inside a smaller box
    const view = (name === 'panel' ? el.querySelector('.mb-scroll') : null)?.getBoundingClientRect() ?? el.getBoundingClientRect()
    const was = pieces && !swap ? places(el, pieces) : null
    const active = document.activeElement instanceof HTMLElement && el.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null
    const scroll = el.querySelector('.mb-scroll')?.scrollTop ?? 0
    // A redraw rebuilds the whole region, which would replay every pop, rise and shake in it.
    // Whatever the region already showed is marked is-same, and the styles keep it still, so
    // only the number or card that changed moves.
    const shown = new Set<string>()
    for (const node of el.querySelectorAll<HTMLElement>(ONE_SHOT)) shown.add(stamp(node))
    // looping motion in the new markup picks up where the old markup's left off (see styles.css)
    el.style.setProperty('--now', ((performance.now() - opened) / 1000).toFixed(2))
    el.innerHTML = html
    for (const node of el.querySelectorAll<HTMLElement>(ONE_SHOT)) if (shown.has(stamp(node))) node.classList.add('is-same')
    const sc = el.querySelector('.mb-scroll')
    if (sc) sc.scrollTop = scroll
    if (pieces) bubbles(el, pieces, olds, view, swap)
    // the molecule picker inflates as a whole, so it waits the same way
    if (name === 'panel') for (const list of el.querySelectorAll<HTMLElement>('.mb-picker:not(.is-same)')) settle(list)
    if (pieces && was) slide(el, pieces, was, el.style.getPropertyValue('--wait') === '0s' ? 0 : 70)
    if (active) {
      const again = el.querySelector<HTMLElement>(`[data-key="${active}"]`)
      if (again && !(again as HTMLButtonElement).disabled) {
        again.focus({ preventScroll: true })
        // a redraw while typing keeps the caret at the end of what was typed
        if (again instanceof HTMLInputElement) again.setSelectionRange(again.value.length, again.value.length)
      } else if (name === 'dock') {
        // Clear emptied the board and switched itself off: Undo, which brings the atoms back, takes the focus
        el.querySelector<HTMLElement>('[data-key="undo"]:not([disabled])')?.focus({ preventScroll: true })
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

  // ---- key terms: the card that opens from a highlighted word

  /** The highlighted word the open card belongs to, as it is on the page now. A redraw replaces the button it was opened from. */
  const termAnchor = () => {
    if (!termOpen) return null
    if (termOpen.from && root.contains(termOpen.from)) return termOpen.from
    return regions.panel.querySelector<HTMLElement>(`.mb-term[data-term="${termOpen.id}"]`)
  }
  const markTerms = () => {
    // the word is marked as open only while the card shows that word's own term (a related term may have taken its place)
    const anchor = termAnchor()
    for (const b of root.querySelectorAll<HTMLElement>('.mb-term')) b.setAttribute('aria-expanded', String(b === anchor && b.dataset.term === termOpen?.id))
  }
  /** Where the card sits. Beside the panel on a wide screen, level with its word, with a small tip
   *  that points at the word. On a phone it is a sheet that comes up from the bottom edge. */
  const placeTerm = () => {
    if (!termOpen) return
    const box = root.getBoundingClientRect()
    const wide = box.width > 880
    termEl.dataset.side = wide ? 'beside' : 'sheet'
    termScrim.hidden = wide
    if (!wide) {
      termEl.style.left = ''
      termEl.style.top = ''
      return
    }
    const pr = regions.panel.getBoundingClientRect()
    const ar = termAnchor()?.getBoundingClientRect()
    const w = termEl.offsetWidth
    const h = termEl.offsetHeight
    const at = ar ? Math.min(Math.max(ar.top + ar.height / 2 - box.top, 24), box.height - 24) : box.height / 2
    const top = Math.min(Math.max(12, at - 58), Math.max(12, box.height - h - 12))
    termEl.style.left = `${Math.max(12, pr.left - box.left - w - 16)}px`
    termEl.style.top = `${top}px`
    termEl.style.setProperty('--tip', `${Math.min(Math.max(at - top, 26), h - 26)}px`)
  }
  const showTerm = (id: TermId, from: HTMLElement | null) => {
    const s = store.getState()
    const guided = s.mode === 'guided'
    // a part names the terms whose card would give an open answer away: those never open, and no card links to them
    const blocked = PARTS[s.mode]?.blockedTerms?.(s)
    if (blocked?.has(id)) return
    const card = termCard(id, guided ? store.problemOf(s) : null, guided ? s.step : null)
    termEl.innerHTML = termCardHtml(blocked ? { ...card, related: card.related.filter((r) => !blocked.has(r.id)) } : card)
    termEl.hidden = false
    termEl.dataset.term = id
    termOpen = { id, from }
    // the card pops each time it opens or moves on to another term
    termEl.classList.remove('is-in')
    void termEl.offsetWidth
    termEl.classList.add('is-in')
    placeTerm()
    markTerms()
    termEl.focus({ preventScroll: true })
  }
  /** Close the card. `refocus` puts the keyboard back on the word the card was opened from. */
  const hideTerm = (refocus: boolean) => {
    if (!termOpen) return
    const back = termAnchor()
    termOpen = null
    termEl.hidden = true
    termScrim.hidden = true
    termEl.classList.remove('is-in')
    termEl.replaceChildren()
    markTerms()
    if (refocus) (back ?? regions.panel.querySelector<HTMLElement>('.mb-step'))?.focus({ preventScroll: true })
  }

  let toastTimer = 0
  let toastSeen = 0
  let lastStep: string | null = null
  let lastPanel = ''
  /** The step the panel showed at the last redraw, and whether that step was finished then. */
  let lastPanelStep: string | null = null
  let wasDone = false
  /** Set just before a total is checked: if the check fails, the box comes back with its text selected. */
  let selectTotal = false
  let dockRest = 0
  const measure = () => {
    const sr = stage.getBoundingClientRect()
    const lr = regions.ledger.getBoundingClientRect()
    const cr = regions.checks.getBoundingClientRect()
    const tr = regions.top.getBoundingClientRect()
    const dr = regions.dock.getBoundingClientRect()
    // On a phone the board is short, and the strip of checks would take a fifth of it. There the
    // strip keeps half its height clear and lies over the board's top rim with the rest.
    const strip = cr.height ? (sr.width <= 560 ? cr.top + cr.height / 2 : cr.bottom) : 0
    const top = Math.max(lr.height ? lr.bottom : 0, strip, tr.bottom) - sr.top + 14
    // The board keeps clear of the dock at its resting height. The card for a selected atom can be
    // taller; it is allowed to overlap the board's edge so the board does not jump when it opens.
    if (!regions.dock.querySelector('.mb-sel')) dockRest = dr.height ? sr.bottom - dr.top : 0
    const clear = Math.max(lr.height ? lr.bottom : 0, cr.height ? cr.bottom : 0, tr.bottom) - sr.top
    scene.setInsets({ top, bottom: dockRest + 18, left: 14, right: 14, clear })
  }

  const render = (s: State) => {
    const part = PARTS[s.mode]
    const stepKey = part ? `${s.mode}:${part.screen(s)}` : `${s.mode}:${s.problem}:${s.step}`
    // a card belongs to the step it was opened in
    if (termOpen && lastStep !== null && stepKey !== lastStep) hideTerm(false)
    paint('top', topbar(s, !!opts.onExit))
    paint('ledger', ledger(s))
    paint('checks', checkbar(s))
    paint('dock', dock(s))
    // on a move to another step every chunk of the old step leaves and every chunk of the new one arrives
    paint('panel', panel(s), lastStep !== null && stepKey !== lastStep)
    root.dataset.mode = s.mode
    root.dataset.view = s.view
    root.dataset.step = s.mode === 'guided' ? s.step : s.mode
    if (termOpen) markTerms()

    const panelChanged = lastHtml.panel !== lastPanel
    lastPanel = lastHtml.panel ?? ''
    const stepDone = part ? !!part.done?.(s) : s.mode === 'guided' && store.stepDone(s.step, s)
    if (stepKey !== lastStep) {
      lastStep = stepKey
      regions.panel.querySelector('.mb-scroll')?.scrollTo({ top: 0 })
    } else if (stepDone && !wasDone) celebrate(s.step === 'shape')
    wasDone = stepDone
    if (panelChanged && lastPanelStep === stepKey) {
      // same step, new content (feedback, the next question, a hint): bring the newest part into view
      const scroller = regions.panel.querySelector('.mb-scroll')
      const fresh = regions.panel.querySelector('.mb-coach:not(.is-same)')
      if (regions.panel.querySelector('.mb-readout')) scroller?.scrollTo({ top: 0, behavior: 'smooth' }) // the shape result reads from its first line
      else if (fresh) fresh.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) // a new explanation is read from its first line
      else {
        const parts = regions.panel.querySelectorAll('.mb-step > :is(.mb-fb, .mb-choices, .mb-total, .mb-hints, .mb-note, .mb-btn, .mb-draw)')
        parts[parts.length - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    lastPanelStep = stepKey
    if (pointerAt) aimEyes()

    const st = store.boardStructure(s)
    const report = store.isSpecimen(s) ? null : assess(st)
    // the shape whose angles get marked on the lifted model
    const shown = s.view === 'shape' ? shapeInfoFor(st) : null
    const input: SceneInput = {
      s: st,
      editable: store.editable(s),
      selection: s.selection,
      view: s.view,
      specimen: store.isSpecimen(s),
      // each atom's electron count stays beside it from the moment it is on the board; formal charges come in with step 4
      showCounts: !store.isSpecimen(s),
      showCharges: s.mode === 'free' || !['count', 'place', 'bond'].includes(s.step),
      shells: new Map((report?.atoms ?? []).map((a) => [a.id, { count: a.count, target: a.target, status: a.status }])),
      refused: s.refused,
      point: ringGroups(s),
      dipoles: dipolesFor(s, st),
      draw: drawFor(s, st),
      // an atom dropped from the tray onto another atom is bonded to it, except in the place step, where bonding is the next step
      dropBonds: s.mode === 'free' || s.step === 'bond' || s.step === 'check',
      // the switch on the lifted model is the guided steps' and free build's; a part draws its own model
      groupsView: store.groupsViewShown(s),
      // the net dipole runs along the same line as an angle's label, so the two are never drawn together
      angles: shown && !showsDipoles(s) && !freeNetShown(s, st) ? angleMarks(s.mode === 'guided' ? store.problemOf(s) : null, shown, mixedOuter(st)) : [],
    }
    const onAtom = document.activeElement instanceof HTMLButtonElement && document.activeElement.classList.contains('mb-hit') ? document.activeElement : null
    scene.sync(part?.scene ? part.scene(s, input) : input)
    if (onAtom?.disabled) {
      // The atom that had the keyboard's focus is switched off (the last arrow was just drawn). Move
      // to the step's main button when it is ready, otherwise to the step itself, as the panel does.
      const main = regions.panel.querySelector<HTMLElement>('.mb-btn-main:not([disabled])')
      ;(main ?? regions.panel.querySelector<HTMLElement>('.mb-step'))?.focus({ preventScroll: true })
    }

    setCue(part ? (part.cue?.(s) ?? null) : store.cue(s))

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

  // A press anywhere outside an open card closes it, and the press still does what it would have done.
  root.addEventListener(
    'pointerdown',
    (e) => {
      const target = e.target as HTMLElement
      if (!termOpen || termEl.contains(target) || target.closest('.mb-term, .mb-termscrim')) return
      const word = termAnchor()
      const inCard = termEl.contains(document.activeElement)
      hideTerm(false)
      // The keyboard was inside the card, which is gone now. If the press lands on something that
      // takes the focus, it has it by the next turn. If it lands on bare page, the focus goes back
      // to the word, so a keyboard user keeps their place.
      if (inCard) window.setTimeout(() => (document.activeElement === document.body || document.activeElement === null ? word?.focus({ preventScroll: true }) : undefined), 0)
    },
    { capture: true, signal: off.signal },
  )
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const word = target.closest<HTMLElement>('.mb-term')
    if (word) {
      // a second press on the word closes its card; if the card has moved on to a related term, the press brings the word's own card back
      if (termOpen && termAnchor() === word && termOpen.id === word.dataset.term) hideTerm(true)
      else showTerm(word.dataset.term as TermId, word)
      return
    }
    const go = target.closest<HTMLElement>('[data-term-go]')
    if (go) {
      showTerm(go.dataset.termGo as TermId, termOpen?.from ?? null)
      return
    }
    if (target.closest('[data-term-close], .mb-termscrim')) {
      hideTerm(true)
      return
    }
    const t = target.closest<HTMLElement>('[data-act]')
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
      case 'bond-polar':
        store.answerBond(t.dataset.el as El, t.dataset.answer as BondAnswer)
        break
      case 'net-polar':
        store.answerNet(t.dataset.polar === 'true')
        break
      case 'bond-count': {
        const kind = t.dataset.kind as 'sigma' | 'pi'
        store.setBondCount(kind, s.orbitals[kind] + Number(t.dataset.d))
        break
      }
      case 'bonds-check':
        store.checkBondCounts()
        break
      case 'hybrid':
        store.pickHybrid(t.dataset.h as Hybrid)
        break
      case 'geometry':
        store.pickGeometry(t.dataset.name as ShapeName)
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
      case 'groups-view':
        store.setGroupsView(t.dataset.groups === 'atoms' ? 'atoms' : 'all')
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
      default:
        // a part's own control (parts.ts)
        PARTS[s.mode]?.act?.(t, s)
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
    if (e.key === 'Escape' && termOpen) {
      hideTerm(true)
      return
    }
    if (PARTS[s.mode]?.key?.(e, s)) return
    if (e.key === 'Escape') {
      if (s.pickerOpen) store.togglePicker(false)
      else store.clearSelection()
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection?.kind === 'atom' && target.tagName !== 'INPUT') store.remove(s.selection.id)
  }, on)
  root.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement
    if (PARTS[store.getState().mode]?.input?.(input, store.getState())) return
    if (input.id !== 'mb-total') return
    const digits = input.value.replace(/\D/g, '').slice(0, 2)
    if (digits !== input.value) input.value = digits
    store.typeTotal(digits === '' ? null : Number(digits))
  }, on)

  const ro = new ResizeObserver(() => {
    measure()
    placeTerm()
  })
  // the card stays level with its word while the panel's text scrolls under it
  regions.panel.addEventListener('scroll', () => placeTerm(), { capture: true, passive: true, signal: off.signal })
  ro.observe(stage)
  const unsubscribe = store.subscribe(render)
  render(store.getState())

  // a handle for scripts/check-browser.mjs: screen positions of what is on the board, the state, and the checker
  const handle = {
    scene,
    store,
    report: () => assess(store.getState().s, store.getState().mode === 'guided' ? speciesOf(store.problemOf()) : undefined),
    nextMove: () => nextMove(store.getState().mode === 'guided' ? store.problemOf() : null, store.getState().s),
    /** Every key term, for a check that opens each card in turn. */
    terms: ALL_TERMS,
    /** Open a term's card without a word to open it from, so a check can look at every card. */
    showTerm: (id: string) => showTerm(id as TermId, null),
    /** The key term whose card is open, read from the page: the term, where the card is, and its heading. */
    term: () => {
      if (!termOpen || termEl.hidden) return null
      const r = termEl.getBoundingClientRect()
      return { id: termEl.dataset.term, side: termEl.dataset.side, name: termEl.querySelector('h3')?.textContent ?? '', x: r.left, y: r.top, w: r.width, h: r.height }
    },
    /** What the glow and the pointing hand show now, read from the page itself: each glow that is
     *  switched on, where it is, and whether the hand can be seen. */
    cue: () => {
      const seen = (n: Element) => {
        const r = n.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height, opacity: Number(getComputedStyle(n).opacity) }
      }
      const h = seen(hand)
      const handSeen = hand.classList.contains('is-on') && h.opacity > 0.5 && h.x + h.w > 0 && h.y + h.h > 0 && h.x < window.innerWidth && h.y < window.innerHeight
      const eyes = carried.classList.contains('is-on') ? carried.querySelector('.mb-eyes') : null
      return {
        // in a part the cue is the part's own
        cue: PARTS[store.getState().mode] ? (PARTS[store.getState().mode]!.cue?.(store.getState()) ?? null) : store.cue(),
        hand: handSeen ? cueShown.hand : 'off',
        halos: halos.filter((n) => n.classList.contains('is-on')).map(seen),
        /** The atom the hand carries: how wide its eyes are drawn, or null when no atom is carried. */
        carriedEyes: eyes ? eyes.getBoundingClientRect().width : null,
      }
    },
  }
  ;(window as unknown as { __mb?: unknown }).__mb = handle

  return () => {
    off.abort()
    unsubscribe()
    ro.disconnect()
    cancelAnimationFrame(aiming)
    cancelAnimationFrame(cueRaf)
    window.clearTimeout(toastTimer)
    scene.dispose()
    root.replaceChildren()
    root.classList.remove('mb')
    const w = window as unknown as { __mb?: unknown }
    if (w.__mb === handle) delete w.__mb
  }
}
