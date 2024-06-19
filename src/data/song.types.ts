export type Song = {
  title: string
  tracks: {
    title: string
    subtitle?: string
    file: string
  }[]
  lyrics: {
    startTime: number
    endTime?: number
    spaceBefore?: boolean
    text: string
  }[]
}
