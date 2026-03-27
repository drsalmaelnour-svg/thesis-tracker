import { HashRouter, Routes, Route } from 'react-router-dom'
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
import StudentCheckin from './pages/StudentCheckin'
import Respond from './pages/Respond'

function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public response route — no sidebar */}
        <Route path="/respond" element={<Respond />} />
        <Route path="/supervisor-respond" element={<SupervisorRespond />} />

        {/* App routes — with sidebar */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/students" element={<Layout><Students /></Layout>} />
        <Route path="/students/:id" element={<Layout><StudentDetail /></Layout>} />
        <Route path="/emails" element={<Layout><EmailCenter /></Layout>} />
        <Route path="/reminders" element={<Layout><Reminders /></Layout>} />
        <Route path="/reports"  element={<Layout><Reports /></Layout>} />
        <Route path="/checkins"   element={<Layout><Checkins /></Layout>} />
        <Route path="/analytics"  element={<Layout><Analytics /></Layout>} />
        <Route path="/calendar"   element={<Layout><CalendarPage /></Layout>} />
        <Route path="/deadlines"  element={<Layout><Deadlines /></Layout>} />
        <Route path="/assessments" element={<Layout><Assessments /></Layout>} />
        <Route path="/student-checkin" element={<StudentCheckin />} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
      </Routes>
    </HashRouter>
  )
}
