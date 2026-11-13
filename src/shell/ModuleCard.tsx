// One module on the home screen. The whole card is the link into the module.
import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import type { ModuleInfo } from '@/modules/registry'
import { color, font, radius, space } from '@/theme/tokens'

import { MoleculeMark } from './MoleculeMark'

export function ModuleCard({ info, done, order = 0 }: { info: ModuleInfo; done: number; order?: number }) {
  const pressed = useSharedValue(0)
  // the card sits on a darker edge and sinks onto it while it is pressed
  const squeeze = useAnimatedStyle(() => ({ transform: [{ translateY: 5 * pressed.get() }, { scale: 1 - 0.012 * pressed.get() }] }))
  const share = Math.min(1, done / info.problems)
  const progress = done > 0 ? `${done} of ${info.problems} ${info.problemWord} finished` : `${info.problems} ${info.problemWord}`

  // phones: drawing and title on one line, then the text, then a full-width button.
  // wider screens: drawing, text and button side by side.
  const wide = useWindowDimensions().width >= 640
  const meter = (
    <View style={styles.meter}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%` }]} />
      </View>
      <Text style={styles.progress}>{progress}</Text>
    </View>
  )
  const open = (
    <View style={[styles.open, !wide && styles.openFull]}>
      <Text style={styles.openText}>Open</Text>
    </View>
  )

  // Link hands its props to the Pressable, and it can only merge a plain style object (an array
  // breaks on the web), so the animated style lives on the view inside.
  return (
    // the cards rise into place once, one after another, when the home screen first shows
    <Animated.View entering={FadeInDown.delay(80 * order).springify().damping(20).stiffness(170)}>
      <Link href={info.route} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${info.title}. ${info.summary} ${progress}.`}
          onPressIn={() => pressed.set(withSpring(1, { damping: 18, stiffness: 420 }))}
          onPressOut={() => pressed.set(withSpring(0, { damping: 11, stiffness: 260 }))}
          style={styles.hit}>
          {wide ? (
            <Animated.View style={[styles.card, styles.row, squeeze]}>
              <MoleculeMark />
              <View style={styles.body}>
                <Text style={styles.title}>{info.title}</Text>
                <Text style={styles.summary}>{info.summary}</Text>
                {meter}
              </View>
              {open}
            </Animated.View>
          ) : (
            <Animated.View style={[styles.card, styles.column, squeeze]}>
              <View style={styles.lead}>
                <MoleculeMark size={76} />
                <Text style={[styles.title, styles.titleNarrow]}>{info.title}</Text>
              </View>
              <Text style={styles.summary}>{info.summary}</Text>
              {meter}
              {open}
            </Animated.View>
          )}
        </Pressable>
      </Link>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hit: { borderRadius: radius.l },
  card: {
    padding: space.l,
    borderRadius: radius.l,
    backgroundColor: color.paper,
    boxShadow: `0 6px 0 ${color.paperLip}, 0 22px 34px -18px rgba(74, 58, 140, 0.55)`,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.l, paddingHorizontal: space.xl },
  column: { gap: space.m, padding: space.xl - 4 },
  lead: { flexDirection: 'row', alignItems: 'center', gap: space.l },
  body: { flex: 1, gap: 6 },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 29, color: color.ink },
  summary: { fontFamily: font.semi, fontSize: 16, lineHeight: 23, color: color.ink2 },
  meter: { marginTop: 6, gap: 6 },
  track: { height: 10, borderRadius: 5, backgroundColor: color.tint2, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: color.mintDeep },
  progress: { fontFamily: font.extra, fontSize: 13.5, color: color.ink2 },
  titleNarrow: { flex: 1 },
  open: { minHeight: 48, marginBottom: 4, paddingHorizontal: 26, borderRadius: radius.pill, backgroundColor: color.grapeDeep, boxShadow: `0 4px 0 ${color.grapeLip}`, alignItems: 'center', justifyContent: 'center' },
  openFull: { marginTop: space.xs, minHeight: 52 },
  openText: { fontFamily: font.display, fontSize: 18, color: '#ffffff' },
})
