import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentDetail from './pages/StudentDetail'
import EmailCenter from './pages/EmailCenter'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import SupervisorCheckins from './pages/SupervisorCheckins'
import SupervisorRespond from './pages/SupervisorRespond'
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
        <Route path="/supervisor-checkins" element={<Layout><SupervisorCheckins /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
      </Routes>
    </HashRouter>
  )
}
