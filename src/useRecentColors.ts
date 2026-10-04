import { useSyncExternalStore } from 'react'

const storageKey = 'orbit-recent-colors'
const limit = 12
const listeners = new Set<() => void>()

function loadColors(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    return [
      ...new Set(
        stored
          .filter(
            (color): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color),
          )
          .map((color) => color.toLowerCase()),
      ),
    ].slice(0, limit)
  } catch {
    return []
  }
}

let colors = loadColors()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function remember(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return
  const normalized = color.toLowerCase()
  if (colors[0] === normalized) return
  colors = [normalized, ...colors.filter((item) => item !== normalized)].slice(0, limit)
  listeners.forEach((listener) => listener())
  try {
    localStorage.setItem(storageKey, JSON.stringify(colors))
  } catch {
    return
  }
}

export function useRecentColors() {
  return { colors: useSyncExternalStore(subscribe, () => colors), remember }
}
