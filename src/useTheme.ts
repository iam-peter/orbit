import { useEffect, useState } from 'react'

type Preference = 'light' | 'dark' | 'system'

function savedPreference(): Preference {
  try {
    const stored = localStorage.getItem('orbit-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    return 'system'
  }
  return 'system'
}

export function useTheme() {
  const [preference, setPreference] = useState(savedPreference)
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const next = preference === 'system' ? media.matches : preference === 'dark'
      document.documentElement.dataset.theme = next ? 'dark' : 'light'
      document.documentElement.style.colorScheme = next ? 'dark' : 'light'
      setDark(next)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])
  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    setPreference(next)
    try {
      localStorage.setItem('orbit-theme', next)
    } catch {
      return
    }
  }
  return { dark, toggle }
}
