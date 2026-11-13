// The app's palette, radii and type, in one place. The native shell reads these directly; web
// modules get the colors as CSS variables through cssVars().
//
// The look carries over from Sam's physics sims: blueberry-milk sky, mint board, grape controls,
// butter electrons, strawberry for mistakes, one rounded family (Nunito).

export const color = {
  sky: '#e9e7ff',
  sky2: '#f7eaf5',
  paper: '#fffdfb',
  tint: '#f4f1ff',
  tint2: '#e6e1fa',
  ink: '#3a3358',
  ink2: '#5f577f', // 6.4:1 on paper
  inkDim: '#9a93b8',
  grape: '#7467c2',
  grapeDeep: '#5a4daa',
  butter: '#ffd15c',
  butterSoft: '#fff1c4',
  butterLine: '#f3da8c',
  butterDeep: '#8a5a00',
  mint: '#cfebdb',
  mintSoft: '#e6f6ed',
  mintLine: '#bfe3cf',
  mintDeep: '#256b48',
  straw: '#ff8fa3',
  strawSoft: '#fff0f2',
  strawLine: '#ffcdd6',
  strawDeep: '#b9324f',
  blueSoft: '#e6edff',
  blueDeep: '#2f4fb0',
} as const

export const radius = { s: 12, m: 18, l: 30, pill: 999 } as const
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const

/** Font family names registered in src/app/_layout.tsx. React Native picks a weight by family name. */
export const font = {
  semi: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const

/** The palette as CSS custom properties (`--grape-deep`, ...), for modules written with web tech. */
export function cssVars(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(color)) out[`--${name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`] = value
  return out
}
