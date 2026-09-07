import { useState, useEffect } from 'react'
import { useDept } from '../context/DeptContext'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle, CheckCircle2, GraduationCap, Mail, Bell,
  ArrowRight, RefreshCw, TrendingUp, Users, Clock,
  ClipboardList, Calendar, Activity
} from 'lucide-react'
import {
  getStudentsWithProgress, getSupervisorCheckins,
  getStudentCheckins, getRecentActivity, MILESTONES
} from '../lib/supabase'
import EmailModal from '../components/EmailModal'
import { formatDistanceToNow } from 'date-fns'

const ACTIVITY_ICONS = {
  email:     { icon: Mail,          color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  milestone: { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  checkin:   { icon: ClipboardList, color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  note:      { icon: Activity,      color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  reminder:  { icon: Bell,          color: 'text-orange-400',  bg: 'bg-orange-500/10'  },
}

function MinorStat({ icon: Icon, value, label, tint }) {
  return (
    <div className="flex items-center gap-3.5 px-6 first:pl-0 last:pr-0" style={{borderRight:'1px solid var(--hair)'}}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:`${tint}2e`, color:tint}}>
        <Icon size={18}/>
      </div>
      <div>
        <p className="font-display text-[28px] font-medium leading-none" style={{color:'var(--ink)'}}>{value}</p>
        <p className="text-[13px] font-medium mt-2 max-w-[110px] leading-tight" style={{color:'var(--ink-dim)'}}>{label}</p>
      </div>
    </div>
  )
}

// Ledger hero band — one headline figure + supporting stats, replaces the
// generic 5-identical-cards grid.
function Ledger({ needsAttention, completedThisWeek, pendingSupCheckins, nearCompletion, total, onNeedsAttention }) {
  return (
    <div className="relative rounded-[22px] p-8 mb-8 flex items-stretch overflow-hidden card"
      style={{boxShadow:'0 30px 55px -30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'}}>
      <div className="absolute w-[340px] h-[340px] rounded-full pointer-events-none"
        style={{left:-90, top:-140, background:'radial-gradient(circle, rgba(226,90,90,0.16), transparent 70%)'}}/>
      <button onClick={onNeedsAttention}
        className="text-left pr-9 mr-9 relative z-10 shrink-0" style={{borderRight:'1px solid var(--hair)'}}>
        <p className="font-display font-medium leading-none" style={{fontSize:60, color:'#e25a5a', filter:'drop-shadow(0 2px 18px rgba(226,90,90,0.3))'}}>
          {needsAttention}
        </p>
        <p className="text-[15px] font-semibold mt-3" style={{color:'var(--ink)'}}>Need attention</p>
        <p className="text-[12.5px] mt-0.5" style={{color:'var(--ink-dim)'}}>Overdue or flagged in check-ins</p>
      </button>
      <div className="flex-1 flex items-center justify-between relative z-10">
        <MinorStat icon={CheckCircle2}  value={completedThisWeek}  label="Completed this week"          tint="#5fa3a3"/>
        <MinorStat icon={Calendar}      value={pendingSupCheckins} label="Awaiting supervisor check-in"  tint="#e8bf5a"/>
        <MinorStat icon={GraduationCap} value={nearCompletion}     label="Near completion"               tint="#c7ae8a"/>
        <MinorStat icon={Users}         value={total}              label="Total students"                tint="#f0d080"/>
      </div>
    </div>
  )
}

// Circular progress ring — replaces the flat bar, one glance shows status.
function ProgressRing({ done, totalCount, flagged }) {
  const r = 18, circ = 2 * Math.PI * r
  const offset = circ - (totalCount ? done / totalCount : 0) * circ
  const stroke = flagged ? '#e25a5a' : done >= totalCount ? '#e8bf5a' : '#5fa3a3'
  return (
    <div className="relative w-[42px] h-[42px] shrink-0">
      <svg width="42" height="42" viewBox="0 0 42 42" style={{transform:'rotate(-90deg)'}}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--hair)" strokeWidth="3"/>
        <circle cx="21" cy="21" r={r} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{transition:'stroke-dashoffset 0.6s ease'}}/>
      </svg>
    </div>
  )
}

