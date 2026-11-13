// The guided walk through one problem: what each step asks, when it is done, and every sentence
// the panel shows. Pure functions of the problem and the board, so the wording is testable.
//
// Wording rules (Sam's voice rules): plain and literal, name the atom instead of "it", say what
// to do, no citations on screen, no lines that describe the interface.
import { assess, type Assessment, type Issue } from '../../chem/assess'
import { ELEMENTS, canExpand, shellMax, type El } from '../../chem/elements'
import { atomsOf, chargeWord, neutralElectrons, speciesOf, totalElectrons, type Problem } from '../../chem/problems'
import { bestStructures, solveStar } from '../../chem/solve'
import { addElectron, atomById, bondsOf, removeElectron, share, shellCount, type Refusal, type Structure } from '../../chem/structure'
import { ALL_SHAPES, MEASURED_ANGLE, centerDomains, classify, type ShapeInfo, type ShapeName } from '../../chem/vsepr'

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

// ---------------------------------------------------------------- step 1: count

/** What to say about a wrong valence count. `tries` is how many wrong checks this atom has had (1 = first). */
export function countFeedback(el: El, answer: number, tries: number): string {
  const e = ELEMENTS[el]
  const name = lower(el)
  if (tries >= 3) return `${cap(name)} has ${plural(e.valence, 'valence electron')}.`
  if (tries === 2) {
    return e.group <= 2
      ? `${cap(name)} is in group ${e.group}. In groups 1 and 2, the group number is the number of valence electrons.`
      : `${cap(name)} is in group ${e.group}. For groups 13 to 18, subtract 10 from the group number.`
  }
  if (answer === e.z && e.z !== e.valence) {
    return `${answer} is ${name}'s atomic number, which counts all of its electrons. Count only the outer shell.`
  }
  if (answer === 0) return `Set a number for ${name}. Find ${name}'s group on the periodic table.`
  return `${cap(name)} doesn't have ${plural(answer, 'valence electron')}. Find ${name}'s group on the periodic table.`
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

export function totalFeedback(p: Problem, answer: number, tries: number): string {
  const neutral = neutralElectrons(p)
  const n = Math.abs(p.charge)
  if (tries >= 3) return `${totalSum(p)} = ${totalElectrons(p)}.`
  if (p.charge !== 0 && answer === neutral) {
    return p.charge < 0
      ? `${neutral} is the count for the neutral atoms. The ${chargeWord(p.charge)} charge means the ion has ${plural(n, 'extra electron')}.`
      : `${neutral} is the count for the neutral atoms. The ${chargeWord(p.charge)} charge means the ion is missing ${plural(n, 'electron')}.`
  }
  if (p.charge !== 0 && answer === neutral + p.charge) {
    return p.charge < 0
      ? `A ${chargeWord(p.charge)} charge means ${plural(n, 'extra electron')}, so add ${n} to ${neutral}.`
      : `A ${chargeWord(p.charge)} charge means ${plural(n, 'electron')} fewer, so subtract ${n} from ${neutral}.`
  }
  const once = p.formula.reduce((sum, [el]) => sum + ELEMENTS[el].valence, 0)
  if (answer === once && once !== neutral) {
    const many = p.formula.filter(([, k]) => k > 1).map(([el, k]) => `${k} ${lower(el)} atoms`)
    return `Count every atom. ${cap(inventory({ ...p, charge: 0 }))}: the ${list(many)} each bring their own electrons.`
  }
  if (tries === 2) return `Work out ${totalSum(p)}.`
  return p.charge === 0 ? 'Add up the valence electrons of every atom.' : `Add up the valence electrons of every atom, then adjust for the ${chargeWord(p.charge)} charge.`
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
export function middleFeedback(p: Problem, pick: El): { right: boolean; text: string } {
  const c = lower(p.center)
  if (pick === p.center) {
    if (hydrogenRule(p)) return { right: true, text: `${cap(c)}. A hydrogen atom makes only 1 bond, so hydrogen always goes on the outside.` }
    const tail = outerEls(p).includes('H') ? ' Hydrogen is never in the middle.' : ''
    return { right: true, text: `${cap(c)}. The middle atom is usually the least electronegative one, the atom that pulls on shared electrons the least.${tail}` }
  }
  if (pick === 'H') return { right: false, text: 'A hydrogen atom makes only 1 bond, so it can connect to only 1 other atom. Pick again.' }
  return {
    right: false,
    text: `${cap(lower(pick))} pulls on shared electrons harder than ${c} does (it is more electronegative). The middle atom is usually the least electronegative one. Pick again.`,
  }
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
    text: `Drag ${lower(o.el)} onto ${cName} again. They share 1 more pair, which makes a ${orderTo(o.id) >= 2 ? 'triple' : 'double'} bond.`,
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
}
export function groupFacts(s: Structure): GroupFacts | null {
  const a = assess(s)
  if (a.topology.kind !== 'star') return null
  const d = centerDomains(s, a.topology.center)
  return { bonded: d.bonds.length, lonePairs: d.lonePairs, groups: d.bonds.length + d.lonePairs, bondPairs: d.bonds.reduce((n, b) => n + b.order, 0) }
}

const pairsText = (n: number) => (n === 0 ? 'no lone pairs' : plural(n, 'lone pair'))

export function groupsFeedback(center: El, f: GroupFacts, answer: number, tries: number): string {
  const c = lower(center)
  if (tries >= 2) return `${cap(c)} has ${plural(f.bonded, 'bonded atom')} and ${pairsText(f.lonePairs)}.`
  if (answer === f.bondPairs + f.lonePairs && f.bondPairs !== f.bonded) return 'A double or triple bond points in one direction, so count the whole bond as 1 group.'
  if (answer === f.bonded && f.lonePairs > 0) return `Count ${f.lonePairs === 1 ? 'the lone pair' : 'the lone pairs'} on ${c} too.`
  return `Count the atoms bonded to ${c}, then the lone pairs on ${c}.`
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

export function shapeFeedback(center: El, info: ShapeInfo, pick: ShapeName): { right: boolean; text: string } {
  const c = lower(center)
  if (pick === info.shape) return { right: true, text: `${cap(info.shape)}: ${plural(info.bonded, 'atom')} and ${pairsText(info.lonePairs)} around ${c}.` }
  if (pick === info.geometry) {
    return {
      right: false,
      text: `The shape is ${info.shape}. The ${info.groups} groups do point to the corners of ${GEOMETRY_NOUN[info.geometry]}, but ${info.lonePairs === 1 ? '1 corner holds a lone pair' : `${info.lonePairs} corners hold lone pairs`}. The shape is named for where the atoms are.`,
    }
  }
  return { right: false, text: `The shape is ${info.shape}: ${plural(info.bonded, 'atom')} and ${pairsText(info.lonePairs)} around ${c}.` }
}

export interface ShapeReadout {
  groups: string
  arrangement: string
  shape: string
  angle: string
  why: string | null
}

export function shapeReadout(p: Problem | null, center: El, info: ShapeInfo): ShapeReadout {
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
    angle: info.diatomic ? 'none (2 atoms)' : measured ? `${info.angle} (measured: ${measured})` : info.angle,
    why,
  }
}

// ---------------------------------------------------------------- refusals and hints

export function refusalText(s: Structure, why: Refusal, atomId?: string): string {
  const atom = atomId ? atomById(s, atomId) : undefined
  if (why === 'shell-full' && atom) {
    const n = shellCount(s, atom.id)
    const max = shellMax(atom.el)
    const name = lower(atom.el)
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
export function hintsFor(step: StepId, p: Problem, s: Structure): string[] {
  const c = lower(p.center)
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

