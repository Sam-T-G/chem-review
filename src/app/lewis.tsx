import { useRouter } from 'expo-router'
import Head from 'expo-router/head'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import LewisModule from '@/modules/lewis/LewisModule'
import { useProgress } from '@/shell/progress'
import { color } from '@/theme/tokens'

const DOM = { scrollEnabled: false, bounces: false, style: { flex: 1, backgroundColor: color.sky } } as const

/** The module with the progress it starts from. Its props never change after it opens: in the
 *  native apps every changed prop is sent across to the web view again. */
function Board({ start, record }: { start: string[]; record: (ids: string[]) => void }) {
  const router = useRouter()
  const [solved] = useState(start)
  const onSolved = useCallback(async (ids: string[]) => record(ids), [record])
  const onExit = useCallback(async () => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [router])
  return <LewisModule dom={DOM} solved={solved} onSolved={onSolved} onExit={onExit} />
}

export default function LewisScreen() {
  const progress = useProgress('lewis')

  return (
    <View style={styles.page}>
      <Head>
        <title>Lewis structures and shapes</title>
        <meta name="description" content="Build Lewis structures on a 3D board: count the valence electrons, place the atoms, bond them, check every atom, then see the molecule's 3D shape." />
      </Head>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        {/* wait for the saved progress, so the module opens with the right molecules ticked */}
        {progress.ready && <Board start={progress.ids} record={progress.record} />}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.sky },
  safe: { flex: 1 },
})
