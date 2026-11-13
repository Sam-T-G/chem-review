// A Lewis structure as plain data, and the moves a student can make on it. Every function is pure:
// it returns a new structure and never changes the one it was given.
//
// The model: each atom keeps a count of its own unshared electrons (`lone`), and each bond of
// order n holds 2n shared electrons. Electrons are only created or destroyed by addElectron and
// removeElectron, so the count on the board always equals unshared + shared.
import { ELEMENTS, shellMax, type El } from './elements'

export interface Atom {
  id: string
  el: El
  /** Electrons on this atom that are not in a bond. */
  lone: number
}
export interface Bond {
  id: string
  a: string
  b: string
  /** 1, 2 or 3. */
  order: number
}
export interface Structure {
  atoms: Atom[]
  bonds: Bond[]
  /** Next atom number, so ids stay unique after removals. */
  seq: number
}

export const EMPTY: Structure = { atoms: [], bonds: [], seq: 1 }
export const MAX_ORDER = 3

export function atomById(s: Structure, id: string): Atom | undefined {
  return s.atoms.find((a) => a.id === id)
}
export function bondBetween(s: Structure, a: string, b: string): Bond | undefined {
  return s.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
}
export function bondsOf(s: Structure, id: string): Bond[] {
  return s.bonds.filter((x) => x.a === id || x.b === id)
}
export function neighborsOf(s: Structure, id: string): string[] {
  return bondsOf(s, id).map((x) => (x.a === id ? x.b : x.a))
}
/** Sum of the bond orders on an atom: how many of its own electrons are in bonds. */
export function orderSum(s: Structure, id: string): number {
  return bondsOf(s, id).reduce((n, x) => n + x.order, 0)
}
/** Electrons around an atom: its unshared electrons plus every electron in its bonds. */
export function shellCount(s: Structure, id: string): number {
  const atom = atomById(s, id)
  return atom ? atom.lone + 2 * orderSum(s, id) : 0
}
/** Formal charge = valence electrons − unshared electrons − bonds. */
export function formalCharge(s: Structure, id: string): number {
  const atom = atomById(s, id)
  return atom ? ELEMENTS[atom.el].valence - atom.lone - orderSum(s, id) : 0
}
export function electronsOnBoard(s: Structure): number {
  return s.atoms.reduce((n, a) => n + a.lone, 0) + 2 * s.bonds.reduce((n, x) => n + x.order, 0)
}
export function sharedElectrons(s: Structure): number {
  return 2 * s.bonds.reduce((n, x) => n + x.order, 0)
}
/** Valence electrons the neutral atoms on the board bring with them. */
export function valenceSum(s: Structure): number {
  return s.atoms.reduce((n, a) => n + ELEMENTS[a.el].valence, 0)
}
/** Charge of everything on the board: fewer electrons than the neutral atoms bring is positive. */
export function netCharge(s: Structure): number {
  return valenceSum(s) - electronsOnBoard(s)
}

export type Refusal =
  | 'same-atom' // a bond needs two different atoms
  | 'max-order' // already a triple bond
  | 'no-electrons' // no unshared electrons to use
  | 'shell-full' // the named atom's outer shell can't hold more
export type Op = { ok: true; s: Structure } | { ok: false; why: Refusal; atomId?: string }

/** A new atom arrives with its own valence electrons, all unshared. */
export function addAtom(s: Structure, el: El): { s: Structure; id: string } {
  const id = `a${s.seq}`
  return { id, s: { atoms: [...s.atoms, { id, el, lone: ELEMENTS[el].valence }], bonds: s.bonds, seq: s.seq + 1 } }
}

/** Take an atom off the board. Each of its bonds breaks evenly: the partner gets back one electron per bond. */
export function removeAtom(s: Structure, id: string): Structure {
  const back = new Map<string, number>()
  for (const x of bondsOf(s, id)) {
    const partner = x.a === id ? x.b : x.a
    back.set(partner, (back.get(partner) ?? 0) + x.order)
  }
  return {
    atoms: s.atoms.filter((a) => a.id !== id).map((a) => (back.has(a.id) ? { ...a, lone: a.lone + back.get(a.id)! } : a)),
    bonds: s.bonds.filter((x) => x.a !== id && x.b !== id),
    seq: s.seq,
  }
}

