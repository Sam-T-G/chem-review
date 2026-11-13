import { describe, expect, it } from 'vitest'
import type { El } from '../src/chem/elements'
import { assess, topologyOf, type Species } from '../src/chem/assess'
import { EMPTY, addAtom, addElectron, removeElectron, share, type Structure } from '../src/chem/structure'
import { nitrousOxide, nitrousOxideTwoDoubles } from './helpers'

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
/** Bond the first atom to each of the others, `orders[i]` times. */
function star(els: El[], orders: number[]): { s: Structure; ids: string[] } {
  const b = board(...els)
  let s = b.s
  orders.forEach((n, i) => {
    for (let k = 0; k < n; k++) s = must(share(s, b.ids[0]!, b.ids[i + 1]!))
  })
  return { s, ids: b.ids }
}
const kinds = (s: Structure, sp?: Species) => assess(s, sp).issues.map((i) => i.kind)

const CO2: Species = { center: 'C', terminals: ['O', 'O'], charge: 0 }
const CH4: Species = { center: 'C', terminals: ['H', 'H', 'H', 'H'], charge: 0 }
const CO3: Species = { center: 'C', terminals: ['O', 'O', 'O'], charge: -2 }
const BF3: Species = { center: 'B', terminals: ['F', 'F', 'F'], charge: 0 }

describe('topology', () => {
  it('names the empty board, loose atoms, a star and a chain', () => {
    expect(topologyOf(EMPTY).kind).toBe('empty')
    expect(topologyOf(board('C').s).kind).toBe('single')
    expect(topologyOf(board('C', 'O').s).kind).toBe('loose')
    const co2 = star(['C', 'O', 'O'], [1, 1])
    const t = topologyOf(co2.s)
    expect(t.kind).toBe('star')
    if (t.kind === 'star') expect(t.center).toBe(co2.ids[0])
    // O–C–O–H style chain: two atoms with two neighbors each
    const b = board('C', 'O', 'O', 'H')
    let s = must(share(b.s, b.ids[0]!, b.ids[1]!))
    s = must(share(s, b.ids[1]!, b.ids[2]!))
    s = must(share(s, b.ids[2]!, b.ids[3]!))
    expect(topologyOf(s).kind).toBe('other')
  })
  it('treats two bonded atoms as a star', () => {
    const n2 = star(['N', 'N'], [3])
    expect(topologyOf(n2.s).kind).toBe('star')
  })
})

