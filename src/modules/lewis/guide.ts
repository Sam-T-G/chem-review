// The guided walk through one problem: what each step asks, when it is done, and every sentence
// the panel shows. Pure functions of the problem and the board, so the wording is testable.
//
// Wording rules (Sam's voice rules): plain and literal, name the atom instead of "it", say what
// to do, no citations on screen, no lines that describe the interface.
import { assess, type Assessment, type Issue } from '../../chem/assess'
import { ELEMENTS, EL_ORDER, canExpand, shellMax, shellTarget, shellsOf, type El } from '../../chem/elements'
import { HYBRIDS, domainsOf, hybridFor, sigmaPi, type Hybrid } from '../../chem/orbitals'
import { bondPolarity, courseEN, moleculePolarity, netAsSeen, type BondPolarity, type MoleculePolarity, type SeenBond } from '../../chem/polarity'
import { atomsOf, chargeWord, neutralElectrons, speciesOf, totalElectrons, type Problem } from '../../chem/problems'
import { bestStructures, solveStar } from '../../chem/solve'
import { addElectron, atomById, bondsOf, removeElectron, share, shellCount, type Refusal, type Structure } from '../../chem/structure'
import { ALL_SHAPES, MEASURED_ANGLE, centerDomains, classify, shapeCases, type Geometry, type ShapeInfo, type ShapeName } from '../../chem/vsepr'

export type StepId = 'count' | 'place' | 'bond' | 'check' | 'shape' | 'polar' | 'orbitals'
/** `next` is the label of the button that leads on from the step. The last step's button leads to the next molecule. */
export const STEPS: { id: StepId; label: string; title: string; next: string }[] = [
  { id: 'count', label: 'Count', title: 'Count the valence electrons', next: 'Put the atoms on the board' },
  { id: 'place', label: 'Place', title: 'Put the atoms on the board', next: 'Bond the atoms' },
  { id: 'bond', label: 'Bond', title: 'Bond the atoms', next: 'Check each atom' },
  { id: 'check', label: 'Check', title: 'Check each atom', next: 'Find both geometries' },
  { id: 'shape', label: 'Shape', title: 'Find the electron geometry and the molecular geometry', next: 'Find the polar bonds' },
  { id: 'polar', label: 'Polar', title: 'Find the polar bonds', next: 'Find the sigma and pi bonds' },
  { id: 'orbitals', label: 'Orbitals', title: 'Find the sigma and pi bonds', next: 'Next molecule' },
]
/** The steps that work on the finished 3D model. */
export const AFTER_SHAPE: StepId[] = ['polar', 'orbitals']

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
  return { lead: `The total is not ${answer}.`, why: totalMethod(p), ask: `Add up what ${atoms === 2 ? 'both atoms' : `all ${atoms} atoms`} bring${charge}.` }
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
  return `Bond ${eachOuter(p)} to ${lower(p.center)}. Each bond is 2 shared electrons${p.charge > 0 ? '' : ', one from each atom'}.`
}
/** What the place step asks for, once the middle atom is known. */
export function placeInstruction(p: Problem): string {
  const n = atomsOf(p).length
  return middleNeeded(p) ? `Put all ${n} atoms on the board, with ${lower(p.center)} in the middle.` : `Put all ${n} atoms on the board.`
}

// ---------------------------------------------------------------- how to act on the board
//
// The steps that are worked on the board say how: which gesture puts an atom down, makes a bond,
// or changes an electron. The pointing finger on the board acts out the first of them.

