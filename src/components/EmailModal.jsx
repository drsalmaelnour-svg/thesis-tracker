import { useState } from 'react'
import { X, Send, Loader2, ChevronDown } from 'lucide-react'
import { EMAIL_TEMPLATES, SUPERVISOR_TEMPLATES } from '../lib/emailTemplates'
import { sendStudentEmail, sendSupervisorEmail } from '../lib/emailService'
import { logEmail } from '../lib/supabase'
import { MILESTONES } from '../lib/supabase'

export default function EmailModal({ student, onClose }) {
  const [recipient, setRecipient] = useState('student')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [milestoneId, setMilestoneId] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const templates = recipient === 'student' ? EMAIL_TEMPLATES : SUPERVISOR_TEMPLATES

  function applyTemplate(key) {
    setSelectedTemplate(key)
    const tpl = templates[key]
    if (!tpl) return
    const fill = (s) => s
      .replace(/{{student_name}}/g, student.name)
      .replace(/{{supervisor_name}}/g, student.supervisors?.name || '')
      .replace(/{{milestone}}/g, milestoneId ? MILESTONES.find(m => m.id === milestoneId)?.name || '' : '{{milestone}}')
      .replace(/{{due_date}}/g, 'the required date')
      .replace(/{{response_link}}/g, '[response link will be inserted automatically]')
    setSubject(fill(tpl.subject))
    setBody(fill(tpl.body))
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    try {
      let res
      if (recipient === 'student') {
        res = await sendStudentEmail({ student, milestoneId, subject, message: body })
      } else {
        res = await sendSupervisorEmail({
          supervisor: student.supervisors,
          student,
          milestoneId,
          subject,
          message: body,
        })
      }
      if (res.ok) {
        await logEmail({
          studentId: student.id,
          recipientType: recipient,
          subject,
          template: selectedTemplate,
          milestoneId,
        })
        setResult({ ok: true, msg: 'Email sent successfully!' })
      } else {
        setResult({ ok: false, msg: res.message || 'Failed to send email.' })
      }
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
            <h3 className="font-display font-semibold text-slate-100">Send Email</h3>
            <p className="text-xs text-navy-400 mt-0.5">To: {student.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recipient toggle */}
          <div className="flex gap-2">
            {['student', 'supervisor'].map(r => (
              <button
                key={r}
                onClick={() => { setRecipient(r); setSelectedTemplate(''); setSubject(''); setBody('') }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  recipient === r
                    ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
                    : 'border-navy-600/50 text-navy-400 hover:text-slate-300'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
                {r === 'student' && <span className="ml-1 text-navy-500">({student.email})</span>}
                {r === 'supervisor' && student.supervisors && (
                  <span className="ml-1 text-navy-500">({student.supervisors.email})</span>
                )}
              </button>
            ))}
          </div>

          {/* Template + Milestone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1.5">Template</label>
              <div className="relative">
                <select
                  value={selectedTemplate}
                  onChange={e => applyTemplate(e.target.value)}
                  className="input appearance-none pr-8"
                >
                  <option value="">— Choose a template —</option>
                  {Object.entries(templates).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1.5">Milestone (optional)</label>
              <div className="relative">
                <select
                  value={milestoneId}
                  onChange={e => setMilestoneId(e.target.value)}
                  className="input appearance-none pr-8"
                >
                  <option value="">— None —</option>
                  {MILESTONES.map(m => (
                    <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>
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
              className="input resize-none h-40 leading-relaxed"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body…"
            />
            {milestoneId && (
              <p className="text-xs text-gold-500/70 mt-1">
                ✓ A unique response/confirmation link will be appended automatically.
              </p>
            )}
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
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
