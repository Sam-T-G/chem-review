import { describe, expect, it } from 'vitest'
import { ELEMENTS, EL_ORDER, shellMax, shellTarget } from '../src/chem/elements'
import {
  EMPTY,
  addAtom,
  addElectron,
  bondBetween,
  electronsOnBoard,
  formalCharge,
  netCharge,
  removeAtom,
  removeElectron,
  share,
  shellCount,
  unshare,
  valenceSum,
  type Structure,
} from '../src/chem/structure'
import type { El } from '../src/chem/elements'

/** Put atoms on the board and return their ids in order. */
function board(...els: El[]): { s: Structure; ids: string[] } {
  let s = EMPTY
  const ids: string[] = []
  for (const el of els) {
    const r = addAtom(s, el)
    s = r.s
    ids.push(r.id)
  }
  return { s, ids }
}
function must(op: ReturnType<typeof share>): Structure {
  if (!op.ok) throw new Error(`refused: ${op.why}`)
  return op.s
}

describe('element data', () => {
  it('gives main-group valence counts from the group number', () => {
    const want: Record<string, number> = { H: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, As: 5, Se: 6, Br: 7, Kr: 8, I: 7, Xe: 8 }
    for (const el of EL_ORDER) expect(ELEMENTS[el].valence, el).toBe(want[el])
  })
  it('knows which shells fill at 2, 4, 6 and 8', () => {
    expect(shellTarget('H')).toBe(2)
    expect(shellTarget('Be')).toBe(4)
    expect(shellTarget('B')).toBe(6)
    expect(shellTarget('Al')).toBe(6)
    expect(shellTarget('C')).toBe(8)
    expect(shellTarget('Xe')).toBe(8)
  })
  it('caps hydrogen at 2 and period 2 at 8, and lets period 3 and below go past 8', () => {
    expect(shellMax('H')).toBe(2)
    for (const el of ['Be', 'B', 'C', 'N', 'O', 'F'] as El[]) expect(shellMax(el), el).toBe(8)
    for (const el of ['P', 'S', 'Cl', 'Xe', 'I'] as El[]) expect(shellMax(el), el).toBeGreaterThan(8)
  })
})

describe('atoms arrive with their own valence electrons', () => {
  it('adds each atom with its valence electrons unshared', () => {
    const { s, ids } = board('C', 'O', 'H')
    expect(s.atoms.map((a) => a.lone)).toEqual([4, 6, 1])
    expect(electronsOnBoard(s)).toBe(11)
    expect(valenceSum(s)).toBe(11)
    expect(netCharge(s)).toBe(0)
    expect(shellCount(s, ids[0]!)).toBe(4)
    expect(formalCharge(s, ids[1]!)).toBe(0)
  })
})

