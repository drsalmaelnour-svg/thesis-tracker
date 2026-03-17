import { useState, useEffect } from 'react'
import { Bell, Zap, Clock, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react'
import { getStudentsWithProgress, MILESTONES } from '../lib/supabase'
import { sendReminder, sendBulkReminders } from '../lib/emailService'

export default function Reminders() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState({})
  const [bulkSending, setBulkSending] = useState(false)
  const [results, setResults] = useState([])
  const [selectedMilestone, setSelectedMilestone] = useState('')

  useEffect(() => {
    getStudentsWithProgress().then(setStudents).finally(() => setLoading(false))
  }, [])

  // Students missing a specific milestone (pending/overdue/in_progress)
  const studentsNeedingReminder = selectedMilestone
    ? students.filter(s => {
        const sm = (s.student_milestones || []).find(m => m.milestone_id === selectedMilestone)
        return !sm || ['pending', 'in_progress', 'overdue'].includes(sm.status)
      })
    : students.filter(s =>
        (s.student_milestones || []).some(m => m.status === 'overdue')
      )

  async function sendOne(student, milestoneId) {
    const key = `${student.id}-${milestoneId}`
    setSending(s => ({ ...s, [key]: 'sending' }))
    const res = await sendReminder({ student, supervisor: student.supervisors, milestoneId })
    setSending(s => ({ ...s, [key]: res.ok ? 'sent' : 'error' }))
    setTimeout(() => setSending(s => ({ ...s, [key]: null })), 4000)
  }

  async function sendBulk() {
    if (!selectedMilestone || !studentsNeedingReminder.length) return
    setBulkSending(true)
    setResults([])
    const res = await sendBulkReminders(studentsNeedingReminder, selectedMilestone)
    setResults(res)
    setBulkSending(false)
  }

  // Group students by their next pending milestone
  const grouped = MILESTONES.map(m => ({
    milestone: m,
    students: students.filter(s => {
      const sm = (s.student_milestones || []).find(x => x.milestone_id === m.id)
      return sm?.status === 'overdue' || sm?.status === 'pending'
    }),
  })).filter(g => g.students.length > 0)

  return (
    <div className="p-8 space-y-6 fade-in">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Reminders</h1>
        <p className="text-navy-400 mt-1">Send targeted reminders to students and supervisors</p>
      </div>

      {/* Bulk reminder panel */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display font-semibold text-slate-100 flex items-center gap-2">
              <Zap size={17} className="text-gold-400" /> Bulk Reminder
            </h2>
            <p className="text-xs text-navy-400 mt-1">
              Send a reminder to all students who haven't completed a specific milestone
            </p>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
            <select
              className="input"
              value={selectedMilestone}
              onChange={e => setSelectedMilestone(e.target.value)}
            >
              <option value="">— Overdue students (all milestones) —</option>
              {MILESTONES.map(m => (
                <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
              ))}
            </select>
          </div>
          <div className="pb-0.5">
            <p className="text-xs text-navy-400 mb-1.5">Recipients</p>
            <p className="text-sm font-semibold text-gold-300">
              {studentsNeedingReminder.length} student{studentsNeedingReminder.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={sendBulk}
            disabled={bulkSending || !studentsNeedingReminder.length || (!selectedMilestone && studentsNeedingReminder.length === 0)}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkSending
              ? <><Loader2 size={15} className="animate-spin" /> Sending…</>
              : <><Play size={15} /> Send Bulk Reminder</>
            }
          </button>
        </div>

        {/* Bulk results */}
        {results.length > 0 && (
          <div className="mt-4 border-t border-navy-700/50 pt-4">
            <p className="text-xs text-navy-400 mb-2 font-medium">Results:</p>
            <div className="flex flex-wrap gap-2">
              {results.map(r => (
                <span
                  key={r.student}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                    r.ok
                      ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                      : 'bg-red-900/20 border-red-700/40 text-red-300'
                  }`}
                >
                  {r.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  {r.student}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-student per-milestone reminders */}
      <div className="card p-5">
        <h2 className="font-display font-semibold text-slate-100 mb-5 flex items-center gap-2">
          <Bell size={17} className="text-gold-400" /> Manual Reminders by Milestone
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-navy-800/40 shimmer" />)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-navy-500">
            <CheckCircle2 size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">All students are up to date — no reminders needed 🎉</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ milestone, students: mStudents }) => (
              <div key={milestone.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{milestone.icon}</span>
                  <h3 className="font-medium text-slate-200 text-sm">{milestone.name}</h3>
                  <span className="text-xs text-navy-400 bg-navy-800/60 px-2 py-0.5 rounded-lg">
                    {mStudents.length} student{mStudents.length !== 1 ? 's' : ''} pending
                  </span>
                </div>
                <div className="space-y-2 ml-7">
                  {mStudents.map(student => {
                    const key = `${student.id}-${milestone.id}`
                    const st = sending[key]
                    const sm = (student.student_milestones || []).find(x => x.milestone_id === milestone.id)
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-navy-800/30 border border-navy-700/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-semibold text-gold-400 shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{student.name}</p>
                            <p className="text-xs text-navy-400">{student.email}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg text-xs border ${
                            sm?.status === 'overdue'     ? 'badge-overdue' :
                            sm?.status === 'in_progress' ? 'badge-progress' :
                            'badge-pending'
                          }`}>
                            {sm?.status || 'pending'}
                          </span>
                        </div>
                        <button
                          onClick={() => sendOne(student, milestone.id)}
                          disabled={st === 'sending'}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            st === 'sent'
                              ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                              : st === 'error'
                              ? 'bg-red-900/20 border-red-700/40 text-red-300'
                              : 'btn-secondary'
                          }`}
                        >
                          {st === 'sending' && <Loader2 size={11} className="animate-spin" />}
                          {st === 'sent'    && <CheckCircle2 size={11} />}
                          {st === 'error'   && <AlertCircle size={11} />}
                          {!st             && <Bell size={11} />}
                          {st === 'sent' ? 'Sent!' : st === 'error' ? 'Failed' : st === 'sending' ? 'Sending…' : 'Remind'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
