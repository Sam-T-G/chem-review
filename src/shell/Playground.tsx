// The top of the home screen: four atoms with their valence electrons, floating. They look at
// the pointer (or at whichever atom is being dragged), and each one can be picked up and dropped.
import { useEffect, useRef, type ComponentRef } from 'react'
import { Platform, View } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'

import type { El } from '@/chem/elements'

import { Atom, type Dots } from './Atom'

// where each atom sits in a 340 x 210 box, its diameter, and its unshared electrons (top, right, bottom, left)
const CAST: { el: El; x: number; y: number; d: number; dots: Dots }[] = [
  { el: 'N', x: 52, y: 62, d: 68, dots: [2, 1, 1, 1] },
  { el: 'C', x: 136, y: 138, d: 84, dots: [1, 1, 1, 1] },
  { el: 'O', x: 232, y: 66, d: 76, dots: [2, 1, 2, 1] },
  { el: 'H', x: 296, y: 158, d: 52, dots: [0, 1, 0, 0] },
]
const BOX = { w: 340, h: 210 }

export function Playground({ width }: { width: number }) {
  const k = width / BOX.w
  const box = useRef<ComponentRef<typeof View>>(null)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const on = useSharedValue(0)

  // In a browser the atoms follow the mouse anywhere on the page. A phone has no pointer until a
  // finger is down, and then the atoms watch the atom that finger is dragging (see Atom).
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const rect = (box.current as unknown as HTMLElement | null)?.getBoundingClientRect()
      if (!rect) return
      x.set(e.clientX - rect.left)
      y.set(e.clientY - rect.top)
      on.set(withTiming(1, { duration: 200 }))
    }
    const leave = () => on.set(withTiming(0, { duration: 400 }))
    window.addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [x, y, on])

  return (
    <View ref={box} style={{ width, height: BOX.h * k }} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      {CAST.map((a, i) => (
        <Atom key={a.el} el={a.el} size={a.d * k} x={a.x * k} y={a.y * k} dots={a.dots} gaze={{ x, y, on }} order={i} draggable />
      ))}
    </View>
  )
}