describe('assess with a target species (guided problems)', () => {
  it('passes the finished CO2 structure', () => {
    const { s } = star(['C', 'O', 'O'], [2, 2])
    const a = assess(s, CO2)
    expect(a.issues).toEqual([])
    expect(a.complete).toBe(true)
    expect(a.electrons).toEqual({ have: 16, need: 16 })
    expect(a.atoms.map((x) => x.status)).toEqual(['full', 'full', 'full'])
    expect(a.atoms.map((x) => x.fc)).toEqual([0, 0, 0])
  })

  it('reports atoms that are not on the board yet', () => {
    const { s } = board('C', 'O')
    const a = assess(s, CO2)
    expect(a.issues[0]).toEqual({ kind: 'missing', els: ['O'] })
    expect(a.complete).toBe(false)
  })

  it('reports atoms that are not connected', () => {
    const b = board('C', 'O', 'O')
    const s = must(share(b.s, b.ids[0]!, b.ids[1]!))
    const a = assess(s, CO2)
    expect(a.issues[0]).toEqual({ kind: 'loose', ids: [b.ids[2]] })
  })

  it('reports the wrong atom in the middle', () => {
    // O in the middle: C–O–O
    const b = board('C', 'O', 'O')
    let s = must(share(b.s, b.ids[1]!, b.ids[0]!))
    s = must(share(s, b.ids[1]!, b.ids[2]!))
    expect(kinds(s, CO2)[0]).toBe('skeleton')
    const issue = assess(s, CO2).issues[0]
    if (issue?.kind === 'skeleton') expect(issue.why).toBe('wrong-center')
  })

  it('reports outer atoms bonded to each other', () => {
    const b = board('C', 'H', 'H', 'H', 'H')
    let s = b.s
    s = must(share(s, b.ids[0]!, b.ids[1]!))
    s = must(share(s, b.ids[0]!, b.ids[2]!))
    s = must(share(s, b.ids[0]!, b.ids[3]!))
    // a bonded hydrogen is full, so outer-to-outer bonds are tested with CO2
    const c = board('C', 'O', 'O')
    let t = must(share(c.s, c.ids[0]!, c.ids[1]!))
    t = must(share(t, c.ids[0]!, c.ids[2]!))
    t = must(share(t, c.ids[1]!, c.ids[2]!))
    const issue = assess(t, CO2).issues[0]
    expect(issue?.kind).toBe('skeleton')
    if (issue?.kind === 'skeleton') expect(issue.why).toBe('outer-bonded')
    // CH4 with three bonds made: the fourth hydrogen is still loose
    expect(kinds(s, CH4)[0]).toBe('loose')
  })

  it('reports atoms short of a full shell after single bonds only', () => {
    const { s, ids } = star(['C', 'O', 'O'], [1, 1])
    const a = assess(s, CO2)
    expect(a.issues[0]?.kind).toBe('short')
    if (a.issues[0]?.kind === 'short') expect(a.issues[0].ids.sort()).toEqual([...ids].sort())
    expect(a.atoms.map((x) => x.count)).toEqual([6, 7, 7])
  })

  it('reports an electron count that does not match the species', () => {
    const { s, ids } = star(['C', 'O', 'O', 'O'], [2, 1, 1])
    // neutral atoms only: 22 electrons, CO3 2- needs 24
    const a = assess(s, CO3)
    expect(a.issues[0]).toEqual({ kind: 'electrons', have: 22, need: 24 })
    let t = must(addElectron(s, ids[2]!))
    t = must(addElectron(t, ids[3]!))
    const done = assess(t, CO3)
    expect(done.issues).toEqual([])
    expect(done.atoms.map((x) => x.fc)).toEqual([0, 0, -1, -1])
    expect(done.charge).toBe(-2)
  })

  it('flags O≡C–O: full shells, but the formal charges can be smaller', () => {
    const b = board('C', 'O', 'O')
    const [c, o1, o2] = b.ids as [string, string, string]
    let s = b.s
    // the third bond takes a pair from the full oxygen; the single bond takes carbon's last pair
    for (let i = 0; i < 3; i++) s = must(share(s, c, o1))
    s = must(share(s, c, o2))
    const a = assess(s, CO2)
    expect(a.atoms.map((x) => x.count)).toEqual([8, 8, 8])
    expect(a.atoms.map((x) => x.fc)).toEqual([0, 1, -1])
    expect(a.issues.map((i) => i.kind)).toEqual(['charges'])
    expect(a.complete).toBe(false)
  })

  it('accepts boron with 6 electrons in BF3, and flags a B=F double bond', () => {
    const ok = star(['B', 'F', 'F', 'F'], [1, 1, 1])
    expect(assess(ok.s, BF3).issues).toEqual([])
    expect(assess(ok.s, BF3).atoms[0]).toMatchObject({ count: 6, target: 6, status: 'full' })
    // B=F: fluorine donates a pair
    const dbl = must(share(ok.s, ok.ids[0]!, ok.ids[1]!))
    const a = assess(dbl, BF3)
    expect(a.atoms[0]!.count).toBe(8)
    expect(a.issues.map((i) => i.kind)).toEqual(['charges'])
  })

  it('accepts either resonance form of ozone', () => {
    const O3: Species = { center: 'O', terminals: ['O', 'O'], charge: 0 }
    const b = board('O', 'O', 'O')
    const [mid, l, r] = b.ids as [string, string, string]
    let left = must(share(b.s, mid, l))
    left = must(share(left, mid, l))
    left = must(share(left, mid, r))
    expect(assess(left, O3).issues).toEqual([])
    let right = must(share(b.s, mid, r))
    right = must(share(right, mid, r))
    right = must(share(right, mid, l))
    expect(assess(right, O3).issues).toEqual([])
  })

  it('accepts the expanded shells of SF4 and XeF4', () => {
    const sf4 = star(['S', 'F', 'F', 'F', 'F'], [1, 1, 1, 1])
    const a = assess(sf4.s, { center: 'S', terminals: ['F', 'F', 'F', 'F'], charge: 0 })
    expect(a.issues).toEqual([])
    expect(a.atoms[0]).toMatchObject({ count: 10, status: 'full' })
    const xef4 = star(['Xe', 'F', 'F', 'F', 'F'], [1, 1, 1, 1])
    expect(assess(xef4.s, { center: 'Xe', terminals: ['F', 'F', 'F', 'F'], charge: 0 }).issues).toEqual([])
  })
})

describe('assess with no target (free build)', () => {
  it('reads the charge off the board', () => {
    const { s, ids } = star(['N', 'H', 'H', 'H'], [1, 1, 1])
    expect(assess(s).charge).toBe(0)
    expect(assess(s).issues).toEqual([])
    const plus = must(removeElectron(s, ids[0]!))
    expect(assess(plus).charge).toBe(1)
  })

  it('SO2: two double bonds pass; sulfur kept at 8 is sent back, because formal charge decides', () => {
    const octet = (() => {
      const b = board('S', 'O', 'O')
      const [sulfur, o1, o2] = b.ids as [string, string, string]
      let s = must(share(b.s, sulfur, o1))
      s = must(share(s, sulfur, o1))
      s = must(share(s, sulfur, o2)) // sulfur may pass 8, so this takes one electron from each
      s = must(removeElectron(s, sulfur)) // move one electron from sulfur to the single-bonded oxygen
      s = must(addElectron(s, o2))
      return s
    })()
    const a = assess(octet)
    expect(a.atoms.map((x) => x.count)).toEqual([8, 8, 8])
    expect(a.atoms.map((x) => x.fc)).toEqual([1, 0, -1])
    expect(a.issues).toEqual([{ kind: 'charges' }])
    expect(a.convention).toBe('octet')

    const expanded = star(['S', 'O', 'O'], [2, 2])
    const e = assess(expanded.s)
    expect(e.atoms[0]!.count).toBe(10)
    expect(e.atoms.map((x) => x.fc)).toEqual([0, 0, 0])
    expect(e.issues).toEqual([])
    expect(e.convention).toBe('charge')
  })

  it('the octet-first convention is one argument away: it accepts sulfur at 8 and sends the 10-electron drawing back', () => {
    const expanded = star(['S', 'O', 'O'], [2, 2])
    expect(assess(expanded.s, undefined, 'octet').issues).toEqual([{ kind: 'charges' }])
    const co2 = star(['C', 'O', 'O'], [2, 2])
    expect(assess(co2.s, undefined, 'octet').issues).toEqual([])
    expect(assess(co2.s, undefined, 'charge').issues).toEqual([])
  })

  it('reports short atoms on a half-built board', () => {
    const { s } = star(['C', 'H', 'H'], [1, 1])
    expect(kinds(s)).toEqual(['short'])
  })
})

