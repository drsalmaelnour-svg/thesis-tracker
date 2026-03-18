import { useState, useEffect } from 'react'
import { Mail, Send, Clock, Loader2, ChevronDown, Users } from 'lucide-react'
import { getStudentsWithProgress, getEmailLog, logEmail, MILESTONES, getEmailTemplates } from '../lib/supabase'
import { sendStudentEmail, sendSupervisorEmail, sendBulkReminders } from '../lib/emailService'
import { EMAIL_TEMPLATES } from '../lib/emailTemplates'
import { formatDistanceToNow } from 'date-fns'

export default function EmailCenter() {
  const [students, setStudents] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)

  // Compose state
  const [recipientType, setRecipientType] = useState('selected')
  const [selectedStudents, setSelectedStudents] = useState([])
  const [filterMilestone, setFilterMilestone] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [templateKey, setTemplateKey] = useState('')
  const [milestoneId, setMilestoneId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  const [mergedTemplates, setMergedTemplates] = useState(EMAIL_TEMPLATES)

  useEffect(() => {
    // Load DB template overrides first
    getEmailTemplates().then(dbTemplates => {
      if (dbTemplates.length > 0) {
        const merged = { ...EMAIL_TEMPLATES }
        for (const t of dbTemplates) {
          if (merged[t.template_key]) {
            merged[t.template_key] = {
              ...merged[t.template_key],
              subject: t.subject,
              body: t.body,
            }
          }
        }
        setMergedTemplates(merged)
      }
    }).catch(e => console.error('Failed to load DB templates:', e))

    // Load students and email log
    Promise.all([
      getStudentsWithProgress().then(setStudents),
      getEmailLog().then(setLog),
    ]).finally(() => setLoading(false))
  }, [])

  // Smart recipient filtering
  const autoRecipients = filterMilestone
    ? students.filter(s => {
        const sm = (s.student_milestones || []).find(m => m.milestone_id === filterMilestone)
        return filterStatus === 'all' ? true : (sm?.status || 'pending') === filterStatus
      })
    : students

  const recipients = recipientType === 'auto' ? autoRecipients : students.filter(s => selectedStudents.includes(s.id))

  function applyTemplate(key) {
    setTemplateKey(key)
    const tpl = mergedTemplates[key]
    if (!tpl) return
    setSubject(tpl.subject.replace(/{{student_name}}/g, '[Student Name]'))
    setBody(tpl.body.replace(/{{student_name}}/g, '[Student Name]').replace(/{{response_link}}/g, '[Response link]').replace(/{{due_date}}/g, 'the required date'))
  }

  async function handleBulkSend() {
    if (!recipients.length || !subject || !body) return
    setSending(true)
    setSendResult(null)
    let sent = 0, failed = 0
    for (const student of recipients) {
      const res = await sendStudentEmail({ student, milestoneId, subject: subject.replace(/\[Student Name\]/g, student.name), message: body.replace(/\[Student Name\]/g, student.name) })
      if (res.ok) {
        sent++
        await logEmail({ studentId: student.id, recipientType: 'student', subject, template: templateKey, milestoneId })
      } else {
        failed++
      }
      await new Promise(r => setTimeout(r, 300))
    }
    setSendResult({ sent, failed })
    setSending(false)
    getEmailLog().then(setLog)
  }

  return (
    <div className="p-8 space-y-6 fade-in">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Email Center</h1>
        <p className="text-navy-400 mt-1">Send individual or bulk emails to students and supervisors</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Compose panel */}
        <div className="col-span-3 card p-6 space-y-5">
          <h2 className="font-display font-semibold text-slate-100">Compose</h2>

          {/* Recipient mode */}
          <div>
            <label className="block text-xs text-navy-400 mb-2">Recipients</label>
            <div className="flex gap-2 mb-3">
              {[['selected', 'Select Manually'], ['auto', 'By Milestone Status']].map(([v, l]) => (
                <button key={v} onClick={() => setRecipientType(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    recipientType === v ? 'bg-gold-500/15 border-gold-500/40 text-gold-300' : 'border-navy-600/50 text-navy-400 hover:text-slate-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {recipientType === 'auto' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-navy-400 mb-1">Milestone</label>
                  <select className="input" value={filterMilestone} onChange={e => setFilterMilestone(e.target.value)}>
                    <option value="">All milestones</option>
                    {MILESTONES.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-navy-400 mb-1">Status</label>
                  <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-navy-700/50 p-2">
                {students.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-navy-700/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={e => setSelectedStudents(prev =>
                        e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id)
                      )}
                      className="accent-amber-400"
                    />
                    <span className="text-sm text-slate-300">{s.name}</span>
                    <span className="text-xs text-navy-500">{s.email}</span>
                  </label>
                ))}
              </div>
            )}

            <p className="text-xs text-gold-500/70 mt-2 flex items-center gap-1">
              <Users size={11} /> {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Template + Milestone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Template</label>
              <select className="input" value={templateKey} onChange={e => applyTemplate(e.target.value)}>
                <option value="">— Choose template —</option>
                {Object.entries(EMAIL_TEMPLATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Response Milestone</label>
              <select className="input" value={milestoneId} onChange={e => setMilestoneId(e.target.value)}>
                <option value="">— None (no link) —</option>
                {MILESTONES.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs text-navy-400 mb-1">Subject</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs text-navy-400 mb-1">Message</label>
            <textarea className="input h-40 resize-none leading-relaxed" value={body} onChange={e => setBody(e.target.value)} placeholder="Use [Student Name] as placeholder — it's replaced automatically for each recipient." />
          </div>

          {sendResult && (
            <div className="p-3 rounded-xl text-sm border bg-emerald-900/20 border-emerald-700/40 text-emerald-300">
              ✓ Sent to {sendResult.sent} student{sendResult.sent !== 1 ? 's' : ''}
              {sendResult.failed > 0 && ` · ${sendResult.failed} failed`}
            </div>
          )}

          <button
            onClick={handleBulkSend}
            disabled={sending || !recipients.length || !subject || !body}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? `Sending to ${recipients.length} recipients…` : `Send to ${recipients.length} Recipient${recipients.length !== 1 ? 's' : ''}`}
          </button>
        </div>

        {/* Email log */}
        <div className="col-span-2 card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gold-400" /> Sent History
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-navy-800/40 shimmer" />)}
            </div>
          ) : log.length === 0 ? (
            <p className="text-sm text-navy-500">No emails sent yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {log.map(entry => (
                <div key={entry.id} className="p-3 rounded-xl bg-navy-800/30 border border-navy-700/30">
                  <p className="text-xs font-medium text-slate-300 truncate">{entry.subject}</p>
                  <p className="text-xs text-navy-400">{entry.students?.name}</p>
                  <p className="text-xs text-navy-500 mt-0.5">
                    {formatDistanceToNow(new Date(entry.sent_at), { addSuffix: true })}
                    {' · '}{entry.recipient_type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
