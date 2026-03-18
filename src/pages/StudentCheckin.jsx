import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, GraduationCap, Send, ChevronDown } from 'lucide-react'
import { sendStudentEmail } from '../lib/emailService'

const STATUS_OPTIONS = [
  { value: 'on_track',       label: '🟢  On track — making good progress'         },
  { value: 'some_concerns',  label: '🟡  Some concerns — facing a few challenges' },
  { value: 'struggling',     label: '🔴  Struggling — need support'               },
]

const MEETING_OPTIONS = [
  { value: 'regularly',    label: 'Regularly (at least once a month)' },
  { value: 'occasionally', label: 'Occasionally (every few months)'   },
  { value: 'not_met',      label: 'We have not met recently'          },
]

const WRITING_OPTIONS = [
  { value: 'proposal_writing',  label: 'Writing / finalising my proposal'    },
  { value: 'data_collection',   label: 'Collecting / analysing data'         },
  { value: 'thesis_writing',    label: 'Writing my thesis chapters'          },
  { value: 'reviewing',         label: 'Reviewing / revising with supervisor'},
  { value: 'ahead',             label: 'Ahead of schedule'                   },
  { value: 'on_track',          label: 'On track with my timeline'           },
  { value: 'behind',            label: 'Slightly behind schedule'            },
  { value: 'not_started',       label: 'Not yet started'                     },
]

const selectCls = "w-full bg-white/10 border border-white/20 focus:border-amber-400/60 rounded-xl px-4 py-3 text-white outline-none transition-all text-sm appearance-none cursor-pointer"
const textareaCls = "w-full bg-white/10 border border-white/20 focus:border-amber-400/60 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all text-sm resize-none h-24 leading-relaxed"

