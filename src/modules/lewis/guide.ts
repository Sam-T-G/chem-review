// The guided walk through one problem: what each step asks, when it is done, and every sentence
// the panel shows. Pure functions of the problem and the board, so the wording is testable.
//
// Wording rules (Sam's voice rules): plain and literal, name the atom instead of "it", say what
// to do, no citations on screen, no lines that describe the interface.
import { assess, type Assessment, type Issue } from '../../chem/assess'
import { ELEMENTS, canExpand, shellMax, shellTarget, shellsOf, type El } from '../../chem/elements'
import { atomsOf, chargeWord, neutralElectrons, speciesOf, totalElectrons, type Problem } from '../../chem/problems'
import { bestStructures, solveStar } from '../../chem/solve'
import { addElectron, atomById, bondsOf, removeElectron, share, shellCount, type Refusal, type Structure } from '../../chem/structure'
import { ALL_SHAPES, MEASURED_ANGLE, centerDomains, classify, shapeCases, type ShapeInfo, type ShapeName } from '../../chem/vsepr'

export type StepId = 'count' | 'place' | 'bond' | 'check' | 'shape'
export const STEPS: { id: StepId; label: string; title: string; next: string }[] = [
  { id: 'count', label: 'Count', title: 'Count the valence electrons', next: 'Put the atoms on the board' },
  { id: 'place', label: 'Place', title: 'Put the atoms on the board', next: 'Bond the atoms' },
  { id: 'bond', label: 'Bond', title: 'Bond the atoms', next: 'Check each atom' },
  { id: 'check', label: 'Check', title: 'Check each atom', next: 'Find the shape' },
  { id: 'shape', label: 'Shape', title: 'Find the shape', next: 'Next molecule' },
]

export const lower = (el: El) => ELEMENTS[el].name.toLowerCase()
export const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const list = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)

/** "1 carbon atom and 4 hydrogen atoms" for a list of atoms. */
function tally(els: El[]): string {
  const counts = new Map<El, number>()
  for (const el of els) counts.set(el, (counts.get(el) ?? 0) + 1)
  return list([...counts].map(([el, n]) => plural(n, `${lower(el)} atom`)))
}

/** "Methane", "Ammonium ion": the problem's name as a heading. */
export function titleOf(p: Problem): string {
  return cap(p.name.replace(/^the /, ''))
}
/** Distinct elements of a problem, in formula order. */
export function elementsOf(p: Problem): El[] {
  return p.formula.map(([el]) => el)
}
function outerEls(p: Problem): El[] {
  return speciesOf(p).terminals
}
/** "each hydrogen atom", or "each outer atom" when the outer atoms differ. */
function eachOuter(p: Problem): string {
  const kinds = [...new Set(outerEls(p))]
  return kinds.length === 1 ? `each ${lower(kinds[0]!)} atom` : 'each outer atom'
}

// ---------------------------------------------------------------- wrong answers

/** What the panel says after a wrong answer, in three short parts. A wrong answer usually comes
 *  from a wrong idea, so the first part names what the answer is, the second says why that does
 *  not answer the question, and the third hands the question back. Any part but the first can
 *  be empty. */
export interface Coach {
  /** The answer named as what it is ("6 is carbon's atomic number."), or the plain fact that it is wrong. */
  lead: string
  /** Why that does not answer the question. */
  why: string
  /** What to count, look at or do next. */
  ask: string
  /** A picture that goes with the words. */
  show?: CoachShow
}
export type CoachShow =
  /** The atom's electron shells, with the outer shell marked. */
  | { kind: 'shells'; el: El }
  /** Rings on the board around the middle atom's double and triple bonds, its lone pairs, or all of its groups in turn. */
  | { kind: 'groups'; which: 'multiple' | 'lone' | 'all' }
  /** Every atom of the molecule with what it brings to the total: the atoms alone, then each kind's sum, then the total. */
  | { kind: 'tally'; reveal: TallyReveal }
export type TallyReveal = 'atoms' | 'sums' | 'total'

/** A coach's sentences as one line. */
export const coachText = (c: Coach) => [c.lead, c.why, c.ask].filter(Boolean).join(' ')

// ---------------------------------------------------------------- step 1: count

/** The wrong idea a valence count most likely came from, checked in this order: the atomic
 *  number, the number of atoms in the formula, the electrons the atom is short of 8, a full shell. */
function countIdea(p: Problem | null, el: El, answer: number): Coach {
  const e = ELEMENTS[el]
  const name = lower(el)
  const shells: CoachShow = { kind: 'shells', el }
  if (answer === 0) return { lead: `Set a number for ${name}.`, why: '', ask: '' }
  if (answer === e.z && e.z !== e.valence) {
    return {
      lead: `${answer} is ${name}'s atomic number.`,
      why: `The atomic number counts all ${e.z} of ${name}'s electrons, and ${e.z - e.valence} of them are in ${e.period === 2 ? 'the inner shell' : 'inner shells'}.`,
      ask: `Count only the electrons in ${name}'s outer shell.`,
      show: shells,
    }
  }
  const inFormula = p?.formula.find(([x]) => x === el)?.[1] ?? 1
  if (p && inFormula > 1 && answer === inFormula) {
    return { lead: `${answer} is the number of ${name} atoms in ${p.name}.`, why: `Each ${name} atom is counted on its own here.`, ask: `Set the valence electrons of 1 ${name} atom.` }
  }
  const full = shellTarget(el)
  if ((full === 8 || full === 2) && e.valence < full) {
    if (full === 8 && answer === 8 - e.valence) {
      return {
        lead: `${answer} is how many electrons ${name} is short of 8.`,
        why: `Valence electrons are the ones ${name} already has in its outer shell.`,
        ask: `Count the electrons in ${name}'s outer shell.`,
        show: shells,
      }
    }
    if (answer === full) {
      return {
        lead: full === 8 ? '8 is a full outer shell.' : `2 is a full outer shell for ${name}.`,
        // some atoms here end up with more than 8 (phosphorus in PCl5), so nothing is said about where the atom ends up
        why: full === 8 ? `On its own, ${name} has fewer than 8 electrons in its outer shell.` : `${cap(name)} gets to 2 by sharing electrons in a bond. On its own, ${name} has fewer.`,
        ask: `Count the electrons ${name} has before any bond.`,
        show: shells,
      }
    }
  }
  return { lead: `${cap(name)} doesn't have ${plural(answer, 'valence electron')}.`, why: '', ask: '' }
}

/** What to say about a wrong valence count. `tries` is how many wrong checks this atom has had
 *  (1 = first). The second miss adds the group rule and a picture of the atom's shells; the third
 *  gives the answer. `p` is the problem, so a count of atoms in the formula can be recognized. */
