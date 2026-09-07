import { useState, useEffect } from 'react'
import { useDept } from '../context/DeptContext'
import { Link, useLocation } from 'react-router-dom'
import { UserPlus, Search, Mail, ArrowRight, Upload, Edit2, CheckSquare, Square, Loader2, Trash2, X } from 'lucide-react'
import { getStudentsWithProgress, updateMilestoneStatus, MILESTONES, logActivity } from '../lib/supabase'
import AddStudentModal from '../components/AddStudentModal'
import EmailModal from '../components/EmailModal'
import ImportModal from '../components/ImportModal'

const STATUS_LABELS = {
  all: 'All students',
  on_track: 'On track',
  overdue: 'Has overdue',
  complete: 'Complete',
}

function ProgressRing({ done, total, hasOverdue }) {
  const r = 15, circ = 2 * Math.PI * r
  const offset = circ - (total ? done / total : 0) * circ
  const stroke = hasOverdue ? 'var(--status-bad-fg)' : done >= total ? 'var(--gold-accent)' : 'var(--status-good-fg)'
  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36" style={{transform:'rotate(-90deg)'}}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--hair)" strokeWidth="2.5"/>
        <circle cx="18" cy="18" r={r} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{transition:'stroke-dashoffset 0.6s ease'}}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display" style={{fontSize:10, color:'var(--ink-faint)'}}>
        {done}/{total}
      </div>
    </div>
  )
}

