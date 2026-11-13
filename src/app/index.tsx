import Head from 'expo-router/head'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MODULES } from '@/modules/registry'
import { ModuleCard } from '@/shell/ModuleCard'
import { useProgress } from '@/shell/progress'
import { color, font, space } from '@/theme/tokens'

export default function HomeScreen() {
  // one hook per module; there is one module so far
  const lewis = useProgress('lewis')
  const done: Record<string, number> = { lewis: lewis.ids.length }

  return (
    <View style={styles.page}>
      <Head>
        <title>Chem Review</title>
        <meta name="description" content="Work general chemistry problems one step at a time. Build Lewis structures on a 3D board and see each molecule's shape." />
      </Head>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.column}>
            <Text style={styles.title} accessibilityRole="header">
              Chem Review
            </Text>
            <Text style={styles.lede}>Work general chemistry problems one step at a time, with a hint ready at every step.</Text>
            <Text style={styles.section} accessibilityRole="header">
              Modules
            </Text>
            <View style={styles.list}>
              {MODULES.map((m, i) => (
                <ModuleCard key={m.id} info={m} done={done[m.id] ?? 0} order={i} />
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const gradient = `linear-gradient(160deg, ${color.sky2} 0%, ${color.sky} 55%, #e1e6ff 100%)`
// React Native names the property experimental_backgroundImage; the web build needs the CSS name
const sky = Platform.OS === 'web' ? ({ backgroundImage: gradient } as object) : { experimental_backgroundImage: gradient }

const styles = StyleSheet.create({
  // the same soft sky as the modules: pink at the top left fading to blueberry milk
  page: { flex: 1, backgroundColor: color.sky, ...sky },
  safe: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space.l, paddingTop: space.xxl, paddingBottom: 48 },
  column: { width: '100%', maxWidth: 760 },
  title: { fontFamily: font.black, fontSize: 44, lineHeight: 50, letterSpacing: -0.6, color: color.ink },
  lede: { marginTop: space.s, maxWidth: 520, fontFamily: font.semi, fontSize: 18, lineHeight: 26, color: color.ink2 },
  section: { marginTop: space.xxl, marginBottom: space.m, fontFamily: font.extra, fontSize: 15, color: color.ink2 },
  list: { gap: space.l },
})
