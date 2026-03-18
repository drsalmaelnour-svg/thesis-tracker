import { useState, useEffect } from 'react'
import { Calendar, Save, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import { getStudentsWithProgress, getCohortDeadlines, upsertCohortDeadline, MILESTONES } from '../lib/supabase'

export default function Deadlines() {
  const [students, setStudents]         = useState([])
  const [cohortYears, setCohortYears]   = useState([])
  const [activeCohort, setActiveCohort] = useState(null)
  const [deadlines, setDeadlines]       = useState({})
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(null)
  const [saved, setSaved]               = useState(null)

  useEffect(() => {
    getStudentsWithProgress().then(s => {
      setStudents(s)
      const years = [...new Set(s.map(x=>x.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
      setCohortYears(years)
      if (years.length) setActiveCohort(years[0])
    })
  }, [])

  useEffect(() => {
    if (!activeCohort) return
    setLoading(true)
    getCohortDeadlines(activeCohort).then(d => {
      const map = {}
      for (const item of d) map[item.milestone_id] = item.due_date
      setDeadlines(map)
      setLoading(false)
    })
  }, [activeCohort])

  function setDate(milestoneId, date) {
    setDeadlines(prev => ({ ...prev, [milestoneId]: date }))
  }

  async function saveMilestone(milestoneId) {
    const date = deadlines[milestoneId]
    if (!date) return
    setSaving(milestoneId)
    await upsertCohortDeadline(activeCohort, milestoneId, date)
    setSaving(null); setSaved(milestoneId)
    setTimeout(()=>setSaved(null), 3000)
  }

  async function saveAll() {
    setSaving('all')
    for (const m of MILESTONES) {
      if (deadlines[m.id]) await upsertCohortDeadline(activeCohort, m.id, deadlines[m.id])
    }
    setSaving(null); setSaved('all')
    setTimeout(()=>setSaved(null), 3000)
  }

  const cohortStudents = activeCohort ? students.filter(s=>s.enrollment_year===activeCohort) : []

  return (
    <div className="p-8 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Deadlines</h1>
          <p className="text-navy-400 mt-1">Set milestone deadlines per cohort — students can have individual overrides</p>
        </div>
        <button onClick={saveAll} disabled={saving==='all' || !activeCohort}
          className="btn-primary disabled:opacity-50">
          {saving==='all' ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
          {saving==='all' ? 'Saving all…' : 'Save All'}
        </button>
      </div>

      {/* Cohort tabs */}
      <div className="flex gap-1 border-b border-navy-700/50">
        {cohortYears.map(year=>(
          <button key={year} onClick={()=>setActiveCohort(year)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeCohort===year ? 'border-gold-500 text-gold-300' : 'border-transparent text-navy-400 hover:text-slate-300'
            }`}>
            {year} Cohort
            <span className="ml-2 text-xs text-navy-500">({students.filter(s=>s.enrollment_year===year).length} students)</span>
          </button>
        ))}
      </div>

      {saved==='all' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
          <CheckCircle2 size={15}/> All deadlines saved for {activeCohort} cohort
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-5">
            {activeCohort} Cohort — Milestone Deadlines
          </h2>
          <p className="text-xs text-navy-400 mb-5 leading-relaxed">
            These dates apply to all {cohortStudents.length} students in this cohort.
            You can override individual student deadlines from their detail page.
          </p>

          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-14 rounded-xl bg-navy-800/40 shimmer"/>)}</div>
          ) : (
            <div className="space-y-3">
              {MILESTONES.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-navy-800/20 border border-navy-700/30">
                  <span className="text-base shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{m.name}</p>
                  </div>
                  <input type="date" className="input text-xs py-1.5 w-36 shrink-0"
                    value={deadlines[m.id] || ''}
                    onChange={e=>setDate(m.id, e.target.value)}/>
                  <button onClick={()=>saveMilestone(m.id)}
                    disabled={saving===m.id || !deadlines[m.id]}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      saved===m.id ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'btn-secondary'
                    } disabled:opacity-40`}>
                    {saving===m.id ? <Loader2 size={11} className="animate-spin"/> :
                     saved===m.id  ? <CheckCircle2 size={11}/> : <Save size={11}/>}
                    {saved===m.id ? 'Saved!' : 'Save'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-3 text-sm flex items-center gap-2">
              <Calendar size={14} className="text-gold-400"/> How Deadlines Work
            </h3>
            <div className="space-y-3 text-xs text-navy-400 leading-relaxed">
              <p>1. Set cohort-level deadlines here — they apply to all students in the cohort by default.</p>
              <p>2. To set a different deadline for a specific student, go to their detail page → <strong className="text-slate-300">Deadlines tab</strong> → set a custom override.</p>
              <p>3. Once a deadline passes and the milestone is not completed, you can mark it as <strong className="text-red-400">Overdue</strong> manually or the system will flag it.</p>
              <p>4. Deadlines show on each student's milestone card so you always know what's due.</p>
            </div>
          </div>

          {/* Students in this cohort */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-3 text-sm">
              Students in {activeCohort} Cohort ({cohortStudents.length})
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {cohortStudents.map(s => {
                const done = (s.student_milestones||[]).filter(m=>m.status==='completed').length
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{s.name}</span>
                    <span className="text-navy-400 font-mono">{done}/{MILESTONES.length}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
