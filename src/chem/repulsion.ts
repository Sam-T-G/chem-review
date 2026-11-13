// The VSEPR picture as a small physical model: each electron group is a point on a sphere around
// the center atom, and every pair of points pushes apart. Left alone, the points settle as far
// from each other as they can get, which is the VSEPR rule itself.
//
// Lone pairs push harder than bonds, and multiple bonds a little harder than single bonds
// (OpenStax Chemistry 2e, 7.6: lone pair-lone pair > lone pair-bonding pair > bonding pair-bonding
// pair, and lone pair > triple bond > double bond > single bond). The numbers below were picked by
// a sweep so that the textbook arrangement is the lowest-energy one for every row of the shape
// table (tests/vsepr.test.ts checks this). They are not fitted to measured angles, so the app
// never prints an angle from this model.

export type V3 = [number, number, number]

export interface Dom {
  /** Unit vector from the center atom to the group. */
  dir: V3
  /** How hard a bond pushes (see WEIGHT). Not used for lone pairs. */
  w: number
  lone: boolean
  /** Held in place (being dragged). */
  pinned: boolean
}

export const WEIGHT = { single: 1, double: 1.08, triple: 1.16 } as const
/** How much harder a pair of groups pushes when lone pairs are involved (two single bonds = 1). */
export const PUSH = { loneBond: 1.4, loneLone: 2.6 } as const
/** Push between two groups falls off as 1 / distance^POWER. Steep, so the closest neighbors matter most. */
export const POWER = 4

function coef(a: Dom, b: Dom): number {
  if (a.lone && b.lone) return PUSH.loneLone
  if (a.lone) return PUSH.loneBond * b.w
  if (b.lone) return PUSH.loneBond * a.w
  return a.w * b.w
}

export function bondWeight(order: number): number {
  return order >= 3 ? WEIGHT.triple : order === 2 ? WEIGHT.double : WEIGHT.single
}

/** Bonds first (in the order given), then the lone pairs. Directions start along +x; set them before use. */
export function makeDomains(bondWeights: number[], lonePairs: number): Dom[] {
  const doms: Dom[] = bondWeights.map((w) => ({ dir: [1, 0, 0], w, lone: false, pinned: false }))
  for (let i = 0; i < lonePairs; i++) doms.push({ dir: [1, 0, 0], w: 1, lone: true, pinned: false })
  return doms
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
export function normalize(a: V3): V3 {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export function angleDeg(a: V3, b: V3): number {
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) * 180) / Math.PI
}

export function energy(doms: Dom[]): number {
  let e = 0
  for (let i = 0; i < doms.length; i++) {
    for (let j = i + 1; j < doms.length; j++) {
      const a = doms[i]!
      const b = doms[j]!
      const d = Math.max(1e-3, Math.hypot(a.dir[0] - b.dir[0], a.dir[1] - b.dir[1], a.dir[2] - b.dir[2]))
      e += coef(a, b) / d ** POWER
    }
  }
  return e
}

/** The push on each group, with the part pointing along its own direction removed (it can only slide on the sphere). */
function tangentForces(doms: Dom[]): V3[] {
  const out: V3[] = doms.map(() => [0, 0, 0])
  for (let i = 0; i < doms.length; i++) {
    for (let j = i + 1; j < doms.length; j++) {
      const a = doms[i]!
      const b = doms[j]!
      const dx = a.dir[0] - b.dir[0]
      const dy = a.dir[1] - b.dir[1]
      const dz = a.dir[2] - b.dir[2]
      const d = Math.max(1e-3, Math.hypot(dx, dy, dz))
      const f = (POWER * coef(a, b)) / d ** (POWER + 2)
      const fi = out[i]!
      const fj = out[j]!
      fi[0] += f * dx
      fi[1] += f * dy
      fi[2] += f * dz
      fj[0] -= f * dx
      fj[1] -= f * dy
      fj[2] -= f * dz
    }
  }
  for (let i = 0; i < doms.length; i++) {
    const f = out[i]!
    const d = doms[i]!.dir
    const along = dot(f, d)
    f[0] -= along * d[0]
    f[1] -= along * d[1]
    f[2] -= along * d[2]
  }
  return out
}