export function countCoach(p: Problem | null, el: El, answer: number, tries: number): Coach {
  const e = ELEMENTS[el]
  const name = lower(el)
  const shells: CoachShow = { kind: 'shells', el }
  if (tries >= 3) return { lead: `${cap(name)} has ${plural(e.valence, 'valence electron')}.`, why: '', ask: '', show: shells }
  const idea = countIdea(p, el, answer)
  if (tries === 2) {
    const rule =
      e.group <= 2
        ? `${cap(name)} is in group ${e.group}. In groups 1 and 2, the group number is the number of valence electrons.`
        : `${cap(name)} is in group ${e.group}. For groups 13 to 18, subtract 10 from the group number.`
    return { lead: idea.lead, why: idea.why, ask: rule, show: shells }
  }
  return { ...idea, ask: idea.ask || `Find ${name}'s group on the periodic table.` }
}

/** Words for the picture of an atom's shells: its two legend labels, and the picture described for a screen reader. */
export function shellsWords(el: El): { inner: string | null; outer: string; label: string } {
  const shells = shellsOf(el)
  const inner = shells.slice(0, -1)
  const outer = shells[shells.length - 1]!
  const name = cap(lower(el))
  return {
    inner: inner.length === 0 ? null : inner.length === 1 ? 'Inner shell' : 'Inner shells',
    outer: 'Outer shell',
    label:
      inner.length === 0
        ? `${name} has 1 shell, with ${plural(outer, 'electron')} in it.`
        : `${name} has ${plural(inner.reduce((a, b) => a + b, 0), 'electron')} in ${inner.length === 1 ? 'its inner shell' : `its ${inner.length} inner shells`} and ${outer} in its outer shell.`,
  }
}

/** "4 + 4 × 1" for CH4, "4 + 3 × 6 + 2" for carbonate, "5 + 4 × 1 − 1" for ammonium. */
export function totalSum(p: Problem): string {
  const terms = p.formula.map(([el, n]) => (n === 1 ? `${ELEMENTS[el].valence}` : `${n} × ${ELEMENTS[el].valence}`))
  let text = terms.join(' + ')
  if (p.charge < 0) text += ` + ${-p.charge}`
  if (p.charge > 0) text += ` − ${p.charge}`
  return text
}

/** "1 carbon atom and 4 hydrogen atoms", plus the charge for an ion. */
export function inventory(p: Problem): string {
  const parts = p.formula.map(([el, n]) => plural(n, `${lower(el)} atom`))
  if (p.charge !== 0) parts.push(`a ${chargeWord(p.charge)} charge`)
  return list(parts)
}

// How the total is built, said three ways. Each one goes a step further than the one before,
// so a student is told how the count works before being told the count.

/** "the nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1": what each atom brings, with nothing added up. */
function whatAtomsBring(p: Problem): string {
  return list(p.formula.map(([el, k]) => (k === 1 ? `the ${lower(el)} atom brings ${ELEMENTS[el].valence}` : `each of the ${k} ${lower(el)} atoms brings ${ELEMENTS[el].valence}`)))
}
/** " The 2− charge adds 2 more." for an ion, nothing for a molecule. */
function chargeAdds(p: Problem): string {
  const n = Math.abs(p.charge)
  if (p.charge === 0) return ''
  return p.charge < 0 ? ` The ${chargeWord(p.charge)} charge adds ${n} more.` : ` The ${chargeWord(p.charge)} charge takes ${n} away.`
}
/** What the total is and what goes into it: "The total is every valence electron in ammonia: the nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1." */
export function totalMethod(p: Problem): string {
  return `The total is every valence electron in ${p.name}: ${whatAtomsBring(p)}.${chargeAdds(p)}`
}
/** Each kind of atom added up: "The nitrogen atom brings 5. The 3 hydrogen atoms bring 1 each, which makes 3." */
export function totalParts(p: Problem): string {
  const parts = p.formula.map(([el, k]) => {
    const v = ELEMENTS[el].valence
    return k === 1 ? `The ${lower(el)} atom brings ${v}.` : `The ${k} ${lower(el)} atoms bring ${v} each, which makes ${k * v}.`
  })
  return `${parts.join(' ')}${chargeAdds(p)}`
}
/** The whole count in words: "5 from nitrogen and 3 from hydrogen make 8." */
export function totalInWords(p: Problem): string {
  const n = Math.abs(p.charge)
  const from = p.formula.map(([el, k]) => `${ELEMENTS[el].valence * k} from ${lower(el)}`)
  if (p.charge > 0) return `${cap(list(from))} make ${neutralElectrons(p)}, and the ${chargeWord(p.charge)} charge takes ${n} away.`
  if (p.charge < 0) from.push(`${n} from the ${chargeWord(p.charge)} charge`)
  return `${cap(list(from))} make ${totalElectrons(p)}.`
}

export interface TallyRow {
  /** The element this row counts, or null for the row that counts an ion's charge. */
  el: El | null
  /** How many atoms of it the molecule has. */
  count: number
  text: string
  /** What the row adds to the total. Null until the sums are shown. */
  sum: string | null
}
/** The picture that goes with a wrong total: one row for each kind of atom, one for an ion's
 *  charge, and the total. `reveal` says how much is filled in. */
export function totalTally(p: Problem, reveal: TallyReveal): { rows: TallyRow[]; totalLabel: string; total: string; label: string } {
  const n = Math.abs(p.charge)
  const w = chargeWord(p.charge)
  const rows: TallyRow[] = p.formula.map(([el, k]) => {
    const v = ELEMENTS[el].valence
    return { el, count: k, text: k === 1 ? `1 ${lower(el)} atom brings ${v}` : `${k} ${lower(el)} atoms bring ${v} each`, sum: reveal === 'atoms' ? null : String(k * v) }
  })
  if (p.charge !== 0) {
    rows.push({
      el: null,
      count: 0,
      text: p.charge < 0 ? `${w} charge: ${plural(n, 'more electron')}` : `${w} charge: ${plural(n, 'electron')} fewer`,
      sum: reveal === 'atoms' ? null : `${p.charge < 0 ? '+' : '−'}${n}`,
    })
  }
  return {
    rows,
    totalLabel: 'Total',
    total: reveal === 'total' ? String(totalElectrons(p)) : '?',
    // the same picture in a sentence, for a screen reader
    label: reveal === 'atoms' ? `${cap(whatAtomsBring(p))}.${chargeAdds(p)}` : reveal === 'sums' ? totalParts(p) : totalInWords(p),
  }
}

/** The wrong idea a total most likely came from: the charge left out, the charge applied the wrong
 *  way, each element counted once, or atomic numbers added up. A total that matches none of them
 *  is told what the total is made of. */
