// A small drawing of a water molecule made of plain views: an oxygen ball, two hydrogen balls,
// two bonds, and oxygen's two lone pairs as butter dots. Used on the module card.
import { StyleSheet, View } from 'react-native'

import { color } from '@/theme/tokens'

const SIZE = 104

function Ball({ d, x, y, fill }: { d: number; x: number; y: number; fill: string }) {
  return <View style={[styles.ball, { width: d, height: d, borderRadius: d / 2, left: x - d / 2, top: y - d / 2, backgroundColor: fill }]} />
}
function Dot({ x, y }: { x: number; y: number }) {
  return <View style={[styles.dot, { left: x - 5, top: y - 5 }]} />
}
function Bond({ x, y, angle }: { x: number; y: number; angle: number }) {
  return <View style={[styles.bond, { left: x - 15, top: y - 3, transform: [{ rotate: `${angle}deg` }] }]} />
}

export function MoleculeMark({ size = SIZE }: { size?: number }) {
  return (
    // drawn at 104 x 104 and scaled as one piece
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
      <View style={[styles.box, { transform: [{ scale: size / SIZE }], transformOrigin: 'top left' }]}>
      {/* H–O–H at 104.5°, the measured angle of water; two lone pairs on oxygen */}
      <Bond x={34.2} y={63.8} angle={-37.7} />
      <Bond x={69.8} y={63.8} angle={37.7} />
      <Ball d={26} x={16.4} y={77.5} fill="#fff6e6" />
      <Ball d={26} x={87.6} y={77.5} fill="#fff6e6" />
      <Ball d={44} x={52} y={50} fill={color.straw} />
      <Dot x={34.4} y={28.2} />
      <Dot x={42} y={23.9} />
      <Dot x={62} y={23.9} />
      <Dot x={69.6} y={28.2} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, borderRadius: 28, backgroundColor: color.mint },
  ball: { position: 'absolute', borderWidth: 2, borderColor: color.ink },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color.butter, borderWidth: 2, borderColor: color.ink },
  bond: { position: 'absolute', width: 30, height: 6, borderRadius: 3, backgroundColor: color.grape },
})
