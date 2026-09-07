import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isLoggedIn, isAdmin, getSession, getRole } from './lib/auth'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResearchImpact from './pages/ResearchImpact'
import Groups from './pages/Groups'
import SupervisorResearchImpact from './pages/SupervisorResearchImpact'
import ResetPassword from './pages/ResetPassword'
import { ThemeProvider } from './context/ThemeContext'
import { RoleProvider } from './context/RoleContext'
import { DeptProvider } from './context/DeptContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'
import EmailCenter from './pages/EmailCenter'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import SupervisorRespond from './pages/SupervisorRespond'
import Checkins from './pages/Checkins'
import Analytics from './pages/Analytics'
import CalendarPage from './pages/CalendarPage'
import Deadlines from './pages/Deadlines'
import Assessments from './pages/Assessments'
import ExaminerResponse from './pages/ExaminerResponse'
import ExaminerPortal from './pages/ExaminerPortal'
import StudentCheckin from './pages/StudentCheckin'
import Respond from './pages/Respond'

function Layout({ children, setViewingLevel, viewingLevel }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen">
      <Sidebar setViewingLevel={setViewingLevel} viewingLevel={viewingLevel}/>
      <main className="flex-1 overflow-y-auto">
        {children}
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
    </RoleProvider>
    </DeptProvider>
    </ThemeProvider>
    </HashRouter>
  )
}
