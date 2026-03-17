import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Edit2, Save, X, ExternalLink, Bell } from 'lucide-react'
import { getStudent, updateMilestoneStatus, MILESTONES } from '../lib/supabase'
import { MilestoneSteps } from '../components/MilestoneProgress'
import EmailModal from '../components/EmailModal'
import { sendReminder } from '../lib/emailService'

export default function StudentDetail() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEmail, setShowEmail] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [reminderStatus, setReminderStatus] = useState({})

  async function load() {
    try {
      const s = await getStudent(id)
      setStudent(s)
      setTitle(s.thesis_title || '')
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function handleMilestoneUpdate(milestoneId, status) {
    await updateMilestoneStatus(id, milestoneId, status)
    load()
  }

  async function handleSendReminder(milestoneId) {
    setReminderStatus(s => ({ ...s, [milestoneId]: 'sending' }))
    const res = await sendReminder({
      student,
      supervisor: student.supervisors,
      milestoneId,
    })
    setReminderStatus(s => ({ ...s, [milestoneId]: res.ok ? 'sent' : 'error' }))
    setTimeout(() => setReminderStatus(s => ({ ...s, [milestoneId]: null })), 3000)
  }

  if (loading) return (
    <div className="p-8">
      <div className="h-8 w-48 rounded-xl bg-navy-800/40 shimmer mb-6" />
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-navy-800/40 shimmer" />)}
      </div>
    </div>
  )

  if (!student) return (
    <div className="p-8 text-center text-navy-400">
      <p>Student not found.</p>
      <Link to="/students" className="btn-secondary mt-4 inline-flex">← Back</Link>
    </div>
  )

  const milestoneMap = Object.fromEntries(
    (student.student_milestones || []).map(sm => [sm.milestone_id, sm])
  )
  const done = (student.student_milestones || []).filter(m => m.status === 'completed').length
  const pendingMilestones = MILESTONES.filter(m => {
    const sm = milestoneMap[m.id]
    return !sm || sm.status === 'pending' || sm.status === 'in_progress' || sm.status === 'overdue'
  })

  return (
    <div className="p-8 space-y-6 fade-in">
      {/* Back + Header */}
      <div>
        <Link to="/students" className="flex items-center gap-2 text-navy-400 hover:text-gold-300 text-sm mb-4 transition-colors w-fit">
          <ArrowLeft size={15} /> Back to Students
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-navy-700 flex items-center justify-center text-2xl font-display font-bold text-gold-400">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold text-slate-100">{student.name}</h1>
              <p className="text-navy-400 text-sm mt-0.5">{student.email}</p>
              {student.student_id && <p className="text-navy-500 text-xs">ID: {student.student_id}</p>}
            </div>
          </div>
          <button onClick={() => setShowEmail(true)} className="btn-primary">
            <Mail size={15} /> Send Email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Milestones — main content */}
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-slate-100">Milestones</h2>
              <span className="text-sm text-navy-400">{done}/{MILESTONES.length} completed</span>
            </div>
            <div className="space-y-2">
              {MILESTONES.map((m, i) => {
                const sm = milestoneMap[m.id]
                const status = sm?.status || 'pending'
                const rStatus = reminderStatus[m.id]
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                      ${status === 'completed' ? 'border-emerald-700/30 bg-emerald-900/10' :
                        status === 'overdue'   ? 'border-red-700/30 bg-red-900/10' :
                        status === 'in_progress' ? 'border-blue-700/30 bg-blue-900/10' :
                        'border-navy-700/40 bg-navy-800/20'}`}
                  >
                    <span className="text-navy-500 text-xs w-4 shrink-0">{i + 1}</span>
                    <span className="text-base shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{m.name}</p>
                      {sm?.completed_at && (
                        <p className="text-xs text-navy-400">Completed {new Date(sm.completed_at).toLocaleDateString()}</p>
                      )}
                      {sm?.notes && <p className="text-xs text-navy-400 truncate">{sm.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Reminder button for pending milestones */}
                      {status !== 'completed' && (
                        <button
                          onClick={() => handleSendReminder(m.id)}
                          disabled={rStatus === 'sending'}
                          title="Send reminder"
                          className={`btn-ghost p-1.5 rounded-lg text-xs ${
                            rStatus === 'sent' ? 'text-emerald-400' :
                            rStatus === 'error' ? 'text-red-400' : ''
                          }`}
                        >
                          <Bell size={13} />
                          {rStatus === 'sending' && <span>…</span>}
                          {rStatus === 'sent' && <span>✓</span>}
                        </button>
                      )}
                      <select
                        value={status}
                        onChange={e => handleMilestoneUpdate(m.id, e.target.value)}
                        className="bg-navy-800 border border-navy-600/50 text-xs text-slate-300 rounded-lg px-2 py-1 outline-none cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Info card */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display font-semibold text-slate-100">Details</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Program', value: student.program },
                { label: 'Year', value: student.enrollment_year },
                { label: 'Supervisor', value: student.supervisors?.name },
                { label: 'Supervisor Email', value: student.supervisors?.email },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-xs text-navy-400">{label}</p>
                  <p className="text-slate-200">{value}</p>
                </div>
              ) : null)}
            </div>

            {/* Thesis title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-navy-400">Thesis Title</p>
                <button onClick={() => setEditTitle(!editTitle)} className="btn-ghost p-1 rounded-md">
                  {editTitle ? <X size={12} /> : <Edit2 size={12} />}
                </button>
              </div>
              {editTitle ? (
                <div className="flex gap-2">
                  <input
                    className="input text-xs flex-1"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  <button className="btn-primary px-2 py-1 text-xs" onClick={async () => {
                    const { supabase } = await import('../lib/supabase')
                    await supabase.from('students').update({ thesis_title: title }).eq('id', id)
                    setEditTitle(false)
                    load()
                  }}>
                    <Save size={11} />
                  </button>
                </div>
              ) : (
                <p className="text-slate-300 text-sm italic leading-relaxed">
                  {student.thesis_title || <span className="text-navy-500 not-italic">Not set</span>}
                </p>
              )}
            </div>
          </div>

          {/* Response link preview */}
          <div className="card p-5">
            <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <ExternalLink size={14} className="text-gold-400" /> Response Links
            </h3>
            <p className="text-xs text-navy-400 mb-3 leading-relaxed">
              These links are included in emails. When a student clicks one, it marks that milestone complete.
            </p>
            <div className="space-y-1">
              {pendingMilestones.slice(0, 3).map(m => (
                <div key={m.id} className="text-xs bg-navy-800/60 rounded-lg px-3 py-2 font-mono text-navy-400 truncate">
                  {m.icon} {m.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEmail && <EmailModal student={student} onClose={() => setShowEmail(false)} />}
    </div>
  )
}
