import { createContext, useContext } from 'react'
import { getDeptId, getRole } from '../lib/auth'

const DeptContext = createContext(null)

export function useDept() { return useContext(DeptContext) }

export function DeptProvider({ children, viewingDept, departments }) {
  const role  = getRole()
  const admin = role === 'admin'
  const dean  = role === 'dean'
  let effectiveDeptId = null

  if (!admin && !dean) {
    effectiveDeptId = getDeptId()
  } else if (admin && viewingDept && departments?.length) {
    const d = departments.find(x => x.name === viewingDept)
    effectiveDeptId = d?.id || null
  }

  return (
    <DeptContext.Provider value={{ effectiveDeptId, viewingDept, isFiltered: !!effectiveDeptId }}>
      {children}
    </DeptContext.Provider>
  )
}