describe('share: one more bond between two atoms', () => {
  it('takes one electron from each atom and keeps the total', () => {
    const { s, ids } = board('C', 'H')
    const s2 = must(share(s, ids[0]!, ids[1]!))
    expect(bondBetween(s2, ids[0]!, ids[1]!)?.order).toBe(1)
    expect(s2.atoms.map((a) => a.lone)).toEqual([3, 0])
    expect(electronsOnBoard(s2)).toBe(5)
    expect(shellCount(s2, ids[0]!)).toBe(5)
    expect(shellCount(s2, ids[1]!)).toBe(2)
  })

  it('builds CO2 as two double bonds with every formal charge 0', () => {
    const { s, ids } = board('C', 'O', 'O')
    const [c, o1, o2] = ids as [string, string, string]
    let t = must(share(s, c, o1))
    t = must(share(t, c, o2))
    t = must(share(t, c, o1))
    t = must(share(t, c, o2))
    expect(bondBetween(t, c, o1)?.order).toBe(2)
    expect(bondBetween(t, c, o2)?.order).toBe(2)
    expect(t.atoms.map((a) => a.lone)).toEqual([0, 4, 4])
    expect([c, o1, o2].map((id) => shellCount(t, id))).toEqual([8, 8, 8])
    expect([c, o1, o2].map((id) => formalCharge(t, id))).toEqual([0, 0, 0])
    expect(electronsOnBoard(t)).toBe(16)
  })

  it('refuses a second bond to hydrogen: its shell holds 2', () => {
    const { s, ids } = board('O', 'H')
    const t = must(share(s, ids[0]!, ids[1]!))
    const again = share(t, ids[0]!, ids[1]!)
    expect(again.ok).toBe(false)
    if (!again.ok) {
      expect(again.why).toBe('shell-full')
      expect(again.atomId).toBe(ids[1])
    }
  })

  it('refuses a fourth hydrogen on neutral nitrogen: 9 electrons do not fit', () => {
    const { s, ids } = board('N', 'H', 'H', 'H', 'H')
    const [n, ...hs] = ids as [string, string, string, string, string]
    let t = s
    for (const h of hs.slice(0, 3)) t = must(share(t, n, h))
    const fourth = share(t, n, hs[3]!)
    expect(fourth.ok).toBe(false)
    if (!fourth.ok) expect(fourth.why).toBe('shell-full')
  })

  it('makes NH4+ once one electron is removed, with +1 on nitrogen', () => {
    const { s, ids } = board('N', 'H', 'H', 'H', 'H')
    const [n, ...hs] = ids as [string, string, string, string, string]
    let t = must(removeElectron(s, hs[3]!)) // a bare proton
    for (const h of hs.slice(0, 3)) t = must(share(t, n, h))
    t = must(share(t, n, hs[3]!)) // both electrons come from nitrogen's lone pair
    expect(t.atoms[0]!.lone).toBe(0)
    expect(shellCount(t, n)).toBe(8)
    expect(formalCharge(t, n)).toBe(1)
    expect(hs.map((h) => formalCharge(t, h))).toEqual([0, 0, 0, 0])
    expect(netCharge(t)).toBe(1)
    expect(electronsOnBoard(t)).toBe(8)
  })

  it('gives ozone its O=O–O form: the full middle oxygen donates a pair', () => {
    const { s, ids } = board('O', 'O', 'O')
    const [mid, left, right] = ids as [string, string, string]
    let t = must(share(s, mid, left))
    t = must(share(t, mid, left)) // double bond: middle oxygen now has 8
    expect(shellCount(t, mid)).toBe(8)
    t = must(share(t, mid, right)) // one each would make 9, so the pair comes from the middle
    expect(bondBetween(t, mid, right)?.order).toBe(1)
    expect([mid, left, right].map((id) => shellCount(t, id))).toEqual([8, 8, 8])
    expect([mid, left, right].map((id) => formalCharge(t, id))).toEqual([1, 0, -1])
    expect(electronsOnBoard(t)).toBe(18)
    expect(netCharge(t)).toBe(0)
  })

  it('stops at a triple bond', () => {
    const { s, ids } = board('N', 'N')
    let t = s
    for (let i = 0; i < 3; i++) t = must(share(t, ids[0]!, ids[1]!))
    expect(bondBetween(t, ids[0]!, ids[1]!)?.order).toBe(3)
    expect(t.atoms.map((a) => a.lone)).toEqual([2, 2])
    const fourth = share(t, ids[0]!, ids[1]!)
    expect(fourth.ok).toBe(false)
    if (!fourth.ok) expect(fourth.why).toBe('max-order')
  })

  it('refuses when neither atom has an electron to give', () => {
    const { s, ids } = board('H', 'H', 'H')
    const t = must(share(s, ids[0]!, ids[1]!))
    const r = share(must(removeElectron(t, ids[2]!)), ids[0]!, ids[2]!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.why).toBe('no-electrons')
  })

  it('refuses to bond an atom to itself', () => {
    const { s, ids } = board('C')
    const r = share(s, ids[0]!, ids[0]!)
    expect(r.ok).toBe(false)
  })

  it('lets sulfur go past 8 for SF6', () => {
    const { s, ids } = board('S', 'F', 'F', 'F', 'F', 'F', 'F')
    const [sulfur, ...fs] = ids as [string, ...string[]]
    let t = s
    for (const f of fs) t = must(share(t, sulfur, f))
    expect(shellCount(t, sulfur)).toBe(12)
    expect(t.atoms[0]!.lone).toBe(0)
    expect(fs.map((f) => shellCount(t, f))).toEqual([8, 8, 8, 8, 8, 8])
    expect(electronsOnBoard(t)).toBe(48)
  })
})

describe('unshare, electrons and removing atoms', () => {
  it('unshare hands one electron back to each atom', () => {
    const { s, ids } = board('C', 'O')
    let t = must(share(s, ids[0]!, ids[1]!))
    t = must(share(t, ids[0]!, ids[1]!))
    const bond = bondBetween(t, ids[0]!, ids[1]!)!
    const u = unshare(t, bond.id)
    expect(bondBetween(u, ids[0]!, ids[1]!)?.order).toBe(1)
    expect(u.atoms.map((a) => a.lone)).toEqual([3, 5])
    const u2 = unshare(u, bond.id)
    expect(bondBetween(u2, ids[0]!, ids[1]!)).toBeUndefined()
    expect(u2.atoms.map((a) => a.lone)).toEqual([4, 6])
  })

  it('adding an electron makes the board 1−, removing one makes it 1+', () => {
    const { s, ids } = board('O')
    const plus = must(addElectron(s, ids[0]!))
    expect(netCharge(plus)).toBe(-1)
    expect(formalCharge(plus, ids[0]!)).toBe(-1)
    const minus = must(removeElectron(s, ids[0]!))
    expect(netCharge(minus)).toBe(1)
  })

  it('refuses a ninth electron on oxygen and a removal from a bare proton', () => {
    const { s, ids } = board('O', 'H')
    let t = must(addElectron(s, ids[0]!))
    t = must(addElectron(t, ids[0]!))
    expect(addElectron(t, ids[0]!).ok).toBe(false)
    const bare = must(removeElectron(s, ids[1]!))
    expect(removeElectron(bare, ids[1]!).ok).toBe(false)
  })

  it('removing an atom breaks its bonds and returns the partner electrons', () => {
    const { s, ids } = board('C', 'O', 'O')
    const [c, o1, o2] = ids as [string, string, string]
    let t = must(share(s, c, o1))
    t = must(share(t, c, o1))
    t = must(share(t, c, o2))
    const r = removeAtom(t, o1)
    expect(r.atoms.map((a) => a.el)).toEqual(['C', 'O'])
    expect(r.bonds).toHaveLength(1)
    expect(r.atoms[0]!.lone).toBe(3) // carbon got its two electrons back from the double bond
    expect(netCharge(r)).toBe(0)
  })

  it('never mutates the structure it was given', () => {
    const { s, ids } = board('C', 'H')
    const before = JSON.stringify(s)
    share(s, ids[0]!, ids[1]!)
    addElectron(s, ids[0]!)
    removeAtom(s, ids[1]!)
    expect(JSON.stringify(s)).toBe(before)
  })
})
