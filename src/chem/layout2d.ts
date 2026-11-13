// Where things sit in the flat Lewis drawing. Pure geometry, no rendering.
//
// Each atom has evenly spaced "seats" around it: one per bonded neighbor and one per group of
// unshared electrons (a pair or a single electron). A carbon with four single bonds has four
// seats 90° apart; the oxygen of a C=O double bond has three seats 120° apart (the bond and two
// lone pairs). Seats are recomputed whenever bonds or electrons change, so the drawing rearranges
// itself as the student works.
import { ELEMENTS, type El } from './elements'
import { atomById, bondsOf, orderSum, type Structure } from './structure'

export interface P2 {
  x: number
  y: number
}

/** Ball radius on the board, by period. */
export function atomRadius(el: El): number {
  const p = ELEMENTS[el].period
  return p === 1 ? 0.34 : p === 2 ? 0.48 : p === 3 ? 0.58 : 0.64
}
/** Center-to-center distance of a bond. Multiple bonds are drawn a little shorter. */
export function bondLength(a: El, b: El, order: number): number {
  return atomRadius(a) + atomRadius(b) + 0.66 - 0.06 * (order - 1)
}

/** How an atom's unshared electrons are drawn: as many single electrons as it has free seats,
 *  pairing up only when the seats run out. Each bond uses one of the atom's four seats per bond order. */
export function loneGroups(lone: number, bondOrderSum: number): { pairs: number; singles: number } {
  const seats = Math.max(0, 4 - bondOrderSum)
  if (lone <= seats) return { pairs: 0, singles: lone }
  if (lone <= 2 * seats) return { pairs: lone - seats, singles: 2 * seats - lone }
  return { pairs: Math.floor(lone / 2), singles: lone % 2 }
}

export interface AtomSlots {
  /** Seat angle for each bonded neighbor, radians, counterclockwise from +x. */
  bonds: { id: string; angle: number }[]
  /** Seat angle for each group of unshared electrons: pairs first, then single electrons. */
  groups: { angle: number; count: 1 | 2 }[]
}

const TAU = Math.PI * 2
function gap(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU
  return d > Math.PI ? TAU - d : d
}

/** Seats around one atom. `neighbors` are in bond order (the first one fixes where seat 0 points);
 *  `first` names a neighbor that picks its seat before the others (the one being dragged). */
export function slotAtom(neighbors: { id: string; angle: number }[], lone: number, bondOrderSum: number, first?: string): AtomSlots {
  const { pairs, singles } = loneGroups(lone, bondOrderSum)
  const g = pairs + singles
  const counts: (1 | 2)[] = [...new Array<1 | 2>(pairs).fill(2), ...new Array<1 | 2>(singles).fill(1)]
  const m = neighbors.length + g
  if (m === 0) return { bonds: [], groups: [] }

  if (neighbors.length === 0) {
    // a free atom: top, right, bottom, left, the way Lewis symbols are printed
    const step = g <= 4 ? TAU / 4 : TAU / g
    return { bonds: [], groups: counts.map((count, k) => ({ angle: Math.PI / 2 - k * step, count })) }
  }

  const base = neighbors[0]!.angle
  const step = TAU / m
  const seat = (k: number) => base + k * step
  const taken = new Array<boolean>(m).fill(false)
  taken[0] = true
  const bonds: { id: string; angle: number }[] = [{ id: neighbors[0]!.id, angle: base }]
  const rest = neighbors.slice(1)
  rest.sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0))
  for (const nb of rest) {
    let pick = -1
    let pickGap = Infinity
    for (let k = 1; k < m; k++) {
      if (taken[k]) continue
      const d = gap(seat(k), nb.angle)
      if (d < pickGap - 1e-9) {
        pickGap = d
        pick = k
      }
    }
    taken[pick] = true
    bonds.push({ id: nb.id, angle: seat(pick) })
  }
  const groups: { angle: number; count: 1 | 2 }[] = []
  let c = 0
  for (let k = 1; k < m && c < counts.length; k++) {
    if (taken[k]) continue
    groups.push({ angle: seat(k), count: counts[c++]! })
  }
  return { bonds, groups }
}

/** Seats for an atom on the board, read from the current positions. */
export function slotsFor(s: Structure, pos: Map<string, P2>, id: string, first?: string): AtomSlots {
  const atom = atomById(s, id)
  const here = pos.get(id)
  if (!atom || !here) return { bonds: [], groups: [] }
  const neighbors = bondsOf(s, id).map((b) => {
    const other = b.a === id ? b.b : b.a
    const p = pos.get(other) ?? here
    return { id: other, angle: Math.atan2(p.y - here.y, p.x - here.x) }
  })
  return slotAtom(neighbors, atom.lone, orderSum(s, id), first)
}

/** True when every atom can be reached from the first one along bonds. */
function isOnePiece(s: Structure): boolean {
  if (s.atoms.length === 0) return false
  const seen = new Set<string>([s.atoms[0]!.id])
  const stack = [s.atoms[0]!.id]
  while (stack.length) {
    const id = stack.pop()!
    for (const b of s.bonds) {
      const other = b.a === id ? b.b : b.b === id ? b.a : null
      if (other && !seen.has(other)) {
        seen.add(other)
        stack.push(other)
      }
    }
  }
  return seen.size === s.atoms.length
}

export interface LayoutOpts {
  /** Atom held by the pointer: it does not move, and it picks its seat first. */
  pinned?: string | null
  /** Half the board's width and height: atoms stay inside. */
  halfW: number
  halfH: number
}