function totalIdea(p: Problem, answer: number): Coach {
  const neutral = neutralElectrons(p)
  const n = Math.abs(p.charge)
  const w = chargeWord(p.charge)
  const adjust = p.charge < 0 ? `Add ${n} to ${neutral}.` : `Subtract ${n} from ${neutral}.`
  if (p.charge !== 0 && answer === neutral) {
    return {
      lead: `${neutral} is the count for the neutral atoms.`,
      why: p.charge < 0 ? `The ${w} charge means the ion has ${plural(n, 'extra electron')}.` : `The ${w} charge means the ion is missing ${plural(n, 'electron')}.`,
      ask: adjust,
    }
  }
  if (p.charge !== 0 && answer === neutral + p.charge) {
    return {
      lead: `${answer} is ${neutral} ${p.charge < 0 ? 'minus' : 'plus'} ${n}.`,
      why: `Electrons are negative, so an ion with a ${w} charge has ${n} ${p.charge < 0 ? 'more' : 'fewer'} ${n === 1 ? 'electron' : 'electrons'} than its atoms bring.`,
      ask: adjust,
    }
  }
  const once = p.formula.reduce((sum, [el]) => sum + ELEMENTS[el].valence, 0)
  if (answer === once && once !== neutral) {
    const many = p.formula.filter(([, k]) => k > 1)
    return {
      lead: `${answer} counts ${list(many.map(([el]) => lower(el)))} once.`,
      why: `${cap(p.name)} has ${list(many.map(([el, k]) => `${k} ${lower(el)} atoms`))}, and each atom brings its own electrons.`,
      ask: 'Count every atom.',
    }
  }
  const all = p.formula.reduce((sum, [el, k]) => sum + ELEMENTS[el].z * k, 0)
  if (answer === all) {
    return {
      lead: `${answer} adds up the atomic numbers.`,
      why: 'That counts every electron, inner shells included. A Lewis structure shows only the valence electrons.',
      ask: 'Add up the valence electrons of every atom.',
    }
  }
  // the atomic numbers, adjusted for the charge
  if (p.charge !== 0 && answer === all - p.charge) {
    return {
      lead: `${answer} counts every electron in ${p.name}.`,
      why: 'That includes the electrons in inner shells. A Lewis structure shows only the valence electrons.',
      ask: `Add up the valence electrons of every atom, then adjust for the ${w} charge.`,
    }
  }
  const atoms = atomsOf(p).length
  const charge = p.charge === 0 ? '' : p.charge < 0 ? `, then add ${n} for the charge` : `, then take ${n} away for the charge`
  return { lead: `The total is not ${answer}.`, why: totalMethod(p), ask: `Add up what all ${atoms} atoms bring${charge}.` }
}

/** What to say about a wrong total, with a picture of the atoms and what each one brings. The
 *  first miss says what the total is made of (or names the wrong idea), the second adds up each
 *  kind of atom, and the third gives the total in words. The bare sum is never the explanation. */
export function totalCoach(p: Problem, answer: number, tries: number): Coach {
  if (tries >= 3) return { lead: `${cap(p.name)} has ${plural(totalElectrons(p), 'valence electron')}.`, why: totalInWords(p), ask: '', show: { kind: 'tally', reveal: 'total' } }
  const idea = totalIdea(p, answer)
  if (tries === 2) {
    const n = Math.abs(p.charge)
    return { lead: idea.lead, why: totalParts(p), ask: p.charge > 0 ? `Add up the atoms' numbers, then take ${n} away.` : 'Add those numbers.', show: { kind: 'tally', reveal: 'sums' } }
  }
  return { ...idea, show: { kind: 'tally', reveal: 'atoms' } }
}

// ---------------------------------------------------------------- step 2: place

/** Problems where every outer atom is hydrogen explain the middle with the hydrogen rule. */
function hydrogenRule(p: Problem): boolean {
  return outerEls(p).every((el) => el === 'H')
}
export function middleChoices(p: Problem): El[] {
  return elementsOf(p)
}
/** The middle question is skipped when the formula has only one element. */
export function middleNeeded(p: Problem): boolean {
  return elementsOf(p).length > 1
}
export function middleFeedback(p: Problem, pick: El): { right: boolean; text: string; coach: Coach | null } {
  const c = lower(p.center)
  if (pick === p.center) {
    if (hydrogenRule(p)) return { right: true, text: `${cap(c)}. A hydrogen atom makes only 1 bond, so hydrogen always goes on the outside.`, coach: null }
    const tail = outerEls(p).includes('H') ? ' Hydrogen is never in the middle.' : ''
    return { right: true, text: `${cap(c)}. The middle atom is usually the least electronegative one, the atom that pulls on shared electrons the least.${tail}`, coach: null }
  }
  let coach: Coach
  if (pick === 'H') {
    // H2O and HCN list hydrogen first, which is where this pick often comes from
    const listedFirst = p.formula[0]![0] === 'H'
    coach = {
      lead: 'A hydrogen atom makes only 1 bond.',
      why: `${listedFirst ? "The order of the atoms in a formula doesn't say which atom is in the middle. " : ''}The middle atom of ${p.name} has to bond to ${plural(outerEls(p).length, 'other atom')}.`,
      ask: 'Pick again.',
    }
  } else {
    const count = (el: El) => p.formula.find(([x]) => x === el)?.[1] ?? 0
    const pulls = `${cap(lower(pick))} pulls on shared electrons harder than ${c} does (it is more electronegative).`
    const rule = 'The middle atom is usually the least electronegative one.'
    coach =
      count(pick) > 1 && count(p.center) === 1
        ? { lead: `${cap(p.name)} has ${count(pick)} ${lower(pick)} atoms, and only 1 atom is in the middle.`, why: `${pulls} ${rule}`, ask: 'Pick again.' }
        : { lead: pulls, why: rule, ask: 'Pick again.' }
  }
  return { right: false, text: coachText(coach), coach }
}
export function placedCount(p: Problem, s: Structure): { placed: number; of: number } {
  const want = atomsOf(p)
  const a = assess(s, speciesOf(p))
  const missing = a.issues.find((i): i is Extract<Issue, { kind: 'missing' }> => i.kind === 'missing')
  return { placed: want.length - (missing?.els.length ?? 0), of: want.length }
}

// ---------------------------------------------------------------- step 3: bond

export interface StepStatus {
  done: boolean
  /** One line under the instructions: progress, a problem to fix, or the success note. */
  text: string
  tone: 'info' | 'warn' | 'good'
}

export function bondInstruction(p: Problem): string {
  // In a positive ion one bond gets both of its electrons from the middle atom, so "one from each" is left out.
  return `Drag ${eachOuter(p)} onto ${lower(p.center)} and let go. Each bond is 2 shared electrons${p.charge > 0 ? '' : ', one from each atom'}.`
}

