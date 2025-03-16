export type Collection = {
  id: string
  title: string
  songsFile: string
  theme: {
    mainColor: string
    trackColors: Record<string, string> | string[]
  }
}
