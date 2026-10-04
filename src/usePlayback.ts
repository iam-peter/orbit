import { useEffect, useRef, useState } from 'react'

export function usePlayback(playing: boolean) {
  const clock = useRef(0)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let previous: number | undefined
    const tick = (now: number) => {
      if (!document.hidden && previous !== undefined) {
        clock.current += Math.min((now - previous) / 1000, 0.1)
        setSeconds(clock.current)
      }
      previous = document.hidden ? undefined : now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  const seek = (time = 0) => {
    clock.current = time
    setSeconds(time)
  }
  return { seconds, seek }
}