export default function StudentCheckin() {
  const [params]  = useSearchParams()
  const token     = params.get('t')

  const [stage, setStage]       = useState('loading')
  const [student, setStudent]   = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const [status, setStatus]         = useState('')
  const [meetings, setMeetings]     = useState('')
  const [writing, setWriting]       = useState('')
  const [challenges, setChallenges] = useState('')
  const [support, setSupport]       = useState('')

  useEffect(() => {
    if (!token) {
      setErrorMsg('This link appears to be invalid. Please contact your thesis coordinator.')
      setStage('error')
      return
    }
    async function init() {
      try {
        const { supabase } = await import('../lib/supabase')
        const { data: s, error } = await supabase
          .from('students')
          .select('id, name, email, student_id, program, token')
          .eq('token', token)
          .single()
        if (error || !s) throw new Error('Invalid or expired link.')
        setStudent(s)
        setStage('form')
      } catch(e) {
        setErrorMsg(e.message || 'Something went wrong.')
        setStage('error')
      }
    }
    init()
  }, [token])

  function validate() {
    const errors = {}
    if (!status)   errors.status   = 'Please select your overall status.'
    if (!meetings) errors.meetings = 'Please select your meeting frequency.'
    if (!writing)  errors.writing  = 'Please select your writing status.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setStage('submitting')
    try {
      const { supabase } = await import('../lib/supabase')

      await supabase.from('student_checkins').insert({
        student_id:          student.id,
        overall_status:      status,
        supervisor_meetings: meetings,
        writing_status:      writing,
        challenges:          challenges || null,
        support_needed:      support    || null,
        academic_year:       new Date().getFullYear().toString(),
      })

      // Send confirmation email
      const statusLabel   = STATUS_OPTIONS.find(o => o.value === status)?.label   || status
      const meetingLabel  = MEETING_OPTIONS.find(o => o.value === meetings)?.label || meetings
      const writingLabel  = WRITING_OPTIONS.find(o => o.value === writing)?.label  || writing

      setTimeout(() => {
        sendStudentEmail({
          student,
          milestoneId: null,
          subject: 'Check-in Received — Thesis Coordination',
          message: `Thank you for completing your thesis check-in.\n\nHere is a summary of your responses:\n\nOverall Status: ${statusLabel}\nSupervisor Meetings: ${meetingLabel}\nThesis Writing: ${writingLabel}${challenges ? `\nChallenges: ${challenges}` : ''}${support ? `\nSupport Needed: ${support}` : ''}\n\nYour thesis coordinator has been notified. If you require immediate support, please reach out directly.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`,
        }).catch(e => console.warn('Confirmation email failed:', e))
      }, 500)

      setStage('success')
    } catch(e) {
      setErrorMsg('Failed to save. Please try again or contact your coordinator.')
      setStage('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f1f36 0%, #1e3a5f 60%, #0f1f36 100%)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="border-b border-white/10 px-8 py-6"
            style={{background:'linear-gradient(135deg,#1e3a5f,#254474)'}}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <GraduationCap size={24} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">Thesis Coordination System</p>
                <h1 className="text-white font-bold text-lg">Thesis Progress Check-in</h1>
              </div>
            </div>
          </div>

          <div className="px-8 py-8 space-y-5">

            {/* LOADING */}
            {stage === 'loading' && (
              <div className="text-center py-8">
                <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-300">Verifying your link…</p>
              </div>
            )}

            {/* FORM */}
            {stage === 'form' && (
              <div className="space-y-5">

                {/* Student info */}
                <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-xs text-slate-500">Completing check-in as</p>
                  <p className="text-white font-medium">{student?.name}</p>
                  <p className="text-amber-400/70 text-xs font-mono">{student?.student_id}</p>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed">
                  Please take a moment to update your thesis coordinator on your current progress.
                  Your responses help ensure you receive the right support at the right time.
                </p>

                {/* Q1 — Overall status */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    How would you describe your overall thesis progress? <span className="text-amber-400">*</span>
                  </label>
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => { setStatus(opt.value); setFieldErrors(e => ({...e, status:''})) }}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                          status === opt.value
                            ? opt.value === 'on_track'      ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                            : opt.value === 'some_concerns' ? 'border-amber-400/60 bg-amber-500/15 text-white'
                            :                                  'border-red-400/60 bg-red-500/15 text-white'
                            : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.status && <p className="text-xs text-red-400 mt-1">{fieldErrors.status}</p>}
                </div>

                {/* Q2 — Supervisor meetings */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    How often have you met with your supervisor? <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <select className={selectCls} value={meetings}
                      onChange={e => { setMeetings(e.target.value); setFieldErrors(er => ({...er, meetings:''})) }}>
                      <option value="">— Select —</option>
                      {MEETING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {fieldErrors.meetings && <p className="text-xs text-red-400 mt-1">{fieldErrors.meetings}</p>}
                </div>

                {/* Q3 — Writing status */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Where are you with your research and writing? <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <select className={selectCls} value={writing}
                      onChange={e => { setWriting(e.target.value); setFieldErrors(er => ({...er, writing:''})) }}>
                      <option value="">— Select —</option>
                      {WRITING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {fieldErrors.writing && <p className="text-xs text-red-400 mt-1">{fieldErrors.writing}</p>}
                </div>

                {/* Q4 — Challenges */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Are you facing any challenges or blockers? <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <textarea className={textareaCls}
                    placeholder="Describe any difficulties you are experiencing — academic, technical, personal, or otherwise…"
                    value={challenges}
                    onChange={e => setChallenges(e.target.value)}
                  />
                </div>

                {/* Q5 — Support needed */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    What support do you need from your coordinator? <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <textarea className={textareaCls}
                    placeholder="E.g. guidance on a specific topic, help scheduling a meeting, administrative support…"
                    value={support}
                    onChange={e => setSupport(e.target.value)}
                  />
                </div>

                <button onClick={handleSubmit}
                  className="w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  style={{background:'#d4a843', color:'#0f1f36'}}>
                  <Send size={16} /> Submit Check-in
                </button>

                <p className="text-xs text-slate-600 text-center">
                  Your responses are confidential and shared only with your thesis coordinator.
                </p>
              </div>
            )}

            {/* SUBMITTING */}
            {stage === 'submitting' && (
              <div className="text-center py-10">
                <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-300">Submitting your check-in…</p>
              </div>
            )}

            {/* SUCCESS */}
            {stage === 'success' && (
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Thank You!</h2>
                <p className="text-slate-400 text-sm">
                  Your check-in has been submitted successfully, {student?.name}.
                </p>
                <div className={`rounded-2xl px-6 py-4 border-2 text-left space-y-2 ${
                  status === 'on_track'      ? 'bg-emerald-500/10 border-emerald-500/20' :
                  status === 'some_concerns' ? 'bg-amber-500/10 border-amber-500/20' :
                                               'bg-red-500/10 border-red-500/20'
                }`}>
                  <p className="text-sm font-medium text-slate-200">
                    {STATUS_OPTIONS.find(o => o.value === status)?.label}
                  </p>
                  <p className="text-xs text-slate-400">
                    {MEETING_OPTIONS.find(o => o.value === meetings)?.label}
                  </p>
                  <p className="text-xs text-slate-400">
                    Writing: {WRITING_OPTIONS.find(o => o.value === writing)?.label}
                  </p>
                </div>
                {(status === 'some_concerns' || status === 'struggling') && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3">
                    <p className="text-xs text-amber-300 leading-relaxed">
                      Your coordinator has been notified and will be in touch to offer support.
                    </p>
                  </div>
                )}
                <p className="text-slate-500 text-xs">A confirmation has been sent to {student?.email}</p>
              </div>
            )}

            {/* ERROR */}
            {stage === 'error' && (
              <div className="text-center space-y-4 py-4">
                <XCircle size={48} className="text-red-400 mx-auto" />
                <h2 className="text-xl font-bold text-white">Something went wrong</h2>
                <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
                <p className="text-slate-600 text-xs">Please contact Dr. Salma Elnour directly.</p>
              </div>
            )}

          </div>
        </div>
        <p className="text-center text-slate-600 text-xs mt-5">Thesis Coordination System · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
