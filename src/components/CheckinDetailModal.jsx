import { useState } from 'react'
import { X, Shield, Send, Loader2, Edit2, ChevronDown } from 'lucide-react'
import { sendStudentEmail, sendSupervisorEmail } from '../lib/emailService'

const STUDENT_STATUS = {
  on_track:      { label: 'On Track',      emoji: '🟢', color: 'text-emerald-300 bg-emerald-900/20 border-emerald-700/40' },
  some_concerns: { label: 'Some Concerns', emoji: '🟡', color: 'text-amber-300 bg-amber-900/20 border-amber-700/40'     },
  struggling:    { label: 'Struggling',    emoji: '🔴', color: 'text-red-300 bg-red-900/20 border-red-700/40'           },
}

const SUPERVISOR_STATUS = {
  on_track: { label: 'On Track',          emoji: '🟢', color: 'text-emerald-300 bg-emerald-900/20 border-emerald-700/40' },
  concerns: { label: 'Needs Attention',   emoji: '🟡', color: 'text-amber-300 bg-amber-900/20 border-amber-700/40'       },
  urgent:   { label: 'Urgent Follow-up',  emoji: '🔴', color: 'text-red-300 bg-red-900/20 border-red-700/40'             },
}

const MEETING_LABELS = {
  regularly:    'Meets regularly (at least monthly)',
  occasionally: 'Meets occasionally (every few months)',
  not_met:      'Has not met with supervisor recently',
}

const WRITING_LABELS = {
  proposal_writing: 'Writing / finalising proposal',
  data_collection:  'Collecting / analysing data',
  thesis_writing:   'Writing thesis chapters',
  reviewing:        'Reviewing / revising with supervisor',
  ahead:            'Ahead of schedule',
  on_track:         'On track with timeline',
  behind:           'Behind schedule',
  not_started:      'Not yet started',
}

function Field({ label, value, full = false }) {
  if (!value) return null
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-navy-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-200 leading-relaxed bg-navy-800/40 rounded-xl px-4 py-3 border border-navy-700/40">
        {value}
      </p>
    </div>
  )
}

