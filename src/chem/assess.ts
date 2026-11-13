// Reads a structure and says what is still wrong with it, in the order a student should fix it.
// With a target species (a guided problem) it checks the atoms, the skeleton and the electron
// count against that species. With no target (free build) it checks the rules only.
import { ELEMENTS, canExpand, shellTarget, type El } from './elements'
import { DEFAULT_CONVENTION, bestStructures, signature, signatureOf, solveStar, type Convention } from './solve'
import { electronsOnBoard, formalCharge, neighborsOf, netCharge, orderSum, shellCount, valenceSum, type Structure } from './structure'

/** What a guided problem asks for: one center atom, the atoms bonded to it, and the overall charge.
 *  For a two-atom molecule the center is simply the first atom. */
export interface Species {
  center: El
  terminals: El[]
  charge: number
}

export type Topology =
  | { kind: 'empty' }
  | { kind: 'single'; center: string }
  /** More than one piece on the board. */
  | { kind: 'loose'; pieces: string[][] }
  /** One center with every other atom bonded only to it. Two bonded atoms count as a star. */
  | { kind: 'star'; center: string; terminals: string[] }
  /** Connected, but with chains, rings or more than one center. */
  | { kind: 'other' }

export interface AtomReport {
  id: string
  el: El
  /** Electrons around the atom. */
  count: number
  /** Electrons that fill its shell. */
  target: number
  /** short: fewer electrons than the shell needs, or an electron without a partner. */
  status: 'short' | 'full' | 'over'
  /** True when the atom's unshared electrons are an odd number: one of them has no partner. */
  unpaired: boolean
  fc: number
}

export type Issue =
  | { kind: 'missing'; els: El[] }
  | { kind: 'loose'; ids: string[] }
  | { kind: 'skeleton'; why: 'wrong-center' | 'outer-bonded' }
  | { kind: 'electrons'; have: number; need: number }
  | { kind: 'over'; ids: string[] }
  | { kind: 'short'; ids: string[] }
  /** Shells are full, but an atom holds an electron without a partner. */
  | { kind: 'unpaired'; ids: string[] }
  | { kind: 'charges' }
  /** Free build: the same atoms give smaller formal charges with this element in the middle. */
  | { kind: 'middle'; el: El }

export interface Assessment {
  topology: Topology
  atoms: AtomReport[]
  electrons: { have: number; need: number | null }
  /** Charge of everything on the board. */
  charge: number
  /** Which convention's best drawing the structure matches; null when it matches neither or no reference exists.
   *  Only a match with the convention in use counts as finished. */
  convention: 'both' | 'octet' | 'charge' | null
  issues: Issue[]
  complete: boolean
}

function pieces(s: Structure): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const atom of s.atoms) {
    if (seen.has(atom.id)) continue
    const piece: string[] = []
    const stack = [atom.id]
    seen.add(atom.id)
    while (stack.length) {
      const id = stack.pop()!
      piece.push(id)
      for (const nb of neighborsOf(s, id)) {
        if (!seen.has(nb)) {
          seen.add(nb)
          stack.push(nb)
        }
      }
    }
    out.push(piece)
  }
  return out
}

/** For two bonded atoms, the "center" is the less electronegative one, never hydrogen if avoidable. */
function pairCenter(s: Structure, prefer?: El): string {
  const [a, b] = s.atoms as [Structure['atoms'][number], Structure['atoms'][number]]
  if (prefer && a.el === prefer) return a.id
  if (prefer && b.el === prefer) return b.id
  if (a.el === 'H' && b.el !== 'H') return b.id
  if (b.el === 'H' && a.el !== 'H') return a.id
  return (ELEMENTS[a.el].en ?? 0) <= (ELEMENTS[b.el].en ?? 0) ? a.id : b.id
}

export function topologyOf(s: Structure, preferCenter?: El): Topology {
  if (s.atoms.length === 0) return { kind: 'empty' }
  const parts = pieces(s)
  if (parts.length > 1) return { kind: 'loose', pieces: parts }
  if (s.atoms.length === 1) return { kind: 'single', center: s.atoms[0]!.id }
  if (s.atoms.length === 2) {
    const center = pairCenter(s, preferCenter)
    return { kind: 'star', center, terminals: s.atoms.filter((a) => a.id !== center).map((a) => a.id) }
  }
  const hubs = s.atoms.filter((a) => neighborsOf(s, a.id).length >= 2)
  if (hubs.length !== 1) return { kind: 'other' }
  const center = hubs[0]!.id
  const terminals = s.atoms.filter((a) => a.id !== center).map((a) => a.id)
  const allOnCenter = terminals.every((id) => {
    const nb = neighborsOf(s, id)
    return nb.length === 1 && nb[0] === center
  })
  return allOnCenter ? { kind: 'star', center, terminals } : { kind: 'other' }
}

function countEls(els: El[]): Map<El, number> {
  const m = new Map<El, number>()
  for (const el of els) m.set(el, (m.get(el) ?? 0) + 1)
  return m
}