/** Move every atom a step toward its seat. Returns the largest move made. Call once per frame. */
export function layoutStep(s: Structure, pos: Map<string, P2>, dt: number, opts: LayoutOpts): number {
  const want = new Map<string, { x: number; y: number; w: number }>()
  const pull = (id: string, x: number, y: number, w: number) => {
    const t = want.get(id) ?? { x: 0, y: 0, w: 0 }
    t.x += x * w
    t.y += y * w
    t.w += w
    want.set(id, t)
  }
  const degree = new Map(s.atoms.map((a) => [a.id, bondsOf(s, a.id).length]))
  const pinned = opts.pinned ?? undefined

  for (const atom of s.atoms) {
    const here = pos.get(atom.id)
    const deg = degree.get(atom.id) ?? 0
    if (!here || deg === 0) continue
    if (deg === 1) {
      // an outer atom only keeps its distance; the atom it is bonded to decides the direction
      const bond = bondsOf(s, atom.id)[0]!
      const otherId = bond.a === atom.id ? bond.b : bond.a
      if ((degree.get(otherId) ?? 0) >= 2) continue
      const other = pos.get(otherId)
      const otherAtom = atomById(s, otherId)
      if (!other || !otherAtom || atom.id > otherId) continue
      // while one of the two is in the student's hand, the other stays where it is, so the held
      // atom can be brought onto it for a second bond
      if (atom.id === pinned || otherId === pinned) continue
      // two atoms bonded only to each other: hold the bond length about their midpoint
      const L = bondLength(atom.el, otherAtom.el, bond.order)
      let dx = other.x - here.x
      let dy = other.y - here.y
      const d = Math.hypot(dx, dy)
      if (d < 1e-6) {
        dx = 1
        dy = 0
      } else {
        dx /= d
        dy /= d
      }
      const mx = (here.x + other.x) / 2
      const my = (here.y + other.y) / 2
      pull(atom.id, mx - (dx * L) / 2, my - (dy * L) / 2, 1)
      pull(otherId, mx + (dx * L) / 2, my + (dy * L) / 2, 1)
      continue
    }
    const slots = slotsFor(s, pos, atom.id, pinned)
    for (const seat of slots.bonds) {
      const other = atomById(s, seat.id)
      const bond = bondsOf(s, atom.id).find((b) => b.a === seat.id || b.b === seat.id)
      const there = pos.get(seat.id)
      if (!other || !bond || !there) continue
      const L = bondLength(atom.el, other.el, bond.order)
      const ux = Math.cos(seat.angle)
      const uy = Math.sin(seat.angle)
      pull(seat.id, here.x + ux * L, here.y + uy * L, 1)
      // the center is pulled back a little by outer atoms, and fully by another center. An outer atom
      // in the student's hand does not pull at all: the center must stay put to be dropped onto.
      const back = (degree.get(seat.id) ?? 0) >= 2 ? 1 : seat.id === pinned ? 0 : 0.12
      if (back > 0) pull(atom.id, there.x - ux * L, there.y - uy * L, back)
    }
  }

  let biggest = 0
  const k = 1 - Math.exp(-11 * dt)
  for (const atom of s.atoms) {
    if (atom.id === pinned) continue
    const here = pos.get(atom.id)
    const t = want.get(atom.id)
    if (!here || !t || t.w === 0) continue
    const dx = (t.x / t.w - here.x) * k
    const dy = (t.y / t.w - here.y) * k
    here.x += dx
    here.y += dy
    biggest = Math.max(biggest, Math.hypot(dx, dy))
  }

  // atoms that are not bonded to each other never overlap. The atom in the student's hand is left
  // out: it has to be able to touch another atom to bond with it.
  for (let i = 0; i < s.atoms.length; i++) {
    for (let j = i + 1; j < s.atoms.length; j++) {
      const a = s.atoms[i]!
      const b = s.atoms[j]!
      if (a.id === pinned || b.id === pinned) continue
      if (s.bonds.some((x) => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id))) continue
      const pa = pos.get(a.id)
      const pb = pos.get(b.id)
      if (!pa || !pb) continue
      const min = atomRadius(a.el) + atomRadius(b.el) + 0.42
      let dx = pb.x - pa.x
      let dy = pb.y - pa.y
      let d = Math.hypot(dx, dy)
      if (d >= min) continue
      if (d < 1e-6) {
        dx = 1
        dy = 0
        d = 1
      }
      const push = (min - d) * Math.min(1, 14 * dt)
      pa.x -= (dx / d) * push * 0.5
      pa.y -= (dy / d) * push * 0.5
      pb.x += (dx / d) * push * 0.5
      pb.y += (dy / d) * push * 0.5
      biggest = Math.max(biggest, push)
    }
  }

  // Once every atom is bonded into one molecule, the molecule drifts to the middle of the board.
  // Not while an atom is in the student's hand, and not while loose atoms are still waiting.
  if (!pinned && s.atoms.length >= 2 && isOnePiece(s)) {
    let cx = 0
    let cy = 0
    let n = 0
    for (const atom of s.atoms) {
      const here = pos.get(atom.id)
      if (!here) continue
      cx += here.x
      cy += here.y
      n++
    }
    if (n) {
      const pull = 1 - Math.exp(-2.5 * dt)
      const dx = (-cx / n) * pull
      const dy = (-cy / n) * pull
      for (const atom of s.atoms) {
        const here = pos.get(atom.id)
        if (!here) continue
        here.x += dx
        here.y += dy
      }
      biggest = Math.max(biggest, Math.hypot(dx, dy))
    }
  }

  for (const atom of s.atoms) {
    if (atom.id === pinned) continue
    const here = pos.get(atom.id)
    if (!here) continue
    const r = atomRadius(atom.el) + 0.08
    here.x = Math.max(-opts.halfW + r, Math.min(opts.halfW - r, here.x))
    here.y = Math.max(-opts.halfH + r, Math.min(opts.halfH - r, here.y))
  }
  return biggest
}
