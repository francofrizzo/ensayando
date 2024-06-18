export type Song = {
  title: string
  tracks: {
    title: string
    file: string
  }[]
  lyrics: {
    startTime: number
    endTime?: number
    spaceBefore?: boolean
    text: string
  }[]
}
