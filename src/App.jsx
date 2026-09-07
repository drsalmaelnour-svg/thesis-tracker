import { useState, Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isLoggedIn, isAdmin, getSession, getRole } from './lib/auth'
import { ThemeProvider } from './context/ThemeContext'
import { RoleProvider } from './context/RoleContext'
import { DeptProvider } from './context/DeptContext'
import Sidebar from './components/Sidebar'

const Login                     = lazy(() => import('./pages/Login'))
const ForgotPassword            = lazy(() => import('./pages/ForgotPassword'))
const ResearchImpact            = lazy(() => import('./pages/ResearchImpact'))
const Groups                    = lazy(() => import('./pages/Groups'))
const SupervisorResearchImpact  = lazy(() => import('./pages/SupervisorResearchImpact'))
const ResetPassword             = lazy(() => import('./pages/ResetPassword'))
const Dashboard                 = lazy(() => import('./pages/Dashboard'))
const Students                  = lazy(() => import('./pages/Students'))
const StudentDetail             = lazy(() => import('./pages/StudentDetail'))
const EmailCenter               = lazy(() => import('./pages/EmailCenter'))
const Reminders                 = lazy(() => import('./pages/Reminders'))
const Settings                  = lazy(() => import('./pages/Settings'))
const Reports                   = lazy(() => import('./pages/Reports'))
const SupervisorRespond         = lazy(() => import('./pages/SupervisorRespond'))
const Checkins                  = lazy(() => import('./pages/Checkins'))
const Analytics                 = lazy(() => import('./pages/Analytics'))
const CalendarPage              = lazy(() => import('./pages/CalendarPage'))
const Deadlines                 = lazy(() => import('./pages/Deadlines'))
const Assessments               = lazy(() => import('./pages/Assessments'))
const ExaminerResponse          = lazy(() => import('./pages/ExaminerResponse'))
const ExaminerPortal            = lazy(() => import('./pages/ExaminerPortal'))
const StudentCheckin            = lazy(() => import('./pages/StudentCheckin'))
const Respond                   = lazy(() => import('./pages/Respond'))

function PageLoader() {
  return (
    <div className="p-8">
      <div className="h-8 w-40 rounded-lg shimmer mb-6" style={{background:'var(--card)'}}/>
      <div className="h-32 rounded-2xl shimmer" style={{background:'var(--card)'}}/>
    </div>
  )
}

function Layout({ children, setViewingLevel, viewingLevel }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen">
      <Sidebar setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}/>
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader/>}>
          {children}
        </Suspense>
      </main>
    </div>
  )
}

function AuthGuard({ children }) {
  const location = useLocation()
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export default function App() {
  const [viewingLevel, setViewingLevel] = useState('All')

  return (
    <HashRouter>
    <ThemeProvider>
    <DeptProvider viewingLevel={viewingLevel}>
    <RoleProvider>
      <Suspense fallback={<PageLoader/>}>
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password"  element={<ForgotPassword />} />
        <Route path="/groups" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Groups /></Layout>} />
        <Route path="/research-impact"              element={<ResearchImpact />} />
        <Route path="/supervisor-research-impact"  element={<SupervisorResearchImpact />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        {/* Public response route — no sidebar */}
        <Route path="/respond" element={<Respond />} />
        <Route path="/supervisor-respond" element={<SupervisorRespond />} />

        {/* App routes — with sidebar */}
        <Route path="/" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Dashboard /></Layout>} />
        <Route path="/students" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Students /></Layout>} />
        <Route path="/students/:id" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><StudentDetail /></Layout>} />
        <Route path="/emails" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><EmailCenter /></Layout>} />
        <Route path="/reminders" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Reminders /></Layout>} />
        <Route path="/reports"  element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Reports /></Layout>} />
        <Route path="/checkins"   element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Checkins /></Layout>} />
        <Route path="/analytics"  element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Analytics /></Layout>} />
        <Route path="/calendar"   element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><CalendarPage /></Layout>} />
        <Route path="/deadlines"  element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Deadlines /></Layout>} />
        <Route path="/assessments"       element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Assessments /></Layout>} />
        <Route path="/examiner-response"  element={<ExaminerResponse />} />
        <Route path="/examiner-portal"    element={<ExaminerPortal />} />
        <Route path="/student-checkin" element={<StudentCheckin />} />
        <Route path="/settings" element={<Layout setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}><Settings /></Layout>} />
      </Routes>
      </Suspense>
    </RoleProvider>
    </DeptProvider>
    </ThemeProvider>
    </HashRouter>
  )
}