function CohortRing({ rate, label, count, onClick }) {
  const r = 28, circ = 2 * Math.PI * r
  const offset = circ - (rate / 100) * circ
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={onClick}
      title={`View ${label} students`}>
      <div className="relative w-20 h-20 transition-transform group-hover:scale-110">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--hair)" strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e8bf5a" strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{color:'var(--gold-accent)'}}>{rate}%</span>
        </div>
      </div>
      <p className="text-xs font-semibold" style={{color:'var(--ink-dim)'}}>{label}</p>
      <p className="text-xs" style={{color:'var(--ink-faint)'}}>{count} students</p>
      <p className="text-xs" style={{color:'var(--ink-faint)'}}>View →</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { effectiveDeptId, effectiveProgLevel, viewingDept, viewingLevel } = useDept() || {}
  const [students, setStudents]     = useState([])
  const [supCheckins, setSupCheckins] = useState([])
  const [stuCheckins, setStuCheckins] = useState([])
  const [activity, setActivity]     = useState([])
  const [impactData, setImpactData]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [emailStudent, setEmailStudent] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [s, sc, stc, act] = await Promise.all([
        getStudentsWithProgress(effectiveDeptId, effectiveProgLevel),
        getSupervisorCheckins(),
        getStudentCheckins(),
        getRecentActivity(12),
      ])
      setStudents(s); setSupCheckins(sc); setStuCheckins(stc); setActivity(act)

      try {
        const { supabase } = await import('../lib/supabase')
        let q = supabase.from('research_impact').select('id,student_id,status,submitted_at,supervisor_confirmed,has_publication,has_ip,has_industry_partner,has_public_events,has_policy_citation,has_commercialisation,no_impact,academic_year')
        if (effectiveDeptId) q = q.eq('department_id', effectiveDeptId)
        const { data: impacts } = await q.order('submitted_at', { ascending: false })
        setImpactData(impacts || [])
      } catch(e) { console.error(e) }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [effectiveDeptId, effectiveProgLevel, viewingDept, viewingLevel])

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

  const overdueItems = students
    .flatMap(s => (s.student_milestones||[])
      .filter(m=>m.status==='overdue')
      .map(m => ({ student: s, milestone: MILESTONES.find(x=>x.id===m.milestone_id), sm: m }))
    ).slice(0, 5)

  return (
    <div className="p-8 space-y-6 fade-in">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold" style={{color:'var(--ink)'}}>Dashboard</h1>
          <p className="mt-1" style={{color:'var(--ink-faint)'}}>
            {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw size={15} className={loading?'animate-spin':''} /> Refresh
        </button>
      </div>

      <Ledger
        needsAttention={needsAttention}
        completedThisWeek={completedThisWeek}
        pendingSupCheckins={pendingSupCheckins}
        nearCompletion={nearCompletion}
        total={students.length}
        onNeedsAttention={() => navigate('/students')}
      />

      {cohortStats.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-base font-semibold mb-5 flex items-center gap-2" style={{color:'var(--ink)'}}>
            <TrendingUp size={17} style={{color:'var(--gold-accent)'}} /> Cohort Progress
          </h2>
          <div className="flex items-center gap-12 flex-wrap">
            {cohortStats.map(c => (
              <CohortRing key={c.year} rate={c.rate} label={`${c.year} Cohort`} count={c.total}
                onClick={() => navigate({ pathname: '/students', search: `?cohort=${c.year}` })} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">

        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-base font-semibold" style={{color:'var(--ink)'}}>Students</h2>
            <Link to="/students" className="text-xs flex items-center gap-1" style={{color:'var(--gold-accent)'}}>
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i=><div key={i} className="h-16 rounded-xl shimmer" style={{background:'var(--card)'}}/>)}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12" style={{color:'var(--ink-faint)'}}>
              <Users size={32} className="mx-auto mb-3 opacity-40"/>
              <p className="text-sm">No students yet.</p>
              <Link to="/students" className="btn-primary mt-4 inline-flex"><Users size={14}/>Add Students</Link>
            </div>
          ) : (
            <div>
              {students.slice(0,8).map(student => {
                const milestones  = student.student_milestones || []
                const done        = milestones.filter(m=>m.status==='completed').length
                const hasOverdue  = milestones.some(m=>m.status==='overdue')
                const isStruggling = stuCheckins.find(c=>c.student_id===student.id&&c.overall_status==='struggling')
                const supUrgent   = supCheckins.find(c=>c.student_id===student.id&&c.engagement_status==='urgent')
                const flagged     = hasOverdue || isStruggling || supUrgent
                const currentMilestone = MILESTONES.find(m => !milestones.find(sm=>sm.milestone_id===m.id && sm.status==='completed'))

                return (
                  <div key={student.id}
                    className="rise-in flex items-center gap-4 p-3 -mx-3 rounded-xl transition-all group"
                    style={{background: flagged ? 'rgba(226,90,90,0.05)' : 'transparent'}}>
                    <ProgressRing done={done} totalCount={MILESTONES.length} flagged={flagged}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[15px] font-medium truncate" style={{color:'var(--ink)'}}>{student.name}</p>
                        {flagged && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{color:'#e25a5a', background:'rgba(226,90,90,0.15)', border:'1px solid rgba(226,90,90,0.3)'}}>overdue</span>}
                      </div>
                      <p className="text-[13px] truncate" style={{color:'var(--ink-dim)'}}>
                        {done >= MILESTONES.length
                          ? <>All milestones complete — <span style={{color:'var(--ink)'}}>thesis submitted</span></>
                          : <>{hasOverdue ? 'Stalled at' : 'In progress on'} <span style={{color:'var(--ink)'}}>{currentMilestone?.name}</span></>
                        }
                      </p>
                    </div>
                    <span className="font-display text-sm font-medium shrink-0" style={{color:'var(--ink-dim)'}}>{done}/{MILESTONES.length}</span>
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
                <Link to="/students" className="block text-center text-xs pt-3" style={{color:'var(--ink-faint)'}}>
                  +{students.length-8} more students →
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">

          <div className="card p-5">
            <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2" style={{color:'var(--ink)'}}>
              <AlertCircle size={15} className="text-red-400"/> Overdue Milestones
            </h2>
            {overdueItems.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400/70 text-sm">
                <CheckCircle2 size={15}/> All on track
              </div>
            ) : (
              <div className="space-y-1">
                {overdueItems.map(({student, milestone}, i) => (
                  <Link key={i} to={`/students/${student.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg transition-all group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{background:'rgba(226,90,90,0.10)', border:'1px solid rgba(226,90,90,0.2)'}}>
                      <span className="text-sm">{milestone?.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{color:'var(--ink)'}}>{student.name}</p>
                      <p className="text-xs truncate" style={{color:'var(--ink-dim)'}}>{milestone?.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2" style={{color:'var(--ink)'}}>
              <Clock size={15} style={{color:'var(--gold-accent)'}}/> Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm" style={{color:'var(--ink-faint)'}}>No recent activity.</p>
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
                        <p className="text-[13px] leading-relaxed line-clamp-2" style={{color:'var(--ink-dim)'}}>{a.description}</p>
                        <p className="text-xs mt-0.5" style={{color:'var(--ink-faint)'}}>
                          {a.students?.name && <span>{a.students.name} · </span>}
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