export function bondStatus(p: Problem, s: Structure): StepStatus {
  const sp = speciesOf(p)
  const a = assess(s, sp)
  const c = lower(p.center)
  const first = a.issues[0]
  if (first?.kind === 'missing') return { done: false, tone: 'warn', text: `Still to put on the board: ${tally(first.els)}.` }
  if (first?.kind === 'skeleton') {
    return first.why === 'outer-bonded'
      ? { done: false, tone: 'warn', text: `Two outer atoms are bonded to each other. Tap that bond and remove it: outer atoms bond only to ${c}.` }
      : { done: false, tone: 'warn', text: `${cap(c)} is not in the middle. Remove those bonds, then bond every other atom to ${c}.` }
  }
  if (first?.kind === 'loose') {
    const total = sp.terminals.length
    const center = s.atoms.find((x) => x.el === p.center)
    const bonded = center ? bondsOf(s, center.id).length : 0
    const tooMany = a.electrons.have > (a.electrons.need ?? 0)
    const k = a.electrons.have - (a.electrons.need ?? 0)
    const centerFull = !!center && shellCount(s, center.id) >= shellMax(center.el)
    if (center && tooMany && centerFull && p.charge <= 0) {
      // extra electrons were added by hand and now block the bonds
      return { done: false, tone: 'warn', text: `${cap(c)} is full with ${shellCount(s, center.id)} electrons, and the board has ${k} more ${k === 1 ? 'electron' : 'electrons'} than ${p.name} has. Tap ${c}, then “− electron”${k === 1 ? '' : ` ${k} times`}.` }
    }
    // a positive ion whose middle atom is already full: the extra electron has to come off first
    if (center && tooMany && centerFull) {
      const loose = first.ids.map((id) => atomById(s, id)).find((x) => x && x.id !== center.id)
      return {
        done: false,
        tone: 'warn',
        text: `${cap(c)} is full with ${shellCount(s, center.id)} electrons. The ${chargeWord(p.charge)} charge means the ion has ${plural(k, 'electron')} fewer than these atoms bring. Tap the last ${loose ? lower(loose.el) : 'atom'}, tap “− electron”${k === 1 ? '' : ` ${k} times`}, then drag the ${loose ? lower(loose.el) : 'atom'} onto ${c}.`,
      }
    }
    return { done: false, tone: 'info', text: `${bonded} of ${total} outer atoms bonded to ${c}.` }
  }
  return { done: true, tone: 'good', text: `Every atom is bonded to ${c}. Each line on the board is 2 shared electrons.` }
}

// ---------------------------------------------------------------- step 4: check

export interface CheckRow {
  state: 'pass' | 'fail' | 'wait'
  text: string
}

function describeAtoms(s: Structure, a: Assessment, ids: string[]): string {
  // group by element and count: "Carbon has 6 of 8. 2 oxygen atoms have 7 of 8."
  const groups = new Map<string, { el: El; count: number; target: number; n: number }>()
  for (const id of ids) {
    const r = a.atoms.find((x) => x.id === id)
    if (!r) continue
    const key = `${r.el}:${r.count}`
    const g = groups.get(key) ?? { el: r.el, count: r.count, target: r.target, n: 0 }
    g.n++
    groups.set(key, g)
  }
  const sameEl = (el: El) => s.atoms.filter((x) => x.el === el).length
  return [...groups.values()]
    .map((g) => {
      const who = g.n === 1 ? (sameEl(g.el) === 1 ? cap(lower(g.el)) : `1 ${lower(g.el)} atom`) : `${g.n} ${lower(g.el)} atoms`
      return `${who} ${g.n === 1 ? 'has' : 'have'} ${g.count} of ${g.target}.`
    })
    .join(' ')
}

