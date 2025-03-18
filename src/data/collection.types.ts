export type Collection = {
  id: string
  title: string
  enabled?: boolean
  songsFile: string
  theme: {
    mainColor: string
    trackColors: Record<string, string> | string[]
  }
}
