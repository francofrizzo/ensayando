export type Song = {
  id: string
  collectionId: string
  title: string
  tracks: Track[]
  lyrics: Lyric[][]
}

export type Track = {
  id: string
  title: string
  subtitle?: string
  file: string
}

export type Lyric = {
  startTime: number
  endTime?: number
  text: string
  tracks?: string[]
  comment?: string
}
