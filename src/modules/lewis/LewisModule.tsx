'use dom'
// The Lewis structures module as one component. It is written with web tech (Three.js on a canvas,
// HTML and CSS for the panel). On the web it renders in place. In the iOS and Android apps, Expo
// runs it inside a web view, and the props below cross over to it as plain data and async calls.
import { useEffect, useRef } from 'react'

import { registerNunito } from './font'
import './styles.css'
import { mount } from './ui'

interface Props {
  /** Problems the app already has down as finished. */
  solved: string[]
  /** Called with every finished problem id each time one more is finished. */
  onSolved: (ids: string[]) => Promise<void>
  /** Back to the app's list of modules. */
  onExit: () => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function LewisModule({ solved, onSolved, onExit }: Props) {
  const root = useRef<HTMLDivElement>(null)
  // the latest callbacks, without remounting the board when the parent re-renders
  const calls = useRef({ onSolved, onExit })
  useEffect(() => {
    calls.current = { onSolved, onExit }
  })
  const firstSolved = useRef(solved)

  useEffect(() => {
    if (!root.current) return
    registerNunito()
    return mount(root.current, {
      solved: firstSolved.current,
      onSolved: (ids) => void calls.current.onSolved(ids),
      onExit: () => void calls.current.onExit(),
    })
  }, [])

  return <div ref={root} />
}
