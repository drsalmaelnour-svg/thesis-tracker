import { createContext, useContext, useEffect, useState } from 'react'

// The sidebar stays a constant dark espresso rail regardless of the
// content-area theme — its labels are hardcoded light text and would be
// illegible against the ivory theme otherwise.
const SIDEBAR_THEME = { primary: '#180f0a', accent: '#e8bf5a' }

const ThemeContext = createContext(SIDEBAR_THEME)
const ColorModeContext = createContext({ mode: 'brown', toggleMode: () => {} })

export function useTheme()     { return useContext(ThemeContext) }
export function useColorMode() { return useContext(ColorModeContext) }

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem('tcs_color_mode')
    return stored === 'ivory' || stored === 'brown' ? stored : 'brown'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    localStorage.setItem('tcs_color_mode', mode)
  }, [mode])

  function toggleMode() {
    setMode(prev => prev === 'brown' ? 'ivory' : 'brown')
  }

  return (
    <ColorModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeContext.Provider value={SIDEBAR_THEME}>
        {children}
      </ThemeContext.Provider>
    </ColorModeContext.Provider>
  )
}
