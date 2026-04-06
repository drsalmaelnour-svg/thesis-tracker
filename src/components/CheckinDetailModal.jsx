import { useState } from 'react'
import { X, Shield, Send, Loader2, Edit2, ChevronDown, Save, CheckCircle2 } from 'lucide-react'
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
  const [coordStatus, setCoordStatus] = useState(checkin.coordinator_status || 'new')
  const [resNote,     setResNote]     = useState(checkin.resolution_note || '')
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusSaved,  setStatusSaved]  = useState(false)

  const isStudent       = type === 'student'
  const studentName     = checkin.students?.name || ''
  const studentId       = checkin.students?.student_id || ''
  const studentEmail    = checkin.students?.email || ''
  // Supervisor info — source differs by check-in type
  const supervisorName  = isStudent
    ? checkin.students?.supervisors?.name
    : checkin.supervisors?.name
  const supervisorEmail = isStudent
    ? checkin.students?.supervisors?.email
    : checkin.supervisors?.email

  const statusCfg = isStudent
    ? STUDENT_STATUS[checkin.overall_status]
    : SUPERVISOR_STATUS[checkin.engagement_status]

  async function updateStatus(newStatus) {
    setSavingStatus(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const table = isStudent ? 'student_checkins' : 'supervisor_checkins'
      await supabase.from(table).update({
        coordinator_status: newStatus,
        resolution_note:    resNote || null,
        resolved_at:        newStatus === 'resolved' ? new Date().toISOString() : null,
      }).eq('id', checkin.id)
      setCoordStatus(newStatus)
      setStatusSaved(true)
      setTimeout(() => setStatusSaved(false), 2500)
    } catch(e) { console.error(e) }
    setSavingStatus(false)
  }

  function openDraft(target) {
    setDraftTarget(target)
    setSent(false)

    if (target === 'student' && isStudent) {
      // Reply to student who submitted a check-in
      setDraftSubject(`Re: Your Thesis Check-in — ${studentName}`)
      setDraftBody(`Dear ${studentName},\n\nThank you for completing your thesis check-in and for sharing your progress with us.\n\nI have reviewed your response and I want to assure you that your concerns have been noted. Please know that you have our full support, and we are committed to helping you navigate any challenges you may be facing.\n\nI will follow up with you shortly regarding next steps. In the meantime, please do not hesitate to reach out to me directly if you need anything.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`)
    } else if (target === 'student' && !isStudent) {
      // Contact student based on supervisor check-in
      setDraftSubject(`Thesis Progress — ${studentName} (${studentId})`)
      setDraftBody(`Dear ${studentName},\n\nI hope this message finds you well.\n\nI am writing to check in on your thesis progress. As your thesis coordinator, I want to ensure you have the support you need to stay on track.\n\nPlease feel free to reach out to me directly if you have any questions, concerns, or require any assistance.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`)
    } else if (target === 'supervisor') {
      // Contact supervisor about student check-in
      setDraftSubject(`Student Progress Update — ${studentName} (${studentId})`)
      setDraftBody(`Dear ${supervisorName || 'Dr.'},\n\nI hope this message finds you well.\n\nI am writing regarding your student ${studentName} (${studentId}). As part of our thesis coordination process, I wanted to bring to your attention that this student may benefit from some additional guidance and support at this time.\n\nI would greatly appreciate it if you could arrange a meeting with your student at your earliest convenience to discuss their progress and provide any necessary guidance.\n\nPlease do not hesitate to contact me if you have any questions or concerns.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`)
    } else if (target === 'supervisor_reply') {
      // Reply to supervisor who submitted a check-in
      setDraftSubject(`Re: Student Check-in — ${studentName} (${studentId})`)
      setDraftBody(`Dear ${checkin.supervisors?.name || 'Dr.'},\n\nThank you for submitting your check-in report regarding ${studentName} (${studentId}).\n\nI have noted your feedback and will take the appropriate steps to follow up on the matters raised. Your engagement in the thesis coordination process is greatly appreciated and plays a vital role in supporting our students.\n\nI will keep you informed of any developments. Please do not hesitate to contact me if you have any further concerns.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`)
    }

    setShowDraft(true)
  }

  async function handleSend() {
    if (!draftSubject.trim() || !draftBody.trim()) return
    setSending(true)
    try {
      if ((draftTarget === 'supervisor') && supervisorEmail) {
        await sendSupervisorEmail({
          supervisor: { name: supervisorName, email: supervisorEmail },
          student:    checkin.students || { name: studentName, student_id: studentId, email: studentEmail },
          milestoneId: null,
          subject:    draftSubject,
          message:    draftBody,
        })
      } else if (draftTarget === 'supervisor_reply' && checkin.supervisors?.email) {
        await sendSupervisorEmail({
          supervisor: { name: checkin.supervisors.name, email: checkin.supervisors.email },
          student:    checkin.students || { name: studentName, student_id: studentId, email: studentEmail },
          milestoneId: null,
          subject:    draftSubject,
          message:    draftBody,
        })
      } else {
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
            <p className="text-xs text-navy-500 mb-3">Draft a confidential communication — always editable before sending:</p>
            <div className="flex flex-wrap gap-2">
              {isStudent ? (
                <>
                  <button onClick={()=>openDraft('student')} className="btn-primary text-xs">
                    <Send size={13}/> Reply to Student
                  </button>
                  {supervisorEmail && (
                    <button onClick={()=>openDraft('supervisor')} className="btn-secondary text-xs">
                      <Send size={13}/> Contact Supervisor
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={()=>openDraft('supervisor_reply')} className="btn-primary text-xs">
                    <Send size={13}/> Reply to Supervisor
                  </button>
                  {studentEmail && (
                    <button onClick={()=>openDraft('student')} className="btn-secondary text-xs">
                      <Send size={13}/> Contact Student
                    </button>
                  )}
                </>
              )}
              <button onClick={onClose} className="btn-ghost text-xs ml-auto">Close</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
