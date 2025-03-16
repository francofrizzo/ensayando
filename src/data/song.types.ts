export type Song = {
  id: string
  collectionId: string
  title: string
  tracks: Track[]
  lyrics: LyricsLine[]
}

export type Track = {
  id: string
  title: string
  subtitle?: string
  file: string
}

export type LyricsLine = {
  startTime: number
  endTime?: number
  spaceBefore?: boolean
  text: string
}
