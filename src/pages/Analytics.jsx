import { useState, useEffect } from 'react'
import { TrendingUp, Users, CheckCircle2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react'
import { getStudentsWithProgress, getStudentCheckins, getSupervisorCheckins, MILESTONES, getCohortAnalytics } from '../lib/supabase'

function MilestoneBar({ label, rate, completed, total, icon }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-6 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-300 truncate">{label}</p>
          <span className="text-xs text-navy-400 shrink-0 ml-2">{completed}/{total} · {rate}%</span>
        </div>
        <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'text-gold-400', icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-navy-400 uppercase tracking-wider">{label}</p>
        {Icon && <Icon size={15} className={color} />}
      </div>
      <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-navy-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function Analytics() {
  const [students, setStudents]         = useState([])
  const [stuCheckins, setStuCheckins]   = useState([])
  const [supCheckins, setSupCheckins]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [cohortFilter, setCohortFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const [s, stc, suc] = await Promise.all([
        getStudentsWithProgress(),
        getStudentCheckins(),
        getSupervisorCheckins(),
      ])
      setStudents(s); setStuCheckins(stc); setSupCheckins(suc)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const cohortYears = [...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
  const analytics = getCohortAnalytics ? getCohortAnalytics(cohortFilter, students) : null

  const filtered = cohortFilter === 'all' ? students : students.filter(s=>String(s.enrollment_year)===String(cohortFilter))
  const total    = filtered.length
  const totalMilestones = total * MILESTONES.length
  const completedMilestones = filtered.reduce((acc,s)=>acc+(s.student_milestones||[]).filter(m=>m.status==='completed').length, 0)
  const overallRate = totalMilestones ? Math.round((completedMilestones/totalMilestones)*100) : 0

  const overdueCount   = filtered.filter(s=>(s.student_milestones||[]).some(m=>m.status==='overdue')).length
  const completeCount  = filtered.filter(s=>(s.student_milestones||[]).filter(m=>m.status==='completed').length===MILESTONES.length).length
  const notStarted     = filtered.filter(s=>!(s.student_milestones||[]).some(m=>m.status==='completed')).length

  const milestoneStats = MILESTONES.map(m => {
    const completed = filtered.filter(s=>(s.student_milestones||[]).find(sm=>sm.milestone_id===m.id&&sm.status==='completed')).length
    return { ...m, completed, rate: total ? Math.round((completed/total)*100) : 0 }
  })

  const stuCheckinFiltered = cohortFilter==='all' ? stuCheckins
    : stuCheckins.filter(c=>filtered.find(s=>s.id===c.student_id))
  const supCheckinFiltered = cohortFilter==='all' ? supCheckins
    : supCheckins.filter(c=>filtered.find(s=>s.id===c.student_id))

  const stuResponseRate  = total ? Math.round((new Set(stuCheckinFiltered.map(c=>c.student_id)).size/total)*100) : 0
  const supResponseRate  = total ? Math.round((new Set(supCheckinFiltered.map(c=>c.student_id)).size/total)*100) : 0
  const stuStruggling    = stuCheckinFiltered.filter(c=>c.overall_status==='struggling').length
  const supUrgent        = supCheckinFiltered.filter(c=>c.engagement_status==='urgent').length

  // Bottleneck — milestone with lowest completion rate
  const bottleneck = [...milestoneStats].filter(m=>m.completed>0).sort((a,b)=>a.rate-b.rate)[0]

  return (
    <div className="p-8 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Analytics</h1>
          <p className="text-navy-400 mt-1">Cohort-level insights and milestone performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select className="input text-sm appearance-none pr-7 py-2"
              value={cohortFilter} onChange={e=>setCohortFilter(e.target.value)}>
              <option value="all">All Cohorts</option>
              {cohortYears.map(y=><option key={y} value={y}>{y} Cohort</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
          </div>
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={15} className={loading?'animate-spin':''}/> Refresh
          </button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard icon={Users}        label="Students"           value={total}           color="text-gold-400" />
        <StatCard icon={TrendingUp}   label="Overall Completion" value={`${overallRate}%`} color="text-emerald-400" sub={`${completedMilestones}/${totalMilestones} milestones`} />
        <StatCard icon={CheckCircle2} label="Fully Complete"     value={completeCount}   color="text-emerald-400" />
        <StatCard icon={AlertCircle}  label="Has Overdue"        value={overdueCount}    color="text-red-400" />
        <StatCard icon={Users}        label="Not Started"        value={notStarted}      color="text-navy-400" />
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Milestone completion rates */}
        <div className="col-span-2 card p-6">
          <h2 className="font-display font-semibold text-slate-100 mb-5">Milestone Completion Rates</h2>
          {loading ? (
            <div className="space-y-4">{[1,2,3,4,5,6,7].map(i=><div key={i} className="h-8 rounded-xl bg-navy-800/40 shimmer"/>)}</div>
          ) : (
            <div className="space-y-4">
              {milestoneStats.map(m=>(
                <MilestoneBar key={m.id} label={m.name} rate={m.rate} completed={m.completed} total={total} icon={m.icon}/>
              ))}
            </div>
          )}
        </div>

        {/* Right stats */}
        <div className="space-y-4">

          {/* Check-in response rates */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 text-sm">Check-in Response Rates</h2>
            <div className="space-y-4">
              {[
                { label: 'Students', rate: stuResponseRate, color: 'bg-blue-500' },
                { label: 'Supervisors', rate: supResponseRate, color: 'bg-gold-500' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                    <span>{r.label}</span><span>{r.rate}%</span>
                  </div>
                  <div className="h-2.5 bg-navy-800 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color} rounded-full transition-all duration-700`}
                      style={{width:`${r.rate}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 text-sm">At Risk</h2>
            <div className="space-y-3">
              {[
                { label: 'Students struggling', value: stuStruggling, color: 'text-red-300' },
                { label: 'Supervisor urgent flags', value: supUrgent, color: 'text-red-300' },
                { label: 'Students with overdue', value: overdueCount, color: 'text-amber-300' },
              ].map(r=>(
                <div key={r.label} className="flex items-center justify-between">
                  <p className="text-xs text-navy-400">{r.label}</p>
                  <p className={`text-sm font-bold ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottleneck */}
          {bottleneck && (
            <div className="card p-5 border-amber-700/30 bg-amber-900/5">
              <h2 className="font-display font-semibold text-slate-100 mb-2 text-sm flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400"/> Bottleneck
              </h2>
              <p className="text-xs text-navy-400 mb-1">Lowest completion rate:</p>
              <p className="text-sm font-medium text-amber-300">{bottleneck.icon} {bottleneck.name}</p>
              <p className="text-xs text-navy-400 mt-1">{bottleneck.rate}% · {bottleneck.completed}/{total} students</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
