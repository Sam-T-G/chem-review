// What the shell may import from the Lewis module besides its top component: the names of its modes
// and the prefixes of its saved ids. Plain values and types with no imports of their own, so a route
// that reads them does not pull the module's store into the native bundle (docs/architecture.md).

/** 'guided' and 'free' are the module's own modes. 'shapes' (the shapes quiz) and 'exercise' are parts: parts.ts has their contract. */
export type Mode = 'guided' | 'free' | 'shapes' | 'exercise'

/** A finished item of a part is saved with the part's prefix, so the three lists never share an id. */
export const PART_IDS = { shapes: 'shape:', exercise: 'ex:' } as const
