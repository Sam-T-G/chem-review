import { describe, expect, it } from 'vitest'
import type { El } from '../src/chem/elements'
import { bondLength, layoutStep, loneGroups, slotAtom, slotsFor, type P2 } from '../src/chem/layout2d'
import { EMPTY, addAtom, share, type Structure } from '../src/chem/structure'

const deg = (rad: number) => ((((rad * 180) / Math.PI) % 360) + 360) % 360

describe('loneGroups: how unshared electrons are drawn', () => {
  it('draws free atoms the way Lewis symbols are printed', () => {
    expect(loneGroups(1, 0)).toEqual({ pairs: 0, singles: 1 }) // H
    expect(loneGroups(4, 0)).toEqual({ pairs: 0, singles: 4 }) // C: four single dots
    expect(loneGroups(5, 0)).toEqual({ pairs: 1, singles: 3 }) // N
    expect(loneGroups(6, 0)).toEqual({ pairs: 2, singles: 2 }) // O
    expect(loneGroups(7, 0)).toEqual({ pairs: 3, singles: 1 }) // F
    expect(loneGroups(8, 0)).toEqual({ pairs: 4, singles: 0 }) // Xe
  })
  it('pairs up what is left as bonds use the seats', () => {
    expect(loneGroups(4, 2)).toEqual({ pairs: 2, singles: 0 }) // O in water, or O of a C=O
    expect(loneGroups(2, 3)).toEqual({ pairs: 1, singles: 0 }) // N in ammonia, N of a C≡N
    expect(loneGroups(5, 1)).toEqual({ pairs: 2, singles: 1 }) // O with one bond so far
    expect(loneGroups(3, 1)).toEqual({ pairs: 0, singles: 3 }) // C with one bond so far
    expect(loneGroups(6, 1)).toEqual({ pairs: 3, singles: 0 }) // F in a bond
    expect(loneGroups(4, 4)).toEqual({ pairs: 2, singles: 0 }) // Xe in XeF4
    expect(loneGroups(0, 4)).toEqual({ pairs: 0, singles: 0 })
  })
})

describe('slotAtom: seats around one atom', () => {
  it('puts a free oxygen’s dots on top, right, bottom, left: pairs first', () => {
    const s = slotAtom([], 6, 0)
    expect(s.groups.map((g) => [Math.round(deg(g.angle)), g.count])).toEqual([[90, 2], [0, 2], [270, 1], [180, 1]])
  })
  it('spreads three lone pairs 90° apart around a bonded fluorine', () => {
    const s = slotAtom([{ id: 'c', angle: Math.PI }], 6, 1)
    expect(s.bonds).toEqual([{ id: 'c', angle: Math.PI }])
    expect(s.groups.map((g) => Math.round(deg(g.angle))).sort((a, b) => a - b)).toEqual([0, 90, 270])
    expect(s.groups.every((g) => g.count === 2)).toBe(true)
  })
  it('gives the oxygen of a double bond two lone pairs 120° from the bond', () => {
    const s = slotAtom([{ id: 'c', angle: 0 }], 4, 2)
    expect(s.groups.map((g) => Math.round(deg(g.angle)))).toEqual([120, 240])
  })
  it('gives carbon in CO2 two seats straight across from each other', () => {
    const s = slotAtom(
      [
        { id: 'o1', angle: 0.3 },
        { id: 'o2', angle: 2 },
      ],
      0,
      4,
    )
    expect(Math.round(deg(s.bonds[1]!.angle - s.bonds[0]!.angle))).toBe(180)
    expect(s.groups).toEqual([])
  })
  it('seats each neighbor at the free seat nearest to where it is', () => {
    // nitrogen in ammonia: 3 bonds + 1 lone pair = 4 seats 90° apart
    const s = slotAtom(
      [
        { id: 'h1', angle: 0 },
        { id: 'h2', angle: (100 * Math.PI) / 180 },
        { id: 'h3', angle: (250 * Math.PI) / 180 },
      ],
      2,
      3,
    )
    expect(s.bonds.map((b) => Math.round(deg(b.angle)))).toEqual([0, 90, 270])
    expect(s.groups.map((g) => [Math.round(deg(g.angle)), g.count])).toEqual([[180, 2]])
  })
  it('lets the dragged neighbor pick its seat first', () => {
    const nbs = [
      { id: 'a', angle: 0 },
      { id: 'b', angle: (80 * Math.PI) / 180 },
      { id: 'c', angle: (95 * Math.PI) / 180 },
    ]
    const plain = slotAtom(nbs.map((n) => ({ ...n })), 2, 3)
    expect(Math.round(deg(plain.bonds.find((x) => x.id === 'b')!.angle))).toBe(90)
    const dragged = slotAtom(nbs.map((n) => ({ ...n })), 2, 3, 'c')
    expect(Math.round(deg(dragged.bonds.find((x) => x.id === 'c')!.angle))).toBe(90)
  })
})