/** Move every group a little along its push. Returns the largest move made, in radians.
 *  `rate` scales how far a unit of push moves a group; `cap` limits any single move. */
export function relaxStep(doms: Dom[], rate: number, cap: number): number {
  const forces = tangentForces(doms)
  let biggest = 0
  for (let i = 0; i < doms.length; i++) {
    const d = doms[i]!
    if (d.pinned) continue
    const f = forces[i]!
    const mag = len(f)
    if (mag < 1e-12) continue
    const move = Math.min(cap, mag * rate)
    const k = move / mag
    d.dir = normalize([d.dir[0] + f[0] * k, d.dir[1] + f[1] * k, d.dir[2] + f[2] * k])
    if (move > biggest) biggest = move
  }
  return biggest
}

/** One animation frame of the live model. The push between far-apart groups is weak (two groups on
 *  opposite sides barely push at all), so the step is scaled by the closest spacing: every shape
 *  then settles in about the same time, a few tenths of a second. */
export function tick(doms: Dom[], dt: number): number {
  let nearest = 2
  for (let i = 0; i < doms.length; i++) {
    for (let j = i + 1; j < doms.length; j++) {
      const a = doms[i]!.dir
      const b = doms[j]!.dir
      nearest = Math.min(nearest, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
    }
  }
  const rate = Math.max(0.5, nearest) ** (POWER + 2)
  // Several small steps per frame keep the stiffest pair of groups from overshooting, which lets
  // the rate be high enough for the slowest motion (the three middle seats of a trigonal
  // bipyramid sliding around their ring) to finish in about a second.
  const steps = Math.max(1, Math.ceil(dt / 0.004))
  const h = dt / steps
  let moved = 0
  for (let i = 0; i < steps; i++) moved += relaxStep(doms, rate * h, 3.2 * h)
  return moved
}

/** Shake every free group by up to `amount` radians. Used when the model is balanced on a ridge
 *  (a flat start, or lone pairs stuck in the wrong seats). */
export function jiggle(doms: Dom[], amount: number, rand: () => number = Math.random): void {
  for (const d of doms) {
    if (d.pinned) continue
    d.dir = normalize([d.dir[0] + (rand() - 0.5) * 2 * amount, d.dir[1] + (rand() - 0.5) * 2 * amount, d.dir[2] + (rand() - 0.5) * 2 * amount])
  }
}

/** Slide downhill until nothing moves. Stops in the nearest resting arrangement, which from an
 *  unlucky start can be a higher one (for example a lone pair in an axial seat). */
export function descend(doms: Dom[]): void {
  let rate = 0.02
  for (let i = 0; i < 6000; i++) {
    const before = energy(doms)
    const saved = doms.map((d) => d.dir)
    const moved = relaxStep(doms, rate, 0.08)
    if (energy(doms) > before) {
      // overshot: go back and take smaller steps
      doms.forEach((d, k) => (d.dir = saved[k]!))
      rate *= 0.5
      if (rate < 1e-9) break
      continue
    }
    rate = Math.min(0.05, rate * 1.1)
    if (moved < 1e-9) break
  }
}

/** Run the model to rest in the textbook arrangement. Slides downhill first; if that stops
 *  somewhere else, it moves to the textbook arrangement turned to sit closest to where the groups are. */
export function settle(doms: Dom[]): void {
  descend(doms)
  if (isTextbook(doms)) return
  const near = textbookNear(doms)
  if (near) doms.forEach((d, i) => (d.dir = near[i]!))
}

function rotateAbout(v: V3, axis: V3, angle: number): V3 {
  // Rodrigues' rotation formula
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = dot(axis, v) * (1 - c)
  return [
    v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * k,
    v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * k,
    v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * k,
  ]
}
/** The rotation that carries unit vector `from` onto `to`, applied to `v`. */
function carry(v: V3, from: V3, to: V3): V3 {
  const axis: V3 = [from[1] * to[2] - from[2] * to[1], from[2] * to[0] - from[0] * to[2], from[0] * to[1] - from[1] * to[0]]
  const sin = len(axis)
  const cos = dot(from, to)
  if (sin < 1e-9) {
    if (cos > 0) return v
    // opposite: half-turn about any axis square to `from`
    const other: V3 = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const perp = normalize([from[1] * other[2] - from[2] * other[1], from[2] * other[0] - from[0] * other[2], from[0] * other[1] - from[1] * other[0]])
    return rotateAbout(v, perp, Math.PI)
  }
  return rotateAbout(v, normalize(axis), Math.atan2(sin, cos))
}

function distinctOrders(weights: number[]): number[][] {
  const out: number[][] = []
  const seen = new Set<string>()
  const idx = weights.map((_, i) => i)
  const walk = (k: number) => {
    if (k === idx.length) {
      const key = idx.map((i) => weights[i]).join(',')
      if (!seen.has(key)) {
        seen.add(key)
        out.push([...idx])
      }
      return
    }
    for (let i = k; i < idx.length; i++) {
      ;[idx[k], idx[i]] = [idx[i]!, idx[k]!]
      walk(k + 1)
      ;[idx[k], idx[i]] = [idx[i]!, idx[k]!]
    }
  }
  walk(0)
  return out
}

/** The settled textbook arrangement for these groups, turned to sit as close as it can to where
 *  the groups are now. One direction per group, in the same order. Null when the shape table has no row. */
export function textbookNear(doms: Dom[]): V3[] | null {
  const bondIdx = doms.map((d, i) => (d.lone ? -1 : i)).filter((i) => i >= 0)
  const loneIdx = doms.map((d, i) => (d.lone ? i : -1)).filter((i) => i >= 0)
  const seats = idealDirs(bondIdx.length, loneIdx.length)
  if (!seats) return null

  // 1. the resting textbook arrangement: try each distinct way to seat bonds of different weight, keep the lowest
  let rest: Dom[] | null = null
  let restEnergy = Infinity
  for (const order of distinctOrders(bondIdx.map((i) => doms[i]!.w))) {
    const trial: Dom[] = [
      ...order.map((k, seat) => ({ dir: seats[seat]!, w: doms[bondIdx[k]!]!.w, lone: false, pinned: false })),
      ...loneIdx.map((_, k) => ({ dir: seats[bondIdx.length + k]!, w: 1, lone: true, pinned: false })),
    ]
    descend(trial)
    const e = energy(trial)
    if (isTextbook(trial) && e < restEnergy - 1e-9) {
      restEnergy = e
      rest = trial
    }
  }
  if (!rest) return null

  // 2. turn it: try carrying each resting group onto each current group, with a spin about that axis,
  //    and keep the turn where like groups end up closest to the current ones
  const kindOf = (d: Dom) => (d.lone ? 'lone' : `bond${d.w}`)
  let bestCost = Infinity
  let bestDirs: V3[] | null = null
  const SPINS = 24
  for (const a of rest) {
    for (const b of doms) {
      if (kindOf(a) !== kindOf(b)) continue
      const carried = rest.map((r) => carry(r.dir, a.dir, b.dir))
      for (let sIdx = 0; sIdx < SPINS; sIdx++) {
        const turned = carried.map((v) => rotateAbout(v, b.dir, (sIdx * 2 * Math.PI) / SPINS))
        // match each current group to the closest unused resting group of the same kind
        const used = new Array<boolean>(rest.length).fill(false)
        const assigned: V3[] = new Array(doms.length)
        let cost = 0
        for (let i = 0; i < doms.length; i++) {
          let pick = -1
          let pickAngle = Infinity
          for (let j = 0; j < rest.length; j++) {
            if (used[j] || kindOf(rest[j]!) !== kindOf(doms[i]!)) continue
            const ang = angleDeg(turned[j]!, doms[i]!.dir)
            if (ang < pickAngle) {
              pickAngle = ang
              pick = j
            }
          }
          if (pick < 0) {
            cost = Infinity
            break
          }
          used[pick] = true
          assigned[i] = turned[pick]!
          cost += pickAngle * pickAngle
        }
        if (cost < bestCost) {
          bestCost = cost
          bestDirs = assigned
        }
      }
    }
  }
  return bestDirs
}

/** The textbook arrangement as unit vectors: bonded atoms first, then lone pairs.
 *  Trigonal bipyramid: lone pairs take equatorial seats. Octahedron: two lone pairs sit opposite. */
export function idealDirs(bonded: number, lonePairs: number): V3[] | null {
  const n = bonded + lonePairs
  const s = Math.sqrt(3) / 2
  let seats: V3[]
  // each list is ordered so that lone pairs can take seats from the END
  if (n === 2) seats = [[1, 0, 0], [-1, 0, 0]]
  else if (n === 3) seats = [[1, 0, 0], [-0.5, 0, s], [-0.5, 0, -s]]
  else if (n === 4) {
    const t = 1 / Math.sqrt(3)
    seats = [[t, t, t], [t, -t, -t], [-t, t, -t], [-t, -t, t]]
  } else if (n === 5) seats = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-0.5, 0, s], [-0.5, 0, -s]] // axial, axial, then equatorial
  else if (n === 6) seats = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]] // the last two are opposite
  else return null
  if (bonded < 1 || lonePairs < 0) return null
  if (n === 5 && lonePairs > 3) return null
  if (n === 6 && lonePairs > 2) return null
  return seats
}

