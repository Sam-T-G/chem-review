// Sigma and pi bonds, and hybridization, the way the course's chapter 8 slides give them:
//
//   - The first bond between two atoms is always a sigma bond. A second and a third bond between
//     the same two atoms are pi bonds. So a single bond is 1 sigma, a double bond is 1 sigma and
//     1 pi, and a triple bond is 1 sigma and 2 pi.
//   - An atom's hybridization follows from its number of electron domains: 2 is sp, 3 is sp2,
//     4 is sp3. A double or triple bond is still one domain. The slides name sp3d and sp3d2 as
//     the other types, which go with 5 and 6 domains.
//
// Pure TypeScript.
import type { Structure } from './structure'

export function sigmaPi(s: Structure): { sigma: number; pi: number } {
  return { sigma: s.bonds.length, pi: s.bonds.reduce((n, b) => n + b.order - 1, 0) }
}

export type Hybrid = 'sp' | 'sp2' | 'sp3' | 'sp3d' | 'sp3d2'
/** In order of electron domains, 2 to 6. */
export const HYBRIDS: Hybrid[] = ['sp', 'sp2', 'sp3', 'sp3d', 'sp3d2']

/** The hybridization that goes with this many electron domains, or null outside 2 to 6. */
export function hybridFor(domains: number): Hybrid | null {
  return HYBRIDS[domains - 2] ?? null
}
/** How many electron domains this hybridization goes with. */
export function domainsOf(hybrid: Hybrid): number {
  return HYBRIDS.indexOf(hybrid) + 2
}