function withBond(s: Structure, a: string, b: string, giveA: number, giveB: number): Structure {
  const existing = bondBetween(s, a, b)
  const atoms = s.atoms.map((x) => (x.id === a ? { ...x, lone: x.lone - giveA } : x.id === b ? { ...x, lone: x.lone - giveB } : x))
  const bonds = existing ? s.bonds.map((x) => (x.id === existing.id ? { ...x, order: x.order + 1 } : x)) : [...s.bonds, { id: `${a}-${b}`, a, b, order: 1 }]
  return { atoms, bonds, seq: s.seq }
}

/** Add one bond between two atoms (a new single bond, or one more on an existing bond).
 *  The two electrons come from, in order of preference:
 *   1. one unshared electron from each atom;
 *   2. a pair from one atom, when the other has none to give or its shell would overflow.
 *  A move that would overfill a shell is refused and names the full atom. */
export function share(s: Structure, a: string, b: string): Op {
  if (a === b) return { ok: false, why: 'same-atom' }
  const A = atomById(s, a)
  const B = atomById(s, b)
  if (!A || !B) return { ok: false, why: 'same-atom' }
  const existing = bondBetween(s, a, b)
  if (existing && existing.order >= MAX_ORDER) return { ok: false, why: 'max-order' }

  const roomA = shellMax(A.el) - shellCount(s, a)
  const roomB = shellMax(B.el) - shellCount(s, b)

  // 1. one from each: each atom's count goes up by the partner's one electron
  if (A.lone >= 1 && B.lone >= 1 && roomA >= 1 && roomB >= 1) return { ok: true, s: withBond(s, a, b, 1, 1) }
  // 2. a pair from A: only B's count goes up, by two
  if (A.lone >= 2 && roomB >= 2 && (B.lone === 0 || roomA < 1)) return { ok: true, s: withBond(s, a, b, 2, 0) }
  //    or a pair from B
  if (B.lone >= 2 && roomA >= 2 && (A.lone === 0 || roomB < 1)) return { ok: true, s: withBond(s, a, b, 0, 2) }

  if (A.lone === 0 && B.lone === 0) return { ok: false, why: 'no-electrons' }
  // Something has electrons, so a shell is in the way. Name the atom with the least room.
  if (A.lone + B.lone < 2) return { ok: false, why: 'no-electrons' }
  return { ok: false, why: 'shell-full', atomId: roomA <= roomB ? a : b }
}

/** Take one bond away. Each atom gets one electron back. */
export function unshare(s: Structure, bondId: string): Structure {
  const bond = s.bonds.find((x) => x.id === bondId)
  if (!bond) return s
  return {
    atoms: s.atoms.map((x) => (x.id === bond.a || x.id === bond.b ? { ...x, lone: x.lone + 1 } : x)),
    bonds: bond.order > 1 ? s.bonds.map((x) => (x.id === bondId ? { ...x, order: x.order - 1 } : x)) : s.bonds.filter((x) => x.id !== bondId),
    seq: s.seq,
  }
}

/** Put one extra electron on an atom (the board's charge goes down by 1). */
export function addElectron(s: Structure, id: string): Op {
  const atom = atomById(s, id)
  if (!atom) return { ok: false, why: 'no-electrons' }
  if (shellCount(s, id) + 1 > shellMax(atom.el)) return { ok: false, why: 'shell-full', atomId: id }
  return { ok: true, s: { ...s, atoms: s.atoms.map((x) => (x.id === id ? { ...x, lone: x.lone + 1 } : x)) } }
}

/** Take one unshared electron off an atom (the board's charge goes up by 1). */
export function removeElectron(s: Structure, id: string): Op {
  const atom = atomById(s, id)
  if (!atom || atom.lone < 1) return { ok: false, why: 'no-electrons', atomId: id }
  return { ok: true, s: { ...s, atoms: s.atoms.map((x) => (x.id === id ? { ...x, lone: x.lone - 1 } : x)) } }
}
