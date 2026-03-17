import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Mail, Settings, GraduationCap, Bell
} from 'lucide-react'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/students', icon: Users,           label: 'Students'  },
  { to: '/emails',   icon: Mail,            label: 'Email Center' },
  { to: '/reminders',icon: Bell,            label: 'Reminders' },
  { to: '/settings', icon: Settings,        label: 'Settings'  },
]

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-navy-700/50 bg-navy-900/40 min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-navy-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center">
            <GraduationCap size={20} className="text-gold-400" />
          </div>
          <div>
            <p className="font-display font-semibold text-slate-100 text-sm leading-tight">Thesis</p>
            <p className="font-display text-gold-400/80 text-xs leading-tight italic">Coordination</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gold-500/15 text-gold-300 border border-gold-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-700/40'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-navy-700/50">
        <p className="text-xs text-navy-500 text-center">Thesis Tracker v1.0</p>
      </div>
    </aside>
  )
}
