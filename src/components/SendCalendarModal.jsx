import { useState, useMemo } from 'react'
import { X, Send, Loader2, GraduationCap, Users as UsersIcon } from 'lucide-react'
import { sendStudentEmail, sendSupervisorEmail } from '../lib/emailService'
import { logEmail } from '../lib/supabase'

function buildCalendarText(events) {
  const sorted = [...events].sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
  return sorted.map(e =>
    `📅 ${new Date(e.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} — ${e.title}${e.description ? `\n   ${e.description}` : ''}`
  ).join('\n\n')
}

function defaultBody(cohortYear, calendarText) {
  return `Please find below the thesis program calendar for the ${cohortYear} cohort.\n\n${calendarText}\n\nPlease note these dates and ensure the relevant milestones are tracked accordingly.\n\nFor any questions, please do not hesitate to contact the thesis coordination office.`
}

// One row per unique supervisor, carrying the cohort students they supervise
// (used both for the recipient count and as context when sending the email).
function uniqueSupervisors(students) {
  const map = new Map()
  for (const s of students) {
    const sup = s.supervisors
    if (!sup?.email) continue
    if (!map.has(sup.id)) map.set(sup.id, { ...sup, students: [s] })
    else map.get(sup.id).students.push(s)
  }
  return [...map.values()]
}

export default function SendCalendarModal({ events, students, cohortYear, onClose }) {
  const calendarText = useMemo(() => buildCalendarText(events), [events])
  const studentRecipients = useMemo(() => students.filter(s => s.email), [students])
  const supervisorRecipients = useMemo(() => uniqueSupervisors(students), [students])

  const [sendToStudents, setSendToStudents]       = useState(true)
  const [sendToSupervisors, setSendToSupervisors] = useState(false)
  const [subject, setSubject] = useState(`${cohortYear} Cohort — Thesis Academic Calendar`)
  const [body, setBody]       = useState(defaultBody(cohortYear, calendarText))
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState(null)

  const noRecipientsSelected = !sendToStudents && !sendToSupervisors

  async function handleSend() {
    if (!subject.trim() || !body.trim() || noRecipientsSelected) return
    setSending(true); setResult(null)
    let sentStudents = 0, sentSupervisors = 0
    const failures = []

    try {
      if (sendToStudents) {
        for (const student of studentRecipients) {
          const res = await sendStudentEmail({ student, milestoneId: null, subject, message: body })
          if (res.ok) {
            sentStudents++
            logEmail({ studentId: student.id, recipientType: 'student', subject, template: 'calendar_broadcast', milestoneId: null }).catch(() => {})
          } else {
            failures.push(student.name)
          }
          await new Promise(r => setTimeout(r, 350))
        }
      }
      if (sendToSupervisors) {
        for (const sup of supervisorRecipients) {
          const res = await sendSupervisorEmail({ supervisor: sup, student: sup.students[0], milestoneId: null, subject, message: body })
          if (res.ok) {
            sentSupervisors++
            logEmail({ studentId: sup.students[0].id, recipientType: 'supervisor', subject, template: 'calendar_broadcast', milestoneId: null }).catch(() => {})
          } else {
            failures.push(sup.name)
          }
          await new Promise(r => setTimeout(r, 350))
        }
      }

      const parts = []
      if (sendToStudents) parts.push(`${sentStudents} student${sentStudents !== 1 ? 's' : ''}`)
      if (sendToSupervisors) parts.push(`${sentSupervisors} supervisor${sentSupervisors !== 1 ? 's' : ''}`)
      const okMsg = `Calendar sent to ${parts.join(' and ')} in the ${cohortYear} cohort.`
      setResult({
        ok: failures.length === 0,
        msg: failures.length === 0 ? okMsg : `${okMsg} Failed for: ${failures.join(', ')}.`,
      })
    } catch (e) {
      setResult({ ok: false, msg: String(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl fade-in shadow-2xl border-navy-600/60">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Send Calendar</h3>
            <p className="text-xs text-navy-400 mt-0.5">{cohortYear} Cohort</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recipient groups */}
          <div>
            <label className="block text-xs text-navy-400 mb-1.5">Send to</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSendToStudents(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  sendToStudents ? 'bg-gold-500/15 border-gold-500/40 text-gold-300' : 'border-navy-600/50 text-navy-400 hover:text-slate-300'
                }`}>
                <GraduationCap size={14} /> Students
                <span className="text-navy-500">({studentRecipients.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSendToSupervisors(v => !v)}
                disabled={supervisorRecipients.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  sendToSupervisors ? 'bg-gold-500/15 border-gold-500/40 text-gold-300' : 'border-navy-600/50 text-navy-400 hover:text-slate-300'
                }`}>
                <UsersIcon size={14} /> Supervisors
                <span className="text-navy-500">({supervisorRecipients.length})</span>
              </button>
            </div>
            {supervisorRecipients.length === 0 && (
              <p className="text-xs text-navy-500 mt-1.5">No supervisors with an email on file for this cohort.</p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs text-navy-400 mb-1.5">Subject</label>
            <input
              className="input"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs text-navy-400 mb-1.5">Message</label>
            <textarea
              className="input resize-none h-64 leading-relaxed font-mono text-xs"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body…"
            />
            <p className="text-xs text-navy-500 mt-1">
              Pre-filled with the current calendar — edit freely before sending.
            </p>
          </div>

          {/* Result */}
          {result && (
            <div className={`p-3 rounded-xl text-sm border ${
              result.ok
                ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                : 'bg-red-900/20 border-red-700/40 text-red-300'
            }`}>
              {result.msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-navy-700/50">
          <button onClick={onClose} className="btn-secondary">{result ? 'Close' : 'Cancel'}</button>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim() || noRecipientsSelected}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Sending…' : 'Send Calendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
