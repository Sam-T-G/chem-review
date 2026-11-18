// Bubbles that rise slowly behind the home screen, the same ones that drift behind the Lewis board.
import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated'

// left edge (share of the width), diameter, seconds to cross the screen, seconds before the first rise
const BUBBLES: [number, number, number, number][] = [
  [0.06, 26, 19, 0],
  [0.2, 14, 24, 6],
  [0.36, 34, 17, 11],
  [0.55, 18, 22, 3],
  [0.7, 28, 20, 14],
  [0.84, 16, 26, 8],
  [0.94, 36, 18, 1],
]

function Bubble({ left, d, seconds, wait, height }: { left: number; d: number; seconds: number; wait: number; height: number }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(withDelay(wait * 1000, withRepeat(withTiming(1, { duration: seconds * 1000, easing: Easing.linear }), -1)))
  }, [t, seconds, wait])
  const rise = useAnimatedStyle(() => {
    const p = t.get()
    // fades in at the bottom, sways a little on the way up, fades out at the top
    return { opacity: Math.min(1, p * 8, (1 - p) * 8) * 0.75, transform: [{ translateY: -p * (height + 80) }, { translateX: Math.sin(p * 6.3) * 14 }] }
  })
  return <Animated.View style={[styles.bubble, { left: `${left * 100}%`, width: d, height: d, borderRadius: d / 2 }, rise]} />
}

export function Sky() {
  const { height } = useWindowDimensions()
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      {BUBBLES.map(([left, d, seconds, wait], i) => (
        <Bubble key={i} left={left} d={d} seconds={seconds} wait={wait} height={height} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // a bubble near the right edge sways 14 px past it, which let a phone scroll the home screen sideways
  clip: { overflow: 'hidden' },
  bubble: { position: 'absolute', bottom: -40, backgroundColor: 'rgba(255, 255, 255, 0.22)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.75)' },
})
