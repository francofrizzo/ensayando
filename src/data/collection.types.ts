export type Collection = {
  id: string
  title: string
  enabled?: boolean
  songsFile: string
  artist?: string
  artwork?: string
  theme: {
    mainColor: string
    trackColors: Record<string, string> | string[]
  }
}
