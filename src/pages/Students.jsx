import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Search, Mail, ArrowRight, Upload } from 'lucide-react'
import { getStudentsWithProgress, MILESTONES } from '../lib/supabase'
import { MilestoneBar } from '../components/MilestoneProgress'
import AddStudentModal from '../components/AddStudentModal'
import EmailModal from '../components/EmailModal'
import ImportModal from '../components/ImportModal'

const STATUS_LABELS = {
  all: 'All Students',
  on_track: 'On Track',
  overdue: 'Has Overdue',
  complete: 'Complete',
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [emailStudent, setEmailStudent] = useState(null)

  async function load() {
    setLoading(true)
    try { setStudents(await getStudentsWithProgress()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_id || '').toLowerCase().includes(search.toLowerCase())

    const milestones = s.student_milestones || []
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'overdue' ? milestones.some(m => m.status === 'overdue') :
      filter === 'complete' ? milestones.filter(m => m.status === 'completed').length === MILESTONES.length :
      filter === 'on_track' ? !milestones.some(m => m.status === 'overdue')

    return matchesSearch && matchesFilter
  })

  return (
    <div className="p-8 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Students</h1>
          <p className="text-navy-400 mt-1">{students.length} enrolled students</p>
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

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            className="input pl-9"
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                filter === k
                  ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
                  : 'border-navy-600/50 text-navy-400 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-navy-800/40 shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-navy-500">
            <UserPlus size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {search ? 'No students match your search.' : 'No students yet. Add your first one!'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="text-left p-4 text-xs font-medium text-navy-400 uppercase tracking-wider">Student</th>
                <th className="text-left p-4 text-xs font-medium text-navy-400 uppercase tracking-wider">Supervisor</th>
                <th className="text-left p-4 text-xs font-medium text-navy-400 uppercase tracking-wider">Progress</th>
                <th className="text-left p-4 text-xs font-medium text-navy-400 uppercase tracking-wider">Status</th>
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
                    className="border-b border-navy-700/30 hover:bg-navy-800/30 transition-all group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-semibold text-gold-400 shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{student.name}</p>
                          <p className="text-xs text-navy-400">{student.email}</p>
                          {student.student_id && (
                            <p className="text-xs text-navy-500">ID: {student.student_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {student.supervisors ? (
                        <div>
                          <p className="text-sm text-slate-300">{student.supervisors.name}</p>
                          <p className="text-xs text-navy-400">{student.supervisors.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-navy-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-4 min-w-[180px]">
                      <MilestoneBar studentMilestones={milestones} />
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        isComplete  ? 'badge-completed' :
                        hasOverdue  ? 'badge-overdue' :
                        done > 0    ? 'badge-progress' :
                        'badge-pending'
                      }`}>
                        {isComplete ? '🎓 Complete' : hasOverdue ? '⚠ Overdue' : done > 0 ? '→ In Progress' : 'Not Started'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onSuccess={load} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={load} />}
      {emailStudent && <EmailModal student={emailStudent} onClose={() => setEmailStudent(null)} />}
    </div>
  )
}
