import { createContext, useContext } from 'react'
import { getDeptId, getRole } from '../lib/auth'

const DeptContext = createContext(null)

export function useDept() { return useContext(DeptContext) }

export function DeptProvider({ children, viewingDept, viewingLevel, departments }) {
  const role  = getRole()
  const admin = role === 'admin'
  const dean  = role === 'dean'
  let effectiveDeptId    = null
  let effectiveProgLevel = null

  if (!admin && !dean) {
    // Coordinator/HOD — always their own dept and level
    effectiveDeptId    = getDeptId()
    try {
      const session = JSON.parse(localStorage.getItem('gmu_session') || '{}')
      if (session.program_level && session.program_level !== 'Both') {
        effectiveProgLevel = session.program_level
      }
    } catch { /* ignore */ }
  } else if (admin && viewingDept && departments?.length) {
    const d = departments.find(x => x.name === viewingDept)
    effectiveDeptId = d?.id || null
  }

  // Admin can filter by program level via viewingLevel
  if (admin && viewingLevel && viewingLevel !== 'All') {
    effectiveProgLevel = viewingLevel
  }

  return (
    <DeptContext.Provider value={{ effectiveDeptId, effectiveProgLevel, viewingDept, viewingLevel, isFiltered: !!effectiveDeptId }}>
      {children}
    </DeptContext.Provider>
  )
}
