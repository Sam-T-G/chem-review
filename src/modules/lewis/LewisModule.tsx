'use dom'
// The Lewis structures module as one component. It is written with web tech (Three.js on a canvas,
// HTML and CSS for the panel). On the web it renders in place. In the iOS and Android apps, Expo
// runs it inside a web view, and the props below cross over to it as plain data and async calls.
import { useEffect, useRef } from 'react'

import { registerFonts } from './font'
import './styles.css'
import './shapes/shapes.css'
import './exercise/exercise.css'
import type { Mode } from './store'
import { mount, type Feel } from './ui'

interface Props {
  /** The mode the module opens in: the guided steps, the shapes quiz or the exercises. */
  start: Mode
  /** What the app already has down as finished: guided problems by id, shapes as `shape:<id>`, exercises as `ex:<id>`. */
  solved: string[]
  /** Called with every finished problem id each time one more is finished. */
  onSolved: (ids: string[]) => Promise<void>
  /** Back to the app's list of modules. */
  onExit: () => Promise<void>
  /** An atom landed, a bond formed, a move was refused, a step was finished: the phone can tap back. */
  onFeel: (kind: Feel) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function LewisModule({ start, solved, onSolved, onExit, onFeel }: Props) {
  const root = useRef<HTMLDivElement>(null)
  // the latest callbacks, without remounting the board when the parent re-renders
  const calls = useRef({ onSolved, onExit, onFeel })
  useEffect(() => {
    calls.current = { onSolved, onExit, onFeel }
  })
  const firstSolved = useRef(solved)
  const firstStart = useRef(start)

  useEffect(() => {
    if (!root.current) return
    registerFonts()
    return mount(root.current, {
      solved: firstSolved.current,
      start: firstStart.current,
      onSolved: (ids) => void calls.current.onSolved(ids),
      onExit: () => void calls.current.onExit(),
      onFeel: (kind) => void calls.current.onFeel(kind),
    })
  }, [])

  return <div ref={root} />
}
