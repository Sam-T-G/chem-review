// An atom with a face, drawn with plain views: the same ball the Lewis board draws, with a pale
// patch and two tall dark eyes above its symbol. It bobs, blinks and its eyes lean toward a point.
// A draggable one can be picked up, and springs back to its place when it is let go.
import { useEffect, useState } from 'react'
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'

import type { El } from '@/chem/elements'
import { BALL, faceColor } from '@/modules/lewis/palette'
import { color, font } from '@/theme/tokens'

/** A point for atoms to look at, in the coordinates of the view that holds them. `on` is 0 when there is nothing to look at. */
export interface Gaze {
  x: SharedValue<number>
  y: SharedValue<number>
  on: SharedValue<number>
}

/** Unshared electrons to draw around the atom: how many (0, 1 or 2) at the top, right, bottom and left. */
export type Dots = [number, number, number, number]

interface Props {
  el: El
  /** Diameter in px. */
  size: number
  /** Where the atom's center sits inside its parent, in px. */
  x: number
  y: number
  gaze: Gaze
  dots?: Dots
  /** Sets the atom's own rhythm, so neighbors bob and blink out of step. */
  order?: number
  draggable?: boolean
}

/** A dropped atom goes back to its place, overshooting a little on the way. */
function letGo(tx: SharedValue<number>, ty: SharedValue<number>, held: SharedValue<number>) {
  tx.set(withSpring(0, { damping: 9, stiffness: 110 }))
  ty.set(withSpring(0, { damping: 9, stiffness: 110 }))
  held.set(withSpring(0, { damping: 10, stiffness: 240 }))
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
// the browser must not scroll the page or select text while an atom is being dragged
const grabbable = Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object) : null

