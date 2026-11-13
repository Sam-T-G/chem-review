import { describe, expect, it } from 'vitest'
import type { El } from '../src/chem/elements'
import { EMPTY, addAtom, share, type Structure } from '../src/chem/structure'
import { centerDomains, classify, shapeOf } from '../src/chem/vsepr'
import { angleDeg, descend, energy, idealDirs, isTextbook, makeDomains, settle, textbookNear, tick, WEIGHT, type Dom } from '../src/chem/repulsion'

/** OpenStax Chemistry 2e, Figures 7.16 and 7.19. */
const TABLE: [number, number, string, string][] = [
  // bonded atoms, lone pairs, electron-group geometry, shape
  [2, 0, 'linear', 'linear'],
  [3, 0, 'trigonal planar', 'trigonal planar'],
  [2, 1, 'trigonal planar', 'bent'],
  [4, 0, 'tetrahedral', 'tetrahedral'],
  [3, 1, 'tetrahedral', 'trigonal pyramidal'],
  [2, 2, 'tetrahedral', 'bent'],
  [5, 0, 'trigonal bipyramidal', 'trigonal bipyramidal'],
  [4, 1, 'trigonal bipyramidal', 'seesaw'],
  [3, 2, 'trigonal bipyramidal', 'T-shaped'],
  [2, 3, 'trigonal bipyramidal', 'linear'],
  [6, 0, 'octahedral', 'octahedral'],
  [5, 1, 'octahedral', 'square pyramidal'],
  [4, 2, 'octahedral', 'square planar'],
]

describe('classify: groups around the center to a shape name', () => {
  for (const [x, e, geometry, shape] of TABLE) {
    it(`${x} atoms + ${e} lone pairs is ${shape}`, () => {
      const info = classify(x, e)
      expect(info).not.toBeNull()
      expect(info!.groups).toBe(x + e)
      expect(info!.geometry).toBe(geometry)
      expect(info!.shape).toBe(shape)
    })
  }
  it('gives the ideal angles of the five geometries', () => {
    expect(classify(2, 0)!.angle).toBe('180°')
    expect(classify(3, 0)!.angle).toBe('120°')
    expect(classify(4, 0)!.angle).toBe('109.5°')
    expect(classify(5, 0)!.angle).toBe('90° and 120°')
    expect(classify(6, 0)!.angle).toBe('90°')
  })
  it('marks angles squeezed by lone pairs as less than the ideal', () => {
    expect(classify(3, 1)!.angle).toBe('less than 109.5°')
    expect(classify(2, 2)!.angle).toBe('less than 109.5°')
    expect(classify(2, 1)!.angle).toBe('less than 120°')
    // lone pairs opposite each other leave the angles alone
    expect(classify(4, 2)!.angle).toBe('90°')
    expect(classify(2, 3)!.angle).toBe('180°')
  })
  it('has no entry for more than six groups or fewer than two', () => {
    expect(classify(7, 0)).toBeNull()
    expect(classify(1, 0)).toBeNull()
  })
})

function star(els: El[], orders: number[]): { s: Structure; ids: string[] } {
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
      if (!op.ok) throw new Error(op.why)
      s = op.s
    }
  })
  return { s, ids }
}

describe('reading the groups off a structure', () => {
  it('counts a double bond as one group (CO2: 2 groups, linear)', () => {
    const { s, ids } = star(['C', 'O', 'O'], [2, 2])
    const d = centerDomains(s, ids[0]!)
    expect(d.bonds.map((b) => b.order)).toEqual([2, 2])
    expect(d.lonePairs).toBe(0)
    expect(shapeOf(s)?.shape).toBe('linear')
  })
  it('counts lone pairs on the center (NH3: 3 + 1, H2O: 2 + 2)', () => {
    const nh3 = star(['N', 'H', 'H', 'H'], [1, 1, 1])
    expect(centerDomains(nh3.s, nh3.ids[0]!).lonePairs).toBe(1)
    expect(shapeOf(nh3.s)?.shape).toBe('trigonal pyramidal')
    const h2o = star(['O', 'H', 'H'], [1, 1])
    expect(centerDomains(h2o.s, h2o.ids[0]!).lonePairs).toBe(2)
    expect(shapeOf(h2o.s)?.shape).toBe('bent')
  })
  it('reads the expanded shells: SF4 seesaw, ClF3 T-shaped, XeF2 linear, XeF4 square planar', () => {
    expect(shapeOf(star(['S', 'F', 'F', 'F', 'F'], [1, 1, 1, 1]).s)?.shape).toBe('seesaw')
    expect(shapeOf(star(['Cl', 'F', 'F', 'F'], [1, 1, 1]).s)?.shape).toBe('T-shaped')
    expect(shapeOf(star(['Xe', 'F', 'F'], [1, 1]).s)?.shape).toBe('linear')
    expect(shapeOf(star(['Xe', 'F', 'F', 'F', 'F'], [1, 1, 1, 1]).s)?.shape).toBe('square planar')
  })
  it('calls any two-atom molecule linear', () => {
    const n2 = star(['N', 'N'], [3])
    const info = shapeOf(n2.s)
    expect(info?.shape).toBe('linear')
    expect(info?.diatomic).toBe(true)
  })
  it('has no shape for a chain with two centers', () => {
    let { s, ids } = star(['C', 'O', 'O'], [1, 1])
    const h = addAtom(s, 'H')
    const op = share(h.s, ids[1]!, h.id)
    if (!op.ok) throw new Error(op.why)
    s = op.s
    expect(shapeOf(s)).toBeNull()
  })
})