export default function Students() {
  const { effectiveDeptId, effectiveProgLevel, viewingDept, viewingLevel } = useDept() || {}
  const location = useLocation()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [cohortFilter, setCohortFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const cohort = params.get('cohort')
    if (cohort) setCohortFilter(cohort)
    else setCohortFilter('all')
  }, [location.search])
  const [editStudent, setEditStudent] = useState(null)
  const [emailStudent, setEmailStudent] = useState(null)
  const [selected, setSelected] = useState([])
  const [bulkMilestone, setBulkMilestone] = useState('')
  const [bulkApplying, setBulkApplying] = useState(false)

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id])
  }
  function toggleAll() {
    setSelected(s => s.length === filtered.length ? [] : filtered.map(s=>s.id))
  }
  async function applyBulkMilestone() {
    if (!bulkMilestone || !selected.length) return
    setBulkApplying(true)
    const m = MILESTONES.find(x=>x.id===bulkMilestone)
    for (const studentId of selected) {
      await updateMilestoneStatus(studentId, bulkMilestone, 'completed')
      await logActivity(studentId, 'milestone', `Bulk update: "${m?.name}" marked as completed`)
    }
    setSelected([]); setBulkMilestone('')
    setBulkApplying(false)
    load()
  }

  async function load() {
    setLoading(true)
    try { setStudents(await getStudentsWithProgress(effectiveDeptId, effectiveProgLevel)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [effectiveDeptId, effectiveProgLevel, viewingDept, viewingLevel])

  const filtered = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_id || '').toLowerCase().includes(search.toLowerCase())

    const milestones = s.student_milestones || []
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'overdue' ? milestones.some(m => m.status === 'overdue') :
      filter === 'complete' ? milestones.filter(m => m.status === 'completed').length === MILESTONES.length :
      filter === 'on_track' ? !milestones.some(m => m.status === 'overdue') : true

    const matchesCohort = cohortFilter === 'all' || String(s.enrollment_year) === String(cohortFilter)

    return matchesSearch && matchesFilter && matchesCohort
  })

  return (
    <div className="p-8 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold" style={{color:'var(--ink)'}}>Students</h1>
          <p className="mt-1" style={{color:'var(--ink-faint)'}}>{students.length} enrolled students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <UserPlus size={15} /> Add Student
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--ink-faint)'}} />
          <input
            className="input pl-9"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input text-sm w-40"
          value={cohortFilter} onChange={e => setCohortFilter(e.target.value)}>
          <option value="all">All cohorts</option>
          {[...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
            .map(y => <option key={y} value={y}>{y} cohort</option>)}
        </select>

        <div className="flex gap-1">
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all btn-secondary ${
                filter === k ? '' : ''
              }`}
              style={filter === k
                ? {background:'var(--status-warn-bg)', borderColor:'var(--status-warn-brd)', color:'var(--gold-accent)'}
                : {}}
            >
              {label}
            </button>
          ))}
        </div>
        {cohortFilter !== 'all' && (
          <button onClick={() => setCohortFilter('all')}
            className="text-xs flex items-center gap-1 transition-colors" style={{color:'var(--ink-faint)'}}>
            <X size={12}/> Clear cohort
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl shimmer" style={{background:'var(--card)'}} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{color:'var(--ink-faint)'}}>
            <UserPlus size={32} className="mx-auto mb-3 opacity-40" />
            {search ? (
              <p className="text-sm">No students match your search.</p>
            ) : (
              <>
                <p className="text-sm font-medium" style={{color:'var(--ink-dim)'}}>Start your cohort</p>
                <p className="text-sm mt-1">Add students individually or import a class list.</p>
                <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 inline-flex">
                  <UserPlus size={14}/> Add your first student
                </button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{borderBottom:'1px solid var(--hair)'}}>
                <th className="p-4">
                  <button onClick={toggleAll} style={{color:'var(--ink-faint)'}}>
                    {selected.length === filtered.length && filtered.length > 0
                      ? <CheckSquare size={15} style={{color:'var(--gold-accent)'}}/>
                      : <Square size={15}/>
                    }
                  </button>
                </th>
                <th className="text-left p-4 text-xs font-medium tracking-wide" style={{color:'var(--ink-faint)'}}>Student</th>
                <th className="text-left p-4 text-xs font-medium tracking-wide" style={{color:'var(--ink-faint)'}}>Supervisor</th>
                <th className="text-left p-4 text-xs font-medium tracking-wide" style={{color:'var(--ink-faint)'}}>Progress</th>
                <th className="text-left p-4 text-xs font-medium tracking-wide" style={{color:'var(--ink-faint)'}}>Status</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, i) => {
                const milestones = student.student_milestones || []
                const done = milestones.filter(m => m.status === 'completed').length
                const hasOverdue = milestones.some(m => m.status === 'overdue')
                const isComplete = done === MILESTONES.length

                return (
                  <tr
                    key={student.id}
                    className="rise-in transition-all group"
                    style={{
                      borderBottom:'1px solid var(--hair)',
                      background: selected.includes(student.id) ? 'var(--status-warn-bg)' : 'transparent',
                      animationDelay: `${Math.min(i,8)*0.03}s`
                    }}
                  >
                    <td className="p-4">
                      <button onClick={()=>toggleSelect(student.id)} style={{color:'var(--ink-faint)'}}>
                        {selected.includes(student.id)
                          ? <CheckSquare size={15} style={{color:'var(--gold-accent)'}}/>
                          : <Square size={15}/>
                        }
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <ProgressRing done={done} total={MILESTONES.length} hasOverdue={hasOverdue}/>
                        <div>
                          <p className="text-sm font-medium" style={{color:'var(--ink)'}}>{student.name}</p>
                          <p className="text-xs" style={{color:'var(--ink-faint)'}}>{student.email}</p>
                          {student.student_id && (
                            <p className="text-xs" style={{color:'var(--ink-faint)'}}>ID: {student.student_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {student.supervisors ? (
                        <div>
                          <p className="text-sm" style={{color:'var(--ink-dim)'}}>{student.supervisors.name}</p>
                          <p className="text-xs" style={{color:'var(--ink-faint)'}}>{student.supervisors.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{color:'var(--ink-faint)'}}>Unassigned</span>
                      )}
                      {student.research_area && (
                        <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-lg"
                          style={{color:'var(--gold-accent)', background:'var(--status-warn-bg)', border:'1px solid var(--status-warn-brd)'}}>
                          {student.research_area}
                        </span>
                      )}
                    </td>
                    <td className="p-4 min-w-[140px]">
                      <p className="text-xs" style={{color:'var(--ink-faint)'}}>
                        {hasOverdue
                          ? <span className="tone-text-bad font-medium">Milestone overdue</span>
                          : isComplete
                          ? 'All milestones complete'
                          : `${MILESTONES.length - done} milestone${MILESTONES.length-done!==1?'s':''} remaining`
                        }
                      </p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        isComplete  ? 'badge-completed' :
                        hasOverdue  ? 'badge-overdue' :
                        done > 0    ? 'badge-progress' :
                        'badge-pending'
                      }`}>
                        {isComplete ? 'Complete' : hasOverdue ? 'Overdue' : done > 0 ? 'In progress' : 'Not started'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.preventDefault(); setEditStudent(student) }}
                          className="btn-ghost p-2 rounded-lg"
                          title="Edit student"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={e => { e.preventDefault(); setEmailStudent(student) }}
                          className="btn-ghost p-2 rounded-lg"
                          title="Send email"
                        >
                          <Mail size={14} />
                        </button>
                        <Link
                          to={`/students/${student.id}`}
                          className="btn-ghost p-2 rounded-lg"
                          title="View details"
                        >
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 card px-5 py-3 flex items-center gap-4 fade-in"
          style={{boxShadow:'0 30px 55px -25px rgba(0,0,0,0.5)', borderColor:'var(--status-warn-brd)'}}>
          <span className="text-sm font-medium" style={{color:'var(--gold-accent)'}}>{selected.length} student{selected.length!==1?'s':''} selected</span>
          <select className="input text-sm py-1.5 w-52"
            value={bulkMilestone} onChange={e=>setBulkMilestone(e.target.value)}>
            <option value="">— Mark milestone as complete —</option>
            {MILESTONES.map(m=><option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
          </select>
          <button onClick={applyBulkMilestone} disabled={bulkApplying||!bulkMilestone}
            className="btn-primary py-1.5 disabled:opacity-50">
            {bulkApplying?<Loader2 size={13} className="animate-spin"/>:<CheckSquare size={13}/>}
            {bulkApplying?'Applying…':'Apply'}
          </button>
          <button onClick={async()=>{
            if(!confirm(`Delete ${selected.length} student${selected.length!==1?'s':''}? This cannot be undone.`)) return
            const { supabase } = await import('../lib/supabase')
            await supabase.from('students').delete().in('id', selected)
            setSelected([]); load()
          }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tone-badge-bad transition-all">
            <Trash2 size={12}/> Delete Selected
          </button>
          <button onClick={()=>setSelected([])} className="btn-ghost py-1.5 text-xs">Clear</button>
        </div>
      )}

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onSuccess={load} />}
      {editStudent && <AddStudentModal student={editStudent} onClose={() => setEditStudent(null)} onSuccess={load} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={load} />}
      {emailStudent && <EmailModal student={emailStudent} onClose={() => setEmailStudent(null)} />}
    </div>
  )
}
