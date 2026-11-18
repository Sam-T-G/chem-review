// Shared by the test files: build structures with the same moves the app offers.
import { assess } from '../src/chem/assess'
import type { El } from '../src/chem/elements'
import { PROBLEMS, speciesOf, totalElectrons } from '../src/chem/problems'
import { EMPTY, addAtom, addElectron, removeElectron, share, type Structure } from '../src/chem/structure'
import { nextMove, type Move } from '../src/modules/lewis/guide'

/** Atoms on the board, the first bonded to each of the others `orders[i]` times. */
export function star(els: El[], orders: number[] = []): { s: Structure; ids: string[] } {
  let s = EMPTY
  const ids: string[] = []
  for (const el of els) {
    const r = addAtom(s, el)
    s = r.s
    ids.push(r.id)
  }
  orders.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      const op = share(s, ids[0]!, ids[i + 1]!)
      if (!op.ok) throw new Error(`refused: ${op.why}`)
      s = op.s
    }
  })
  return { s, ids }
}

/** Carry out one move from the guide. Throws if the board refuses it. */
export function applyMove(s: Structure, m: Move): Structure {
  const must = (op: ReturnType<typeof share>, what: string): Structure => {
    if (!op.ok) throw new Error(`the guide suggested ${what}, but the board refused: ${op.why}`)
    return op.s
  }
  if (m.kind === 'bond') return must(share(s, m.to, m.from), 'a bond')
  if (m.kind === 'add') return must(addElectron(s, m.atomId), '+ electron')
  if (m.kind === 'remove') return must(removeElectron(s, m.atomId), '− electron')
  if (m.kind === 'transfer') return must(addElectron(must(removeElectron(s, m.from), '− electron'), m.to), '+ electron')
  throw new Error(`the guide gave advice with no move: ${m.text}`)
}

/** Solve a problem the way the guide tells a student to, using only the app's moves: connect each
 *  outer atom to the middle atom, then do whatever the check step's hint says until nothing is left. */
export function solveLikeAStudent(problemId: string): Structure {
  const p = PROBLEMS.find((x) => x.id === problemId)!
  const sp = speciesOf(p)
  let s = EMPTY
  const c = addAtom(s, sp.center)
  s = c.s
  const terms: string[] = []
  for (const el of sp.terminals) {
    const r = addAtom(s, el)
    s = r.s
    terms.push(r.id)
  }
  // bond step: connect each outer atom to the middle atom once
  for (const t of terms) {
    let op = share(s, c.id, t)
    if (!op.ok && assess(s, sp).electrons.have > totalElectrons(p)) {
      // a positive ion: the middle atom is full, so the extra electron comes off this outer atom first
      const off = removeElectron(s, t)
      if (!off.ok) throw new Error(`${problemId}: cannot remove an electron`)
      s = off.s
      op = share(s, c.id, t)
    }
    if (!op.ok) throw new Error(`${problemId}: cannot bond ${t}: ${op.why}`)
    s = op.s
  }
  // check step: follow the hints
  for (let round = 0; round < 24; round++) {
    const m = nextMove(p, s)
    if (!m) break
    s = applyMove(s, m)
  }
  const a = assess(s, sp)
  if (!a.complete) throw new Error(`${problemId}: the hints ran out with ${JSON.stringify(a.issues)}`)
  return s
}

/** N=N=O with nitrogen in the middle: two double bonds, charges +1 (middle N), −1 (end N), 0 (O).
 *  Every shell is full, but this is the second-best drawing: N≡N–O puts the −1 on oxygen instead.
 *  Plain drags stop one bond short, so one electron is moved from the middle nitrogen to the end one. */
export function nitrousOxideTwoDoubles(): { s: Structure; ids: string[] } {
  const b = star(['N', 'N', 'O'], [2, 1])
  const [mid, end, o] = b.ids as [string, string, string]
  const off = removeElectron(b.s, mid)
  if (!off.ok) throw new Error(off.why)
  const on = addElectron(off.s, end)
  if (!on.ok) throw new Error(on.why)
  const last = share(on.s, mid, o)
  if (!last.ok) throw new Error(last.why)
  return { s: last.s, ids: b.ids }
}

/** N≡N–O, the accepted drawing of nitrous oxide: charges +1 on the middle nitrogen and −1 on oxygen. */
export function nitrousOxide(): { s: Structure; ids: string[] } {
  return star(['N', 'N', 'O'], [3, 1])
}

/** Draws a molecule with one middle atom (or two atoms) from a drawing worked by hand, with the app's moves:
 *  place the atoms, add or take away electrons until each atom holds what it keeps plus one electron per bond,
 *  then share. `orders` is the bond order to each outer atom, in `terminals` order. Every outer atom ends with a
 *  full shell (2 for hydrogen, 8 for the rest). The middle atom ends with `centerLone` unshared electrons. */
export function drawn(center: El, terminals: El[], orders: number[], centerLone: number): { s: Structure; ids: string[] } {
  const must = (op: ReturnType<typeof share>, what: string): Structure => {
    if (!op.ok) throw new Error(`${what}: the board refused (${op.why})`)
    return op.s
  }
  let s = EMPTY
  const ids: string[] = []
  const keep = [centerLone + orders.reduce((a, b) => a + b, 0), ...terminals.map((el, i) => (el === 'H' ? 2 : 8) - orders[i]!)]
  for (const el of [center, ...terminals]) {
    const r = addAtom(s, el)
    s = r.s
    ids.push(r.id)
  }
  ids.forEach((id, i) => {
    for (;;) {
      const lone = s.atoms.find((a) => a.id === id)!.lone
      if (lone === keep[i]) break
      s = must(lone < keep[i]! ? addElectron(s, id) : removeElectron(s, id), `setting ${id} to ${keep[i]}`)
    }
  })
  orders.forEach((n, i) => {
    for (let k = 0; k < n; k++) s = must(share(s, ids[0]!, ids[i + 1]!), `bond ${i + 1}`)
  })
  return { s, ids }
}