/** Deterministic pseudo-random numbers so the test starts are the same every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function randomStart(x: number, e: number, rand: () => number): Dom[] {
  const doms = makeDomains(
    Array.from({ length: x }, () => WEIGHT.single),
    e,
  )
  for (const d of doms) {
    // uniform on the sphere
    const z = 2 * rand() - 1
    const phi = 2 * Math.PI * rand()
    const r = Math.sqrt(1 - z * z)
    d.dir = [r * Math.cos(phi), r * Math.sin(phi), z]
  }
  return doms
}

describe('repulsion: groups pushed apart on a sphere settle into the textbook arrangement', () => {
  for (const [x, e, , shape] of TABLE) {
    it(`${x} atoms + ${e} lone pairs settles as ${shape} from 40 random starts`, () => {
      const rand = rng(1000 + x * 10 + e)
      for (let trial = 0; trial < 40; trial++) {
        const doms = randomStart(x, e, rand)
        settle(doms)
        expect(isTextbook(doms), `trial ${trial}`).toBe(true)
      }
    })
  }

  for (const [x, e, , shape] of TABLE) {
    it(`${shape} (${x} + ${e}) is the lowest-energy arrangement the model can find`, () => {
      const ideal = makeDomains(
        Array.from({ length: x }, () => WEIGHT.single),
        e,
      )
      idealDirs(x, e)!.forEach((dir, i) => (ideal[i]!.dir = dir))
      descend(ideal)
      expect(isTextbook(ideal)).toBe(true)
      const floor = energy(ideal)
      const rand = rng(500 + x * 10 + e)
      for (let trial = 0; trial < 40; trial++) {
        const doms = randomStart(x, e, rand)
        descend(doms) // wherever plain downhill sliding lands, it must not beat the textbook arrangement
        expect(energy(doms), `trial ${trial}`).toBeGreaterThan(floor - 1e-6)
      }
    })
  }

  it('reaches the exact ideal angles when every group is a single bond', () => {
    const rand = rng(7)
    const tetra = randomStart(4, 0, rand)
    settle(tetra)
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(angleDeg(tetra[i]!.dir, tetra[j]!.dir)).toBeCloseTo(109.47, 1)
    const tri = randomStart(3, 0, rand)
    settle(tri)
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(angleDeg(tri[i]!.dir, tri[j]!.dir)).toBeCloseTo(120, 1)
    const two = randomStart(2, 0, rand)
    settle(two)
    expect(angleDeg(two[0]!.dir, two[1]!.dir)).toBeCloseTo(180, 1)
    const octa = randomStart(6, 0, rand)
    settle(octa)
    const angles = []
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) angles.push(Math.round(angleDeg(octa[i]!.dir, octa[j]!.dir)))
    expect(angles.filter((a) => a === 90)).toHaveLength(12)
    expect(angles.filter((a) => a === 180)).toHaveLength(3)
  })

  it('squeezes the H–N–H and H–O–H angles below 109.5°, water more than ammonia', () => {
    const rand = rng(11)
    const nh3 = randomStart(3, 1, rand)
    settle(nh3)
    const bondsN = nh3.filter((d) => !d.lone)
    const hnh = angleDeg(bondsN[0]!.dir, bondsN[1]!.dir)
    const h2o = randomStart(2, 2, rand)
    settle(h2o)
    const bondsO = h2o.filter((d) => !d.lone)
    const hoh = angleDeg(bondsO[0]!.dir, bondsO[1]!.dir)
    expect(hnh).toBeLessThan(109.4)
    expect(hoh).toBeLessThan(hnh)
    expect(hoh).toBeGreaterThan(95)
  })

  it('starts flat and still finds the tetrahedron once nudged out of the plane', () => {
    const doms = makeDomains([1, 1, 1, 1], 0)
    doms.forEach((d, i) => {
      const a = (i * Math.PI) / 2
      d.dir = [Math.cos(a), 0.01 * (i % 2 === 0 ? 1 : -1), Math.sin(a)]
    })
    settle(doms)
    expect(angleDeg(doms[0]!.dir, doms[1]!.dir)).toBeCloseTo(109.47, 1)
  })

  it('textbookNear keeps a settled arrangement where it is, and moves a wrong one the short way', () => {
    // settled SF4-like model: asking for the nearest textbook arrangement should barely move it
    const rand = rng(31)
    const good = randomStart(4, 1, rand)
    settle(good)
    const near = textbookNear(good)!
    good.forEach((d, i) => expect(angleDeg(d.dir, near[i]!)).toBeLessThan(1))

    // lone pair forced into an axial seat: the fix moves it to an equatorial seat
    const wrong = makeDomains([1, 1, 1, 1], 1)
    const s = Math.sqrt(3) / 2
    const seats: [number, number, number][] = [[0, -1, 0], [1, 0, 0], [-0.5, 0, s], [-0.5, 0, -s], [0, 1, 0]]
    seats.forEach((dir, i) => (wrong[i]!.dir = dir))
    expect(isTextbook(wrong)).toBe(false)
    const fixed = textbookNear(wrong)!
    fixed.forEach((dir, i) => (wrong[i]!.dir = dir))
    expect(isTextbook(wrong)).toBe(true)
  })

  it('seats a double bond in the equatorial position of a trigonal bipyramid', () => {
    // one double bond + four single bonds, like SOF4 (OpenStax 7.6: multiple bonds take more room than single bonds)
    const doms = makeDomains([WEIGHT.double, 1, 1, 1, 1], 0)
    const rand = rng(5)
    for (const d of doms) {
      const z = 2 * rand() - 1
      const phi = 2 * Math.PI * rand()
      const r = Math.sqrt(1 - z * z)
      d.dir = [r * Math.cos(phi), r * Math.sin(phi), z]
    }
    const near = textbookNear(doms)!
    near.forEach((dir, i) => (doms[i]!.dir = dir))
    // the double bond (index 0) has no partner straight across from it
    const across = doms.slice(1).filter((d) => angleDeg(d.dir, doms[0]!.dir) > 160)
    expect(across).toHaveLength(0)
  })

  it('the live model settles within 2 seconds of animation frames, for every shape', () => {
    for (const [x, e] of TABLE) {
      const doms = makeDomains(
        Array.from({ length: x }, () => 1),
        e,
      )
      idealDirs(x, e)!.forEach((dir, i) => (doms[i]!.dir = dir))
      descend(doms)
      const rest = doms.map((d) => d.dir)
      // knock one bonded atom 25° off its seat, as a drag would, then run 120 frames at 60 per second
      const a = doms[0]!.dir
      const b = doms[doms.length - 1]!.dir
      const mix = 0.45
      const len = Math.hypot(a[0] + mix * b[0], a[1] + mix * b[1] + 0.2, a[2] + mix * b[2])
      doms[0]!.dir = [(a[0] + mix * b[0]) / len, (a[1] + mix * b[1] + 0.2) / len, (a[2] + mix * b[2]) / len]
      let moved = 1
      for (let f = 0; f < 120; f++) moved = tick(doms, 1 / 60)
      // under 1 degree per second: at rest to the eye
      expect(moved * 60, `${x}+${e} still moving`).toBeLessThan(0.0175)
      // and at a slow 20 frames per second it is just as stable
      for (let f = 0; f < 10; f++) moved = tick(doms, 1 / 20)
      expect(moved * 20, `${x}+${e} unstable at 20 fps`).toBeLessThan(0.0175)
      // it never blows up: every direction stays a unit vector
      for (const d of doms) expect(Math.hypot(...d.dir)).toBeCloseTo(1, 6)
      void rest
    }
  })

  it('ideal directions exist for every table row and are already textbook', () => {
    for (const [x, e] of TABLE) {
      const dirs = idealDirs(x, e)
      expect(dirs, `${x}+${e}`).not.toBeNull()
      const doms = makeDomains(
        Array.from({ length: x }, () => 1),
        e,
      )
      // ideal lists bonds first, then lone pairs, the same order makeDomains uses
      dirs!.forEach((dir, i) => (doms[i]!.dir = dir))
      expect(isTextbook(doms), `${x}+${e}`).toBe(true)
    }
  })
})