export default function CheckinDetailModal({ checkin, type, onClose }) {
  // type: 'student' | 'supervisor'
  const [showDraft, setShowDraft]     = useState(false)
  const [draftTarget, setDraftTarget] = useState('') // 'supervisor' | 'student' | 'escalate'
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody]     = useState('')
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState(false)

  const isStudent    = type === 'student'
  const studentName  = isStudent ? checkin.students?.name : checkin.students?.name
  const studentId    = isStudent ? checkin.students?.student_id : checkin.students?.student_id
  const supervisorName = isStudent ? checkin.students?.supervisors?.name : checkin.supervisors?.name
  const supervisorEmail = isStudent ? checkin.students?.supervisors?.email : checkin.supervisors?.email
  const studentEmail = checkin.students?.email || checkin.student_email || ''

  const statusCfg = isStudent
    ? STUDENT_STATUS[checkin.overall_status]
    : SUPERVISOR_STATUS[checkin.engagement_status]

  function openDraft(target) {
    setDraftTarget(target)
    setSent(false)

    if (isStudent && target === 'supervisor') {
      setDraftSubject(`Student Support — ${studentName} (${studentId})`)
      setDraftBody(`Dear ${supervisorName || 'Supervisor'},\n\nI am writing regarding your student ${studentName} (${studentId}).\n\nDuring a recent check-in, it was noted that this student may benefit from additional support or guidance at this time.\n\nI would appreciate it if you could arrange a meeting with your student at your earliest convenience.\n\nPlease do not hesitate to contact me if you need any further information.\n\nBest regards,\n${checkin.coordinator_name || 'Dr. Salma Elnour'}\nThesis Coordinator`)
    } else if (!isStudent && target === 'student') {
      setDraftSubject(`Thesis Progress — ${studentName} (${studentId})`)
      setDraftBody(`Dear ${studentName},\n\nI hope this message finds you well.\n\nI am writing to check in on your thesis progress and to remind you of the importance of maintaining regular communication with your supervisor.\n\nPlease do not hesitate to reach out if you require any support or guidance from the thesis coordination office.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`)
    } else if (target === 'escalate') {
      setDraftSubject(`Escalation — Student Concern: ${studentName} (${studentId})`)
      setDraftBody(`Dear [Department Head],\n\nI am writing to bring to your attention a concern regarding the thesis progress of ${studentName} (${studentId}).\n\nThis matter requires your consideration and guidance.\n\nI am available to discuss this further at your convenience.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`)
    }

    setShowDraft(true)
  }

  async function handleSend() {
    if (!draftSubject.trim() || !draftBody.trim()) return
    setSending(true)
    try {
      if (isStudent && draftTarget === 'supervisor' && supervisorEmail) {
        await sendSupervisorEmail({
          supervisor: { name: supervisorName, email: supervisorEmail },
          student:    checkin.students || { name: studentName, student_id: studentId, email: studentEmail },
          milestoneId: null,
          subject:    draftSubject,
          message:    draftBody,
        })
      } else {
        // Send to student or escalate — use generic email
        await sendStudentEmail({
          student:    { name: studentName, email: studentEmail, token: '' },
          milestoneId: null,
          subject:    draftSubject,
          message:    draftBody,
        })
      }
      setSent(true)
      setShowDraft(false)
    } catch(e) {
      console.error(e)
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl fade-in shadow-2xl border-navy-600/60 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-navy-700/50 shrink-0">
          <div>
            <h3 className="font-display font-semibold text-slate-100 text-lg">
              {isStudent ? 'Student Check-in' : 'Supervisor Check-in'}
            </h3>
            <p className="text-xs text-navy-400 mt-1">
              {studentName} · {studentId}
              {!isStudent && ` · Reported by ${checkin.supervisors?.name}`}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg shrink-0"><X size={18}/></button>
        </div>

        {/* Confidentiality notice */}
        <div className="mx-6 mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-navy-800/60 border border-navy-700/40 shrink-0">
          <Shield size={14} className="text-gold-400 shrink-0"/>
          <p className="text-xs text-navy-400 leading-relaxed">
            This response is <strong className="text-slate-300">confidential</strong>. Any communication to third parties is drafted by you and reviewed before sending.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Status badge */}
          {statusCfg && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${statusCfg.color}`}>
              <span className="text-lg">{statusCfg.emoji}</span> {statusCfg.label}
            </div>
          )}

          {/* Student check-in fields */}
          {isStudent && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supervisor Meetings" value={MEETING_LABELS[checkin.supervisor_meetings]} />
              <Field label="Research & Writing Status" value={WRITING_LABELS[checkin.writing_status]} />
              <Field label="Challenges & Blockers" value={checkin.challenges} full />
              <Field label="Support Needed from Coordinator" value={checkin.support_needed} full />
            </div>
          )}

          {/* Supervisor check-in fields */}
          {!isStudent && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue Type" value={checkin.issue_type} />
              <Field label="Recommended Action" value={checkin.recommended_action} />
              <Field label="Issue Description" value={checkin.issue_description} full />
            </div>
          )}

          {/* Submission date */}
          <p className="text-xs text-navy-500">
            Submitted: {new Date(checkin.submitted_at).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            {' at '}{new Date(checkin.submitted_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
          </p>

          {/* Success message */}
          {sent && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
              ✓ Email drafted and sent successfully.
            </div>
          )}

          {/* Draft email form */}
          {showDraft && (
            <div className="border border-navy-600/50 rounded-2xl p-5 space-y-3 bg-navy-800/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Edit2 size={14} className="text-gold-400"/> Draft Email
                </p>
                <button onClick={()=>setShowDraft(false)} className="btn-ghost p-1.5 rounded-lg text-xs">
                  <X size={13}/>
                </button>
              </div>
              <p className="text-xs text-amber-400/80">
                ⚠ Review and edit this email carefully before sending. It does not quote the check-in response directly.
              </p>
              <div>
                <label className="block text-xs text-navy-400 mb-1">Subject</label>
                <input className="input text-sm" value={draftSubject} onChange={e=>setDraftSubject(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-navy-400 mb-1">Message</label>
                <textarea className="input text-sm resize-none leading-relaxed" style={{minHeight:'160px'}}
                  value={draftBody} onChange={e=>setDraftBody(e.target.value)}/>
              </div>
              <button onClick={handleSend} disabled={sending||!draftSubject||!draftBody}
                className="btn-primary disabled:opacity-50">
                {sending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          )}
        </div>

        {/* Action footer */}
        {!showDraft && (
          <div className="p-6 border-t border-navy-700/50 shrink-0">
            <p className="text-xs text-navy-500 mb-3">Draft a confidential communication based on this check-in:</p>
            <div className="flex flex-wrap gap-2">
              {isStudent && supervisorEmail && (
                <button onClick={()=>openDraft('supervisor')} className="btn-secondary text-xs">
                  <Send size={13}/> Draft Email to Supervisor
                </button>
              )}
              {!isStudent && studentEmail && (
                <button onClick={()=>openDraft('student')} className="btn-secondary text-xs">
                  <Send size={13}/> Draft Email to Student
                </button>
              )}
              <button onClick={()=>openDraft('escalate')} className="btn-secondary text-xs text-amber-400 border-amber-700/40 hover:border-amber-600/60">
                <Send size={13}/> Escalate to Department
              </button>
              <button onClick={onClose} className="btn-ghost text-xs ml-auto">Close</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
