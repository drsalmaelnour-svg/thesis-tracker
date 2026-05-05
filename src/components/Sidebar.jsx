import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Mail, Settings, GraduationCap,
  Bell, FileText, ClipboardList, TrendingUp, Calendar,
  Clock, Award, LogOut, Shield, ChevronDown
} from 'lucide-react'
import { logout, getSession, isAdmin, getDeptInfo, getRole, switchRole, getAvailableRoles } from '../lib/auth'
import { useTheme } from '../context/ThemeContext'
import { useRole } from '../context/RoleContext'

const ALL_NAV = [
  { to:'/',             icon:LayoutDashboard, label:'Dashboard',    key:'dashboard'   },
  { to:'/students',     icon:Users,           label:'Students',     key:'students'    },
  { to:'/checkins',     icon:ClipboardList,   label:'Check-ins',    key:'checkins'    },
  { to:'/emails',       icon:Mail,            label:'Email Center', key:'emailCenter' },
  { to:'/assessments',  icon:Award,           label:'Assessments',  key:'assessments' },
  { to:'/reports',      icon:FileText,        label:'Reports',      key:'reports'     },
  { to:'/analytics',    icon:TrendingUp,      label:'Analytics',    key:'analytics'   },
  { to:'/calendar',     icon:Calendar,        label:'Calendar',     key:'calendar'    },
  { to:'/deadlines',    icon:Clock,           label:'Deadlines',    key:'deadlines'   },
  { to:'/reminders',    icon:Bell,            label:'Reminders',    key:'reminders'   },
  { to:'/settings',     icon:Settings,        label:'Settings',     key:'settings'    },
]

export default function Sidebar({ setViewingDept, viewingDept, setViewingLevel, viewingLevel }) {
  const navigate  = useNavigate()
  const session   = getSession()
  const admin     = isAdmin()
  const dept      = getDeptInfo()
  const role      = getRole()
  const theme     = useTheme()
  const { can }   = useRole() || { can: { nav: {} } }
  const [depts, setDepts] = useState([])

  useEffect(() => {
    if (!admin && role !== 'dean') return
    import('../lib/supabase').then(({ supabase }) =>
      supabase.from('departments')
        .select('id,name,primary_color,accent_color,bg_color')
        .order('name')
        .then(({ data }) => setDepts(data || []))
    )
  }, [admin])

  const availableRoles = getAvailableRoles()
  const [switching, setSwitching] = useState(false)

  async function handleRoleSwitch(newRole) {
    setSwitching(true)
    await switchRole(newRole)
    window.location.reload() // reload to apply new role context
  }

  function handleLogout() { logout(); navigate('/login') }

  const navItems = ALL_NAV.filter(item => {
    if (!can?.nav) return true
    return can.nav[item.key] !== false
  })

  const sidebarBg     = theme?.primary || '#1e3a5f'
  const accentColor   = theme?.accent  || '#d4a843'
  const deptName      = admin ? (viewingDept || 'All Departments') : dept?.name || ''

  return (
    <aside className="w-64 shrink-0 flex flex-col min-h-screen"
      style={{background:sidebarBg, borderRight:'1px solid rgba(255,255,255,0.08)'}}>

      {/* Logo + dept name */}
      <div className="p-5 border-b" style={{borderColor:'rgba(255,255,255,0.08)'}}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{background:`${accentColor}22`, border:`1px solid ${accentColor}44`}}>
            <GraduationCap size={20} style={{color:accentColor}}/>
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">Thesis Coordinator</p>
            <p className="text-xs leading-tight" style={{color:`${accentColor}99`}}>Gulf Medical University</p>
          </div>
        </div>
        {/* Current dept / role badge */}
        <div className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={{background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)'}}>
          {admin
            ? <span className="flex items-center gap-1.5"><Shield size={11} style={{color:accentColor}}/> {viewingDept ? `Viewing: ${viewingDept}` : 'Super Admin'}</span>
            : <span>{deptName}</span>
          }
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon:Icon, label }) => (
          <NavLink key={to} to={to} end={to==='/'}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive?'active-nav':''}`}
            style={({ isActive }) => isActive
              ? { background:`${accentColor}22`, color:accentColor, border:`1px solid ${accentColor}44` }
              : { color:'rgba(255,255,255,0.6)', border:'1px solid transparent' }
            }>
            <Icon size={16}/>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Program level filter — admin and dean */}
      {(admin || role === 'dean') && (
        <div className="px-3 pb-2">
          <p className="text-xs px-2 mb-2 font-semibold uppercase tracking-wider"
            style={{color:'rgba(255,255,255,0.3)'}}>Program Level</p>
          <div className="flex gap-1">
            {['All','Postgraduate','Undergraduate'].map(l => (
              <button key={l} onClick={()=>setViewingLevel?.(l)}
                className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={viewingLevel===l
                  ? {background:`${accentColor}33`, color:accentColor, border:`1px solid ${accentColor}55`}
                  : {background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)'}
                }>
                {l==='All'?'All':l==='Postgraduate'?'PG':'UG'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Department list — admin and dean */}
      {(admin || role === 'dean') && depts.length > 0 && (
        <div className="px-3 pb-2 border-t" style={{borderColor:'rgba(255,255,255,0.08)', paddingTop:'12px'}}>
          <p className="text-xs px-2 mb-2 font-semibold uppercase tracking-wider"
            style={{color:'rgba(255,255,255,0.3)'}}>Departments</p>
          <button
            onClick={()=>setViewingDept?.(null)}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 mb-0.5"
            style={!viewingDept
              ? {background:'rgba(255,255,255,0.12)', color:'#fff'}
              : {color:'rgba(255,255,255,0.45)'}}>
            <span>👁</span> All Departments
          </button>
          {depts.map(d => (
            <button key={d.id}
              onClick={()=>setViewingDept?.(d.name)}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2"
              style={viewingDept===d.name
                ? {background:`${d.accent_color}22`, color:d.accent_color, border:`1px solid ${d.accent_color}44`}
                : {color:'rgba(255,255,255,0.45)', border:'1px solid transparent'}}>
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{background:d.accent_color||'#d4a843'}}/>
              <span className="truncate">{d.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* User info + logout */}
      <div className="p-3 border-t" style={{borderColor:'rgba(255,255,255,0.08)'}}>
        <div className="px-3 py-2 rounded-xl mb-1.5"
          style={{background:'rgba(255,255,255,0.06)'}}>
          <p className="text-xs font-semibold text-white truncate">
            {session?.user?.title} {session?.user?.name || 'Admin'}
          </p>
          <p className="text-xs truncate" style={{color:'rgba(255,255,255,0.4)'}}>
            {session?.user?.email || ''}
          </p>
          {availableRoles.length > 1 ? (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {availableRoles.map(r => (
                <button key={r} onClick={() => handleRoleSwitch(r)}
                  className="text-xs px-2 py-0.5 rounded-lg font-medium transition-all"
                  style={role===r
                    ? {background:`${accentColor}33`, color:accentColor, border:`1px solid ${accentColor}55`}
                    : {background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)'}
                  }>
                  {r}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block font-medium"
              style={{background:`${accentColor}22`, color:accentColor}}>
              {role || 'admin'}
            </span>
          )}
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
          style={{color:'rgba(255,255,255,0.4)'}}
          onMouseEnter={e=>{e.currentTarget.style.color='#f87171';e.currentTarget.style.background='rgba(248,113,113,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.4)';e.currentTarget.style.background='transparent'}}>
          <LogOut size={13}/> Sign Out
        </button>
      </div>

    </aside>
  )
}