describe('review findings: structures that must not pass', () => {
  it('does not pass a period 3 middle atom that holds an odd electron (SF3, SF5)', () => {
    for (const n of [3, 5]) {
      const b = star(['S', ...new Array<El>(n).fill('F')], new Array<number>(n).fill(1))
      const a = assess(b.s)
      expect(a.complete, `SF${n}`).toBe(false)
      expect(a.issues.map((i) => i.kind), `SF${n}`).toEqual(['unpaired'])
      expect(a.atoms[0], `SF${n}`).toMatchObject({ unpaired: true, status: 'short' })
    }
    // boron trifluoride with one extra electron on boron: 7 around boron, one of them alone
    const bf3 = star(['B', 'F', 'F', 'F'], [1, 1, 1])
    const plus = must(addElectron(bf3.s, bf3.ids[0]!))
    expect(assess(plus).complete).toBe(false)
    expect(assess(plus).issues.map((i) => i.kind)).toEqual(['unpaired'])
  })

  it('does not let a lone atom or an outer atom hold more than 8', () => {
    let { s, ids } = board('Cl')
    s = must(addElectron(s, ids[0]!)) // 8: chloride
    expect(assess(s).complete).toBe(true)
    s = must(addElectron(s, ids[0]!))
    s = must(addElectron(s, ids[0]!)) // 10 on a lone atom
    const a = assess(s)
    expect(a.atoms[0]!.status).toBe('over')
    expect(a.complete).toBe(false)
  })

  it('does not call xenon over-full while its fluorines are still being bonded', () => {
    const XeF2: Species = { center: 'Xe', terminals: ['F', 'F'], charge: 0 }
    const b = board('Xe', 'F', 'F')
    const one = must(share(b.s, b.ids[0]!, b.ids[1]!))
    const a = assess(one, XeF2)
    expect(a.atoms[0]).toMatchObject({ count: 9, status: 'short' })
    const two = must(share(one, b.ids[0]!, b.ids[2]!))
    expect(assess(two, XeF2).atoms[0]).toMatchObject({ count: 10, status: 'full' })
    expect(assess(two, XeF2).complete).toBe(true)
  })

  it('free build: flags the wrong atom in the middle when another gives smaller formal charges', () => {
    // C–O–O with oxygen in the middle, every shell full: C≡O–O has charges −1, +2, −1
    const b = board('O', 'C', 'O')
    const [mid, c, o] = b.ids as [string, string, string]
    let s = b.s
    for (let i = 0; i < 3; i++) s = must(share(s, mid, c))
    s = must(share(s, mid, o))
    const a = assess(s)
    expect(a.atoms.map((x) => x.count)).toEqual([8, 8, 8])
    expect(a.issues).toEqual([{ kind: 'middle', el: 'C' }])
    expect(a.complete).toBe(false)
  })

  it('free build: accepts N≡N–O, where nitrogen in the middle is the better choice', () => {
    // charges +1, 0, −1. Oxygen in the middle would be worse (+2 on oxygen).
    const a = assess(nitrousOxide().s)
    expect(a.atoms.map((x) => x.fc)).toEqual([1, 0, -1])
    expect(a.issues).toEqual([])
  })

  it('free build: N=N=O has full shells but is the second-best drawing (the −1 belongs on oxygen)', () => {
    const a = assess(nitrousOxideTwoDoubles().s)
    expect(a.atoms.map((x) => x.count)).toEqual([8, 8, 8])
    expect(a.atoms.map((x) => x.fc)).toEqual([1, -1, 0])
    expect(a.issues).toEqual([{ kind: 'charges' }])
  })

  it('free build: water, carbon dioxide and ammonia still pass with their usual middle atoms', () => {
    expect(assess(star(['O', 'H', 'H'], [1, 1]).s).issues).toEqual([])
    expect(assess(star(['C', 'O', 'O'], [2, 2]).s).issues).toEqual([])
    expect(assess(star(['N', 'H', 'H', 'H'], [1, 1, 1]).s).issues).toEqual([])
  })
})
