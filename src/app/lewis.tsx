import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { useCallback, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import LewisModule from '@/modules/lewis/LewisModule'
import { PART_IDS, type Mode } from '@/modules/lewis/store'
import type { Feel } from '@/modules/lewis/ui'
import { useProgress } from '@/shell/progress'
import { color } from '@/theme/tokens'

const DOM = { scrollEnabled: false, bounces: false, style: { flex: 1, backgroundColor: color.sky } } as const

/** The module with the progress it starts from. Its props never change after it opens: in the
 *  native apps every changed prop is sent across to the web view again. */
function Board({ mode, start, record }: { mode: Mode; start: string[]; record: (ids: string[]) => void }) {
  const router = useRouter()
  const [solved] = useState(start)
  const onSolved = useCallback(async (ids: string[]) => record(ids), [record])
  const onExit = useCallback(async () => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [router])
  // On a phone, the board's bumps come through the phone's motor. Browsers have no such motor to ask.
  const onFeel = useCallback(async (kind: Feel) => {
    if (Platform.OS === 'web') return
    try {
      if (kind === 'done') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      else if (kind === 'refuse') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      else await Haptics.impactAsync(kind === 'bond' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    } catch {
      // a phone with its motor switched off
    }
  }, [])
  return <LewisModule dom={DOM} start={mode} solved={solved} onSolved={onSolved} onExit={onExit} onFeel={onFeel} />
}

/** The module on one of its three screens. Each has its own saved list: guided problems under
 *  'lewis', shapes under 'shapes', exercises under 'exercises'. The module gets the three lists as
 *  one and reports them as one, and the prefix of an id says which list it belongs to. */
export function LewisScreen({ mode, title, description }: { mode: Mode; title: string; description: string }) {
  const lewis = useProgress('lewis')
  const shapes = useProgress('shapes')
  const exercises = useProgress('exercises')
  const ready = lewis.ready && shapes.ready && exercises.ready
  const record = useCallback(
    (ids: string[]) => {
      shapes.record(ids.filter((id) => id.startsWith(PART_IDS.shapes)))
      exercises.record(ids.filter((id) => id.startsWith(PART_IDS.exercise)))
      lewis.record(ids.filter((id) => !id.startsWith(PART_IDS.shapes) && !id.startsWith(PART_IDS.exercise)))
    },
    [lewis, shapes, exercises],
  )

  return (
    <View style={styles.page}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/* wait for the saved progress, so the module opens with the right molecules ticked */}
        {ready && <Board mode={mode} start={[...lewis.ids, ...shapes.ids, ...exercises.ids]} record={record} />}
      </SafeAreaView>
    </View>
  )
}

export default function LewisRoute() {
  return (
    <LewisScreen
      mode="guided"
      title="Lewis structures and shapes"
      description="Build Lewis structures on a 3D board: count the valence electrons, place the atoms, bond them, check every atom, then see the molecule's 3D shape."
    />
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.sky },
  safe: { flex: 1 },
})