/** The three checks, in order. `p` is null in free build, where there is no target electron count. */
export function checkRows(p: Problem | null, s: Structure): CheckRow[] {
  const a = assess(s, p ? speciesOf(p) : undefined)
  const rows: CheckRow[] = []
  const blocked = a.issues.find((i) => i.kind === 'missing' || i.kind === 'loose' || i.kind === 'skeleton')

  if (p) {
    const { have, need } = a.electrons
    if (blocked?.kind === 'missing') rows.push({ state: 'fail', text: `${plural(blocked.els.length, 'atom')} still to put on the board.` })
    else if (have === need) rows.push({ state: 'pass', text: `All ${need} valence electrons are on the board.` })
    else rows.push({ state: 'fail', text: `The board has ${plural(have, 'electron')}. ${cap(p.name)} has ${need}.` })
  } else {
    if (s.atoms.length === 0) rows.push({ state: 'wait', text: 'The atoms make one connected molecule.' })
    else if (blocked?.kind === 'loose') rows.push({ state: 'fail', text: `${plural(blocked.ids.length, 'atom is', 'atoms are')} not bonded to the rest.` })
    else rows.push({ state: 'pass', text: s.atoms.length === 1 ? 'One atom on the board.' : 'The atoms make one connected molecule.' })
  }

  const over = a.atoms.filter((x) => x.status === 'over').map((x) => x.id)
  const short = a.atoms.filter((x) => x.count < x.target).map((x) => x.id)
  if (s.atoms.length === 0 || (p && blocked)) rows.push({ state: 'wait', text: 'Every atom has a full outer shell.' })
  else if (over.length) rows.push({ state: 'fail', text: `${describeAtoms(s, a, over)} That is more than the outer shell holds here.` })
  else if (short.length) rows.push({ state: 'fail', text: describeAtoms(s, a, short) })
  else if (a.issues.some((i) => i.kind === 'unpaired')) {
    const ids = a.issues.find((i): i is Extract<Issue, { kind: 'unpaired' }> => i.kind === 'unpaired')!.ids
    const names = [...new Set(ids.map((id) => lower(atomById(s, id)!.el)))]
    rows.push({ state: 'fail', text: `${cap(list(names))} ${ids.length === 1 ? 'has' : 'have'} an electron with no partner.` })
  } else rows.push({ state: 'pass', text: 'Every atom has a full outer shell.' })

  const charged = a.atoms.filter((x) => x.fc !== 0)
  const middle = a.issues.find((i): i is Extract<Issue, { kind: 'middle' }> => i.kind === 'middle')
  if (a.complete) {
    const starCenter = a.topology.kind === 'star' ? atomById(s, a.topology.center) : undefined
    if (charged.length === 0) rows.push({ state: 'pass', text: 'Every formal charge is 0.' })
    // free build with several middle atoms: the charges are shown on the board but not judged
    else if (!p && !starCenter) rows.push({ state: 'wait', text: 'Formal charges are checked only for molecules with one middle atom.' })
    else if (!p && starCenter && s.atoms.length > 2) rows.push({ state: 'pass', text: `The formal charges are as small as they can be with ${lower(starCenter.el)} in the middle.` })
    else rows.push({ state: 'pass', text: 'The formal charges are as small as they can be.' })
  } else if (a.issues.length === 1 && middle) {
    rows.push({ state: 'fail', text: `The formal charges are smaller with ${lower(middle.el)} in the middle.` })
  } else if (a.issues.length === 1 && a.issues[0]!.kind === 'charges') {
    rows.push({ state: 'fail', text: 'The formal charges can be smaller.' })
  } else {
    rows.push({ state: 'wait', text: 'The formal charges are as small as they can be.' })
  }
  return rows
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

/** One next step toward the finished structure, as something the app can do and a sentence that
 *  says it. Every bond, add and remove move returned here was tried against the bonding rules
 *  first, so a hint never tells the student to make a move the board would refuse. */
export type Move =
  /** Drag `from` (an outer atom) onto `to` (the middle atom): one more bond between them. */
  | { kind: 'bond'; from: string; to: string; text: string }
  | { kind: 'add'; atomId: string; text: string }
  | { kind: 'remove'; atomId: string; text: string }
  /** "− electron" on `from`, then "+ electron" on `to`. */
  | { kind: 'transfer'; from: string; to: string; text: string }
  /** Advice that is not a single move (loose atoms, start over with another middle atom). */
  | { kind: 'tell'; text: string }

export function nextMove(p: Problem | null, s: Structure): Move | null {
  const a = assess(s, p ? speciesOf(p) : undefined)
  if (a.complete || s.atoms.length === 0) return null
  const first = a.issues[0]!
  if (first.kind === 'missing' || first.kind === 'skeleton') return p ? { kind: 'tell', text: bondStatus(p, s).text } : null
  if (first.kind === 'loose') return { kind: 'tell', text: 'Drag each loose atom onto the atom it should bond to.' }

  const centerId = a.topology.kind === 'star' ? a.topology.center : null
  const center = centerId ? a.atoms.find((x) => x.id === centerId) : undefined
  const centerAtom = centerId ? atomById(s, centerId) : undefined
  const cName = center ? lower(center.el) : 'the middle atom'
  const outer = a.atoms.filter((x) => x.id !== centerId)
  const short = a.atoms.filter((x) => x.count < x.target)
  const shortOuter = short.filter((x) => x.id !== centerId)
  const centerShort = short.some((x) => x.id === centerId)
  const canBond = (id: string) => !!centerId && share(s, centerId, id).ok
  const orderTo = (id: string) => (centerId ? (bondsOf(s, id).find((b) => b.a === centerId || b.b === centerId)?.order ?? 0) : 0)

  /** One more bond between an outer atom and the middle atom, named by what it makes. */
  const bondAgain = (o: { id: string; el: El }): Move => ({
    kind: 'bond',
    from: o.id,
    to: centerId!,
    text: `Drag ${lower(o.el)} onto ${cName} again. They share 1 more pair, which makes a ${orderTo(o.id) >= 2 ? 'triple' : 'double'} bond. A shared pair counts for both atoms.`,
  })

  const over = a.atoms.find((x) => x.status === 'over')
  if (over) {
    const name = lower(over.el)
    if (removeElectron(s, over.id).ok) return { kind: 'remove', atomId: over.id, text: `${cap(name)} has ${over.count} electrons, more than its outer shell holds here. Tap ${name}, then “− electron”.` }
    return { kind: 'tell', text: `${cap(name)} has ${over.count} electrons, more than its outer shell holds here. Tap one of its bonds, then “Remove a bond”.` }
  }

  if (first.kind === 'electrons') {
    const k = Math.abs(first.need - first.have)
    if (first.have > first.need) {
      // take them off the atom with the most to spare
      const from = [...a.atoms].sort((x, y) => y.count - y.target - (x.count - x.target)).find((x) => removeElectron(s, x.id).ok)
      if (from) return { kind: 'remove', atomId: from.id, text: `The board has ${k} more ${k === 1 ? 'electron' : 'electrons'} than ${p ? p.name : 'it should'}. Tap ${lower(from.el)}, then “− electron”.` }
      return { kind: 'tell', text: `The board has ${k} more ${k === 1 ? 'electron' : 'electrons'} than ${p ? p.name : 'it should'}.` }
    }
    // An ion with extra electrons: bond while the middle atom is still short, then the extra
    // electrons go on the outer atoms that are still short.
    const bondable = centerShort ? shortOuter.find((x) => canBond(x.id)) : undefined
    if (bondable) return bondAgain(bondable)
    const needy = shortOuter.find((x) => addElectron(s, x.id).ok)
    if (needy) {
      const t = lower(needy.el)
      return {
        kind: 'add',
        atomId: needy.id,
        text: `Add the ${k === 1 ? 'missing electron' : `${k} missing electrons`} to ${shortOuter.length === 1 ? `the ${t} atom that is short` : `the ${t} atoms that are short`}: tap the atom, then “+ electron”.`,
      }
    }
    // nobody is short: the electron goes where one is alone, or anywhere there is room
    const lonely = a.atoms.find((x) => x.unpaired && addElectron(s, x.id).ok) ?? a.atoms.find((x) => addElectron(s, x.id).ok)
    if (lonely) return { kind: 'add', atomId: lonely.id, text: `Add ${plural(k, 'electron')}: tap ${lower(lonely.el)}, then “+ electron”.` }
    return { kind: 'tell', text: `Add ${plural(k, 'electron')}: tap an atom, then “+ electron”.` }
  }

  if (first.kind === 'short') {
    // an outer atom that is short bonds to the middle atom again, whenever the middle atom can take it
    const bondable = shortOuter.find((x) => canBond(x.id))
    if (bondable) return bondAgain(bondable)
    if (centerShort) {
      const donor = outer.find((x) => canBond(x.id))
      if (donor) return { kind: 'bond', from: donor.id, to: centerId!, text: `Drag ${lower(donor.el)} onto ${cName} again. ${cap(lower(donor.el))} shares one of its lone pairs with ${cName}.` }
    }
    const needy = shortOuter[0]
    if (needy && centerAtom && removeElectron(s, centerAtom.id).ok && addElectron(s, needy.id).ok) {
      const t = lower(needy.el)
      return {
        kind: 'transfer',
        from: centerAtom.id,
        to: needy.id,
        text: `${cap(cName)} is full, and ${shortOuter.length === 1 ? `1 ${t} atom is` : `${shortOuter.length} ${t} atoms are`} short. Move 1 electron from ${cName} to a short ${t}: “− electron” on ${cName}, then “+ electron” on the ${t}.`,
      }
    }
    return { kind: 'tell', text: 'Bond the short atoms again, or add electrons to them.' }
  }

  if (first.kind === 'unpaired') {
    const who = a.atoms.find((x) => x.id === first.ids[0])
    return { kind: 'tell', text: `Electrons in a finished structure come in pairs. Bond ${who ? lower(who.el) : 'that atom'} to another atom, or add or remove 1 electron.` }
  }
  if (first.kind === 'middle') return { kind: 'tell', text: `Clear the board and build it again with ${lower(first.el)} in the middle.` }

  if (first.kind === 'charges') {
    // A period 3 atom in the middle can take more than 8: an outer atom with a − charge shares a
    // lone pair with it, and both formal charges move toward 0.
    const giver = centerAtom && canExpand(centerAtom.el) ? outer.find((x) => x.fc < 0 && canBond(x.id)) : undefined
    if (giver) {
      const t = lower(giver.el)
      return { kind: 'bond', from: giver.id, to: centerId!, text: `Drag ${a.atoms.filter((x) => x.el === giver.el && x.fc < 0).length > 1 ? `one ${t} that has a − charge` : `the ${t} that has a − charge`} onto ${cName} again. ${cap(cName)} can hold more than 8 electrons, and the double bond brings both formal charges closer to 0.` }
    }
    return { kind: 'tell', text: 'Every shell is full, but another drawing has smaller formal charges. Formal charge = valence electrons − unshared electrons − bonds. Try a different mix of single, double and triple bonds.' }
  }
  return null
}

/** What to do next in the check step, as a sentence. Shown when the student asks for a hint. */
export function checkGuidance(p: Problem | null, s: Structure): string | null {
  return nextMove(p, s)?.text ?? null
}

/** Check step: a wrong idea the board itself shows. Electrons added by hand to fill a shell,
 *  electrons taken off, or full shells taken for a finished drawing. Null while the board is
 *  only unfinished (atoms missing or loose, an ion's charge not yet counted). */
export function checkCoach(p: Problem, s: Structure): Coach | null {
  const sp = speciesOf(p)
  const a = assess(s, sp)
  if (a.issues.some((i) => i.kind === 'missing' || i.kind === 'loose' || i.kind === 'skeleton')) return null
  const have = a.electrons.have
  const need = a.electrons.need ?? have
  const neutral = neutralElectrons(p)
  const c = lower(p.center)
  // More than the atoms brought and more than the species has: someone tapped "+ electron".
  if (have > Math.max(need, neutral)) {
    const k = have - need
    const from = [...a.atoms].sort((x, y) => y.count - y.target - (x.count - x.target)).find((x) => removeElectron(s, x.id).ok)
    // the finished drawing shares more pairs than the board does now
    const ref = solveStar(sp.center, sp.terminals, sp.charge)
    const wanted = ref ? (bestStructures(ref)[0]?.orders.reduce((n, o) => n + o, 0) ?? 0) : 0
    const shared = s.bonds.reduce((n, b) => n + b.order, 0)
    return {
      lead: `The board has ${plural(have, 'electron')}, ${k} more than ${p.name} has.`,
      why: `${cap(p.name)} has the ${need} valence electrons counted in step 1 and no others, so electrons can't be added to fill a shell.`,
      ask: `${from ? `Tap ${lower(from.el)}, then “− electron”.` : 'Take the extra electrons off.'}${shared < wanted ? ` An atom that is short after that can share 1 more pair with ${c}.` : ''}`,
    }
  }
  if (have < Math.min(need, neutral)) {
    const k = need - have
    const to = a.atoms.find((x) => x.count < x.target && addElectron(s, x.id).ok) ?? a.atoms.find((x) => addElectron(s, x.id).ok)
    return {
      lead: `The board has ${plural(have, 'electron')}, ${k} fewer than ${p.name} has.`,
      why: `All ${need} valence electrons counted in step 1 have to be in the drawing.`,
      ask: to ? `Tap ${lower(to.el)}, then “+ electron”.` : 'Put the missing electrons back.',
    }
  }
  if (a.issues.length === 1 && a.issues[0]!.kind === 'charges') {
    // the checklist above already says the shells are full and the charges are not as small as they can be
    return { lead: `More than one drawing of ${p.name} fills every shell.`, why: 'The drawing with formal charges closest to 0 is the one that is used.', ask: '' }
  }
  return null
}

/** Notes shown under the checklist once the structure is right. */
export function finishedNotes(p: Problem, s: Structure): string[] {
  const sp = speciesOf(p)
  const a = assess(s, sp)
  if (!a.complete) return []
  const notes: string[] = []
  const center = a.atoms.find((x) => a.topology.kind === 'star' && x.id === a.topology.center)

  const ref = solveStar(sp.center, sp.terminals, sp.charge)
  const forms = ref ? bestStructures(ref) : []
  if (forms.length > 1) {
    const sol = forms[0]!
    const at = sol.orders.findIndex((o) => o > 1)
    const el = at >= 0 ? sp.terminals[at]! : sp.terminals[0]!
    const doubles = sol.orders.filter((o, i) => o > 1 && sp.terminals[i] === el).length
    const same = sp.terminals.filter((x) => x === el).length
    const n = forms.length
    const where =
      doubles === 1
        ? `The double bond could be drawn on ${same === 2 ? `either ${lower(el)}` : `any of the ${same} ${lower(el)} atoms`}.`
        : `The ${doubles} double bonds could be drawn on any ${doubles} of the ${same} ${lower(el)} atoms.`
    notes.push(`${where} The real ion is an average of the ${n} drawings, which are called resonance structures.`)
  }
  if (center && center.count < 8 && center.el !== 'H') {
    notes.push(`${cap(lower(center.el))} has only ${center.count} electrons around it. Atoms in groups 2 and 13, such as ${lower(center.el)}, often end up with fewer than 8.`)
  }
  if (center && center.count > 8) {
    notes.push(`${cap(lower(center.el))} has ${center.count} electrons around it. Atoms from period 3 onward can hold more than 8.`)
  }
  const charged = a.atoms.filter((x) => x.fc !== 0)
  if (charged.length) {
    const byKey = new Map<string, { el: El; fc: number; n: number }>()
    for (const x of charged) {
      const g = byKey.get(`${x.el}${x.fc}`) ?? { el: x.el, fc: x.fc, n: 0 }
      g.n++
      byKey.set(`${x.el}${x.fc}`, g)
    }
    const howMany = (el: El) => s.atoms.filter((x) => x.el === el).length
    const parts = [...byKey.values()].map((g) =>
      g.n > 1 ? `${signed(g.fc)} on each of ${g.n} ${lower(g.el)} atoms` : howMany(g.el) > 1 ? `${signed(g.fc)} on one ${lower(g.el)} atom` : `${signed(g.fc)} on ${lower(g.el)}`,
    )
    const sum = p.charge === 0 ? '0, because the molecule has no charge' : `the ion's ${chargeWord(p.charge)} charge`
    notes.push(charged.length === 1 ? `Formal charge: ${parts[0]}, the same as ${sum}.` : `Formal charges: ${list(parts)}. They add up to ${sum}.`)
  }
  return notes
}

/** "6 − 4 − 2 = 0": an atom's formal charge worked out. */
export function formalChargeSum(s: Structure, id: string): string {
  const atom = atomById(s, id)
  if (!atom) return ''
  const bonds = bondsOf(s, id).reduce((n, b) => n + b.order, 0)
  const v = ELEMENTS[atom.el].valence
  return `${v} − ${atom.lone} − ${bonds} = ${signed(v - atom.lone - bonds)}`
}

// ---------------------------------------------------------------- step 5: shape

export interface GroupFacts {
  bonded: number
  lonePairs: number
  groups: number
  /** Bonds counted one per shared pair, the usual miscount. */
  bondPairs: number
  /** Lone pairs on the outer atoms, which are not groups around the middle atom. */
  outerPairs: number
}
export function groupFacts(s: Structure): GroupFacts | null {
  const a = assess(s)
  if (a.topology.kind !== 'star') return null
  const d = centerDomains(s, a.topology.center)
  const outerPairs = a.topology.terminals.reduce((n, id) => n + Math.floor((atomById(s, id)?.lone ?? 0) / 2), 0)
  return { bonded: d.bonds.length, lonePairs: d.lonePairs, groups: d.bonds.length + d.lonePairs, bondPairs: d.bonds.reduce((n, b) => n + b.order, 0), outerPairs }
}

const pairsText = (n: number) => (n === 0 ? 'no lone pairs' : plural(n, 'lone pair'))

/** The wrong idea a group count most likely came from. Each one says which groups to ring on the board. */
function groupsIdea(center: El, f: GroupFacts, answer: number): Coach {
  const c = lower(center)
  const count = `Count the atoms bonded to ${c}, then the lone pairs on ${c}.`
  const one = f.lonePairs === 1
  if (answer === f.bondPairs + f.lonePairs && f.bondPairs !== f.bonded) {
    return {
      lead: `${answer} counts every shared pair as its own group.`,
      why: 'The pairs in a double or triple bond sit between the same 2 atoms, so the whole bond points one way and is 1 group.',
      ask: 'Count each bond once.',
      show: { kind: 'groups', which: 'multiple' },
    }
  }
  if (answer === f.bonded && f.lonePairs > 0) {
    return {
      lead: `${answer} is the number of atoms bonded to ${c}.`,
      why: `${one ? 'The lone pair' : `The ${f.lonePairs} lone pairs`} on ${c} ${one ? 'takes' : 'take'} up room around ${c} as well, so ${one ? 'the lone pair is a group' : 'each lone pair is a group'}.`,
      ask: `Count ${one ? 'the lone pair' : 'the lone pairs'} on ${c} too.`,
      show: { kind: 'groups', which: 'lone' },
    }
  }
  if (answer === f.bonded + 1 && f.lonePairs >= 2) {
    return {
      lead: `${answer} counts the ${f.lonePairs} lone pairs on ${c} as 1 group.`,
      why: `Each lone pair takes up its own room around ${c}, so each one is a group.`,
      ask: 'Count every lone pair.',
      show: { kind: 'groups', which: 'lone' },
    }
  }
  if (f.outerPairs > 0 && answer === f.groups + f.outerPairs) {
    return { lead: `${answer} counts the lone pairs on the outer atoms.`, why: `Only the groups on ${c} set the shape around ${c}.`, ask: count, show: { kind: 'groups', which: 'all' } }
  }
  if (answer === f.bonded + 1 && f.lonePairs === 0) {
    return { lead: `${answer} counts ${c} as a group.`, why: `The groups are the bonds and lone pairs around ${c}.`, ask: count, show: { kind: 'groups', which: 'all' } }
  }
  return { lead: `${cap(c)} doesn't have ${plural(answer, 'group')} around it.`, why: '', ask: count }
}

/** What to say about a wrong group count. The second miss lists what is around the middle atom
 *  and rings each group on the board in turn. */
export function groupsCoach(center: El, f: GroupFacts, answer: number, tries: number): Coach {
  const idea = groupsIdea(center, f, answer)
  if (tries < 2) return idea
  return { lead: idea.lead, why: idea.why, ask: `${cap(lower(center))} has ${plural(f.bonded, 'bonded atom')} and ${pairsText(f.lonePairs)}.`, show: { kind: 'groups', which: 'all' } }
}
export function groupsRight(center: El, f: GroupFacts): string {
  return `${plural(f.groups, 'group')}: ${plural(f.bonded, 'bonded atom')} and ${pairsText(f.lonePairs)} on ${lower(center)}.`
}

/** Four shape names to pick from: the right one, the arrangement of all the groups if it differs,
 *  and shapes with the same number of atoms. Always in the same table order. */
export function shapeChoices(info: ShapeInfo): ShapeName[] {
  const pool: ShapeName[] = [info.shape]
  const add = (name: ShapeName) => {
    if (pool.length < 4 && !pool.includes(name)) pool.push(name)
  }
  add(info.geometry)
  const sameAtoms: Record<number, ShapeName[]> = {
    2: ['linear', 'bent', 'trigonal planar', 'tetrahedral'],
    3: ['trigonal planar', 'trigonal pyramidal', 'T-shaped', 'tetrahedral'],
    4: ['tetrahedral', 'square planar', 'seesaw', 'trigonal bipyramidal'],
    5: ['trigonal bipyramidal', 'square pyramidal', 'octahedral', 'seesaw'],
    6: ['octahedral', 'square pyramidal', 'trigonal bipyramidal', 'square planar'],
  }
  for (const name of sameAtoms[info.bonded] ?? []) add(name)
  for (const name of ALL_SHAPES) add(name)
  return ALL_SHAPES.filter((name) => pool.includes(name))
}

const GEOMETRY_NOUN: Record<string, string> = {
  linear: 'a line',
  'trigonal planar': 'a flat triangle',
  tetrahedral: 'a tetrahedron',
  'trigonal bipyramidal': 'a trigonal bipyramid',
  octahedral: 'an octahedron',
}

/** The student has committed to a shape and the model is about to lift into 3D, so a wrong pick
 *  is told the right shape. The first two parts say what the picked shape is and why this
 *  molecule is not that. */
export function shapeFeedback(center: El, info: ShapeInfo, pick: ShapeName): { right: boolean; text: string; coach: Coach | null } {
  const c = lower(center)
  const has = `${plural(info.bonded, 'atom')} and ${pairsText(info.lonePairs)}`
  if (pick === info.shape) return { right: true, text: `${cap(info.shape)}: ${has} around ${c}.`, coach: null }
  const answer = `The shape is ${info.shape}.`
  const corners = `The ${info.groups} groups point to the corners of ${GEOMETRY_NOUN[info.geometry]}`
  let coach: Coach
  if (pick === info.geometry) {
    // the arrangement of every group, lone pairs included
    coach = {
      lead: `${cap(pick)} is the arrangement of all ${info.groups} groups around ${c}, lone pairs included.`,
      why: `${corners}, and ${info.lonePairs === 1 ? '1 corner holds a lone pair' : `${info.lonePairs} corners hold lone pairs`}. A shape is named for where the atoms are.`,
      ask: answer,
    }
  } else if (info.lonePairs > 0 && pick === classify(info.bonded, 0)?.shape) {
    // the shape these atoms would make with no lone pairs: the lone pairs were left out
    coach = {
      lead: `${cap(pick)} would be the shape if ${c} had no lone pairs.`,
      why: `${cap(c)} has ${pairsText(info.lonePairs)}, and each lone pair takes up room around ${c} too. ${corners}, and the bonded atoms sit at ${info.bonded} of them.`,
      ask: answer,
    }
  } else if (info.shape === 'tetrahedral' && pick === 'square planar') {
    // four bonds drawn as a cross on paper
    coach = {
      lead: 'Square planar is how the 4 bonds look in a flat drawing, 90° apart.',
      why: 'In 3D the 4 groups get further apart than that: 109.5°, at the corners of a tetrahedron.',
      ask: answer,
    }
  } else {
    // bent and linear each come from two counts of lone pairs: "2 atoms and 1 or 2 lone pairs"
    const cases = shapeCases(pick)
    const pairs = cases.length === 1 ? pairsText(cases[0]!.lonePairs) : `${cases.map((k) => k.lonePairs).join(' or ')} lone pairs`
    coach = { lead: `${cap(pick)} is the shape for ${plural(cases[0]!.bonded, 'atom')} and ${pairs} around the middle atom.`, why: `${cap(c)} has ${has} around it.`, ask: answer }
  }
  return { right: false, text: coachText(coach), coach }
}

export interface ShapeReadout {
  groups: string
  arrangement: string
  shape: string
  angle: string
  why: string | null
}

/** True when the atoms around the middle atom are not all the same element. */
export function mixedOuter(s: Structure): boolean {
  const a = assess(s)
  if (a.topology.kind !== 'star') return false
  return new Set(a.topology.terminals.map((id) => atomById(s, id)?.el)).size > 1
}
/** The shape's bond angles in words, one entry per angle. Different outer atoms push a little
 *  differently, so with mixed outer atoms an ideal angle is "about" right. Two groups stay on a
 *  straight line whatever the atoms are. */
function angleParts(info: ShapeInfo, mixed: boolean): string[] {
  return info.angle.split(' and ').map((part) => (mixed && info.groups >= 3 && !part.startsWith('less') ? `about ${part}` : part))
}

export function shapeReadout(p: Problem | null, center: El, info: ShapeInfo, mixed = false): ShapeReadout {
  const measured = p ? MEASURED_ANGLE[p.id] : undefined
  const c = lower(center)
  let why: string | null = null
  const squeezed = info.angle.startsWith('less')
  if (info.diatomic) why = 'Two atoms always sit on a straight line.'
  else if (squeezed && info.groups === 5) why = `Lone pairs take the seats around the middle of a trigonal bipyramid, where they have the most room. They push the bonds closer together.`
  else if (squeezed) why = `A lone pair pushes harder than a bond, so the bonds on ${c} end up closer together.`
  else if (info.lonePairs === 2 && info.groups === 6) why = `The 2 lone pairs sit on opposite sides of ${c}, so their pushes cancel and the bonds stay at 90°.`
  else if (info.lonePairs === 3 && info.groups === 5) why = `The 3 lone pairs spread evenly around the middle of ${c}, so the 2 bonds stay on a straight line.`
  return {
    groups: `${info.groups} (${plural(info.bonded, 'bonded atom')}, ${pairsText(info.lonePairs)})`,
    arrangement: info.geometry,
    shape: info.shape,
    angle: info.diatomic ? 'none (2 atoms)' : measured ? `${info.angle} (measured: ${measured})` : angleParts(info, mixed).join(' and '),
    why,
  }
}

/** A bond angle to mark on the 3D model: the angle it is close to in the textbook arrangement, and the words to print beside it. */
export interface AngleMark {
  near: number
  text: string
  /** The real angle is somewhere below `near` (lone pairs squeeze it). */
  under: boolean
}
/** One mark per angle the shape has. Water and ammonia get their measured angle; nothing is ever read off the model. */
export function angleMarks(p: Problem | null, info: ShapeInfo, mixed = false): AngleMark[] {
  if (info.diatomic || !info.angle) return []
  const parts = info.angle.split(' and ')
  const words = angleParts(info, mixed)
  const measured = p && parts.length === 1 ? MEASURED_ANGLE[p.id] : undefined
  return parts.map((part, i) => ({ near: parseFloat(part.replace(/^less than /, '')), text: measured ?? words[i]!, under: part.startsWith('less') }))
}

// ---------------------------------------------------------------- refusals and hints

export function refusalText(s: Structure, why: Refusal, atomId?: string): string {
  const atom = atomId ? atomById(s, atomId) : undefined
  if (why === 'shell-full' && atom) {
    const n = shellCount(s, atom.id)
    const max = shellMax(atom.el)
    const name = lower(atom.el)
    // a bonded hydrogen is full, which is why hydrogen is always on the outside
    if (n >= max && atom.el === 'H' && bondsOf(s, atom.id).length === 1) return `Hydrogen already has 2 electrons around it. Its outer shell holds 2, so a hydrogen atom makes only 1 bond.`
    if (n >= max) return `${cap(name)} already has ${plural(n, 'electron')} around it. Its outer shell holds ${max}.`
    return `${cap(name)} has ${plural(n, 'electron')} around it and its outer shell holds ${max}, so there is no room for 2 more.`
  }
  if (why === 'max-order') return 'These two atoms already share a triple bond, the most two atoms can share.'
  if (why === 'no-electrons') {
    return atom ? `${cap(lower(atom.el))} has no unshared electrons to take off.` : 'A bond needs 2 electrons. These two atoms have fewer than 2 unshared electrons between them.'
  }
  return 'A bond needs two different atoms.'
}

/** Hints for a step, weakest first. The panel shows as many as the student has asked for. */
export function hintsFor(step: StepId, p: Problem, s: Structure, totalNext = false): string[] {
  const c = lower(p.center)
  // every atom's count is right and the total is the open question
  if (step === 'count' && totalNext) return [totalMethod(p), totalParts(p)]
  if (step === 'count') {
    const rule = p.formula.every(([el]) => ELEMENTS[el].group > 2)
      ? 'For groups 13 to 18, subtract 10 from the group number to get the valence electrons.'
      : 'In groups 1 and 2, the group number is the number of valence electrons. For groups 13 to 18, subtract 10.'
    return ['Find each atom on this periodic table. The number above its column is its group number.', rule]
  }
  if (step === 'place') {
    return [
      'The middle atom is usually the least electronegative one. Hydrogen is never in the middle.',
      `Put ${c} in the middle of the board and the other atoms around it.`,
    ]
  }
  if (step === 'bond') {
    return [`Press on an outer atom, drag it until it touches ${c}, and let go.`, `To undo a bond, tap the line between the two atoms, then “Remove a bond”.`]
  }
  if (step === 'check') {
    const g = checkGuidance(p, s)
    return g ? [g] : []
  }
  const f = groupFacts(s)
  if (!f) return []
  return [`Count the atoms bonded to ${c}, then the lone pairs on ${c}.`, `${cap(c)} has ${plural(f.bonded, 'bonded atom')} and ${pairsText(f.lonePairs)}.`]
}

/** True when the step's work is finished on the board (the count and shape steps track their own answers). */
export function boardStepDone(step: StepId, p: Problem, s: Structure): boolean {
  if (step === 'place') return placedCount(p, s).placed === atomsOf(p).length
  if (step === 'bond') return bondStatus(p, s).done
  if (step === 'check') return assess(s, speciesOf(p)).complete
  return false
}

/** The shape of the finished guided structure. */
export function shapeInfoFor(s: Structure): ShapeInfo | null {
  const f = groupFacts(s)
  if (!f) return null
  if (f.bonded === 1) return { groups: 1 + f.lonePairs, bonded: 1, lonePairs: f.lonePairs, geometry: 'linear', shape: 'linear', angle: '', diatomic: true }
  return classify(f.bonded, f.lonePairs)
}

