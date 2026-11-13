// Every module the app offers. The home screen lists these; each one has a route in src/app/.
// To add a module: build it under src/modules/<id>/, add a route file, and add an entry here.
import type { Href } from 'expo-router'

import { PROBLEMS } from '@/chem/problems'

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

export const MODULES: ModuleInfo[] = [
  {
    id: 'lewis',
    route: '/lewis',
    title: 'Lewis structures and shapes',
    summary: "Count the valence electrons, bond the atoms on a 3D board, check every atom, then see the molecule's shape.",
    problems: PROBLEMS.length,
    problemWord: 'molecules',
  },
]