export function Atom({ el, size, x, y, gaze, dots, order = 0, draggable = false }: Props) {
  const bob = useSharedValue(0)
  const lid = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const held = useSharedValue(0)
  const homeX = useSharedValue(x)
  const homeY = useSharedValue(y)

  useEffect(() => {
    homeX.set(x)
    homeY.set(y)
  }, [x, y, homeX, homeY])

  useEffect(() => {
    bob.set(withDelay(order * 330, withRepeat(withTiming(1, { duration: 1500 + order * 140, easing: Easing.inOut(Easing.sin) }), -1, true)))
    // a quick blink, then a few seconds with the eyes open
    lid.set(
      withDelay(
        700 + order * 640,
        withRepeat(withSequence(withTiming(0.12, { duration: 80 }), withTiming(1, { duration: 120 }), withDelay(2400 + order * 520, withTiming(1, { duration: 1 }))), -1),
      ),
    )
  }, [bob, lid, order])

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        held.set(withSpring(1, { damping: 12, stiffness: 300 }))
      },
      onPanResponderMove: (_e, g) => {
        tx.set(g.dx)
        ty.set(g.dy)
        // the other atoms watch the one being carried
        gaze.x.set(homeX.get() + g.dx)
        gaze.y.set(homeY.get() + g.dy)
        gaze.on.set(1)
      },
      onPanResponderRelease: () => letGo(tx, ty, held),
      onPanResponderTerminate: () => letGo(tx, ty, held),
    }),
  )

  const float = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() + (bob.get() - 0.5) * size * 0.09 * (1 - held.get()) }, { scale: 1 + 0.1 * held.get() }],
  }))
  const blink = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.get() }, { scale: 1 + 0.18 * held.get() }] }))
  const look = useAnimatedStyle(() => {
    const dx = gaze.x.get() - (homeX.get() + tx.get())
    const dy = gaze.y.get() - (homeY.get() + ty.get())
    const far = Math.hypot(dx, dy)
    // the pair of eyes moves a little over the patch, further sideways than up and down
    const reach = far > 1 ? Math.min(1, far / 110) * gaze.on.get() * size : 0
    return { transform: [{ translateX: far > 1 ? (dx / far) * reach * 0.037 : 0 }, { translateY: far > 1 ? (dy / far) * reach * 0.02 : 0 }] }
  })
  // the electrons rock a few degrees around the atom
  const rock = useAnimatedStyle(() => ({ transform: [{ rotate: `${(bob.get() - 0.5) * 9}deg` }] }))

  const ball = BALL[el]
  const line = Math.max(1.5, size * 0.034)
  // the same proportions as the face on the board (face.ts), which counts in ball radii
  const patchH = size * 0.27
  const eyeW = size * 0.092
  const eyeH = size * 0.19
  const glint = Math.max(2, size * 0.036)
  const dot = Math.max(7, size * 0.14)
  // a ball under 32 px is too small for eyes that read as eyes: it gets its symbol in the middle
  const face = size >= 32
  const seats: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]

  return (
    <Animated.View
      {...(draggable ? pan.panHandlers : null)}
      style={[styles.wrap, { left: x - size / 2, top: y - size / 2, width: size, height: size }, draggable && grabbable, float]}>
      {dots && (
        <Animated.View style={[StyleSheet.absoluteFill, rock]} pointerEvents="none">
          {seats.flatMap(([sx, sy], seat) => {
            const n = dots[seat] ?? 0
            const out = size / 2 + dot * 0.75
            // one electron sits on the seat; a pair sits side by side across it
            return Array.from({ length: n }, (_, i) => {
              const side = n === 2 ? (i === 0 ? -1 : 1) * dot * 0.62 : 0
              const cx = size / 2 + sx * out + (sx === 0 ? side : 0)
              const cy = size / 2 + sy * out + (sy === 0 ? side : 0)
              return <View key={`${seat}-${i}`} style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, borderWidth: line, left: cx - dot / 2, top: cy - dot / 2 }]} />
            })
          })}
        </Animated.View>
      )}
      <View style={[styles.ball, { borderRadius: size / 2, borderWidth: line, backgroundColor: hex(ball.color) }]}>
        {/* a soft highlight at the upper left, where the light comes from; smaller on a ball with a face, so it stays clear of the patch */}
        <View
          style={[
            styles.shine,
            face
              ? { width: size * 0.11, height: size * 0.042, borderRadius: size * 0.021, left: size * 0.215 - line, top: size * 0.111 - line }
              : { width: size * 0.3, height: size * 0.2, borderRadius: size * 0.15, left: size * 0.13, top: size * 0.07 },
          ]}
        />
        {face && (
          <View style={[styles.patch, { top: size * 0.145 - line, left: size * 0.22 - line, width: size * 0.56, height: patchH, borderRadius: patchH / 2, backgroundColor: hex(faceColor(ball.color)) }]}>
            <Animated.View style={[styles.eyes, { gap: size * 0.073 }, look]}>
              {[0, 1].map((i) => (
                <Animated.View key={i} style={[styles.eye, { width: eyeW, height: eyeH, borderRadius: eyeW / 2 }, blink]}>
                  <View style={[styles.glint, { width: glint, height: glint, borderRadius: glint / 2, top: eyeH * 0.13, left: eyeW * 0.5 }]} />
                </Animated.View>
              ))}
            </Animated.View>
          </View>
        )}
        <Text
          style={[styles.symbol, face ? { fontSize: size * 0.36, lineHeight: size * 0.42, marginTop: size * 0.4 } : { fontSize: size * 0.5, lineHeight: size * 0.6, marginTop: size * 0.2 - line }, { color: ball.ink }]}
          selectable={false}>
          {el}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  ball: { flex: 1, alignItems: 'center', borderColor: color.ink, overflow: 'hidden', boxShadow: '0 8px 12px -6px rgba(58, 51, 88, 0.55)' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.5)', transform: [{ rotate: '-28deg' }] },
  patch: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  eyes: { flexDirection: 'row' },
  eye: { backgroundColor: color.ink },
  glint: { position: 'absolute', backgroundColor: '#ffffff' },
  symbol: { fontFamily: font.display, textAlign: 'center' },
  dot: { position: 'absolute', backgroundColor: color.butter, borderColor: color.ink },
})
