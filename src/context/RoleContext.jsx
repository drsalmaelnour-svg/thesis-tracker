import { createContext, useContext } from 'react'
import { getRole, isAdmin, isCoordinator, isHOD, isDean, getDeptId } from '../lib/auth'

const RoleContext = createContext(null)

export function useRole() { return useContext(RoleContext) }

export function RoleProvider({ children, viewingDept }) {
  const role      = getRole()
  const deptId    = getDeptId()
  const admin     = isAdmin()
  const coord     = isCoordinator()
  const hod       = isHOD()
  const dean      = isDean()

  // What this role can do
  const can = {
    // Data scope
    seeAllDepts:     admin || dean,
    seeOwnDeptOnly:  coord || hod,
    effectiveDeptId: admin ? (viewingDept || null) : deptId,

    // Actions
    editStudents:    admin || coord,
    editMilestones:  admin || coord,
    editAssessments: admin || coord,
    sendEmails:      admin || coord,
    resolveCheckins: admin || coord,
    manageSettings:  admin,
    limitedSettings: coord, // deadlines + email templates only
    viewReports:     true,
    downloadReports: true,
    viewCheckins:    true,
    viewAssessments: true,
    viewAnalytics:   admin || coord || dean,

    // Sidebar items visible
    nav: {
      dashboard:   true,
      students:    true,
      checkins:    true,
      emailCenter: admin || coord,
      assessments: true,
      reports:     true,
      analytics:   admin || coord || dean,
      calendar:    admin || coord,
      deadlines:   admin || coord,
      settings:    admin || coord,
      reminders:   admin || coord,
    }
  }

  return (
    <RoleContext.Provider value={{ role, can, admin, coord, hod, dean }}>
      {children}
    </RoleContext.Provider>
  )
}
