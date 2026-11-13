// The reference Lewis structure for one center atom with outer atoms bonded to it (or for two atoms).
// It tries every combination of single, double and triple bonds, fills the outer atoms' shells, puts
// what is left on the center, and keeps the best combination. That is the five-step textbook
// procedure (OpenStax Chemistry 2e, 7.3) done exhaustively, with formal charge (7.4) as the judge.
//
// Two conventions are in use for period 3 centers such as SO2 or sulfate:
//   charge - make formal charges small first, letting the center go past 8 (an expanded octet);
//   octet  - keep the center at 8 when the electron count allows it, then make formal charges small.
// Both are computed. The app uses DEFAULT_CONVENTION, which is 'charge': Sam's call on 2026-11-12
// ("we can do expanded octets"). For period 2 centers the two always agree.
import { ELEMENTS, shellMax, shellTarget, type El } from './elements'
import { MAX_ORDER } from './structure'

export interface StarSolution {
  /** Unshared electrons on the center. */
  centerLone: number
  /** Bond order to each outer atom, in the order the outer atoms were given. */
  orders: number[]
  /** Unshared electrons on each outer atom. */
  termLone: number[]
  fcCenter: number
  fcTerm: number[]
  /** Electrons around the center. */
  centerCount: number
  /** Sum of the sizes of all formal charges. */
  sumAbs: number
}

export type Convention = 'charge' | 'octet'
/** The convention the app teaches and checks against. Change this one line to switch. */
export const DEFAULT_CONVENTION: Convention = 'charge'

export interface Reference {
  /** Valence electrons of the species, charge included. */
  total: number
  /** Best structures under the octet-first convention (more than one means resonance forms). */
  octet: StarSolution[]
  /** Best structures when formal charges come first. */
  charge: StarSolution[]
  /** True when both conventions pick the same structures. */
  sameAnswer: boolean
}

interface Scored extends StarSolution {
  deficiency: number
  excess: number
  maxAbs: number
  /** Lower when negative formal charges sit on the more electronegative atoms. */
  enScore: number
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!
    if (Math.abs(d) > 1e-9) return d
  }
  return 0
}

function best(all: Scored[], key: (s: Scored) => number[]): Scored[] {
  if (all.length === 0) return []
  let top = all[0]!
  for (const s of all) if (compare(key(s), key(top)) < 0) top = s
  return all.filter((s) => compare(key(s), key(top)) === 0)
}

/** The accepted structures under a convention (more than one means resonance forms). */
export function bestStructures(ref: Reference, convention: Convention = DEFAULT_CONVENTION): StarSolution[] {
  return convention === 'charge' ? ref.charge : ref.octet
}

/** A structure's identity, ignoring which of several identical outer atoms carries which bond. */
export function signature(center: El, centerLone: number, terms: { el: El; order: number; lone: number }[]): string {
  return `${center}:${centerLone}|${terms
    .map((t) => `${t.el}:${t.order}:${t.lone}`)
    .sort()
    .join(',')}`
}
export function signatureOf(center: El, terminals: El[], sol: StarSolution): string {
  return signature(
    center,
    sol.centerLone,
    terminals.map((el, i) => ({ el, order: sol.orders[i]!, lone: sol.termLone[i]! })),
  )
}

export function solveStar(center: El, terminals: El[], charge: number): Reference | null {
  const total = ELEMENTS[center].valence + terminals.reduce((n, el) => n + ELEMENTS[el].valence, 0) - charge
  if (total <= 0 || total % 2 !== 0 || terminals.length === 0) return null

  const n = terminals.length
  const orders = new Array<number>(n).fill(1)
  const all: Scored[] = []
  const centerMax = shellMax(center)
  const centerTarget = shellTarget(center)

  for (;;) {
    // outer atoms: shell filled exactly, hydrogen at 2
    let ok = true
    const termLone: number[] = []
    for (let i = 0; i < n; i++) {
      const lone = shellTarget(terminals[i]!) - 2 * orders[i]!
      if (lone < 0) ok = false
      termLone.push(lone)
    }
    if (ok) {
      const bondSum = orders.reduce((a, b) => a + b, 0)
      const centerLone = total - 2 * bondSum - termLone.reduce((a, b) => a + b, 0)
      const centerCount = centerLone + 2 * bondSum
      if (centerLone >= 0 && centerCount <= centerMax) {
        const fcCenter = ELEMENTS[center].valence - centerLone - bondSum
        const fcTerm = terminals.map((el, i) => ELEMENTS[el].valence - termLone[i]! - orders[i]!)
        const charges = [fcCenter, ...fcTerm]
        const els = [center, ...terminals]
        all.push({
          centerLone,
          orders: [...orders],
          termLone,
          fcCenter,
          fcTerm,
          centerCount,
          sumAbs: charges.reduce((a, c) => a + Math.abs(c), 0),
          maxAbs: Math.max(...charges.map((c) => Math.abs(c))),
          deficiency: Math.max(0, centerTarget - centerCount),
          excess: Math.max(0, centerCount - 8),
          enScore: charges.reduce((a, c, i) => a + c * (ELEMENTS[els[i]!].en ?? 0), 0),
        })
      }
    }
    // next combination of bond orders
    let i = 0
    while (i < n && orders[i]! === MAX_ORDER) orders[i++] = 1
    if (i === n) break
    orders[i]! += 1
  }
  if (all.length === 0) return null

  const octet = best(all, (s) => [s.deficiency, s.excess, s.sumAbs, s.maxAbs, s.enScore])
  const chargeFirst = best(all, (s) => [s.deficiency, s.sumAbs, s.maxAbs, s.excess, s.enScore])
  const strip = ({ deficiency: _d, excess: _e, maxAbs: _m, enScore: _s, ...rest }: Scored): StarSolution => rest
  const sigs = (list: Scored[]) => new Set(list.map((s) => signatureOf(center, terminals, s)))
  const a = sigs(octet)
  const b = sigs(chargeFirst)
  const sameAnswer = a.size === b.size && [...a].every((x) => b.has(x))
  return { total, octet: octet.map(strip), charge: chargeFirst.map(strip), sameAnswer }
}
