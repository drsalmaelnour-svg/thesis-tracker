import { createContext, useContext, useEffect, useState } from 'react'
import { getSession, isAdmin } from '../lib/auth'

const DEFAULT_THEME = { primary: '#1e3a5f', accent: '#d4a843', bg: '#f1f5f9' }

const DEPT_THEMES = {
  'Medical Laboratory Sciences': { primary:'#1e3a5f', accent:'#d4a843', bg:'#f1f5f9' },
  'Physiotherapy':               { primary:'#1a4731', accent:'#65a30d', bg:'#f0fdf4' },
  'Medical Imaging':             { primary:'#134e4a', accent:'#0891b2', bg:'#f0fdfa' },
  'Anaesthesia Technology':      { primary:'#312e81', accent:'#7c3aed', bg:'#eef2ff' },
  'Optometry':                   { primary:'#1e3a8a', accent:'#0284c7', bg:'#eff6ff' },
  'Audiology':                   { primary:'#431407', accent:'#d97706', bg:'#fffbeb' },
}

const ThemeContext = createContext(DEFAULT_THEME)
const ColorModeContext = createContext({ mode:'dark', toggleMode:()=>{} })

export function useTheme()     { return useContext(ThemeContext) }
export function useColorMode() { return useContext(ColorModeContext) }

export function ThemeProvider({ children, viewingDept }) {
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [mode, setMode]   = useState(() => localStorage.getItem('tcs_color_mode') || 'dark')
  const session = getSession()

  // Apply data-theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    localStorage.setItem('tcs_color_mode', mode)
  }, [mode])

  useEffect(() => {
    let t = DEFAULT_THEME
    if (viewingDept) {
      t = DEPT_THEMES[viewingDept] || DEFAULT_THEME
    } else if (!isAdmin() && session?.department?.name) {
      t = DEPT_THEMES[session.department.name] || DEFAULT_THEME
    }
    setTheme(t)
  }, [viewingDept, session?.department?.name])

  function toggleMode() {
    setMode(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ColorModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeContext.Provider value={theme}>
        {children}
      </ThemeContext.Provider>
    </ColorModeContext.Provider>
  )
}
