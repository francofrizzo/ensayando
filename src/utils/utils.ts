export const formatTime = (time: number): string => {
  const [minutes, seconds] = [Math.floor(time / 60), Math.floor(time % 60)]
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