export function assess(s: Structure, species?: Species, use: Convention = DEFAULT_CONVENTION): Assessment {
  const topology = topologyOf(s, species?.center)
  const have = electronsOnBoard(s)
  const need = species ? ELEMENTS[species.center].valence + species.terminals.reduce((n, el) => n + ELEMENTS[el].valence, 0) - species.charge : null

  // In a guided problem the middle atom is known before it has its bonds, so a period 3 middle atom
  // (xenon in XeF2) is not called over-full while the student is still bonding the outer atoms.
  const namedCenterId = species ? (s.atoms.find((a) => a.el === species.center)?.id ?? null) : null
  const atoms: AtomReport[] = s.atoms.map((a) => {
    const count = shellCount(s, a.id)
    const target = shellTarget(a.el)
    const degree = neighborsOf(s, a.id).length
    // An atom may sit above its target when it is an electron-deficient element that reached 8,
    // or a period 3+ atom in the middle (two or more neighbors). A lone atom or an outer atom may not.
    const mayExceed = (target < 8 && count <= 8) || (canExpand(a.el) && (degree >= 2 || a.id === namedCenterId))
    const unpaired = a.lone % 2 === 1
    const status: AtomReport['status'] = count < target || unpaired ? 'short' : count === target || mayExceed ? 'full' : 'over'
    return { id: a.id, el: a.el, count, target, status, unpaired, fc: formalCharge(s, a.id) }
  })

  const issues: Issue[] = []

  // 1. every atom of the species is on the board
  if (species) {
    const want = countEls([species.center, ...species.terminals])
    const got = countEls(s.atoms.map((a) => a.el))
    const missing: El[] = []
    for (const [el, n] of want) for (let i = got.get(el) ?? 0; i < n; i++) missing.push(el)
    if (missing.length) issues.push({ kind: 'missing', els: missing })
  }

  // 2. one connected piece
  if (topology.kind === 'loose') {
    const biggest = topology.pieces.reduce((a, b) => (b.length > a.length ? b : a))
    const loose = topology.pieces.filter((p) => p !== biggest).flat()
    issues.push({ kind: 'loose', ids: loose })
  }

  // 3. the skeleton of the species: its center in the middle, outer atoms bonded only to it
  if (species && issues.length === 0) {
    if (topology.kind === 'other') {
      const centerAtoms = s.atoms.filter((a) => a.el === species.center)
      const hubIsCenter = centerAtoms.some((a) => neighborsOf(s, a.id).length === s.atoms.length - 1)
      issues.push({ kind: 'skeleton', why: hubIsCenter ? 'outer-bonded' : 'wrong-center' })
    } else if (topology.kind === 'star') {
      const center = s.atoms.find((a) => a.id === topology.center)!
      if (center.el !== species.center) issues.push({ kind: 'skeleton', why: 'wrong-center' })
    }
  }

  // 4. the electron count of the species
  if (need !== null && issues.length === 0 && have !== need) issues.push({ kind: 'electrons', have, need })

  // 5. every shell: nothing over, nothing short
  const onlyCountIssues: boolean = issues.filter((i) => i.kind !== 'electrons').length === 0
  if (topology.kind !== 'empty' && onlyCountIssues) {
    const over = atoms.filter((a) => a.status === 'over').map((a) => a.id)
    const short = atoms.filter((a) => a.count < a.target).map((a) => a.id)
    const unpaired = atoms.filter((a) => a.unpaired && a.count >= a.target).map((a) => a.id)
    if (over.length) issues.push({ kind: 'over', ids: over })
    if (short.length) issues.push({ kind: 'short', ids: short })
    if (unpaired.length) issues.push({ kind: 'unpaired', ids: unpaired })
  }

  // 6. formal charges as small as they can be
  let convention: Assessment['convention'] = null
  if (issues.length === 0 && topology.kind === 'star') {
    const center = s.atoms.find((a) => a.id === topology.center)!
    const terms = topology.terminals.map((id) => s.atoms.find((a) => a.id === id)!)
    const ref = solveStar(
      center.el,
      terms.map((t) => t.el),
      netCharge(s),
    )
    if (ref) {
      const mine = signature(
        center.el,
        center.lone,
        terms.map((t) => ({ el: t.el, order: orderSum(s, t.id), lone: t.lone })),
      )
      const termEls = terms.map((t) => t.el)
      const inOctet = ref.octet.some((sol) => signatureOf(center.el, termEls, sol) === mine)
      const inCharge = ref.charge.some((sol) => signatureOf(center.el, termEls, sol) === mine)
      if (inOctet && inCharge) convention = 'both'
      else if (inOctet) convention = 'octet'
      else if (inCharge) convention = 'charge'
      // only the convention in use counts: with 'charge', O=S–O (sulfur at 8, charges +1 and −1) is
      // sent back for the second double bond
      if (!(use === 'charge' ? inCharge : inOctet)) issues.push({ kind: 'charges' })

      // Free build: the student also chose which atom is in the middle. If the same atoms give
      // smaller formal charges around a different element, say so (C–O–O against O–C–O).
      if (!species && issues.length === 0 && terms.length >= 2) {
        const mine = atoms.reduce((n, a) => n + Math.abs(a.fc), 0)
        let best: { el: El; sum: number } | null = null
        for (const el of new Set(termEls)) {
          if (el === center.el) continue
          const at = termEls.indexOf(el)
          const others = [center.el, ...termEls.filter((_, i) => i !== at)]
          const altRef = solveStar(el, others, netCharge(s))
          const alt = altRef ? bestStructures(altRef, use)[0] : undefined
          if (!alt || alt.centerCount < shellTarget(el)) continue
          if (alt.sumAbs < mine && (!best || alt.sumAbs < best.sum)) best = { el, sum: alt.sumAbs }
        }
        if (best) {
          issues.push({ kind: 'middle', el: best.el })
          convention = null
        }
      }
    }
  }

  return {
    topology,
    atoms,
    electrons: { have, need },
    charge: valenceSum(s) - have,
    convention,
    issues,
    complete: topology.kind !== 'empty' && issues.length === 0,
  }
}
