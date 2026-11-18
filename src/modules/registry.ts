// Every card on the home screen; each one has a route in src/app/. The Lewis module has three:
// its guided molecules, its shapes quiz and its exercises. Each card has its own saved list.
// To add a module: build it under src/modules/<id>/, add a route file, and add an entry here.
import type { Href } from 'expo-router'

import { EXERCISES } from '@/chem/exercises'
import { PROBLEMS } from '@/chem/problems'
import { ALL_CASES } from '@/chem/vsepr'

export interface ModuleInfo {
  id: string
  route: Href
  title: string
  /** One or two plain sentences: what the student does in this module. */
  summary: string
  /** How many problems it has, for the progress line on its card. */
  problems: number
  problemWord: string
}

const ALL: ModuleInfo[] = [
  {
    id: 'lewis',
    route: '/lewis',
    title: 'Lewis structures and shapes',
    summary: "Count the valence electrons, bond the atoms on a 3D board, check every atom, then see the molecule's shape.",
    problems: PROBLEMS.length,
    problemWord: 'molecules',
  },
  {
    id: 'shapes',
    route: '/shapes',
    title: 'Shapes quiz',
    summary: 'See each electron geometry and molecular geometry as a 3D model, then name them from memory.',
    problems: ALL_CASES.length,
    problemWord: 'shapes',
  },
  {
    id: 'exercises',
    route: '/exercises',
    title: 'Exercises',
    summary: 'Work a molecule from start to finish without the guided steps: the electron count, the Lewis structure, both geometries, the bond angles and the dipoles.',
    problems: EXERCISES.length,
    problemWord: 'molecules',
  },
]

/** The cards a student can open. The shapes quiz and the exercises are built and stay closed until
 *  their review findings are fixed. The Lewis module has the same switch for its tabs
 *  (`OPEN_PARTS` in `src/modules/lewis/parts.ts`): change both together. */
const OPEN: readonly string[] = ['lewis', 'shapes', 'exercises']

export const MODULES: ModuleInfo[] = ALL.filter((m) => OPEN.includes(m.id))