function build(els: El[], orders: number[], at: [number, number][]): { s: Structure; ids: string[]; pos: Map<string, P2> } {
  let s = EMPTY
  const ids: string[] = []
  const pos = new Map<string, P2>()
  els.forEach((el, i) => {
    const r = addAtom(s, el)
    s = r.s
    ids.push(r.id)
    pos.set(r.id, { x: at[i]![0], y: at[i]![1] })
  })
  orders.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      const op = share(s, ids[0]!, ids[i + 1]!)
      if (!op.ok) throw new Error(op.why)
      s = op.s
    }
  })
  return { s, ids, pos }
}
function run(s: Structure, pos: Map<string, P2>, frames = 600) {
  for (let i = 0; i < frames; i++) layoutStep(s, pos, 1 / 60, { halfW: 5.5, halfH: 3.6 })
}
const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y)
const angleAt = (c: P2, a: P2, b: P2) => deg(Math.atan2(b.y - c.y, b.x - c.x) - Math.atan2(a.y - c.y, a.x - c.x))

describe('layoutStep: the flat drawing arranges itself', () => {
  it('draws methane as a cross: four hydrogens 90° apart at one bond length', () => {
    const { s, ids, pos } = build(['C', 'H', 'H', 'H', 'H'], [1, 1, 1, 1], [[0, 0], [2.5, 0.4], [-1, 2.2], [-2.4, -0.6], [0.5, -2.8]])
    run(s, pos)
    const c = pos.get(ids[0]!)!
    const L = bondLength('C', 'H', 1)
    const angles = ids.slice(1).map((id) => deg(Math.atan2(pos.get(id)!.y - c.y, pos.get(id)!.x - c.x)))
    for (const id of ids.slice(1)) expect(dist(c, pos.get(id)!)).toBeCloseTo(L, 2)
    const sorted = [...angles].sort((a, b) => a - b)
    for (let i = 1; i < 4; i++) expect(sorted[i]! - sorted[i - 1]!).toBeCloseTo(90, 0)
  })
  it('draws carbon dioxide in a straight line', () => {
    const { s, ids, pos } = build(['C', 'O', 'O'], [2, 2], [[0, 0], [1.5, 1], [0.5, 1.8]])
    run(s, pos)
    expect(angleAt(pos.get(ids[0]!)!, pos.get(ids[1]!)!, pos.get(ids[2]!)!)).toBeCloseTo(180, 0)
  })
  it('leaves a seat for the lone pair of ammonia', () => {
    const { s, ids, pos } = build(['N', 'H', 'H', 'H'], [1, 1, 1], [[0, 0], [1.6, 0.1], [0.1, 1.7], [-0.2, -1.5]])
    run(s, pos)
    const slots = slotsFor(s, pos, ids[0]!)
    expect(slots.groups).toHaveLength(1)
    expect(slots.groups[0]!.count).toBe(2)
    const taken = slots.bonds.map((b) => Math.round(deg(b.angle - slots.bonds[0]!.angle)))
    expect(taken.sort((a, b) => a - b)).toEqual([0, 90, 270])
    expect(Math.round(deg(slots.groups[0]!.angle - slots.bonds[0]!.angle))).toBe(180)
  })
  it('pulls two bonded atoms to one bond length and keeps unbonded atoms apart', () => {
    const { s, ids, pos } = build(['N', 'N', 'O'], [3], [[-3, 0], [3, 0], [0, 0.05]])
    run(s, pos)
    expect(dist(pos.get(ids[0]!)!, pos.get(ids[1]!)!)).toBeCloseTo(bondLength('N', 'N', 3), 2)
    expect(dist(pos.get(ids[2]!)!, pos.get(ids[0]!)!)).toBeGreaterThan(1.3)
    expect(dist(pos.get(ids[2]!)!, pos.get(ids[1]!)!)).toBeGreaterThan(1.3)
  })
  it('keeps every atom on the board', () => {
    const { s, ids, pos } = build(['S', 'F', 'F', 'F', 'F', 'F', 'F'], [1, 1, 1, 1, 1, 1], [[5.2, 3.4], [5, 3], [5, 2], [4, 3], [4.5, 2.5], [5.3, 2.8], [4.2, 3.5]])
    run(s, pos, 900)
    for (const id of ids) {
      const p = pos.get(id)!
      expect(Math.abs(p.x)).toBeLessThanOrEqual(5.5)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(3.6)
    }
    // and the six fluorines still sit 60° apart around sulfur
    const c = pos.get(ids[0]!)!
    const angles = ids.slice(1).map((id) => deg(Math.atan2(pos.get(id)!.y - c.y, pos.get(id)!.x - c.x))).sort((a, b) => a - b)
    for (let i = 1; i < 6; i++) expect(angles[i]! - angles[i - 1]!).toBeCloseTo(60, 0)
  })
  it('lets the atom being dragged touch another atom without pushing it away', () => {
    const { s, ids, pos } = build(['C', 'H'], [], [[0, 0], [0.1, 0.05]])
    for (let i = 0; i < 120; i++) layoutStep(s, pos, 1 / 60, { halfW: 5.5, halfH: 3.6, pinned: ids[1]! })
    expect(pos.get(ids[0]!)).toEqual({ x: 0, y: 0 })
    expect(pos.get(ids[1]!)).toEqual({ x: 0.1, y: 0.05 })
    // once it is let go, the two atoms move apart
    run(s, pos, 240)
    expect(dist(pos.get(ids[0]!)!, pos.get(ids[1]!)!)).toBeGreaterThan(1.2)
  })

  it('keeps the center still while a bonded outer atom is dragged onto it', () => {
    const { s, ids, pos } = build(['C', 'H', 'H', 'O'], [1, 1, 1], [[0, 0], [1.4, 0], [-1.4, 0], [0, 1.6]])
    run(s, pos)
    const c0 = { ...pos.get(ids[0]!)! }
    // drag the oxygen from its seat to the middle of the carbon
    for (let i = 0; i <= 30; i++) {
      const from = pos.get(ids[3]!)!
      pos.set(ids[3]!, { x: from.x + (c0.x - from.x) * 0.2, y: from.y + (c0.y - from.y) * 0.2 })
      layoutStep(s, pos, 1 / 60, { halfW: 5.5, halfH: 3.6, pinned: ids[3]! })
    }
    expect(dist(pos.get(ids[0]!)!, c0)).toBeLessThan(0.02)
    expect(dist(pos.get(ids[3]!)!, pos.get(ids[0]!)!)).toBeLessThan(0.05)
  })

  it('keeps one atom of a two-atom molecule still while the other is dragged onto it', () => {
    const { s, ids, pos } = build(['N', 'N'], [1], [[-0.9, 0], [0.9, 0]])
    run(s, pos)
    const a0 = { ...pos.get(ids[0]!)! }
    for (let i = 0; i <= 30; i++) {
      const from = pos.get(ids[1]!)!
      pos.set(ids[1]!, { x: from.x + (a0.x - from.x) * 0.2, y: from.y + (a0.y - from.y) * 0.2 })
      layoutStep(s, pos, 1 / 60, { halfW: 5.5, halfH: 3.6, pinned: ids[1]! })
    }
    expect(dist(pos.get(ids[0]!)!, a0)).toBeLessThan(1e-9)
  })

  it('moves a finished molecule to the middle of the board, and leaves loose atoms where they are', () => {
    const whole = build(['C', 'O', 'O'], [2, 2], [[3, 2], [4, 2.5], [2.5, 1]])
    run(whole.s, whole.pos, 900)
    const c = whole.pos.get(whole.ids[0]!)!
    expect(Math.hypot(c.x, c.y)).toBeLessThan(0.02) // carbon is the middle of O=C=O
    const parts = build(['C', 'O', 'O'], [2], [[3, 2], [4, 2.5], [-3, -2]])
    run(parts.s, parts.pos, 900)
    expect(parts.pos.get(parts.ids[2]!)).toEqual({ x: -3, y: -2 })
    expect(parts.pos.get(parts.ids[0]!)!.x).toBeGreaterThan(2)
  })

  it('holds a pinned atom still', () => {
    const { s, ids, pos } = build(['C', 'H', 'H'], [1, 1], [[0, 0], [1.5, 0], [0, 1.5]])
    pos.set(ids[1]!, { x: 3, y: 2 })
    for (let i = 0; i < 120; i++) layoutStep(s, pos, 1 / 60, { halfW: 5.5, halfH: 3.6, pinned: ids[1]! })
    expect(pos.get(ids[1]!)).toEqual({ x: 3, y: 2 })
  })
})
