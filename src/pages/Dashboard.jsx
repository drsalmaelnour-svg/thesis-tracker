import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, CheckCircle2, GraduationCap, Mail, Bell,
  ArrowRight, RefreshCw, TrendingUp, Users, Clock,
  ClipboardList, Calendar, Activity
} from 'lucide-react'
import {
  getStudentsWithProgress, getSupervisorCheckins,
  getStudentCheckins, getRecentActivity, MILESTONES
} from '../lib/supabase'
import { MilestoneBar } from '../components/MilestoneProgress'
import EmailModal from '../components/EmailModal'
import { formatDistanceToNow } from 'date-fns'

const ACTIVITY_ICONS = {
  email:     { icon: Mail,          color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  milestone: { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  checkin:   { icon: ClipboardList, color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  note:      { icon: Activity,      color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  reminder:  { icon: Bell,          color: 'text-orange-400',  bg: 'bg-orange-500/10'  },
}

function ActionCard({ icon: Icon, label, value, sub, color, to, alert }) {
  const card = (
    <div className={`card p-5 hover:border-gold-500/30 transition-all group ${alert ? 'border-red-700/50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={18} />
        </div>
        {alert && <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />}
      </div>
      <p className={`text-3xl font-display font-bold ${alert && value > 0 ? 'text-red-300' : 'text-slate-100'}`}>{value}</p>
      <p className="text-xs font-medium text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-navy-500 mt-0.5">{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{card}</Link> : card
}

function CohortRing({ rate, label, count }) {
  const r = 28, circ = 2 * Math.PI * r
  const offset = circ - (rate / 100) * circ
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e3a5f" strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#d4a843" strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gold-300">{rate}%</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="text-xs text-navy-500">{count} students</p>
    </div>
  )
}

export default function Dashboard() {
  const [students, setStudents]     = useState([])
  const [supCheckins, setSupCheckins] = useState([])
  const [stuCheckins, setStuCheckins] = useState([])
  const [activity, setActivity]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [emailStudent, setEmailStudent] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [s, sc, stc, act] = await Promise.all([
        getStudentsWithProgress(),
        getSupervisorCheckins(),
        getStudentCheckins(),
        getRecentActivity(12),
      ])
      setStudents(s); setSupCheckins(sc); setStuCheckins(stc); setActivity(act)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const needsAttention = students.filter(s =>
    (s.student_milestones||[]).some(m=>m.status==='overdue') ||
    stuCheckins.find(c=>c.student_id===s.id&&c.overall_status==='struggling') ||
    supCheckins.find(c=>c.student_id===s.id&&c.engagement_status==='urgent')
  ).length

  const completedThisWeek = students.flatMap(s=>s.student_milestones||[])
    .filter(m => m.status==='completed' && m.completed_at &&
      new Date(m.completed_at) > new Date(Date.now() - 7*24*60*60*1000)
    ).length

  const pendingSupCheckins = students.filter(s =>
    !supCheckins.find(c=>c.student_id===s.id)
  ).length

  const nearCompletion = students.filter(s => {
    const done = (s.student_milestones||[]).filter(m=>m.status==='completed').length
    return done >= MILESTONES.length - 1 && done < MILESTONES.length
  }).length

  // ── Cohort snapshots ──────────────────────────────────────────────────────
  const cohortYears = [...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
  const cohortStats = cohortYears.map(year => {
    const cohortStudents = students.filter(s=>s.enrollment_year===year)
    const total = cohortStudents.length
    const totalDone = cohortStudents.reduce((acc,s) =>
      acc + (s.student_milestones||[]).filter(m=>m.status==='completed').length, 0)
    const maxPossible = total * MILESTONES.length
    return {
      year, total,
      rate: maxPossible ? Math.round((totalDone/maxPossible)*100) : 0
    }
  })

  // ── Upcoming (overdue) milestones ─────────────────────────────────────────
  const overdueItems = students
    .flatMap(s => (s.student_milestones||[])
      .filter(m=>m.status==='overdue')
      .map(m => ({ student: s, milestone: MILESTONES.find(x=>x.id===m.milestone_id), sm: m }))
    ).slice(0, 5)

  return (
    <div className="p-8 space-y-6 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-navy-400 mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw size={15} className={loading?'animate-spin':''} /> Refresh
        </button>
      </div>

      {/* Action stat cards */}
      <div className="grid grid-cols-5 gap-4">
        <ActionCard icon={AlertCircle}   label="Needs Attention"       value={needsAttention}     color="bg-red-500/10 text-red-400"     to="/students"  alert={needsAttention>0} />
        <ActionCard icon={CheckCircle2}  label="Completed This Week"   value={completedThisWeek}  color="bg-emerald-500/10 text-emerald-400" to="/students" />
        <ActionCard icon={ClipboardList} label="Awaiting Sup Check-in" value={pendingSupCheckins}  color="bg-amber-500/10 text-amber-400"  to="/checkins" />
        <ActionCard icon={GraduationCap} label="Near Completion"       value={nearCompletion}      color="bg-blue-500/10 text-blue-400"    to="/students" />
        <ActionCard icon={Users}         label="Total Students"        value={students.length}     color="bg-gold-500/10 text-gold-400"    to="/students" />
      </div>

      {/* Cohort snapshot */}
      {cohortStats.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-5 flex items-center gap-2">
            <TrendingUp size={17} className="text-gold-400" /> Cohort Progress
          </h2>
          <div className="flex items-center gap-12 flex-wrap">
            {cohortStats.map(c => (
              <CohortRing key={c.year} rate={c.rate} label={`${c.year} Cohort`} count={c.total} />
            ))}
            {cohortStats.length === 0 && (
              <p className="text-sm text-navy-500">No cohort data yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Main 3-column grid */}
      <div className="grid grid-cols-3 gap-6">

        {/* Student list — 2 cols */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-slate-100">Students</h2>
            <Link to="/students" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i=><div key={i} className="h-16 rounded-xl bg-navy-800/40 shimmer"/>)}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-navy-500">
              <Users size={32} className="mx-auto mb-3 opacity-40"/>
              <p className="text-sm">No students yet.</p>
              <Link to="/students" className="btn-primary mt-4 inline-flex"><Users size={14}/>Add Students</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {students.slice(0,8).map(student => {
                const milestones  = student.student_milestones || []
                const done        = milestones.filter(m=>m.status==='completed').length
                const hasOverdue  = milestones.some(m=>m.status==='overdue')
                const isStruggling = stuCheckins.find(c=>c.student_id===student.id&&c.overall_status==='struggling')
                const supUrgent   = supCheckins.find(c=>c.student_id===student.id&&c.engagement_status==='urgent')
                const flagged     = hasOverdue || isStruggling || supUrgent

                return (
                  <div key={student.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all group ${
                      flagged ? 'border-red-700/30 bg-red-900/5' : 'border-navy-700/20 hover:bg-navy-800/30'
                    }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                      flagged ? 'bg-red-900/40 text-red-300' : 'bg-navy-700 text-gold-400'
                    }`}>
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-200 truncate">{student.name}</p>
                        {flagged && <AlertCircle size={12} className="text-red-400 shrink-0"/>}
                        <span className="text-xs text-navy-500 shrink-0">{done}/{MILESTONES.length}</span>
                      </div>
                      <MilestoneBar studentMilestones={milestones}/>
                    </div>
                    {/* Quick actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setEmailStudent(student)}
                        className="btn-ghost p-1.5 rounded-lg" title="Send email">
                        <Mail size={13}/>
                      </button>
                      <Link to={`/students/${student.id}`} className="btn-ghost p-1.5 rounded-lg" title="View details">
                        <ArrowRight size={13}/>
                      </Link>
                    </div>
                  </div>
                )
              })}
              {students.length > 8 && (
                <Link to="/students" className="block text-center text-xs text-navy-400 hover:text-gold-400 pt-2">
                  +{students.length-8} more students →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Overdue alerts */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <AlertCircle size={15} className="text-red-400"/> Overdue Milestones
            </h2>
            {overdueItems.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400/70 text-sm">
                <CheckCircle2 size={15}/> All on track 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {overdueItems.map(({student, milestone}, i) => (
                  <Link key={i} to={`/students/${student.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-900/10 transition-all group">
                    <span className="text-sm">{milestone?.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate group-hover:text-red-300">{student.name}</p>
                      <p className="text-xs text-navy-500 truncate">{milestone?.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Clock size={15} className="text-gold-400"/> Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-navy-500">No recent activity.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {activity.map(a => {
                  const cfg = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.note
                  const Icon = cfg.icon
                  return (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                        <Icon size={12} className={cfg.color}/>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{a.description}</p>
                        <p className="text-xs text-navy-500 mt-0.5">
                          {a.students?.name && <span className="text-navy-400">{a.students.name} · </span>}
                          {formatDistanceToNow(new Date(a.created_at), {addSuffix:true})}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {emailStudent && <EmailModal student={emailStudent} onClose={() => setEmailStudent(null)}/>}
    </div>
  )
}
