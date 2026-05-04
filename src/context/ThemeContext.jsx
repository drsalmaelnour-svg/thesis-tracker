import { createContext, useContext, useEffect, useState } from 'react'
import { getSession, isAdmin, getDeptId } from '../lib/auth'

// Default theme — MLS navy/gold
const DEFAULT_THEME = {
  primary: '#1e3a5f',
  accent:  '#d4a843',
  bg:      '#f1f5f9',
}

const DEPT_THEMES = {
  'Medical Laboratory Sciences': { primary:'#1e3a5f', accent:'#d4a843', bg:'#f1f5f9' },
  'Physiotherapy':               { primary:'#1a4731', accent:'#65a30d', bg:'#f0fdf4' },
  'Medical Imaging':             { primary:'#134e4a', accent:'#0891b2', bg:'#f0fdfa' },
  'Anaesthesia Technology':      { primary:'#312e81', accent:'#7c3aed', bg:'#eef2ff' },
  'Optometry':                   { primary:'#1e3a8a', accent:'#0284c7', bg:'#eff6ff' },
  'Audiology':                   { primary:'#431407', accent:'#d97706', bg:'#fffbeb' },
}

const ThemeContext = createContext(DEFAULT_THEME)

export function useTheme() { return useContext(ThemeContext) }

export function ThemeProvider({ children, viewingDept }) {
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const session = getSession()

  useEffect(() => {
    let t = DEFAULT_THEME

    if (viewingDept) {
      // Admin switched to a department view
      t = DEPT_THEMES[viewingDept] || DEFAULT_THEME
    } else if (!isAdmin() && session?.department?.name) {
      // Coordinator — use their department theme
      t = DEPT_THEMES[session.department.name] || DEFAULT_THEME
    }

    setTheme(t)

    // Apply CSS variables to :root
    document.documentElement.style.setProperty('--color-primary',  t.primary)
    document.documentElement.style.setProperty('--color-accent',   t.accent)
    document.documentElement.style.setProperty('--color-bg',       t.bg)

    // Derive lighter/darker shades
    document.documentElement.style.setProperty('--color-primary-hover',
      t.primary + 'ee')
    document.documentElement.style.setProperty('--color-accent-light',
      t.accent + '22')

    return () => {
      // Reset on unmount
      document.documentElement.style.removeProperty('--color-primary')
      document.documentElement.style.removeProperty('--color-accent')
      document.documentElement.style.removeProperty('--color-bg')
    }
  }, [viewingDept, session?.department?.name])

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

export { DEPT_THEMES }