/** One way to act on the board, and the gesture it takes. */
export interface HowTo {
  gesture: 'drag' | 'tap' | 'swipe'
  text: string
}
/** Said beside the bin while an atom is being carried. */
export const BIN_WORDS = 'Drop here to take it off'
const CUT: HowTo = { gesture: 'swipe', text: 'To take a bond back, swipe across its line.' }
const BIN: HowTo = { gesture: 'drag', text: 'To take an atom off the board, drag it to the bin in the corner.' }
/** "an oxygen atom", "a hydrogen atom", or "an outer atom" when the outer atoms differ. */
function oneOuter(p: Problem): string {
  const kinds = [...new Set(outerEls(p))]
  if (kinds.length !== 1) return 'an outer atom'
  const name = lower(kinds[0]!)
  return `${/^[aeio]/.test(name) ? 'an' : 'a'} ${name} atom`
}
/** How the board is worked in a step: empty for the steps that are answered in the panel. */
export function howTo(step: StepId, p: Problem): HowTo[] {
  const c = lower(p.center)
  if (step === 'place') return [{ gesture: 'drag', text: 'Press on an atom in the row under the board, drag it onto the board and let go. A tap on the atom puts it on the board too.' }, BIN]
  if (step === 'bond') return [{ gesture: 'drag', text: `Press on ${oneOuter(p)}, drag it onto ${c} and let go.` }, CUT]
  if (step === 'check') {
    return [
      { gesture: 'drag', text: `To add a second or third bond, drag the outer atom onto ${c} again.` },
      CUT,
      { gesture: 'tap', text: 'To add or take off an electron, tap an atom, then “+ electron” or “− electron”.' },
    ]
  }
  return []
}
/** How the board is worked in free build. */
export function howToFree(): HowTo[] {
  return [
    { gesture: 'drag', text: 'Drag an atom from the row under the board onto the board. Drop it on another atom to bond the two.' },
    { gesture: 'drag', text: 'To bond two atoms on the board, drag one onto the other.' },
    CUT,
    BIN,
    { gesture: 'tap', text: 'To add or take off an electron, tap an atom, then “+ electron” or “− electron”.' },
  ]
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

/** One of the three checks as the strip over the board shows it: a name, a count where the check
 *  has one, and the full sentence from the list in step 4 for a screen reader. */
export interface CheckChip {
  id: 'electrons' | 'joined' | 'shells' | 'charges'
  state: CheckRow['state']
  /** The name, and a shorter one for a narrow screen. */
  label: string
  short: string
  /** "2 of 3", or nothing. */
  value: string
  says: string
}
/** The same three checks as `checkRows`, in the same order and with the same states, for the
 *  strip that stays over the board in every step. Two differences, both about an electron total
 *  that is not wrong yet. While atoms are still off the board, the strip shows that check as
 *  waiting. And in the steps before the check step (`early`), an ion whose atoms still hold exactly
 *  what neutral atoms bring is waiting too: the ion's charge is dealt with in the check step. */
export function checkChips(p: Problem | null, s: Structure, early = false): CheckChip[] {
  const rows = checkRows(p, s)
  const a = assess(s, p ? speciesOf(p) : undefined)
  const atoms = p ? atomsOf(p).length : s.atoms.length
  // when the check passes, every atom counts (a loose piece with an unpaired electron is not judged yet, as in the list)
  const full = rows[1]!.state === 'pass' ? atoms : a.atoms.filter((x) => x.status === 'full').length
  const placing = !!p && a.issues.some((i) => i.kind === 'missing') && a.electrons.have <= (a.electrons.need ?? 0)
  const chargeToCome = !!p && early && p.charge !== 0 && a.electrons.have === neutralElectrons(p)
  const first: CheckChip = p
    ? { id: 'electrons', state: placing || chargeToCome ? 'wait' : rows[0]!.state, label: 'Electron total', short: 'Electrons', value: '', says: rows[0]!.text }
    : { id: 'joined', state: rows[0]!.state, label: 'One molecule', short: 'Joined', value: '', says: rows[0]!.text }
  return [
    first,
    { id: 'shells', state: rows[1]!.state, label: 'Full shells', short: 'Shells', value: atoms ? `${full} of ${atoms}` : '', says: rows[1]!.text },
    { id: 'charges', state: rows[2]!.state, label: 'Formal charges', short: 'Charges', value: '', says: rows[2]!.text },
  ]
}
/** The electrons on the board as pairs, for the counter over the board: "4 pairs" in bonds, and
 *  "6 lone pairs" once every atom has a full shell. Before that, an atom's unshared electrons are
 *  not all in pairs (a loose carbon atom has 4 single electrons), so no number is given. */
export function pairWords(s: Structure): { bonded: string; lone: string } {
  const lines = s.bonds.reduce((n, b) => n + b.order, 0)
  const a = assess(s)
  const settled = a.atoms.every((x) => x.status === 'full') && !a.issues.some((i) => i.kind === 'unpaired')
  const lone = s.atoms.reduce((n, x) => n + Math.floor(x.lone / 2), 0)
  return { bonded: lines ? plural(lines, 'pair') : '', lone: settled && lone ? plural(lone, 'lone pair') : '' }
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
  /** Double and triple bonds on the middle atom, so a card names the kind of bond the molecule has. */
  doubles: number
  triples: number
}
export function groupFacts(s: Structure): GroupFacts | null {
  const a = assess(s)
  if (a.topology.kind !== 'star') return null
  const d = centerDomains(s, a.topology.center)
  const outerPairs = a.topology.terminals.reduce((n, id) => n + Math.floor((atomById(s, id)?.lone ?? 0) / 2), 0)
  const doubles = d.bonds.filter((b) => b.order === 2).length
  const triples = d.bonds.filter((b) => b.order === 3).length
  return { bonded: d.bonds.length, lonePairs: d.lonePairs, groups: d.bonds.length + d.lonePairs, bondPairs: d.bonds.reduce((n, b) => n + b.order, 0), outerPairs, doubles, triples }
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
    return { lead: `${answer} counts the lone pairs on the outer atoms.`, why: `Those lone pairs sit on the outer atoms, so they are not groups around ${c}.`, ask: count, show: { kind: 'groups', which: 'all' } }
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

/** The three questions of step 5, in order: the electron groups, the electron geometry, the
 *  molecular geometry. Each one says what it counts, so the two geometries read apart. */
export function groupsQuestion(center: El): { ask: string; sub: string } {
  return { ask: `How many electron groups are around ${lower(center)}?`, sub: 'A lone pair (2 unshared electrons on one atom) is 1 group. A bond is 1 group, even a double or triple bond.' }
}
export function geometryQuestion(center: El): { ask: string; sub: string } {
  const c = lower(center)
  return { ask: `What is the electron geometry around ${c}?`, sub: `The electron geometry is how every electron group around ${c} is spread out, lone pairs included. The groups push each other as far apart as they can get.` }
}
/** Where the lone pairs go when the corners are not alike, for the second hint of the molecular
 *  geometry: in the flat triangle of a trigonal bipyramid, and on opposite corners of an octahedron
 *  when there are 2 (section 7.6). Empty where every corner is alike. It names no molecular geometry. */
function lonePairCorners(groups: number, lonePairs: number): string {
  if (groups === 5 && lonePairs > 0) return `${lonePairs === 1 ? 'The lone pair takes 1' : lonePairs === 3 ? 'The 3 lone pairs take all 3' : `The ${lonePairs} lone pairs take ${lonePairs}`} of the 3 corners in the flat triangle. `
  if (groups === 6 && lonePairs === 2) return 'The 2 lone pairs take 2 corners on opposite sides. '
  return ''
}
/** The name over the picks of step 5's two questions. On a phone the picks fill the panel and the
 *  question scrolls out of view, so the picks carry the name of what is asked. */
export const PICKS_NAME = { geometry: 'Electron geometry', shapes: 'Molecular geometry' } as const
export function shapeQuestion(center: El): { ask: string; sub: string } {
  // the line is the same for every molecule: "lone pairs on nitrogen" would tell methane's student that carbon has some
  return { ask: `What is the molecular geometry around ${lower(center)}?`, sub: 'To name the molecular geometry, look only at where the atoms sit. The lone pairs still take up room, but they are left out of the name.' }
}

/** Four molecular geometries to pick from: the right one, the electron geometry if it differs,
 *  and the molecular geometries with the same number of atoms. Always in the same table order. */
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

/** The student has committed to a molecular geometry and the model is about to lift into 3D, so a
 *  wrong pick is told the right one. The first two parts say what the pick is and why this
 *  molecule is not that. */
export function shapeFeedback(center: El, info: ShapeInfo, pick: ShapeName): { right: boolean; text: string; coach: Coach | null } {
  const c = lower(center)
  if (info.diatomic) {
    // two atoms: no middle atom and no groups to count around one, so nothing is argued from them
    if (pick === 'linear') return { right: true, text: TWO_ATOMS_SHAPE_RIGHT, coach: null }
    const two: Coach = { lead: `${cap(pick)} does not fit a molecule of 2 atoms.`, why: TWO_ATOMS_WHY, ask: 'The molecular geometry is linear.' }
    return { right: false, text: coachText(two), coach: two }
  }
  const has = `${plural(info.bonded, 'bonded atom')} and ${pairsText(info.lonePairs)}`
  if (pick === info.shape) return { right: true, text: `The molecular geometry is ${info.shape}: ${has} around ${c}.`, coach: null }
  const answer = `The molecular geometry is ${info.shape}.`
  const corners = `The ${info.groups} electron groups point to the corners of ${GEOMETRY_NOUN[info.geometry]}`
  let coach: Coach
  if (pick === info.geometry) {
    // the electron geometry: every group, lone pairs included
    coach = {
      lead: `${cap(pick)} is the electron geometry: all ${info.groups} electron groups around ${c}, lone pairs included.`,
      why: `${corners}, and ${info.lonePairs === 1 ? '1 corner holds a lone pair' : `${info.lonePairs} corners hold lone pairs`}.`,
      ask: `Leave out ${info.lonePairs === 1 ? 'the corner that holds the lone pair' : `the ${info.lonePairs} corners that hold lone pairs`}, and the ${plural(info.bonded, 'bonded atom')} make a ${info.shape} molecular geometry.`,
    }
  } else if (info.lonePairs > 0 && pick === classify(info.bonded, 0)?.shape) {
    // the molecular geometry these atoms would have with no lone pairs: the lone pairs were left out
    coach = {
      lead: `${cap(pick)} would be the molecular geometry if ${c} had no lone pairs.`,
      why: `${cap(c)} has ${pairsText(info.lonePairs)}, and each lone pair takes up room around ${c} too. ${corners}, and the bonded atoms sit at ${info.bonded} of them.`,
      ask: answer,
    }
  } else if (info.shape === 'tetrahedral' && pick === 'square planar') {
    // four bonds drawn as a cross on paper
    coach = {
      lead: 'Square planar is how the 4 bonds look in a flat drawing, 90° apart.',
      why: 'In 3D the 4 electron groups get further apart than that: 109.5°, at the corners of a tetrahedron.',
      ask: answer,
    }
  } else {
    // bent and linear each come from two counts of lone pairs: "2 atoms and 1 or 2 lone pairs"
    const cases = shapeCases(pick)
    const pairs = cases.length === 1 ? pairsText(cases[0]!.lonePairs) : `${cases.map((k) => k.lonePairs).join(' or ')} lone pairs`
    coach = { lead: `${cap(pick)} is the molecular geometry for ${plural(cases[0]!.bonded, 'bonded atom')} and ${pairs} around the middle atom.`, why: `${cap(c)} has ${has}.`, ask: answer }
  }
  return { right: false, text: coachText(coach), coach }
}

/** The electron geometry for each number of electron groups (section 7.6). */
const GEOMETRY_FOR: Record<number, Geometry> = { 2: 'linear', 3: 'trigonal planar', 4: 'tetrahedral', 5: 'trigonal bipyramidal', 6: 'octahedral' }
const groupsOfGeometry = (g: Geometry) => Number(Object.keys(GEOMETRY_FOR).find((n) => GEOMETRY_FOR[Number(n)] === g))
/** The rule that turns a count of groups into an electron geometry. With the count on screen it is
 *  the answer, so only the third miss gives it, as the reason for the answer (COPY2-2). */
const GEOMETRY_RULE = 'The electron geometry follows the number of electron groups: 2 is linear, 3 is trigonal planar, 4 is tetrahedral, 5 is trigonal bipyramidal and 6 is octahedral.'

/** The five electron geometries, in the order of the shape table: 2 to 6 electron groups. */
export function geometryChoices(): Geometry[] {
  return ['linear', 'trigonal planar', 'tetrahedral', 'trigonal bipyramidal', 'octahedral']
}
/** The smaller question the second miss and the second hint hand back: which of the five spreads
 *  this many groups apart. It lists all five, so it names no answer. */
const geometryAsk = (groups: number) => {
  const names = geometryChoices()
  return `Which of these 5 electron geometries spreads ${plural(groups, 'electron group')} as far apart as they can get: ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}?`
}
const isGeometry = (name: ShapeName): name is Geometry => (Object.values(GEOMETRY_FOR) as ShapeName[]).includes(name)
/** The picks for the electron geometry in the guided steps: the five electron geometries, and with
 *  them the molecular geometries that the same number of electron groups can make (for 4 groups:
 *  trigonal pyramidal and bent), so a student can give a molecular geometry where the electron
 *  geometry is asked and be told the difference. The extra names depend on the count of groups
 *  alone, which is already on screen, so they say nothing about this molecule's lone pairs. With 2
 *  groups the only molecular geometry is linear, and bent is offered. With 6 groups square planar
 *  is offered alone: with square pyramidal as well the picks take a fourth row on a phone, which is
 *  taller than the panel there (measured at 390 px wide: 220 px of picks in a 221 px panel).
 *  Always in table order. */
export function geometryPicks(info: ShapeInfo): ShapeName[] {
  const pool: ShapeName[] = [...geometryChoices()]
  if (info.groups === 6) pool.push('square planar')
  else {
    for (let lonePairs = 1; lonePairs < info.groups; lonePairs++) {
      const name = classify(info.groups - lonePairs, lonePairs)?.shape
      if (name && !pool.includes(name)) pool.push(name)
    }
  }
  if (pool.length === 5) pool.push('bent')
  return ALL_SHAPES.filter((name) => pool.includes(name))
}
/** A molecule of two atoms (an exercise can be one). Its `groups` counts around one of its atoms,
 *  so no line about it gives a count of groups or a middle atom. */
/** The straight line is the reason for the molecular geometry only. The electron geometry of 2
 *  atoms is linear because the course gives it the same name (D-0033, CHEM2-4), so that line states
 *  the name and gives no reason drawn from where the atoms sit. */
const TWO_ATOMS_SHAPE_RIGHT = 'The molecular geometry is linear: 2 atoms always sit on a straight line.'
const TWO_ATOMS_WHY = '2 atoms always sit on a straight line, whatever lone pairs they have.'
const TWO_ATOMS_GEOMETRY_RIGHT = 'The electron geometry is linear: for a molecule of 2 atoms it is given the same name as the molecular geometry.'
export function geometryRight(center: El, info: ShapeInfo): string {
  if (info.diatomic) return TWO_ATOMS_GEOMETRY_RIGHT
  return `The electron geometry is ${info.geometry}: ${plural(info.groups, 'electron group')} around ${lower(center)}.`
}

/** What the board says about the middle atom's bonds, when there is a board. `doubles` and
 *  `triples` let the card name the kind of bond the molecule has; without them it says both. */
type BoardBonds = Pick<GroupFacts, 'bondPairs'> & Partial<Pick<GroupFacts, 'doubles' | 'triples'>>

/** "each double bond as 2 groups", "the triple bond as 3 groups": the bonds counted once per shared pair. */
function multipleCounted(f: BoardBonds): { counted: string; pairs: string } {
  const d = f.doubles ?? 0
  const t = f.triples ?? 0
  if (d > 0 && t === 0) return { counted: `${d === 1 ? 'the double bond' : 'each double bond'} as 2 groups`, pairs: 'The 2 shared pairs of a double bond' }
  if (t > 0 && d === 0) return { counted: `${t === 1 ? 'the triple bond' : 'each triple bond'} as 3 groups`, pairs: 'The 3 shared pairs of a triple bond' }
  return { counted: 'every shared pair of a bond as a group', pairs: 'The shared pairs of a double or triple bond' }
}

/** The wrong idea an electron geometry pick most likely came from. `f` is the board's count of
 *  shared pairs; without it (the shapes quiz has no board) a double bond counted twice and a full
 *  shell read as 4 groups are not told apart from any other miscount. The generic card is marked
 *  `generic`, so the second miss can put the count in place of its reason. */
function geometryIdea(center: El, info: ShapeInfo, pick: ShapeName, f: BoardBonds | null): Coach & { generic?: true } {
  const c = lower(center)
  const lp = info.lonePairs
  if (!isGeometry(pick)) {
    // a name that only a molecular geometry has. The card says what kind of name it is and never
    // whether it is this molecule's molecular geometry: that question comes next, and its first pick is final.
    return {
      lead: `${cap(pick)} is a molecular geometry: it describes where the atoms are and leaves the lone pairs out.`,
      why: `The electron geometry describes where all ${info.groups} electron groups around ${c} point, lone pairs included.`,
      ask: `Pick the electron geometry for ${plural(info.groups, 'electron group')}. It is one of these 5: ${list(geometryChoices())}.`,
      show: { kind: 'groups', which: 'all' },
    }
  }
  const n = groupsOfGeometry(pick)
  const countPairs = `Count ${lp === 1 ? 'the lone pair' : `the ${lp} lone pairs`} on ${c} as ${lp === 1 ? 'a group' : 'groups'} too, then pick again.`
  if (lp > 0 && n === info.bonded) {
    // the bonded atoms counted and the lone pairs left out
    return {
      lead: `${cap(pick)} is the electron geometry for ${plural(n, 'electron group')}: one for each atom bonded to ${c}.`,
      why: `${cap(c)} also has ${pairsText(lp)}, and each lone pair is an electron group too.`,
      ask: countPairs,
      show: { kind: 'groups', which: 'lone' },
    }
  }
  if (f && f.bondPairs > info.bonded && n === f.bondPairs + lp) {
    // each shared pair of a double or triple bond counted as a group
    const m = multipleCounted(f)
    return {
      lead: `${cap(pick)} is the electron geometry for ${plural(n, 'electron group')}. You get ${n} by counting ${m.counted}.`,
      why: `${m.pairs} sit between the same 2 atoms, so the whole bond is 1 electron group.`,
      ask: `Count each bond on ${c} once, then pick again.`,
      show: { kind: 'groups', which: 'multiple' },
    }
  }
  if (n === info.groups + 1) {
    // the middle atom counted as one of its own groups (the same idea groupsIdea names for the count)
    return {
      lead: `${cap(pick)} is the electron geometry for ${plural(n, 'electron group')}. You get ${n} by counting ${c} as a group too.`,
      why: `The electron groups are the bonds and lone pairs around ${c}, and ${c} itself is not one of them.`,
      ask: `Count only the bonded atoms and lone pairs around ${c}, then pick again.`,
      show: { kind: 'groups', which: 'all' },
    }
  }
  const electrons = f ? 2 * (f.bondPairs + lp) : 0
  if (f && pick === 'tetrahedral' && info.groups !== 4 && electrons !== 8) {
    // a full shell of 8 read as 4 groups: true only when every bond is single, and this middle atom
    // has another number of electrons around it
    return {
      lead: 'Tetrahedral is the electron geometry for 4 electron groups, the count for a middle atom with 8 electrons when all its bonds are single bonds.',
      why: `${cap(c)} has ${electrons} electrons around it, in ${plural(info.bonded, 'bond')}${lp > 0 ? ` and ${pairsText(lp)}` : ''}, so ${c} has ${plural(info.groups, 'electron group')}.`,
      ask: `Pick the electron geometry for ${plural(info.groups, 'electron group')}.`,
      show: { kind: 'groups', which: 'all' },
    }
  }
  return { lead: `${cap(pick)} is the electron geometry for ${plural(n, 'electron group')}.`, why: `${cap(c)} has ${plural(info.groups, 'electron group')} around it.`, ask: `Pick the electron geometry for ${plural(info.groups, 'electron group')}.`, generic: true }
}

/** What to say about a pick for the electron geometry: the arrangement of every electron group
 *  around the middle atom, lone pairs included. The student picks until it is right (D-0033). The
 *  first miss names the wrong idea. The second keeps that idea and hands back a smaller question:
 *  the count as bonded atoms and lone pairs, and which of the five names spreads that many groups
 *  apart. The third gives the answer with the rule as its reason, and the move to make. No hint or
 *  earlier miss gives the rule, because with the count on screen the rule is the answer (COPY2-2).
 *  `tries` counts this miss; `f` is what the board holds, when there is a board. */
export function geometryFeedback(center: El, info: ShapeInfo, pick: ShapeName, tries = 1, f: BoardBonds | null = null): { right: boolean; text: string; coach: Coach | null } {
  if (pick === info.geometry) return { right: true, text: geometryRight(center, info), coach: null }
  let coach: Coach
  if (info.diatomic) {
    // two atoms: the electron geometry takes the molecular geometry's name. The first two misses ask
    // a smaller question with no "straight line" in it; the third gives the answer (COPY2-6, CHEM2-4).
    const lead = `${cap(pick)} does not fit a molecule of 2 atoms.`
    coach =
      tries >= 3
        ? { lead, why: 'The 2 atoms sit on a straight line, so the molecular geometry is linear, and the electron geometry is given as linear too.', ask: 'Pick Linear.' }
        : { lead, why: 'A molecule of 2 atoms has the same name for its electron geometry as for its molecular geometry.', ask: 'Which name fits 2 atoms joined by a bond?' }
  } else {
    const { generic, ...idea } = geometryIdea(center, info, pick, f)
    const c = lower(center)
    if (tries >= 3) {
      coach = { lead: idea.lead, why: GEOMETRY_RULE, ask: `${cap(c)} has ${plural(info.groups, 'electron group')}, so the electron geometry is ${info.geometry}. Pick ${cap(info.geometry)}.` }
    } else if (tries === 2) {
      const count = `${cap(c)} has ${plural(info.bonded, 'bonded atom')} and ${pairsText(info.lonePairs)}, which is ${plural(info.groups, 'electron group')}.`
      coach = { lead: idea.lead, why: generic ? '' : idea.why, ask: `${count} ${geometryAsk(info.groups)}` }
    } else coach = idea
  }
  return { right: false, text: coachText(coach), coach }
}

/** A molecule of two atoms has no middle atom: the two atoms are on a line. `a` and `b` are its
 *  atoms; without them the sentence says "the 2 atoms". */
export function twoAtomsLine(a: El | null = null, b: El | null = null): string {
  const atoms = !a || !b ? 'The 2 atoms' : a === b ? `The 2 ${lower(a)} atoms` : `The ${lower(a)} atom and the ${lower(b)} atom`
  return `There is no middle atom. ${atoms} sit on a straight line, so the molecular geometry is linear and there is no bond angle. The electron geometry is given as linear too.`
}

export interface ShapeReadout {
  /** Empty for a molecule of two atoms, which has no middle atom to count groups around. */
  groups: string
  /** The electron geometry. */
  arrangement: string
  /** The molecular geometry. */
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

/** `pair` names the two atoms of a molecule of two atoms. */
export function shapeReadout(p: Problem | null, center: El, info: ShapeInfo, mixed = false, pair: [El, El] | null = null): ShapeReadout {
  const measured = p ? MEASURED_ANGLE[p.id] : undefined
  const c = lower(center)
  let why: string | null = null
  const squeezed = info.angle.startsWith('less')
  if (info.diatomic) why = twoAtomsLine(pair?.[0], pair?.[1])
  else if (squeezed && info.groups === 5) why = `Lone pairs take the seats around the middle of a trigonal bipyramid, where they have the most room. They push the bonds closer together.`
  else if (squeezed) why = `A lone pair pushes harder than a bond, so the bonds on ${c} end up closer together.`
  else if (info.lonePairs === 2 && info.groups === 6) why = `The 2 lone pairs sit on opposite sides of ${c}, so their pushes cancel and the bonds stay at 90°.`
  else if (info.lonePairs === 3 && info.groups === 5) why = `The 3 lone pairs spread evenly around the middle of ${c}, so the 2 bonds stay on a straight line.`
  return {
    groups: info.diatomic ? '' : `${info.groups} (${plural(info.bonded, 'bonded atom')}, ${pairsText(info.lonePairs)})`,
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

// ---------------------------------------------------------------- step 6: polar bonds and the net dipole
//
// The course's method (chapter 7 slides): subtract the two electronegativities, call the bond
// nonpolar at 0.4 or less and polar above that, draw an arrow on each polar bond that points at
// the more electronegative atom, then see whether the arrows cancel in the molecule's shape.

/** The words printed on the board and beside the pictures in this step. */
export const DIPOLE_WORDS = { plus: 'δ+', minus: 'δ−', net: 'net dipole', table: 'Electronegativity', bondKey: 'Bond dipole: the arrow points at δ−', netKey: 'Net dipole' }

/** "C–O": a bond named by its two atoms, the middle atom first. */
export const bondName = (a: El, b: El) => `${a}–${b}`
/** A bond's answer: 'nonpolar', or the atom that is δ−. */
export type BondAnswer = 'nonpolar' | El

export function polarity(s: Structure): MoleculePolarity | null {
  return moleculePolarity(s)
}
/** The label on the button for a bond that has no dipole. */
export const NO_ARROW = 'Nonpolar, no arrow'
/** The question for one kind of bond. A student answers by drawing the bond's dipole arrow on the
 *  board, from one atom to the other, or by pressing the button for a nonpolar bond. `answers` are
 *  the three things a student can say: no arrow, an arrow that points at `a`, an arrow that points at `b`. */
export function bondQuestion(a: El, b: El): { ask: string; sub: string; draw: string; none: string; answers: BondAnswer[] } {
  return {
    ask: `Is the ${bondName(a, b)} bond polar?`,
    sub: 'Subtract the smaller electronegativity from the larger. The difference is ΔEN: 0.4 or less is a nonpolar bond, and above 0.4 is a polar bond.',
    draw: `For a polar bond, draw its arrow on the board: drag from ${lower(a)} to ${lower(b)}, or from ${lower(b)} to ${lower(a)}. The arrow points at the atom where you let go.`,
    none: NO_ARROW,
    answers: ['nonpolar', a, b],
  }
}
const bondTruth = (b: BondPolarity): BondAnswer => (b.kind === 'nonpolar' ? 'nonpolar' : b.negative!)
const subtraction = (b: BondPolarity) => `ΔEN = ${b.high} − ${b.low} = ${b.delta}`

/** The line shown once a bond's polarity is right. */
export function bondRight(a: El, b: El, pol: BondPolarity): string {
  if (pol.kind === 'nonpolar') {
    return `Nonpolar. ${subtraction(pol)}, and at 0.4 or less the two atoms share the electrons almost evenly. A nonpolar bond has no dipole.`
  }
  return `Polar. ${subtraction(pol)}. ${cap(lower(pol.negative!))} pulls the shared electrons harder, so ${lower(pol.negative!)} is δ− and ${lower(pol.positive!)} is δ+.`
}
/** What to say about a wrong answer for one bond. `answer` is 'nonpolar' for the button, or the
 *  atom the drawn arrow points at. The first miss names the rule that was missed, the second works
 *  the subtraction, the third gives the answer. */
export function bondCoach(a: El, b: El, pol: BondPolarity, answer: BondAnswer, tries: number): Coach {
  const name = bondName(a, b)
  if (tries >= 3) {
    return { lead: bondRight(a, b, pol), why: '', ask: pol.kind === 'nonpolar' ? `Press “${NO_ARROW}”.` : `Draw the arrow from ${lower(pol.positive!)} to ${lower(pol.negative!)}.` }
  }
  const table = 'Find both electronegativities in the table and subtract.'
  if (pol.kind === 'nonpolar') {
    // an arrow on a bond that has no dipole, whichever atom it points at
    const lead = 'Only a polar bond has a dipole arrow.'
    return tries === 1
      ? { lead, why: `A polar bond has a ΔEN above 0.4, and ${lower(a)} and ${lower(b)} are closer than that.`, ask: table }
      : { lead, why: `For ${name}, ${subtraction(pol)}.`, ask: 'A difference of 0.4 or less is a nonpolar bond, and a nonpolar bond has no arrow.' }
  }
  if (answer === 'nonpolar') {
    return tries === 1
      ? { lead: 'A bond is nonpolar when ΔEN is 0.4 or less.', why: `For ${name}, ΔEN is larger than that.`, ask: table }
      : { lead: 'A bond is nonpolar when ΔEN is 0.4 or less.', why: `For ${name}, ${subtraction(pol)}.`, ask: 'Draw the arrow so that it points at the atom with the larger electronegativity.' }
  }
  // an arrow that points at the δ+ atom: the rule first, the two numbers on the second miss
  const lead = `That arrow points at ${lower(pol.positive!)}.`
  return tries === 1
    ? { lead, why: 'A dipole arrow points at the atom that pulls the shared electrons harder: the atom with the larger electronegativity.', ask: 'Compare the two atoms in the table, then draw the arrow again.' }
    : { lead, why: `${cap(lower(pol.positive!))}'s electronegativity is ${pol.low} and ${lower(pol.negative!)}'s is ${pol.high}.`, ask: 'Draw the arrow so that it points at the atom with the larger electronegativity.' }
}
/** What the board says when an arrow is drawn between two atoms that are not the bond in question. */
export function drawRefusal(a: El, b: El): string {
  return `This question is about the ${bondName(a, b)} bond. Draw the arrow from ${lower(a)} to ${lower(b)}, or from ${lower(b)} to ${lower(a)}.`
}
/** Printed beside the head of a bond's arrow while it is being drawn over an atom. */
export function arrowCaption(el: El): string {
  return `points at ${lower(el)}`
}
/** What a screen reader says for an atom while a bond's arrow can be drawn: the first atom starts
 *  the arrow, and the second is the atom the arrow points at. */
export function arrowLabel(el: El, started: boolean): string {
  return started ? `${ELEMENTS[el].name}. Press Enter to point the dipole arrow at ${lower(el)}.` : `${ELEMENTS[el].name}. Press Enter to start a dipole arrow at ${lower(el)}.`
}
export function bondAnswerRight(pol: BondPolarity, answer: BondAnswer): boolean {
  return answer === bondTruth(pol)
}

/** Where the bonds of each shape point, for the sentence about dipoles that cancel. */
const POINT: Partial<Record<ShapeName, string>> = {
  linear: 'in opposite directions',
  'trigonal planar': 'to the corners of a flat triangle',
  tetrahedral: 'to the corners of a tetrahedron',
  'trigonal bipyramidal': 'to the corners of a trigonal bipyramid',
  octahedral: 'to the corners of an octahedron',
  'square planar': 'to the corners of a square',
}
const isIon = (p: Problem | null) => !!p && p.charge !== 0
/** The whole-molecule question. An ion is asked about its bond dipoles; a molecule is asked for the word. */
export function netQuestion(p: Problem): { ask: string; sub: string; choices: { polar: boolean; label: string }[] } {
  const sub = 'Each polar bond has a dipole, drawn as an arrow that points at its δ− atom. The arrows cancel when the same atoms sit evenly around the middle atom.'
  return isIon(p)
    ? { ask: `Do the bond dipoles in ${p.name} cancel?`, sub, choices: [{ polar: false, label: 'They cancel' }, { polar: true, label: 'They do not cancel' }] }
    : { ask: `Is ${p.name} polar or nonpolar?`, sub, choices: [{ polar: true, label: 'Polar' }, { polar: false, label: 'Nonpolar' }] }
}
/** "the 2 C–O dipoles", "the C–N dipole": the arrows of one kind of bond. */
const dipolesOf = (k: MoleculePolarity['kinds'][number]) => (k.count === 1 ? `the ${bondName(k.center, k.terminal)} dipole` : `the ${k.count} ${bondName(k.center, k.terminal)} dipoles`)
/** "the C–O bond", "the 2 C–H bonds": the bonds of one kind. */
const theBonds = (k: MoleculePolarity['kinds'][number]) => (k.count === 1 ? `the ${bondName(k.center, k.terminal)} bond` : `the ${k.count} ${bondName(k.center, k.terminal)} bonds`)
/** "is" for one bond, "are" for more. */
const isAre = (kinds: MoleculePolarity['kinds']) => (kinds.length === 1 && kinds[0]!.count === 1 ? 'is' : 'are')

/** Why the bond dipoles cancel or do not, in one or two sentences. `name` is the molecule in a sentence ("water", "the nitrite ion"). */
function netReason(m: MoleculePolarity, info: ShapeInfo | null): string {
  const polar = m.kinds.filter((k) => k.polarity.kind !== 'nonpolar')
  const flat = m.kinds.filter((k) => k.polarity.kind === 'nonpolar')
  if (info?.diatomic && m.bonds.length === 1) {
    // two atoms, one bond: that bond's dipole is the whole molecule's, named with the less electronegative atom first
    const k = m.kinds[0]!
    const pol = k.polarity
    const name = pol.positive && pol.negative ? bondName(pol.positive, pol.negative) : bondName(k.center, k.terminal)
    if (pol.kind === 'nonpolar' && m.polar) return 'The atoms are the same, so ΔEN is 0, but the formal charges are not the same. The electrons sit closer to the atom with the negative formal charge, and that dipole is the net dipole.'
    return pol.kind === 'nonpolar' ? `The ${name} bond is nonpolar, and a molecule of 2 atoms has no other bond, so there is no net dipole.` : `The ${name} bond is the only bond, so its dipole is the net dipole.`
  }
  if (m.why === 'no-polar-bonds') {
    const k = m.kinds[0]!
    return m.kinds.length === 1
      ? `ΔEN for ${bondName(k.center, k.terminal)} is ${k.polarity.delta}, which is a nonpolar bond, so there are no bond dipoles to add up.`
      : 'None of the bonds is polar, so there are no bond dipoles to add up.'
  }
  if (m.why === 'charges') {
    // ozone: the two arrows are the same size (sources.md, polarity), so the bent molecular geometry is why they do not cancel
    const shape = info ? `the molecular geometry is ${info.shape}, so ` : ''
    return `The atoms are the same, so ΔEN is 0, but the formal charges are not the same. The electrons sit closer to the atoms with the negative formal charge, and ${shape}those dipoles do not cancel.`
  }
  if (m.why === 'cancel') {
    const where = info ? POINT[info.shape] : undefined
    // no bond is polar by ΔEN, and the dipoles that unlike formal charges make are the ones that cancel (the triiodide ion)
    const which = polar[0] ? cap(dipolesOf(polar[0])) : 'The dipoles that the formal charges make'
    return `${which} are the same size and point ${where ?? 'evenly around the middle atom'}, so they cancel.`
  }
  if (m.why === 'shape') {
    const k = polar[0]!
    const shape = info ? `The molecular geometry is ${info.shape}, so ${dipolesOf(k)}` : `${cap(dipolesOf(k))}`
    return m.bonds.length === 1 ? `${cap(dipolesOf(k))} is the only one, so nothing cancels it.` : `${shape} do not cancel. They add up to a net dipole.`
  }
  // unlike bonds
  if (polar.length === 1 && flat.length >= 1) {
    // one polar bond: nothing can cancel it. Two or more of one kind cancel each other in part, and what is left is the net dipole (CHEMWORDS-8)
    const k = polar[0]!
    return `${cap(theBonds(k))} ${isAre(polar)} polar and ${list(flat.map(theBonds))} ${isAre(flat)} nonpolar, so ${k.count === 1 ? `nothing cancels ${dipolesOf(k)}` : `${dipolesOf(k)} add up to a net dipole`}.`
  }
  return 'The bond dipoles are not all the same size, so they do not cancel.'
}
/** "Water is polar." / "The bond dipoles in the nitrite ion do not cancel." An ion with no polar
 *  bonds has no bond dipoles to cancel, so its verdict says it has no net dipole (CHEMWORDS-6). */
function netVerdict(p: Problem | null, m: MoleculePolarity): string {
  if (!p) return m.polar ? 'This molecule is polar.' : 'This molecule is nonpolar.'
  if (isIon(p) && m.why === 'no-polar-bonds') return `${cap(p.name)} has no net dipole.`
  if (isIon(p)) return m.polar ? `The bond dipoles in ${p.name} do not cancel.` : `The bond dipoles in ${p.name} cancel.`
  return `${cap(p.name)} is ${m.polar ? 'polar' : 'nonpolar'}.`
}
/** What the panel says once the whole-molecule answer is in: the plain line for a right answer,
 *  a coach for a wrong one. Either way the answer is given, because the model then shows it. */
export function netFeedback(p: Problem, m: MoleculePolarity, info: ShapeInfo | null, saidPolar: boolean): { right: boolean; text: string; coach: Coach | null } {
  const reason = netReason(m, info)
  const verdict = netVerdict(p, m)
  if (saidPolar === m.polar) return { right: true, text: `${verdict} ${reason}`, coach: null }
  let lead: string
  const polarKinds = m.kinds.filter((k) => k.polarity.kind !== 'nonpolar')
  if (m.why === 'cancel') lead = `${cap(theBonds(polarKinds[0]!))} ${isAre(polarKinds.slice(0, 1))} polar, and the dipoles still cancel.`
  else if (m.why === 'no-polar-bonds') lead = `${cap(p.name)} has no polar bonds.`
  else if (m.why === 'shape') lead = 'Bond dipoles cancel only when the bonds are spread evenly around the middle atom.'
  // ozone: the student read "same atoms" as nonpolar. Its two arrows are the same size, so the size is not the reason (CHEMWORDS-3)
  else if (m.why === 'charges') lead = 'A bond between 2 atoms of the same element can still be polar.'
  else lead = 'Bond dipoles cancel only when they are the same size.'
  const coach: Coach = { lead, why: reason, ask: verdict }
  return { right: false, text: coachText(coach), coach }
}
// ---- the net dipole, drawn
//
// Once a molecule is known to be polar, the student draws its net dipole on the 3D model: a press
// on the middle atom and a drag the way the bond arrows add up. Only the direction is judged, the
// way a viewer sees it (src/chem/polarity.ts, netAsSeen).

/** A drawn net dipole within this many degrees of the real one is right. */
export const NET_WITHIN = 35
/** A drawn direction can be judged only while at least this share of the net dipole lies across the screen. */
export const NET_ACROSS = 0.45
/** A drawn arrow within this many degrees of a bond's line follows that bond. */
const ALONG_BOND = 18

/** What a wrong net dipole is taken for: it points against the bond arrows, it follows one bond
 *  where several bond arrows add up, or neither. */
export type NetIdea = 'against' | 'one-bond' | 'other'
export type NetVerdict = { kind: 'right' } | { kind: 'wrong'; idea: NetIdea } | { kind: 'side' }

const degreesBetween = (ax: number, ay: number, bx: number, by: number) => {
  const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}
/** Judges a net dipole drawn on screen (x to the right, y up) against the bond dipoles as the
 *  viewer sees them. 'side' means the net dipole points at the viewer or away, so no direction on
 *  screen can be right. Null when there is no net dipole or nothing was drawn. */
export function judgeNetArrow(m: MoleculePolarity, seen: SeenBond[], drawn: { x: number; y: number }): NetVerdict | null {
  const net = netAsSeen(m, seen)
  if (!net || Math.hypot(drawn.x, drawn.y) < 1e-6) return null
  if (net.across < NET_ACROSS) return { kind: 'side' }
  const off = degreesBetween(drawn.x, drawn.y, net.x, net.y)
  if (off <= NET_WITHIN) return { kind: 'right' }
  if (off >= 180 - NET_WITHIN) return { kind: 'wrong', idea: 'against' }
  const arrows = m.bonds.filter((b) => b.out !== 0)
  const alongOne =
    arrows.length > 1 &&
    arrows.some((b) => {
      const dir = seen.find((x) => x.atomId === b.atomId)?.dir
      if (!dir || Math.hypot(dir[0], dir[1]) < 0.3) return false
      const a = degreesBetween(drawn.x, drawn.y, dir[0], dir[1])
      return a <= ALONG_BOND || a >= 180 - ALONG_BOND
    })
  return { kind: 'wrong', idea: alongOne ? 'one-bond' : 'other' }
}

export function netArrowQuestion(p: Problem): { ask: string; draw: string } {
  return {
    ask: `Which way does the net dipole of ${p.name} point?`,
    draw: `Draw the net dipole on the 3D model: drag from ${lower(p.center)} to one of the dots, or tap a dot. The dots are at the outer atoms, at the lone pairs, and in the space between them.`,
  }
}
/** The words beside the net dipole while it is being drawn, for each kind of aim point: an outer
 *  atom, a lone pair of the middle atom, the middle of the outer atoms, and straight away from it. */
export function aimWords(m: MoleculePolarity): { atoms: Record<string, string>; lone: string; middle: string; away: string } {
  const els = m.bonds.map((b) => b.el)
  const atoms: Record<string, string> = {}
  for (const b of m.bonds) {
    const name = lower(b.el)
    atoms[b.atomId] = els.filter((el) => el === b.el).length === 1 ? `toward ${name}` : `toward ${/^[aeio]/.test(name) ? 'an' : 'a'} ${name} atom`
  }
  const same = els.every((el) => el === els[0])
  const group = same && els[0] ? `the ${els.length} ${lower(els[0])} atoms` : `the ${els.length} outer atoms`
  return { atoms, lone: m.lonePairs === 1 ? 'toward the lone pair' : 'toward a lone pair', middle: `toward the middle of ${group}`, away: `away from ${group}` }
}
/** Where the net dipole points, by the atoms it runs between: "from carbon toward oxygen". Bonds
 *  that are all alike add up to an arrow along the line through the middle atom and the middle of
 *  the outer atoms. Null for a molecule this cannot be said about in one phrase. */
export function netPoints(m: MoleculePolarity): string | null {
  const arrows = m.bonds.filter((b) => b.out !== 0)
  const first = arrows[0]
  if (!m.net || !first) return null
  const c = lower(m.center.el)
  let outer: string
  if (arrows.length === 1) outer = lower(first.el)
  else if (m.why === 'shape') outer = arrows.every((b) => b.el === first.el) ? `the middle of the ${arrows.length} ${lower(first.el)} atoms` : `the middle of the ${arrows.length} outer atoms`
  else return null
  return first.out === 1 ? `from ${c} toward ${outer}` : `from ${outer} toward ${c}`
}
/** The line shown once the drawn net dipole is right, and the answer a third miss is given. */
export function netArrowRight(m: MoleculePolarity): string {
  const where = netPoints(m)
  const polar = m.kinds.filter((k) => k.polarity.kind !== 'nonpolar')
  if (!where || polar.length !== 1) return 'The net dipole is the bond dipoles added together.'
  const k = polar[0]!
  return k.count === 1 ? `${cap(dipolesOf(k))} is the only bond dipole, so the net dipole points the same way: ${where}.` : `${cap(dipolesOf(k))} add up to a net dipole that points ${where}.`
}
/** What to say about a net dipole drawn the wrong way. The first miss names what the arrow does,
 *  the second says how the arrows of this molecule add up, the third gives the direction. */
export function netArrowCoach(m: MoleculePolarity, idea: NetIdea, tries: number): Coach {
  if (tries >= 3) return { lead: netArrowRight(m), why: '', ask: 'Draw that arrow.' }
  const polar = m.kinds.filter((k) => k.polarity.kind !== 'nonpolar')
  const k = polar[0]
  const n = m.bonds.filter((b) => b.out !== 0).length
  const again = 'Draw the net dipole again.'
  let lead = 'The net dipole does not point that way.'
  let why = 'The net dipole is the bond arrows added together: move each arrow so that it starts where the one before ends, and the net dipole runs from the first start to the last tip.'
  if (idea === 'against' && n === 1 && k) {
    // one bond arrow: say "arrow", and name it
    lead = `That arrow points against the ${bondName(k.center, k.terminal)} arrow.`
    why = `The ${bondName(k.center, k.terminal)} arrow is the only bond arrow, so the net dipole points the same way as the ${bondName(k.center, k.terminal)} arrow.`
  } else if (idea === 'against') {
    lead = 'That arrow points against the bond arrows.'
    why = 'The net dipole is the bond arrows added together, so it points toward the δ− side, the same as they do.'
  } else if (idea === 'one-bond' && k) {
    lead = `That arrow follows 1 ${bondName(k.center, k.terminal)} bond.`
    why = `The net dipole is ${n === 2 ? 'both' : `all ${n}`} bond arrows added together, so the other ${n === 2 ? 'arrow moves' : 'arrows move'} it off that bond.`
  }
  if (tries === 1 || !k) return { lead, why, ask: again }
  // the second miss: how the arrows of this molecule add up, without saying which way along the line
  if (n === 1) return { lead, why: `${cap(theBonds(k))} is the only polar bond, so the net dipole runs along the ${bondName(k.center, k.terminal)} bond.`, ask: 'Decide which way along that bond the arrow points, then draw again.' }
  if (m.why === 'shape' && polar.length === 1) {
    return { lead, why: `${cap(dipolesOf(k))} are the same size, so the net dipole runs along the line through ${lower(k.center)} and the middle of the ${n} ${lower(k.terminal)} atoms.`, ask: 'Decide which way along that line the arrows point, then draw again.' }
  }
  return { lead, why, ask: again }
}
/** What a screen reader says for the middle atom while the net dipole can be drawn. */
export function netArrowLabel(el: El): string {
  return `${ELEMENTS[el].name}. Press the left or right arrow key to turn the net dipole arrow, then press Enter.`
}
/** Shown when the net dipole was drawn while it pointed at the viewer or away. */
export const NET_SIDE = 'The net dipole pointed toward you or away from you, so the model turned. Draw the arrow again.'

/** One line for the readout: "Polar", "Nonpolar", or for an ion whether its bond dipoles cancel.
 *  `charged` says the board holds an ion, for free build, where there is no problem to ask. */
export function polarityWord(p: Problem | null, m: MoleculePolarity, charged = isIon(p)): string {
  if (charged && m.why === 'no-polar-bonds') return 'No bond dipoles'
  if (charged) return m.polar ? 'The bond dipoles do not cancel' : 'The bond dipoles cancel'
  if (m.depends) return 'Depends on where the unlike atoms sit'
  return m.polar ? 'Polar' : 'Nonpolar'
}
/** Free build: the same reasoning as the guided step, for whatever is on the board. */
export function polarityNote(m: MoleculePolarity, info: ShapeInfo | null): string {
  return m.depends ? 'The outer atoms are not all the same, and with five or six groups the answer depends on which corners they take.' : netReason(m, info)
}

// ---------------------------------------------------------------- free build: electronegativity and dipoles
//
// Free build asks nothing, so it shows step 6's results for whatever is on the board: each atom's
// electronegativity, each kind of bond worked from the table, and once every shell is full, whether
// the whole molecule is polar. Sam chose this on 2026-11-17 (D-0029).

export const FREE_POLAR_WORDS = {
  bonds: 'Bond polarity',
  net: 'Net dipole',
  notStar: 'Bond dipoles are added up only for molecules with one middle atom.',
  notFull: 'Fill every shell to see whether the whole molecule is polar.',
}
/** One kind of bond on the free build board. `byCharge` is true for a bond between identical atoms
 *  that unlike formal charges make polar (ozone). */
export function freeBondLine(a: El, b: El, pol: BondPolarity, byCharge: boolean): string {
  if (byCharge) return 'ΔEN = 0, but where the two atoms have different formal charges, the shared electrons sit closer to the atom with the negative charge.'
  if (pol.kind === 'ionic') return `Ionic. ${subtraction(pol)}, and a ΔEN above 2.0 counts as an ionic bond. ${cap(lower(pol.negative!))} is δ− and ${lower(pol.positive!)} is δ+.`
  return bondRight(a, b, pol)
}
/** The whole molecule on the free build board: polar or nonpolar, and why. */
export function freeNetLine(m: MoleculePolarity, info: ShapeInfo | null): string {
  return m.depends ? polarityNote(m, info) : `${m.polar ? 'Polar' : 'Nonpolar'}. ${polarityNote(m, info)}`
}
/** Every kind of bond on the board, each pair of elements once: the middle atom first when there is
 *  one, otherwise the less electronegative atom first. */
export function bondKindsOn(s: Structure): { a: El; b: El; pol: BondPolarity; byCharge: boolean }[] {
  const m = moleculePolarity(s)
  // a molecule of two atoms has no middle atom to put first: it is listed as a chain is, below
  if (m && s.atoms.length > 2) return m.kinds.map((k) => ({ a: k.center, b: k.terminal, pol: k.polarity, byCharge: k.polarity.tenths === 0 && m.bonds.some((x) => x.el === k.terminal && x.out !== 0) }))
  const out: { a: El; b: El; pol: BondPolarity; byCharge: boolean }[] = []
  for (const bond of s.bonds) {
    const x = atomById(s, bond.a)?.el
    const y = atomById(s, bond.b)?.el
    if (!x || !y || out.some((k) => (k.a === x && k.b === y) || (k.a === y && k.b === x))) continue
    const pol = bondPolarity(x, y)
    const [a, b] = pol.positive === y ? [y, x] : [x, y]
    // two atoms of one element with unlike formal charges: the bond is polar by charge, as the net line says
    out.push({ a, b, pol, byCharge: !!m && s.atoms.length === 2 && pol.tenths === 0 && m.bonds.some((k) => k.out !== 0) })
  }
  return out
}

// ---------------------------------------------------------------- step 7: sigma and pi bonds, hybridization
//
// Chapter 8 slides: the first bond between two atoms is a sigma bond and the rest are pi bonds;
// hybridization follows the number of electron groups (2 sp, 3 sp2, 4 sp3, then sp3d and sp3d2).

/** A hybridization as it is written: sp², sp³d. */
export function hybridLabel(h: Hybrid): string {
  return { sp: 'sp', sp2: 'sp²', sp3: 'sp³', sp3d: 'sp³d', sp3d2: 'sp³d²' }[h]
}
export { HYBRIDS, type Hybrid }

export interface BondCounts {
  sigma: number
  pi: number
  single: number
  double: number
  triple: number
}
export function bondCounts(s: Structure): BondCounts {
  const { sigma, pi } = sigmaPi(s)
  const of = (order: number) => s.bonds.filter((b) => b.order === order).length
  return { sigma, pi, single: of(1), double: of(2), triple: of(3) }
}
/** "2 double bonds", "1 single bond and 1 triple bond": the bonds on the board by kind. */
function bondsByKind(c: BondCounts): string {
  const parts = [
    c.single ? plural(c.single, 'single bond') : '',
    c.double ? plural(c.double, 'double bond') : '',
    c.triple ? plural(c.triple, 'triple bond') : '',
  ].filter(Boolean)
  return list(parts)
}
/** "each double bond is 1 sigma and 1 pi": what the multiple bonds on the board are made of. */
function madeOf(c: BondCounts): string {
  const parts = [
    c.single ? (c.single === 1 ? 'the single bond is 1 sigma' : 'each single bond is 1 sigma') : '',
    c.double ? (c.double === 1 ? 'the double bond is 1 sigma and 1 pi' : 'each double bond is 1 sigma and 1 pi') : '',
    c.triple ? (c.triple === 1 ? 'the triple bond is 1 sigma and 2 pi' : 'each triple bond is 1 sigma and 2 pi') : '',
  ].filter(Boolean)
  return list(parts)
}
export function sigmaPiRight(c: BondCounts): string {
  return `${plural(c.sigma, 'sigma bond')} and ${c.pi === 0 ? 'no pi bonds' : plural(c.pi, 'pi bond')}: ${madeOf(c)}.`
}
/** What to say about a wrong count of sigma and pi bonds. */
export function sigmaPiCoach(p: Problem, c: BondCounts, sigma: number, pi: number, tries: number): Coach {
  const name = cap(p.name)
  if (tries >= 3) return { lead: `${name} has ${sigmaPiRight(c)}`, why: '', ask: '' }
  const lines = c.sigma + c.pi
  const multiples = c.double + c.triple
  let idea: Coach
  if (sigma !== c.sigma && sigma === lines && c.pi > 0) {
    idea = { lead: `${sigma} counts every line as a sigma bond.`, why: 'Only the first bond between two atoms is a sigma bond. A second or third bond between the same two atoms is a pi bond.', ask: 'Count 1 sigma bond for each pair of bonded atoms.' }
  } else if (sigma !== c.sigma) {
    idea = { lead: `${name} doesn't have ${plural(sigma, 'sigma bond')}.`, why: 'Every pair of bonded atoms has exactly 1 sigma bond between them.', ask: `Count the atoms bonded to ${lower(p.center)}.` }
  } else if (pi === 0 && c.pi > 0) {
    idea = { lead: 'A double or triple bond has pi bonds in it.', why: `${name} has ${bondsByKind(c)}.`, ask: 'Count 1 pi bond for a double bond and 2 for a triple bond.' }
  } else if (c.triple > 0 && pi === multiples) {
    idea = { lead: `${pi} counts 1 pi bond for each double or triple bond.`, why: 'A triple bond has 2 pi bonds: its first bond is the sigma bond and the other 2 are pi bonds.', ask: 'Count the pi bonds again.' }
  } else if (c.pi === 0) {
    idea = { lead: `${name} has no pi bonds.`, why: 'A pi bond is the second or third bond between two atoms, and every bond here is a single bond.', ask: 'Set the pi bonds to 0.' }
  } else {
    idea = { lead: `${name} doesn't have ${plural(pi, 'pi bond')}.`, why: 'A pi bond is the second or third bond between two atoms.', ask: 'Count 1 pi bond for a double bond and 2 for a triple bond.' }
  }
  if (tries === 2) return { lead: idea.lead, why: `${name} has ${bondsByKind(c)}, and ${madeOf(c)}.`, ask: 'Add up the sigma bonds, then the pi bonds.' }
  return idea
}

export function sigmaPiQuestion(p: Problem): { ask: string; sub: string; sigma: string; pi: string; check: string } {
  return {
    ask: `How many sigma bonds and pi bonds does ${p.name} have?`,
    sub: 'The first bond between two atoms is a sigma bond. A second or third bond between the same two atoms is a pi bond.',
    sigma: 'Sigma bonds',
    pi: 'Pi bonds',
    check: 'Check my counts',
  }
}
export function hybridQuestion(center: El): string {
  return `What is the hybridization of ${lower(center)}?`
}
/** The last line of the last step. */
export function finishedLine(p: Problem): string {
  return `That is everything for ${p.name}: its Lewis structure, electron geometry, molecular geometry, polarity and bonding.`
}

export function hybridRight(center: El, h: Hybrid, f: GroupFacts): string {
  return `${hybridLabel(h)}: ${lower(center)} has ${plural(f.groups, 'electron group')}.`
}
/** What to say about a wrong hybridization. Every miss says how many groups the picked one goes with. */
export function hybridCoach(center: El, f: GroupFacts, pick: Hybrid, tries: number): Coach {
  const c = lower(center)
  const right = hybridFor(f.groups)
  if (tries >= 3 && right) return { lead: hybridRight(center, right, f), why: '', ask: '' }
  const goes = `${hybridLabel(pick)} goes with ${plural(domainsOf(pick), 'electron group')}.`
  const has = `${cap(c)} has ${plural(f.bonded, 'bonded atom')} and ${pairsText(f.lonePairs)}`
  if (domainsOf(pick) === f.bonded && f.lonePairs > 0) {
    return { lead: goes, why: `${has}, and each lone pair is a group too.`, ask: 'Count the bonded atoms and the lone pairs, then pick again.' }
  }
  if (domainsOf(pick) === f.bondPairs + f.lonePairs && f.bondPairs !== f.bonded) {
    return { lead: goes, why: 'A double or triple bond is 1 group: the pi bonds in it are not hybridized.', ask: `Count each bond on ${c} once, then pick again.` }
  }
  return tries === 1
    ? { lead: goes, why: `${cap(c)} has a different number of groups.`, ask: `Count the electron groups around ${c}, then pick again.` }
    : { lead: goes, why: `${has}: ${plural(f.groups, 'group')}.`, ask: 'Each group is one hybrid orbital: 2 groups is sp, 3 is sp², 4 is sp³, 5 is sp³d and 6 is sp³d².' }
}

/** Everything the app has worked out about a finished molecule, as rows of a table. */
export function profile(p: Problem | null, s: Structure): { label: string; value: string }[] {
  const info = shapeInfoFor(s)
  const f = groupFacts(s)
  const m = moleculePolarity(s)
  if (!info || !f) return []
  const top = assess(s).topology
  const center = top.kind === 'star' ? atomById(s, top.center) : undefined
  const h = hybridFor(f.groups)
  const c = bondCounts(s)
  // free build has no problem to say whether this is an ion, so the charge on the board decides
  const rows = [{ label: 'Polarity', value: m ? polarityWord(p, m, p ? p.charge !== 0 : assess(s).charge !== 0) : '' }, { label: 'Sigma and pi bonds', value: `${c.sigma} sigma, ${c.pi} pi` }]
  if (h && center && !info.diatomic) rows.push({ label: `Hybridization of ${lower(center.el)}`, value: hybridLabel(h) })
  return rows.filter((r) => r.value)
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

/** Hints for a step, weakest first. The panel shows as many as the student has asked for.
 *  `totalNext`: the count step is at its total. `netArrow`: step 6 is at the drawn net dipole.
 *  `shapeAt`: which question of step 5 is open. */
export function hintsFor(step: StepId, p: Problem, s: Structure, totalNext = false, netArrow = false, shapeAt: 'groups' | 'geometry' | 'molecular' = 'groups'): string[] {
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
  if (step === 'polar' && netArrow) {
    return [
      'Each bond arrow points at its δ− atom. Bond arrows that point in opposite directions cancel.',
      'Move each bond arrow so that it starts where the one before ends. The net dipole runs from the first start to the last tip.',
    ]
  }
  if (step === 'polar') {
    return [
      'Find both atoms of the bond in the electronegativity table. Subtract the smaller number from the larger.',
      'A ΔEN of 0.4 or less is a nonpolar bond. Above 0.4 the bond is polar, and the atom with the larger electronegativity is δ−.',
    ]
  }
  if (step === 'orbitals') {
    return [
      'A single bond is 1 sigma bond. A double bond is 1 sigma and 1 pi. A triple bond is 1 sigma and 2 pi.',
      'Hybridization follows the number of electron groups: 2 groups is sp, 3 is sp², 4 is sp³, 5 is sp³d and 6 is sp³d².',
    ]
  }
  const f = groupFacts(s)
  if (!f) return []
  const has = `${cap(c)} has ${plural(f.bonded, 'bonded atom')} and ${pairsText(f.lonePairs)}.`
  // no hint for the electron geometry gives the rule: with the count on screen the rule is the answer (COPY2-2)
  if (shapeAt === 'geometry') return [`Each electron group around ${c} is a bonded atom or a lone pair, and the groups spread as far apart as they can.`, geometryAsk(f.groups)]
  if (shapeAt === 'molecular') {
    const info = shapeInfoFor(s)
    const corners =
      info && f.lonePairs > 0
        ? `The ${f.groups} electron groups around ${c} point to the corners of ${GEOMETRY_NOUN[info.geometry]}. ${lonePairCorners(f.groups, f.lonePairs)}Which molecular geometry has atoms at the other ${plural(f.bonded, 'corner')}?`
        : has
    return ['To name the molecular geometry, start from the electron geometry, then leave out the corners that hold lone pairs.', corners]
  }
  return [`Count the atoms bonded to ${c}, then the lone pairs on ${c}.`, has]
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


// ---------------------------------------------------------------- key terms
//
// A word a student may not know is highlighted where it first appears on a screen. A press on it
// opens a card: what the word means, an example with a picture, and one more thing to keep in
// mind (D-0027). The definitions follow the key terms of OpenStax Chemistry 2e, chapters 2, 6, 7
// and 8, and the course's chapter 7 and 8 slides (docs/chemistry/sources.md).
//
// A card never works on the molecule on screen. Its example is another atom or molecule, picked
// so that the card does not state a number or an answer the current molecule asks for (D-0028).

export type BaseTermId =
  | 'valence'
  | 'shell'
  | 'group'
  | 'atomic-number'
  | 'ion'
  | 'lewis'
  | 'middle'
  | 'bond'
  | 'multiple'
  | 'lone-pair'
  | 'full-shell'
  | 'formal-charge'
  | 'resonance'
  | 'expanded'
  | 'electron-group'
  | 'electron-geometry'
  /** The molecular geometry. The id is older than the name. */
  | 'shape'
  | 'bond-angle'
  | 'electronegativity'
  | 'delta-en'
  | 'polar'
  | 'polar-bond'
  | 'partial'
  | 'dipole'
  | 'net-dipole'
  | 'cancel'
  | 'polar-molecule'
  | 'sigma'
  | 'pi'
  | 'hybridization'
export type TermId = BaseTermId | `shape:${ShapeName}`

/** A molecule or ion that a card uses as its example. None of them is a guided problem. */
export interface Sample {
  id: string
  formula: [El, number][]
  charge: number
  /** The middle atom. For a molecule of two atoms, the one drawn on the left. */
  center: El
  /** Lowercase, the way it reads after "In": "hydrogen chloride", "a fluorine molecule", "the hydroxide ion". */
  name: string
}
const sample = (id: string, center: El, formula: [El, number][], name: string, charge = 0): Sample => ({ id, center, formula, name, charge })
export const SAMPLES = {
  H2: sample('H2', 'H', [['H', 2]], 'a hydrogen molecule'),
  F2: sample('F2', 'F', [['F', 2]], 'a fluorine molecule'),
  O2: sample('O2', 'O', [['O', 2]], 'an oxygen molecule'),
  N2: sample('N2', 'N', [['N', 2]], 'a nitrogen molecule'),
  I2: sample('I2', 'I', [['I', 2]], 'an iodine molecule'),
  HCl: sample('HCl', 'H', [['H', 1], ['Cl', 1]], 'hydrogen chloride'),
  H2S: sample('H2S', 'S', [['H', 2], ['S', 1]], 'hydrogen sulfide'),
  PH3: sample('PH3', 'P', [['P', 1], ['H', 3]], 'phosphine'),
  SiH4: sample('SiH4', 'Si', [['Si', 1], ['H', 4]], 'silane'),
  O3: sample('O3', 'O', [['O', 3]], 'ozone'),
  NO3: sample('NO3-', 'N', [['N', 1], ['O', 3]], 'the nitrate ion', -1),
  OH: sample('OH-', 'O', [['O', 1], ['H', 1]], 'the hydroxide ion', -1),
  CN: sample('CN-', 'C', [['C', 1], ['N', 1]], 'the cyanide ion', -1),
  BF4: sample('BF4-', 'B', [['B', 1], ['F', 4]], 'the tetrafluoroborate ion', -1),
  BeCl2: sample('BeCl2', 'Be', [['Be', 1], ['Cl', 2]], 'beryllium chloride'),
  BCl3: sample('BCl3', 'B', [['B', 1], ['Cl', 3]], 'boron trichloride'),
  SCl2: sample('SCl2', 'S', [['S', 1], ['Cl', 2]], 'sulfur dichloride'),
  CCl4: sample('CCl4', 'C', [['C', 1], ['Cl', 4]], 'carbon tetrachloride'),
  NF3: sample('NF3', 'N', [['N', 1], ['F', 3]], 'nitrogen trifluoride'),
  PF3: sample('PF3', 'P', [['P', 1], ['F', 3]], 'phosphorus trifluoride'),
  PF5: sample('PF5', 'P', [['P', 1], ['F', 5]], 'phosphorus pentafluoride'),
  SeF4: sample('SeF4', 'Se', [['Se', 1], ['F', 4]], 'selenium tetrafluoride'),
  BrF3: sample('BrF3', 'Br', [['Br', 1], ['F', 3]], 'bromine trifluoride'),
  SeF6: sample('SeF6', 'Se', [['Se', 1], ['F', 6]], 'selenium hexafluoride'),
  IF5: sample('IF5', 'I', [['I', 1], ['F', 5]], 'iodine pentafluoride'),
  ICl4: sample('ICl4-', 'I', [['I', 1], ['Cl', 4]], 'the tetrachloroiodate ion', -1),
  // second examples, for when the first one is the molecule on screen (an exercise can be any of them)
  BeF2: sample('BeF2', 'Be', [['Be', 1], ['F', 2]], 'beryllium fluoride'),
  CS2: sample('CS2', 'C', [['C', 1], ['S', 2]], 'carbon disulfide'),
  AsF5: sample('AsF5', 'As', [['As', 1], ['F', 5]], 'arsenic pentafluoride'),
  SeCl4: sample('SeCl4', 'Se', [['Se', 1], ['Cl', 4]], 'selenium tetrachloride'),
  ICl3: sample('ICl3', 'I', [['I', 1], ['Cl', 3]], 'iodine trichloride'),
  PF6: sample('PF6-', 'P', [['P', 1], ['F', 6]], 'the hexafluorophosphate ion', -1),
  ClF5: sample('ClF5', 'Cl', [['Cl', 1], ['F', 5]], 'chlorine pentafluoride'),
  BrF4: sample('BrF4-', 'Br', [['Br', 1], ['F', 4]], 'the tetrafluorobromate ion', -1),
} satisfies Record<string, Sample>

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP: Record<string, string> = { '2': '²', '3': '³', '+': '⁺', '−': '⁻' }
/** "H₂S", "BF₄⁻": a sample's formula inside a sentence. */
export function formulaWord(m: Pick<Sample, 'formula' | 'charge'>): string {
  const body = m.formula.map(([el, n]) => `${el}${n > 1 ? SUB[n] : ''}`).join('')
  const n = Math.abs(m.charge)
  return m.charge === 0 ? body : `${body}${n > 1 ? SUP[String(n)] : ''}${SUP[m.charge > 0 ? '+' : '−']}`
}
/** "hydrogen chloride, HCl," the way a sample is introduced in a sentence. */
const named = (m: Sample) => `${m.name}, ${formulaWord(m)},`

/** A sample's Lewis structure: what is on its middle atom and on each outer atom. */
export interface Drawn {
  center: El
  /** Unshared electrons on the middle atom, and its formal charge. */
  lone: number
  fc: number
  outer: { el: El; order: number; lone: number; fc: number }[]
}
/** The Lewis structure the engine finds for a sample. `form` picks one of its resonance structures. */
export function drawingOf(m: Sample, form = 0): Drawn {
  const atoms = m.formula.flatMap(([el, n]) => new Array<El>(n).fill(el))
  const at = atoms.indexOf(m.center)
  const outer = atoms.filter((_, i) => i !== at)
  const ref = solveStar(m.center, outer, m.charge)
  const forms = ref ? bestStructures(ref) : []
  const sol = forms[form % Math.max(1, forms.length)]
  if (!sol) throw new Error(`no Lewis structure for ${m.id}`)
  return { center: m.center, lone: sol.centerLone, fc: sol.fcCenter, outer: outer.map((el, i) => ({ el, order: sol.orders[i]!, lone: sol.termLone[i]!, fc: sol.fcTerm[i]! })) }
}
/** How many resonance structures a sample has. */
export function formsOf(m: Sample): number {
  const atoms = m.formula.flatMap(([el, n]) => new Array<El>(n).fill(el))
  const at = atoms.indexOf(m.center)
  const ref = solveStar(m.center, atoms.filter((_, i) => i !== at), m.charge)
  return ref ? bestStructures(ref).length : 0
}
/** The shape of a sample that has a middle atom, from the engine's table. */
export function sampleShape(m: Sample): ShapeInfo {
  const d = drawingOf(m)
  const info = classify(d.outer.length, d.lone / 2)
  if (!info) throw new Error(`no shape for ${m.id}`)
  return info
}

/** What a card's picture shows. */
export type LewisMark = 'none' | 'ion' | 'middle' | 'bond' | 'lone' | 'shell' | 'charges' | 'groups' | 'lines' | 'sigma-pi'
export type TermPicture =
  /** An atom's shells as rings. */
  | { kind: 'shells'; el: El }
  /** The main-group columns of the periodic table with these atoms marked. */
  | { kind: 'table'; els: El[] }
  /** Flat Lewis drawings side by side, with one thing marked. `forms` picks a resonance structure for each. */
  | { kind: 'lewis'; samples: Sample[]; mark: LewisMark; forms?: number[]; captions?: string[] }
  /** Two bonded atoms with their electronegativities, and what the bond between them gets. */
  | { kind: 'pair'; a: El; b: El; sum: string | null; arrow: boolean }
  /** A molecule in its 3D shape, with its bond dipoles, its net dipole or one bond angle. */
  | { kind: 'model'; sample: Sample; arrows: 'none' | 'bonds' | 'net'; angle: boolean }

export interface TermCard {
  id: TermId
  name: string
  /** Another name the course or a textbook uses, or how a symbol is said. */
  also: string | null
  means: string
  example: string
  /** One more thing that is easy to get wrong. */
  note: string | null
  picture: TermPicture
  /** What the picture shows, for a screen reader. */
  pictureLabel: string
  related: { id: TermId; name: string }[]
  /** The atoms the example gives numbers for, and the molecules it draws. The tests hold these apart from the molecule on screen. */
  about: { els: El[]; samples: Sample[] }
}

/** The headings inside a card. */
export const TERM_WORDS = { example: 'Example', note: 'Keep in mind', related: 'Related terms', close: 'Close', opens: 'What this word means' }

interface TermInfo {
  name: string
  also?: string
  /** The step that first uses the word. */
  from: StepId
  /** Words in the app's text that open this card, as a regular expression without flags. */
  match: string
  related: BaseTermId[]
}
/** In the order the matcher tries them: a longer phrase comes before the shorter one inside it. */
const TERMS: Record<BaseTermId, TermInfo> = {
  valence: { name: 'Valence electrons', from: 'count', match: 'valence electrons?', related: ['shell', 'group', 'atomic-number'] },
  'full-shell': { name: 'Full shell', also: 'Also called an octet.', from: 'check', match: 'full (?:outer )?shells?|octets?', related: ['lone-pair', 'bond'] },
  shell: { name: 'Electron shell', from: 'count', match: '(?:outer|inner|electron) shells?|shells?', related: ['valence', 'atomic-number'] },
  group: { name: 'Group and period', from: 'count', match: 'group numbers?|groups? \\d+(?: (?:to|and) \\d+)?|period \\d|periodic table', related: ['valence', 'shell'] },
  'atomic-number': { name: 'Atomic number', from: 'count', match: 'atomic numbers?', related: ['valence', 'shell'] },
  lewis: { name: 'Lewis structure', from: 'place', match: 'Lewis structures?', related: ['valence', 'bond', 'lone-pair'] },
  middle: { name: 'Middle atom and outer atoms', from: 'place', match: 'middle atoms?|outer atoms?', related: ['lewis'] },
  multiple: { name: 'Single, double and triple bonds', from: 'bond', match: '(?:single|double|triple) bonds?', related: ['bond', 'sigma', 'pi'] },
  'lone-pair': { name: 'Lone pair', from: 'bond', match: 'lone pairs?|unshared electrons?', related: ['bond', 'full-shell', 'electron-group'] },
  'formal-charge': { name: 'Formal charge', from: 'check', match: 'formal charges?', related: ['valence', 'lone-pair', 'ion'] },
  resonance: { name: 'Resonance structures', from: 'check', match: 'resonance structures?|resonance', related: ['formal-charge', 'multiple'] },
  expanded: { name: 'More than 8 electrons', also: 'Also called an expanded octet.', from: 'check', match: 'more than 8(?: electrons)?', related: ['full-shell', 'formal-charge', 'group'] },
  'electron-geometry': { name: 'Electron geometry', also: 'Also called the electron-pair geometry.', from: 'shape', match: 'electron geometr(?:y|ies)', related: ['electron-group', 'shape', 'lone-pair'] },
  'electron-group': { name: 'Electron group', also: 'Also called an electron domain.', from: 'shape', match: 'electron (?:groups?|domains?)', related: ['lone-pair', 'bond', 'electron-geometry'] },
  'bond-angle': { name: 'Bond angle', from: 'shape', match: 'bond angles?', related: ['shape', 'electron-group'] },
  electronegativity: { name: 'Electronegativity', from: 'polar', match: 'electronegativit(?:y|ies)|electronegative', related: ['delta-en', 'polar-bond', 'partial'] },
  'delta-en': { name: 'ΔEN', also: 'Said “delta E N”. Δ stands for a difference.', from: 'polar', match: 'ΔEN', related: ['electronegativity', 'polar-bond'] },
  'polar-bond': { name: 'Polar bond', from: 'polar', match: '(?:non)?polar bonds?', related: ['delta-en', 'dipole', 'partial', 'polar-molecule'] },
  'polar-molecule': { name: 'Polar molecule', from: 'polar', match: '(?:non)?polar molecules?', related: ['net-dipole', 'cancel', 'polar-bond'] },
  'net-dipole': { name: 'Net dipole', from: 'polar', match: 'net dipoles?', related: ['dipole', 'cancel', 'polar-molecule'] },
  dipole: { name: 'Bond dipole', from: 'polar', match: 'bond dipoles?|dipole arrows?|bond arrows?|dipoles?', related: ['partial', 'polar-bond', 'net-dipole'] },
  partial: { name: 'δ+ and δ−', also: 'Said “delta plus” and “delta minus”. They are partial charges.', from: 'polar', match: 'δ[+−]|partial charges?', related: ['polar-bond', 'dipole', 'electronegativity'] },
  cancel: { name: 'Dipoles that cancel', from: 'polar', match: 'cancel(?:s|ed)?(?: out)?', related: ['dipole', 'net-dipole', 'polar-molecule'] },
  sigma: { name: 'Sigma bond', also: 'Written σ.', from: 'orbitals', match: 'sigma bonds?|sigma', related: ['pi', 'multiple', 'hybridization'] },
  pi: { name: 'Pi bond', also: 'Written π.', from: 'orbitals', match: 'pi bonds?|pi', related: ['sigma', 'multiple'] },
  hybridization: { name: 'Hybridization', from: 'orbitals', match: 'hybridization|hybrid orbitals?', related: ['electron-group', 'sigma', 'pi'] },
  polar: { name: 'Polar and nonpolar', from: 'polar', match: '(?:non)?polar', related: ['polar-bond', 'polar-molecule', 'electronegativity'] },
  shape: { name: 'Molecular geometry', also: 'Also called the molecular structure, or the shape of the molecule.', from: 'shape', match: 'molecular geometr(?:y|ies)|shapes?', related: ['electron-geometry', 'electron-group', 'bond-angle'] },
  ion: { name: 'Ion', from: 'count', match: 'ions?', related: ['valence', 'formal-charge'] },
  bond: { name: 'Bond', from: 'bond', match: 'shared electrons|bonds?', related: ['multiple', 'lone-pair', 'lewis'] },
}
export const BASE_TERMS = Object.keys(TERMS) as BaseTermId[]
export const ALL_TERMS: TermId[] = [...BASE_TERMS, ...ALL_SHAPES.map((name): TermId => `shape:${name}`)]

const isShapeTerm = (id: TermId): id is `shape:${ShapeName}` => id.startsWith('shape:')
const shapeNameOf = (id: `shape:${ShapeName}`) => id.slice(6) as ShapeName
/** A card's heading: "Lone pair", "Trigonal pyramidal". */
export function termName(id: TermId): string {
  return isShapeTerm(id) ? cap(shapeNameOf(id)) : TERMS[id].name
}
/** The step that first uses the word. A molecular geometry's name is first read in step 5. */
export function termFrom(id: TermId): StepId {
  return isShapeTerm(id) ? 'shape' : TERMS[id].from
}

/** Words every student has met by the time the Lewis structure is finished. They are highlighted
 *  up to the check step and in free build, and left plain in the three steps after it, where the
 *  new words are the ones a student looks for. */
const PLAIN_AFTER_CHECK: BaseTermId[] = ['valence', 'shell', 'ion', 'lewis', 'middle', 'bond']
/** The terms that are not highlighted in a step. `namesOpen`: step 5 has not had its molecular
 *  geometry picked, so the names of the geometries stay plain. Their cards say which counts of
 *  atoms and lone pairs each name goes with, which would answer the open question (L10). */
export function plainTerms(step: StepId | null, namesOpen = false): TermId[] {
  const after = step === 'shape' || step === 'polar' || step === 'orbitals' ? PLAIN_AFTER_CHECK : []
  return step === 'shape' && namesOpen ? [...after, ...ALL_SHAPES.map((name): TermId => `shape:${name}`)] : after
}

const TERM_FINDER = (() => {
  const escaped = (text: string) => text.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
  const list: { id: TermId; match: string }[] = [
    // the longest shape names first, so "trigonal bipyramidal" is not read as "trigonal" plus a word
    ...[...ALL_SHAPES].sort((a, b) => b.length - a.length).map((name) => ({ id: `shape:${name}` as TermId, match: escaped(name) })),
    ...BASE_TERMS.map((id) => ({ id, match: TERMS[id].match })),
  ]
  return { ids: list.map((x) => x.id), re: new RegExp(`(?<![\\p{L}\\d])(?:${list.map((x) => `(${x.match})`).join('|')})(?![\\p{L}\\d])`, 'giu') }
})()

/** A sentence cut into plain text and the key terms in it. Every use of a term is returned; the
 *  panel highlights the first one on a screen. */
export function termPieces(text: string, plain: TermId[] = []): { text: string; term: TermId | null }[] {
  const out: { text: string; term: TermId | null }[] = []
  const push = (part: string, term: TermId | null) => {
    if (!part) return
    const last = out[out.length - 1]
    if (last && last.term === null && term === null) last.text += part
    else out.push({ text: part, term })
  }
  let at = 0
  for (const m of text.matchAll(TERM_FINDER.re)) {
    const id = TERM_FINDER.ids[m.slice(1).findIndex((g) => g !== undefined)]!
    push(text.slice(at, m.index), null)
    // "Bond each hydrogen atom to carbon" and "the atom it should bond to" are the verb: the term is the noun
    const verb = id === 'bond' && (m[0] !== m[0].toLowerCase() || /\b(?:should|could|can|will|must|to) $/i.test(text.slice(0, m.index)))
    // lone pairs' pushes cancel too: the card is about dipoles, so the word opens it only in a sentence about dipoles or arrows
    const other = id === 'cancel' && !/dipole|arrow/i.test(text)
    push(m[0], plain.includes(id) || verb || other ? null : id)
    at = m.index + m[0].length
  }
  push(text.slice(at), null)
  return out
}

// ---- which example a card uses

const elsOfSample = (m: Sample) => m.formula.map(([el]) => el)
/** True when none of these atoms is in the molecule on screen. */
const clearOf = (p: Problem | null, els: El[]) => !p || !els.some((el) => elementsOf(p).includes(el))
/** True when none of these atoms is in the same column of the periodic table as an atom of the
 *  molecule on screen. Atoms of one column have the same number of valence electrons, so a card
 *  that counts chlorine's would give away fluorine's. */
const otherColumns = (p: Problem | null, els: El[]) => !p || !els.some((el) => elementsOf(p).some((mine) => ELEMENTS[mine].group === ELEMENTS[el].group))
const firstThat = <T>(pool: T[], ok: (x: T) => boolean): T => pool.find(ok) ?? pool[0]!
const formulaKey = (formula: [El, number][]) => JSON.stringify([...formula].sort((a, b) => a[0].localeCompare(b[0])))
/** True when the sample is the molecule on screen: a guided problem never is, an exercise can be (L10). */
const onScreen = (p: Problem | null, m: Sample) => !!p && m.charge === p.charge && formulaKey(m.formula) === formulaKey(p.formula)
/** The first sample that passes `ok` and is not the molecule on screen. When none passes, the first
 *  that is not on screen: a card never works on the molecule on screen, whatever else it gives up. */
const pick = (p: Problem | null, pool: Sample[], ok: (m: Sample) => boolean = () => true): Sample =>
  pool.find((m) => !onScreen(p, m) && ok(m)) ?? pool.find((m) => !onScreen(p, m)) ?? pool[0]!
/** The first sample none of whose atoms shares a column with an atom of the molecule on screen. */
const apart = (p: Problem | null, pool: Sample[]) => pick(p, pool, (m) => otherColumns(p, elsOfSample(m)))
/** The first sample whose molecular geometry is not the one of the molecule on screen. */
const otherShape = (p: Problem | null, pool: Sample[]) => pick(p, pool, (m) => !p || sampleShape(m).shape !== p.shape)
/** How many electron groups the middle atom of the molecule on screen has. */
function groupsOf(p: Problem): number {
  const sp = speciesOf(p)
  const ref = solveStar(sp.center, sp.terminals, sp.charge)
  const sol = ref ? bestStructures(ref)[0] : undefined
  return sol ? sp.terminals.length + sol.centerLone / 2 : 0
}
/** The first sample whose middle atom has a different number of electron groups. */
const otherGroups = (p: Problem | null, pool: Sample[]) => pick(p, pool, (m) => !p || sampleShape(m).groups !== groupsOf(p))
/** The first sample with another number of electron groups and another molecular geometry: the
 *  cards about the two geometries name both of the sample's, so neither may be the screen's. */
const otherGeometries = (p: Problem | null, pool: Sample[]) => pick(p, pool, (m) => !p || (sampleShape(m).groups !== groupsOf(p) && sampleShape(m).shape !== p.shape))
/** A bond for the cards about electronegativity: two atoms that are not in the molecule on screen,
 *  with a ΔEN that is not the ΔEN of any of its bonds. So a card never gives the electronegativity
 *  of one of the student's atoms (step 2 asks which of them is the least electronegative), and
 *  its subtraction is never the one step 6 asks for. */
const PAIRS: [El, El][] = [['H', 'Cl'], ['C', 'O'], ['H', 'O'], ['S', 'O'], ['P', 'F']]
function otherPair(p: Problem | null): [El, El] {
  if (!p) return PAIRS[0]!
  const mine = [...new Set(speciesOf(p).terminals)].map((el) => bondPolarity(p.center, el).tenths)
  return firstThat(PAIRS, (pair) => clearOf(p, pair) && !mine.includes(bondPolarity(pair[0], pair[1]).tenths))
}
/** Two atoms of one element for the nonpolar half of an example, again not an element of the molecule on screen. */
const samePair = (p: Problem | null): El => firstThat<El>(['F', 'H', 'Cl'], (el) => clearOf(p, [el]))

/** "an" before a word that is said with a vowel first: "an oxygen atom", "an H–Cl bond" (H, F, N, S and X are said "aitch", "eff", "en", "ess", "ex"). */
const article = (word: string) => (/^[aeiouAEFHILMNORSX]/.test(word) ? 'an' : 'a')
const shellList = (el: El) => list(shellsOf(el).map(String))
const innerOf = (el: El) => shellsOf(el).slice(0, -1)
const innerWords = (el: El) => (innerOf(el).length === 1 ? 'the inner shell' : 'inner shells')
const dotsWord = (n: number) => (n === 0 ? 'no dots' : plural(n, 'dot'))
const atomsWord = (n: number, el: El) => plural(n, `${lower(el)} atom`)
const angleLine = (angle: string) => (angle.includes(' and ') ? `The bond angles are ${angle}.` : `The bond angle is ${angle}.`)

/** What each shape's name means, as where the atoms sit. */
const SHAPE_MEANS: Record<ShapeName, string> = {
  linear: 'The atoms sit in a straight line, with the middle atom between the 2 outer atoms.',
  'trigonal planar': '3 atoms sit at the corners of a flat triangle, with the middle atom at its center.',
  bent: '2 atoms sit on the same side of the middle atom, so the 3 atoms make a V.',
  tetrahedral: '4 atoms sit at the corners of a pyramid that has 4 triangular faces, with the middle atom at its center.',
  'trigonal pyramidal': '3 atoms sit at the corners of a triangle, and the middle atom sits above the center of the triangle, at the top of a pyramid.',
  'trigonal bipyramidal': '3 atoms sit in a flat triangle around the middle atom, with 1 more atom straight above the middle atom and 1 straight below.',
  seesaw: '2 atoms sit on a straight line through the middle atom, and 2 more sit off to one side of that line.',
  'T-shaped': '3 atoms and the middle atom lie flat and make the letter T, with the middle atom where the 2 strokes meet.',
  octahedral: '4 atoms sit at the corners of a flat square around the middle atom, with 1 more atom straight above the middle atom and 1 straight below.',
  'square pyramidal': '4 atoms sit at the corners of a flat square around the middle atom, and a fifth sits straight above the middle atom.',
  'square planar': '4 atoms sit at the corners of a flat square, with the middle atom at its center.',
}
/** Two molecules of each molecular geometry: the first is the example, the second stands in when the first is on screen. */
const SHAPE_SAMPLE: Record<ShapeName, [Sample, Sample]> = {
  linear: [SAMPLES.BeCl2, SAMPLES.BeF2],
  'trigonal planar': [SAMPLES.BCl3, SAMPLES.NO3],
  bent: [SAMPLES.SCl2, SAMPLES.H2S],
  tetrahedral: [SAMPLES.CCl4, SAMPLES.SiH4],
  'trigonal pyramidal': [SAMPLES.NF3, SAMPLES.PF3],
  'trigonal bipyramidal': [SAMPLES.PF5, SAMPLES.AsF5],
  seesaw: [SAMPLES.SeF4, SAMPLES.SeCl4],
  'T-shaped': [SAMPLES.BrF3, SAMPLES.ICl3],
  octahedral: [SAMPLES.SeF6, SAMPLES.PF6],
  'square pyramidal': [SAMPLES.IF5, SAMPLES.ClF5],
  'square planar': [SAMPLES.ICl4, SAMPLES.BrF4],
}

/** Molecules with single, double and triple bonds, for the cards about bonds: the first of each
 *  list is the example, the second stands in when the first is the molecule on screen. */
const ONE_BOND = [SAMPLES.F2, SAMPLES.H2]
const TWO_BONDS = [SAMPLES.O2, SAMPLES.CS2]
const THREE_BONDS = [SAMPLES.N2, SAMPLES.CN]
const ORDER_WORD = ['', 'single', 'double', 'triple']
/** "has a double bond", or "has 2 double bonds" for carbon disulfide. */
function bondWords(m: Sample, order: number): string {
  const n = drawingOf(m).outer.length
  return n === 1 ? `has ${article(ORDER_WORD[order]!)} ${ORDER_WORD[order]} bond` : `has ${n} ${ORDER_WORD[order]} bonds`
}
/** "has a triple bond: 1 sigma bond and 2 pi bonds". */
function sigmaPiWords(m: Sample, order: number): string {
  const parts = `1 sigma bond and ${plural(order - 1, 'pi bond')}`
  return drawingOf(m).outer.length === 1 ? `${bondWords(m, order)}: ${parts}` : `${bondWords(m, order)}, and each is ${parts}`
}
const MARKS = ['', 'σ', 'σ and π', 'σ, π and π']
/** What a drawing of the bonds shows, for a screen reader: "two oxygen atoms joined by 2 lines marked σ and π". */
function linesWords(m: Sample, order: number, marked = false): string {
  const d = drawingOf(m)
  const lines = `${plural(order, 'line')}${marked ? ` marked ${MARKS[order]}` : ''}`
  const o = d.outer[0]!.el
  if (d.outer.length > 1) return `${article(lower(d.center))} ${lower(d.center)} atom joined to ${atomsWord(d.outer.length, o)} by ${lines} each`
  return o === d.center ? `two ${lower(o)} atoms joined by ${lines}` : `${article(lower(d.center))} ${lower(d.center)} atom and ${article(lower(o))} ${lower(o)} atom joined by ${lines}`
}

type CardBody = Pick<TermCard, 'means' | 'example' | 'note' | 'picture' | 'pictureLabel' | 'about'>

function shapeBody(name: ShapeName, p: Problem | null): CardBody {
  const m = pick(p, SHAPE_SAMPLE[name])
  const info = sampleShape(m)
  const cases = shapeCases(name).map((c) => `${plural(c.bonded, 'bonded atom')} and ${pairsText(c.lonePairs)}`)
  // five of the names are electron geometries too: the arrangement of all the groups
  const groups = Object.keys(GEOMETRY_FOR).find((n) => GEOMETRY_FOR[Number(n)] === name)
  const notes = [
    // 2 groups around a middle atom leave no room for a lone pair, so "lone pairs included" is left off linear (COPY2-15)
    groups ? `${cap(name)} is also the electron geometry of a middle atom with ${groups} electron groups${groups === '2' ? '' : ', lone pairs included'}.` : '',
    info.lonePairs > 0 || cases.length > 1 ? 'A molecular geometry is named for where the atoms sit. The lone pairs on the middle atom take up room and are left out of the name.' : '',
  ].filter(Boolean)
  return {
    means: `${SHAPE_MEANS[name]} A middle atom with ${cases.join(', or with ')}${cases.length > 1 ? ',' : ''} has this molecular geometry.`,
    example: `The molecular geometry of ${m.name}, ${formulaWord(m)}, is ${name}. ${angleLine(info.angle)}`,
    note: notes.length ? notes.join(' ') : null,
    picture: { kind: 'model', sample: m, arrows: 'none', angle: false },
    pictureLabel: `${cap(m.name)} drawn in 3D. Its molecular geometry is ${name}.`,
    about: { els: [], samples: [m] },
  }
}

function baseBody(id: BaseTermId, p: Problem | null): CardBody {
  const atom = (pool: El[]) => firstThat(pool, (el) => otherColumns(p, [el]))
  const shells = (el: El) => ({ picture: { kind: 'shells', el } as TermPicture, pictureLabel: shellsWords(el).label, about: { els: [el], samples: [] } })
  const lewis = (m: Sample, mark: LewisMark, label: string) => ({ picture: { kind: 'lewis', samples: [m], mark } as TermPicture, pictureLabel: label, about: { els: [], samples: [m] } })
  const model = (m: Sample, arrows: 'none' | 'bonds' | 'net', label: string, angle = false) => ({ picture: { kind: 'model', sample: m, arrows, angle } as TermPicture, pictureLabel: label, about: { els: [], samples: [m] } })
  const pair = (sum: boolean, arrow: boolean) => {
    const [a, b] = otherPair(p)
    const pol = bondPolarity(a, b)
    const hi = pol.negative!
    const lo = pol.positive!
    const label = `${cap(lower(a))}, ${courseEN(a)}, bonded to ${lower(b)}, ${courseEN(b)}.${arrow ? ` An arrow along the bond points at ${lower(hi)}, which is marked δ−.` : ''}${sum ? ` ${subtraction(pol)}.` : ''}`
    return { a, b, pol, hi, lo, name: bondName(a, b), rest: { picture: { kind: 'pair', a, b, sum: sum ? subtraction(pol) : null, arrow } as TermPicture, pictureLabel: label, about: { els: [a, b], samples: [] } } }
  }

  switch (id) {
    case 'valence': {
      const el = atom(['N', 'O', 'C'])
      const sh = shellsOf(el)
      return {
        means: "Valence electrons are the electrons in an atom's outer shell. They are the electrons an atom uses to make bonds, and the only ones a Lewis structure shows.",
        example: `${cap(lower(el))} has ${ELEMENTS[el].z} electrons in ${plural(sh.length, 'shell')}: ${shellList(el)}. The ${sh[sh.length - 1]} in the outer shell are its valence electrons.`,
        note: 'The inner shells are full and take no part in bonding, so their electrons are left out of the count.',
        ...shells(el),
      }
    }
    case 'shell': {
      const el = atom(['Cl', 'S', 'Si'])
      const sh = shellsOf(el)
      return {
        means: "An atom's electrons are arranged in shells around its nucleus. The inner shells are full. The outer shell is the last one, and the electrons in it are the valence electrons.",
        example: `${cap(lower(el))}'s ${ELEMENTS[el].z} electrons are in ${plural(sh.length, 'shell')}. The inner shells hold ${list(innerOf(el).map(String))}, and the outer shell holds ${sh[sh.length - 1]}.`,
        note: 'The first shell is full with 2 electrons, and the second is full with 8.',
        ...shells(el),
      }
    }
    case 'group': {
      const column = (g: number) => EL_ORDER.filter((el) => ELEMENTS[el].group === g)
      const g = firstThat([16, 17, 15, 14], (n) => clearOf(p, column(n)))
      const els = column(g).slice(0, 3)
      return {
        means: 'A group is a column of the periodic table, and a period is a row. Atoms in the same group have the same number of valence electrons.',
        example: `${cap(list(els.map(lower)))} are ${els.length === 2 ? 'both' : 'all'} in group ${g}, and each has ${ELEMENTS[els[0]!].valence} valence electrons.`,
        note: 'The period of an atom is the number of its shells that hold electrons. Atoms in period 2 have 2 shells, and atoms in period 3 have 3.',
        picture: { kind: 'table', els },
        pictureLabel: `The periodic table with ${list(els.map(lower))} marked in the column of group ${g}.`,
        about: { els: column(g), samples: [] },
      }
    }
    case 'atomic-number': {
      const el = atom(['N', 'O', 'C'])
      const e = ELEMENTS[el]
      return {
        means: 'The atomic number is the number of protons in an atom. A neutral atom has the same number of electrons, so the atomic number also counts all of its electrons.',
        example: `${cap(lower(el))}'s atomic number is ${e.z}, so ${article(lower(el))} ${lower(el)} atom has ${e.z} electrons. ${e.z - e.valence} of them are in ${innerWords(el)}, and ${e.valence} are valence electrons.`,
        note: 'The valence electrons are only part of that number: the electrons in the outer shell.',
        ...shells(el),
      }
    }
    case 'ion': {
      const m = apart(p, [SAMPLES.OH, SAMPLES.BF4, SAMPLES.CN])
      const n = Math.abs(m.charge)
      return {
        means: 'An ion is an atom or a group of bonded atoms that has a charge. A negative ion holds more electrons than its neutral atoms bring, and a positive ion holds fewer.',
        example: `${cap(m.name)}, ${formulaWord(m)}, has a charge of ${chargeWord(m.charge)}. The ion holds ${plural(n, 'more electron')} than its neutral atoms bring.`,
        note: 'The charge is written after the formula. 2− means 2 extra electrons, and 1+ means 1 electron fewer.',
        ...lewis(m, 'ion', `The Lewis structure of ${m.name} inside brackets, with its charge outside them.`),
      }
    }
    case 'lewis': {
      const m = apart(p, [SAMPLES.HCl, SAMPLES.H2S, SAMPLES.I2, SAMPLES.PH3])
      const d = drawingOf(m)
      const o = d.outer[0]!
      const n = d.outer.length
      const dots =
        o.el === d.center
          ? `1 line joins the 2 ${lower(o.el)} atoms, and each has ${dotsWord(o.lone)} around it.`
          : n === 1
            ? `1 line joins ${lower(d.center)} and ${lower(o.el)}. ${cap(lower(o.el))} has ${dotsWord(o.lone)} around it, and ${lower(d.center)} has ${dotsWord(d.lone)}.`
            : `${n} lines join ${lower(d.center)} to the ${atomsWord(n, o.el)}. ${cap(lower(d.center))} has ${dotsWord(d.lone)} around it, and each ${lower(o.el)} atom has ${dotsWord(o.lone)}.`
      return {
        means: 'A Lewis structure is a drawing of a molecule or an ion that shows its valence electrons. A line between two atoms is a bond, which is 2 shared electrons. Dots beside an atom are electrons that the atom does not share.',
        example: `In the Lewis structure of ${named(m)} ${dots}`,
        note: 'Only valence electrons are drawn. The electrons in the inner shells are left out.',
        ...lewis(m, 'none', `The Lewis structure of ${m.name}.`),
      }
    }
    case 'middle': {
      const m = apart(p, [SAMPLES.CCl4, SAMPLES.NF3, SAMPLES.H2S, SAMPLES.PF3, SAMPLES.SiH4, SAMPLES.SCl2])
      const d = drawingOf(m)
      return {
        means: 'The middle atom is the atom that the other atoms are bonded to. The atoms around it are the outer atoms, and each one is bonded to the middle atom only.',
        example: `In ${named(m)} ${lower(d.center)} is the middle atom, and the ${atomsWord(d.outer.length, d.outer[0]!.el)} are the outer atoms.`,
        note: 'Many textbooks call the middle atom the central atom, and the outer atoms the terminal atoms.',
        ...lewis(m, 'middle', `The Lewis structure of ${m.name}, with ${lower(d.center)} in the middle.`),
      }
    }
    case 'bond': {
      const m = apart(p, [SAMPLES.H2, SAMPLES.F2])
      return {
        means: 'A bond is 2 electrons that two atoms share. The shared electrons count for both atoms. A bond is drawn as a line between the two atoms.',
        example: `In ${named(m)} each ${lower(m.center)} atom puts 1 electron into the bond. The line between the atoms stands for those 2 shared electrons.`,
        note: 'A bond made of shared electrons is called a covalent bond.',
        ...lewis(m, 'bond', `The Lewis structure of ${m.name}, with the 2 shared electrons marked on the line.`),
      }
    }
    case 'multiple': {
      const [one, two, three] = [pick(p, ONE_BOND), pick(p, TWO_BONDS), pick(p, THREE_BONDS)]
      return {
        means: 'Two atoms can share 2, 4 or 6 electrons. A single bond is 2 shared electrons, a double bond is 4, and a triple bond is 6. They are drawn as 1, 2 or 3 lines.',
        example: `${cap(one.name)}, ${formulaWord(one)}, ${bondWords(one, 1)}. ${cap(two.name)}, ${formulaWord(two)}, ${bondWords(two, 2)}. ${cap(three.name)}, ${formulaWord(three)}, ${bondWords(three, 3)}.`,
        note: 'A double bond is still 1 bond between 2 atoms. Both atoms count all 4 of its electrons.',
        picture: { kind: 'lewis', samples: [one, two, three], mark: 'lines', captions: ['Single bond', 'Double bond', 'Triple bond'] },
        pictureLabel: `${cap(linesWords(one, 1))}, ${linesWords(two, 2)}, and ${linesWords(three, 3)}.`,
        about: { els: [], samples: [one, two, three] },
      }
    }
    case 'lone-pair': {
      const m = apart(p, [SAMPLES.HCl, SAMPLES.H2S, SAMPLES.I2, SAMPLES.PH3])
      const d = drawingOf(m)
      const o = d.outer[0]!
      const heavy = d.lone > 0 ? { el: d.center, lone: d.lone } : { el: o.el, lone: o.lone }
      const other = d.lone > 0 ? o.el : d.center
      const rest = other === heavy.el ? '' : `, and ${d.outer.length > 1 ? `each ${lower(other)} atom` : lower(other)} has none`
      const who = other === heavy.el ? `each ${lower(heavy.el)} atom` : lower(heavy.el)
      return {
        means: 'A lone pair is 2 valence electrons that stay on one atom and are not shared in a bond. A lone pair is drawn as 2 dots side by side.',
        example: `In ${named(m)} ${who} has ${plural(heavy.lone / 2, 'lone pair')}${rest}.`,
        note: 'A lone pair belongs to 1 atom only. The 2 electrons of a bond belong to both of its atoms.',
        ...lewis(m, 'lone', `The Lewis structure of ${m.name}, with each lone pair circled.`),
      }
    }
    case 'full-shell': {
      const m = apart(p, [SAMPLES.HCl, SAMPLES.H2S, SAMPLES.I2, SAMPLES.PH3])
      const d = drawingOf(m)
      const o = d.outer[0]!
      const heavy = d.lone > 0 ? { el: d.center, lone: d.lone, bonds: d.outer.reduce((n, x) => n + x.order, 0) } : { el: o.el, lone: o.lone, bonds: o.order }
      const other = d.lone > 0 ? o.el : d.center
      const who = other === heavy.el ? `each ${lower(heavy.el)} atom` : lower(heavy.el)
      const inBonds = heavy.bonds === 1 ? `2 in ${other === heavy.el ? 'the' : 'its'} bond` : `${heavy.bonds * 2} in its ${heavy.bonds} bonds`
      const rest = other === heavy.el ? '' : ` ${cap(d.outer.length > 1 ? `each ${lower(other)} atom` : lower(other))} has the 2 in its bond.`
      return {
        means: 'An atom has a full shell when 8 electrons are around it: its unshared electrons plus all the electrons in its bonds. Hydrogen is full with 2.',
        example: `In ${named(m)} ${who} has ${heavy.lone} unshared electrons and ${inBonds}, which makes ${heavy.lone + heavy.bonds * 2}.${rest}`,
        note: 'A few middle atoms end up with fewer than 8 electrons, and atoms from period 3 onward can hold more than 8.',
        ...lewis(m, 'shell', `The Lewis structure of ${m.name}, with a ring around the electrons that count for ${lower(heavy.el)}.`),
      }
    }
    case 'formal-charge': {
      const m = apart(p, [SAMPLES.OH, SAMPLES.BF4, SAMPLES.CN])
      const d = drawingOf(m)
      const bonds = d.outer.reduce((n, x) => n + x.order, 0)
      const v = ELEMENTS[d.center].valence
      return {
        means: 'Formal charge compares the valence electrons an atom brings with the electrons the drawing gives it. Take the valence electrons of the atom, subtract its unshared electrons, and subtract 1 for each bond line drawn to it.',
        example: `In ${named(m)} ${lower(d.center)} brings ${v} valence electrons. In the drawing, ${lower(d.center)} has ${d.lone} unshared electrons and ${plural(bonds, 'bond')}: ${v} − ${d.lone} − ${bonds} = ${signed(d.fc)}.`,
        note: 'The formal charges of all the atoms add up to the charge of the molecule or ion. The drawing with the smallest formal charges is the one to keep.',
        ...lewis(m, 'charges', `The Lewis structure of ${m.name}, with a formal charge of ${signed(d.fc)} on ${lower(d.center)}.`),
        about: { els: [d.center], samples: [m] },
      }
    }
    case 'resonance': {
      // ozone is bent with one double bond, as the nitrite ion is, so a bent molecule on screen gets the nitrate ion
      const m = otherShape(p, [SAMPLES.O3, SAMPLES.NO3])
      const n = formsOf(m)
      const o = drawingOf(m).outer[0]!.el
      return {
        means: 'Some molecules and ions have more than one correct Lewis structure, with a double bond in a different place in each. Those drawings are called resonance structures. The real molecule is an average of them.',
        example:
          n === 2
            ? `${cap(m.name)}, ${formulaWord(m)}, has 2 resonance structures. The double bond is on one side in the first drawing and on the other side in the second.`
            : `${cap(m.name)}, ${formulaWord(m)}, has ${n} resonance structures. The double bond goes to a different ${lower(o)} atom in each drawing.`,
        note: 'The molecule does not switch between the drawings. Its bonds are all the same, each in between a single bond and a double bond.',
        picture: { kind: 'lewis', samples: new Array<Sample>(n).fill(m), mark: 'lines', forms: Array.from({ length: n }, (_, i) => i) },
        pictureLabel: `${n} drawings of ${m.name}. The double bond is in a different place in each.`,
        about: { els: [], samples: [m] },
      }
    }
    case 'expanded': {
      const m = pick(p, [SAMPLES.SeF6, SAMPLES.PF5])
      const d = drawingOf(m)
      const bonds = d.outer.reduce((n, x) => n + x.order, 0)
      return {
        means: 'An atom from period 3 onward can hold more than 8 electrons when it is the middle atom. Atoms in periods 1 and 2 never hold more than 8.',
        example: `In ${named(m)} ${lower(d.center)} has ${plural(bonds, 'bond')}, so ${d.lone + bonds * 2} electrons are around it.`,
        // the third way is the electron count itself: XeF2, ClF3, SF4 and XeF4 have all formal charges 0 and 4 or fewer atoms (CHEM2-1)
        note: 'A middle atom ends up with more than 8 in three ways: it has more than 4 atoms to bond to, an extra bond brings the formal charges closer to 0, or electrons are left over once every outer atom is full, and they go on the middle atom as lone pairs.',
        ...lewis(m, 'lines', `${cap(lower(d.center))} in the middle with a line to each of ${atomsWord(d.outer.length, d.outer[0]!.el)}.`),
      }
    }
    case 'electron-group': {
      const m = otherGroups(p, [SAMPLES.NF3, SAMPLES.BCl3])
      const d = drawingOf(m)
      const info = sampleShape(m)
      return {
        means: 'An electron group is one place around the middle atom where electrons are: a bond to another atom, or a lone pair. A single, double or triple bond is 1 group.',
        example: `In ${named(m)} ${lower(d.center)} has ${plural(info.bonded, 'bonded atom')} and ${pairsText(info.lonePairs)}, which is ${plural(info.groups, 'electron group')}.`,
        note: 'Count the groups around the middle atom only. Lone pairs on the outer atoms are not counted.',
        ...lewis(m, 'groups', `The Lewis structure of ${m.name}, with each electron group around ${lower(d.center)} numbered.`),
      }
    }
    case 'electron-geometry': {
      const m = otherGeometries(p, [SAMPLES.NF3, SAMPLES.BrF3, SAMPLES.IF5])
      const d = drawingOf(m)
      const info = sampleShape(m)
      const c = lower(d.center)
      return {
        means: 'The electron geometry is how all the electron groups around the middle atom are spread out, lone pairs included. The groups push each other as far apart as they can get, so the number of groups sets the electron geometry.',
        example: `In ${named(m)} ${c} has ${plural(info.bonded, 'bonded atom')} and ${pairsText(info.lonePairs)}, which is ${plural(info.groups, 'electron group')}. The electron geometry is ${info.geometry}, and the molecular geometry is ${info.shape}.`,
        note: 'The electron geometry and the molecular geometry have the same name only when the middle atom has no lone pairs. A molecule of 2 atoms has no middle atom, and both of its geometries are given the same name.',
        ...model(m, 'none', `${cap(m.name)} drawn in 3D, with ${plural(info.groups, 'electron group')} around ${c}: ${plural(info.bonded, 'bonded atom')} and ${pairsText(info.lonePairs)}.`),
      }
    }
    case 'shape': {
      // the molecular geometry
      const m = otherGeometries(p, [SAMPLES.NF3, SAMPLES.BrF3, SAMPLES.IF5])
      const d = drawingOf(m)
      const info = sampleShape(m)
      const outer = d.outer[0]!.el
      return {
        means: 'The molecular geometry is where the atoms sit around the middle atom. The electron groups push each other as far apart as they can get, and that sets where the atoms go. The lone pairs take up room and are left out of the name.',
        example: `In ${named(m)} ${lower(d.center)} has ${plural(info.bonded, 'bonded atom')} and ${pairsText(info.lonePairs)}. The ${info.groups} electron groups point to the corners of ${GEOMETRY_NOUN[info.geometry]}, and the ${atomsWord(info.bonded, outer)} sit at ${info.bonded} of them, so the molecular geometry is ${info.shape}.`,
        note: 'Two molecules with the same electron geometry can have different molecular geometries, because a lone pair takes up one of the corners and has no atom there.',
        ...model(m, 'none', `${cap(m.name)} drawn in 3D. Its molecular geometry is ${info.shape}.`),
      }
    }
    case 'bond-angle': {
      const m = otherShape(p, [SAMPLES.BCl3, SAMPLES.CCl4])
      const d = drawingOf(m)
      const info = sampleShape(m)
      return {
        means: 'A bond angle is the angle between two bonds that meet at the same atom.',
        example: `In ${named(m)} the angle between any 2 ${bondName(d.center, d.outer[0]!.el)} bonds is ${info.angle}.`,
        // square planar keeps 90° and linear with 3 lone pairs keeps 180° (section 7.6), so the note says "usually" (COPY-8). It names
        // no molecular geometry and no angle: the card can open in step 5 before the molecular geometry is picked (FG-1).
        note: 'Lone pairs push harder than bonds do, so a lone pair on the middle atom usually squeezes the bonds a little closer together. When the lone pairs are spread evenly around the middle atom, their pushes balance and the bond angle stays the same.',
        ...model(m, 'none', `${cap(m.name)} with the angle between 2 of its bonds marked ${info.angle}.`, true),
      }
    }
    case 'electronegativity': {
      const x = pair(false, false)
      return {
        means: 'Electronegativity is a number for how strongly an atom pulls the shared electrons of a bond toward itself. A larger number means a stronger pull.',
        example: `${cap(lower(x.hi))} has an electronegativity of ${courseEN(x.hi)}, and ${lower(x.lo)} has ${courseEN(x.lo)}. In ${article(x.name)} ${x.name} bond, ${lower(x.hi)} pulls the shared electrons harder.`,
        note: 'Electronegativity gets larger from left to right across a period of the periodic table, and smaller going down a group.',
        ...x.rest,
      }
    }
    case 'delta-en': {
      const x = pair(true, false)
      return {
        means: 'ΔEN is the difference between the electronegativities of the two atoms in a bond: the larger number minus the smaller. ΔEN says how unevenly the two atoms share the electrons of the bond.',
        example: `For ${article(x.name)} ${x.name} bond, ${subtraction(x.pol)}. That is above 0.4, so the bond is polar.`,
        note: 'A ΔEN of 0.4 or less is a nonpolar bond. Above 0.4 and up to 2.0 is a polar bond. Above 2.0 the bond is ionic.',
        ...x.rest,
      }
    }
    case 'polar': {
      const x = pair(false, true)
      const same = samePair(p)
      return {
        means: 'Polar means the electrons are pulled toward one side, so that side is slightly negative and the other side is slightly positive. Nonpolar means the electrons are spread evenly. A bond can be polar, and a whole molecule can be polar.',
        example: `${cap(article(x.name))} ${x.name} bond is polar, because ${lower(x.hi)} pulls the shared electrons harder than ${lower(x.lo)}. ${cap(article(same))} ${bondName(same, same)} bond is nonpolar, because the 2 ${lower(same)} atoms pull equally.`,
        note: 'A molecule with polar bonds can still be nonpolar. That happens when its bond dipoles cancel.',
        ...x.rest,
      }
    }
    case 'polar-bond': {
      const x = pair(true, true)
      return {
        means: 'In a polar bond the two atoms share the electrons unevenly, because one atom has a larger electronegativity than the other. In a nonpolar bond the two atoms share the electrons evenly.',
        example: `In ${article(x.name)} ${x.name} bond, ${subtraction(x.pol)}, which is above 0.4, so the bond is polar. ${cap(lower(x.hi))} has the larger electronegativity, so the shared electrons sit closer to ${lower(x.hi)}.`,
        note: 'Two atoms of the same element have the same electronegativity, so ΔEN is 0 and neither atom pulls the shared electrons harder.',
        ...x.rest,
      }
    }
    case 'partial': {
      const x = pair(false, true)
      return {
        means: 'δ− marks the atom of a polar bond that the shared electrons sit closer to, which makes that atom slightly negative. δ+ marks the other atom, which is slightly positive.',
        example: `In ${article(x.name)} ${x.name} bond, ${lower(x.hi)} has the larger electronegativity, so ${lower(x.hi)} is δ− and ${lower(x.lo)} is δ+.`,
        note: 'A partial charge is smaller than the charge of an ion. No electron has moved from one atom to the other.',
        ...x.rest,
      }
    }
    case 'dipole': {
      const x = pair(false, true)
      return {
        means: 'A bond dipole is the uneven sharing in a polar bond, drawn as an arrow along the bond. The arrow points at the δ− atom, which is the atom with the larger electronegativity. A nonpolar bond gets no arrow.',
        example: `For ${article(x.name)} ${x.name} bond, the arrow starts at ${lower(x.lo)} and points at ${lower(x.hi)}.`,
        note: 'The small cross at the tail of the arrow marks the δ+ end.',
        ...x.rest,
      }
    }
    case 'net-dipole':
    case 'polar-molecule': {
      // the bent molecule lies flat on the page, so its arrows are the easier ones to read
      const m = otherShape(p, [SAMPLES.SCl2, SAMPLES.NF3])
      const d = drawingOf(m)
      const info = sampleShape(m)
      const o = d.outer[0]!.el
      const bondsText = `${info.bonded} ${bondName(d.center, o)}`
      const pic = model(m, 'net', `${cap(m.name)} drawn in 3D, with an arrow on each bond that points at ${lower(o)} and one thicker arrow for the net dipole.`)
      if (id === 'net-dipole') {
        return {
          means: 'The net dipole is all the bond dipoles of a molecule added together, drawn as one arrow. A molecule that has a net dipole is polar.',
          example: `In ${named(m)} each of the ${bondsText} arrows points at ${lower(o)}. In the ${info.shape} molecular geometry the arrows all lean toward the same side, so they add up to a net dipole.`,
          note: 'Bond dipoles are arrows, so their directions count when they are added. Arrows that point in opposite directions can cancel.',
          ...pic,
        }
      }
      return {
        means: 'A polar molecule has a net dipole: one side of the molecule is slightly negative and the other side is slightly positive. A nonpolar molecule has no net dipole, because it has no polar bonds or because its bond dipoles cancel.',
        example: `${cap(m.name)}, ${formulaWord(m)}, is a polar molecule. The ${bondsText} bonds are polar, and in the ${info.shape} molecular geometry their dipoles do not cancel.`,
        note: 'Polar bonds alone do not make a molecule polar. Whether the bond dipoles cancel depends on the molecular geometry.',
        ...pic,
      }
    }
    case 'cancel': {
      const m = otherShape(p, [SAMPLES.BeCl2, SAMPLES.BCl3])
      const d = drawingOf(m)
      const info = sampleShape(m)
      const name = bondName(d.center, d.outer[0]!.el)
      const how: Partial<Record<ShapeName, string>> = {
        linear: 'point in opposite directions',
        'trigonal planar': 'are 120° apart in a flat triangle',
      }
      return {
        means: 'Bond dipoles cancel when they are the same size and are spread evenly around the middle atom. Each arrow is undone by the others, so no net dipole is left and the molecule is nonpolar.',
        example: `In ${named(m)} the ${info.bonded} ${name} arrows are the same size and ${how[info.shape]}, so they cancel.`,
        // free build says the same for PCl3F2: with 5 or 6 groups it depends on which corners the unlike atoms take (CHEM2-3)
        note: 'Different outer atoms give arrows of different sizes, so those arrows usually do not cancel. They can still cancel when the atoms of each element are spread evenly around the middle atom, such as 2 atoms of one element on opposite sides.',
        ...model(m, 'bonds', `${cap(m.name)} drawn in 3D, with an arrow on each bond that points at ${lower(d.outer[0]!.el)} and no net dipole.`),
      }
    }
    case 'sigma': {
      const [one, two] = [pick(p, ONE_BOND), pick(p, TWO_BONDS)]
      return {
        means: 'A sigma bond is the first bond between two atoms. Two orbitals overlap head on, along the line between the atoms. Every single bond is a sigma bond, and every double or triple bond has exactly 1 sigma bond in it.',
        example: `${cap(one.name)}, ${formulaWord(one)}, ${bondWords(one, 1)}, which is 1 sigma bond. ${cap(two.name)}, ${formulaWord(two)}, ${sigmaPiWords(two, 2)}.`,
        note: 'Count 1 sigma bond for each pair of bonded atoms, whatever the number of lines between them.',
        picture: { kind: 'lewis', samples: [one, two], mark: 'sigma-pi' },
        pictureLabel: `${cap(linesWords(one, 1, true))}, and ${linesWords(two, 2, true)}.`,
        about: { els: [], samples: [one, two] },
      }
    }
    case 'pi': {
      const [two, three] = [pick(p, TWO_BONDS), pick(p, THREE_BONDS)]
      return {
        means: 'A pi bond is a second or third bond between the same two atoms. Two p orbitals overlap side by side, above and below the line between the atoms.',
        example: `${cap(two.name)}, ${formulaWord(two)}, ${sigmaPiWords(two, 2)}. ${cap(three.name)}, ${formulaWord(three)}, ${sigmaPiWords(three, 3)}.`,
        note: 'A pi bond is weaker than a sigma bond, and a single bond never has one.',
        picture: { kind: 'lewis', samples: [two, three], mark: 'sigma-pi' },
        pictureLabel: `${cap(linesWords(two, 2, true))}, and ${linesWords(three, 3, true)}.`,
        about: { els: [], samples: [two, three] },
      }
    }
    case 'hybridization': {
      const m = otherGroups(p, [SAMPLES.BCl3, SAMPLES.BeCl2, SAMPLES.CCl4])
      const d = drawingOf(m)
      const info = sampleShape(m)
      const h = hybridFor(info.groups)!
      const c = lower(d.center)
      return {
        means: 'Hybridization is a model in which an atom mixes its outer orbitals into new orbitals that are all alike: an s orbital, p orbitals, and d orbitals when it has 5 or 6 electron groups. The atom makes 1 hybrid orbital for each of its electron groups, and uses them for its sigma bonds and its lone pairs.',
        example: `In ${named(m)} ${c} has ${plural(info.groups, 'electron group')}. ${cap(c)} mixes 1 s orbital and ${plural(info.groups - 1, 'p orbital')} into ${info.groups} ${hybridLabel(h)} orbitals, so ${c} is ${hybridLabel(h)}.`,
        // sulfate (sp³, 2 pi bonds) and sulfur dioxide (sp², 2 pi bonds) have more pi bonds than p orbitals left over, so the
        // claim about where pi bonds come from is narrowed to period 2 middle atoms (CHEM2-2)
        note: 'A double or triple bond still counts as 1 electron group, because only its sigma bond uses a hybrid orbital. For a middle atom from period 2, the pi bonds use p orbitals that were left out of the mix.',
        ...model(m, 'none', `${cap(m.name)} drawn in 3D. Its molecular geometry is ${info.shape}.`),
      }
    }
  }
}

/** Everything a term's card shows. `p` is the molecule on screen, or null in free build. `step`
 *  is the guided step the student is in: the card then links only to terms that step or an
 *  earlier one uses. */
export function termCard(id: TermId, p: Problem | null = null, step: StepId | null = null): TermCard {
  const body = isShapeTerm(id) ? shapeBody(shapeNameOf(id), p) : baseBody(id, p)
  const links: TermId[] = isShapeTerm(id) ? ['shape', 'electron-geometry', 'bond-angle'] : TERMS[id].related
  const stepAt = (x: StepId) => STEPS.findIndex((st) => st.id === x)
  const related = links.filter((to) => step === null || stepAt(termFrom(to)) <= stepAt(step)).map((to) => ({ id: to, name: termName(to) }))
  return { id, name: termName(id), also: isShapeTerm(id) ? null : (TERMS[id].also ?? null), ...body, related }
}

// ---------------------------------------------------------------- the board's own controls (package BOARD)

/** The switch on the lifted 3D model, shown when the middle atom has a lone pair. `all` draws the
 *  lone pairs with the atoms, `atoms` fades the lone pairs out. */
export const GROUPS_VIEW_WORDS = {
  label: 'What the 3D model shows',
  all: 'Electron geometry',
  atoms: 'Molecular geometry',
} as const