/** Is this the arrangement the textbook gives for these groups? Angles are checked loosely,
 *  because lone pairs bend them; what must be right is which seats the lone pairs take. */
export function isTextbook(doms: Dom[]): boolean {
  const n = doms.length
  const ang = (i: number, j: number) => angleDeg(doms[i]!.dir, doms[j]!.dir)
  if (n === 1) return true
  if (n === 2) return ang(0, 1) > 175
  if (n === 3) {
    const a = [ang(0, 1), ang(0, 2), ang(1, 2)]
    return a[0]! + a[1]! + a[2]! > 357 && a.every((x) => x > 95 && x < 145)
  }
  if (n === 4) {
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (ang(i, j) < 90 || ang(i, j) > 135) return false
    return true
  }
  if (n === 5) {
    // the two axial seats are the pair closest to opposite
    let ax: [number, number] = [0, 1]
    let widest = 0
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        if (ang(i, j) > widest) {
          widest = ang(i, j)
          ax = [i, j]
        }
    if (widest < 160) return false
    const eq = [0, 1, 2, 3, 4].filter((i) => i !== ax[0] && i !== ax[1])
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) if (ang(eq[a]!, eq[b]!) < 95 || ang(eq[a]!, eq[b]!) > 145) return false
    for (const e of eq) for (const x of ax) if (ang(e, x) < 70 || ang(e, x) > 110) return false
    // every lone pair is equatorial
    return !doms[ax[0]]!.lone && !doms[ax[1]]!.lone
  }
  if (n === 6) {
    for (let i = 0; i < 6; i++) {
      let opposite = 0
      for (let j = 0; j < 6; j++) {
        if (i === j) continue
        const a = ang(i, j)
        if (a > 160) opposite++
        else if (a < 70 || a > 110) return false
      }
      if (opposite !== 1) return false
    }
    const lone = doms.map((d, i) => (d.lone ? i : -1)).filter((i) => i >= 0)
    if (lone.length === 2) return ang(lone[0]!, lone[1]!) > 160
    return lone.length <= 1
  }
  return false
}
