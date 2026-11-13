// A small water molecule made of plain views: an oxygen with a face, two hydrogens, two bonds,
// and oxygen's two lone pairs as butter dots. It rocks slowly from side to side. Used on the module card.
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { color } from '@/theme/tokens'

import { Atom } from './Atom'

const SIZE = 104

function Dot({ x, y }: { x: number; y: number }) {
  return <View style={[styles.dot, { left: x - 5, top: y - 5 }]} />
}
function Bond({ x, y, angle }: { x: number; y: number; angle: number }) {
  return <View style={[styles.bond, { left: x - 15, top: y - 3, transform: [{ rotate: `${angle}deg` }] }]} />
}

export function MoleculeMark({ size = SIZE }: { size?: number }) {
  const sway = useSharedValue(0)
  // nothing for the atoms to look at on the card: their eyes rest in the middle
  const gaze = { x: useSharedValue(0), y: useSharedValue(0), on: useSharedValue(0) }
  useEffect(() => {
    sway.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [sway])
  const rock = useAnimatedStyle(() => ({ transform: [{ rotate: `${(sway.get() - 0.5) * 9}deg` }, { translateY: (sway.get() - 0.5) * 3 }] }))

  return (
    // drawn at 104 x 104 and scaled as one piece
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      <View style={[styles.box, { transform: [{ scale: size / SIZE }], transformOrigin: 'top left' }]}>
        <Animated.View style={[StyleSheet.absoluteFill, rock]}>
          {/* H–O–H at 104.5°, the measured angle of water; two lone pairs on oxygen */}
          <Bond x={34.2} y={63.8} angle={-37.7} />
          <Bond x={69.8} y={63.8} angle={37.7} />
          <Atom el="H" size={26} x={16.4} y={77.5} gaze={gaze} order={1} />
          <Atom el="H" size={26} x={87.6} y={77.5} gaze={gaze} order={3} />
          <Atom el="O" size={44} x={52} y={50} gaze={gaze} order={0} />
          <Dot x={34.4} y={28.2} />
          <Dot x={42} y={23.9} />
          <Dot x={62} y={23.9} />
          <Dot x={69.6} y={28.2} />
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, borderRadius: 28, backgroundColor: color.mint, boxShadow: `0 4px 0 ${color.mintLip}` },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color.butter, borderWidth: 2, borderColor: color.ink },
  bond: { position: 'absolute', width: 30, height: 6, borderRadius: 3, backgroundColor: color.grape },
})
