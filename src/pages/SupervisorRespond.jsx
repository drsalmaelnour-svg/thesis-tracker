import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, GraduationCap, Send, ChevronDown } from 'lucide-react'

const ENGAGEMENT_OPTIONS = [
  { value: 'on_track',  label: '🟢  Engaged and on track',           color: 'border-emerald-400/40 bg-emerald-500/10' },
  { value: 'concerns',  label: '🟡  Some concerns — needs attention', color: 'border-amber-400/40 bg-amber-500/10'   },
  { value: 'urgent',    label: '🔴  Not engaged — urgent follow-up',  color: 'border-red-400/40 bg-red-500/10'       },
]

const ISSUE_TYPES = [
  'Academic difficulty',
  'Communication breakdown',
  'Ethical concern',
  'Personal circumstances',
  'Supervisor conflict',
  'Other',
]

const RECOMMENDED_ACTIONS = [
  'No action needed',
  'Schedule a meeting',
  'Formal warning required',
  'Refer to student support',
  'Escalate to department',
]

const selectCls = "w-full bg-white/10 border border-white/20 focus:border-amber-400/60 rounded-xl px-4 py-3 text-white outline-none transition-all text-sm appearance-none cursor-pointer"
const textareaCls = "w-full bg-white/10 border border-white/20 focus:border-amber-400/60 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all text-sm resize-none h-28 leading-relaxed"

export default function SupervisorRespond() {
  const [params] = useSearchParams()
  const token     = params.get('t')
  const studentId = params.get('s')

  const [stage, setStage]           = useState('loading')
  const [supervisor, setSupervisor] = useState(null)
  const [student, setStudent]       = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')

  const [engagement, setEngagement]           = useState('')
  const [issueType, setIssueType]             = useState('')
  const [issueDesc, setIssueDesc]             = useState('')
  const [recommendedAction, setRecommendedAction] = useState('')
  const [fieldErrors, setFieldErrors]         = useState({})

  useEffect(() => {
    if (!token || !studentId) {
      setErrorMsg('This link appears to be invalid. Please contact the thesis coordinator.')
      setStage('error')
      return
    }

    async function init() {
      try {
        const { supabase } = await import('../lib/supabase')

        // Validate supervisor token
        const { data: sup, error: supErr } = await supabase
          .from('supervisors')
          .select('id, name, email')
          .eq('token', token)
          .single()

        if (supErr || !sup) throw new Error('Invalid or expired link.')
        setSupervisor(sup)

        // Get student details
        const { data: stu, error: stuErr } = await supabase
          .from('students')
          .select('id, name, student_id, program')
          .eq('id', studentId)
          .single()

        if (stuErr || !stu) throw new Error('Student not found.')
        setStudent(stu)

        setStage('form')
      } catch(e) {
        setErrorMsg(e.message || 'Something went wrong.')
        setStage('error')
      }
    }
    init()
  }, [token, studentId])

  function validate() {
    const errors = {}
    if (!engagement) errors.engagement = 'Please select an engagement status.'
    if (engagement !== 'on_track') {
      if (!issueType)  errors.issueType  = 'Please select an issue type.'
      if (!issueDesc.trim()) errors.issueDesc = 'Please describe the issue.'
      if (!recommendedAction) errors.recommendedAction = 'Please select a recommended action.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setStage('submitting')
    try {
      const { supabase } = await import('../lib/supabase')

      await supabase.from('supervisor_checkins').insert({
        supervisor_id:      supervisor.id,
        student_id:         student.id,
        engagement_status:  engagement,
        issue_type:         engagement !== 'on_track' ? issueType : null,
        issue_description:  engagement !== 'on_track' ? issueDesc : null,
        recommended_action: engagement !== 'on_track' ? recommendedAction : 'No action needed',
        token,
        academic_year:      new Date().getFullYear().toString(),
      })

      setStage('success')
    } catch(e) {
      setErrorMsg('Failed to save. Please try again or contact the coordinator.')
      setStage('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f1f36 0%, #1e3a5f 60%, #0f1f36 100%)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-navy-900 to-navy-800 border-b border-white/10 px-8 py-6"
            style={{background:'linear-gradient(135deg, #1e3a5f, #254474)'}}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <GraduationCap size={24} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">Thesis Coordination System</p>
                <h1 className="text-white font-bold text-lg leading-tight">Supervisor Check-in</h1>
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

                {/* Supervisor + Student info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <p className="text-xs text-slate-500">Supervisor</p>
                    <p className="text-white font-medium text-sm">{supervisor?.name}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <p className="text-xs text-slate-500">Student</p>
                    <p className="text-white font-medium text-sm">{student?.name}</p>
                    <p className="text-amber-400/70 text-xs font-mono">{student?.student_id}</p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed">
                  Please provide a brief update on your student's engagement and progress.
                  This information is confidential and shared only with the thesis coordinator.
                </p>

                {/* Engagement Status */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Student Engagement Status <span className="text-amber-400">*</span>
                  </label>
                  <div className="space-y-2">
                    {ENGAGEMENT_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => { setEngagement(opt.value); setFieldErrors(e => ({...e, engagement: ''})) }}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                          engagement === opt.value
                            ? opt.color + ' text-white'
                            : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.engagement && <p className="text-xs text-red-400 mt-1">{fieldErrors.engagement}</p>}
                </div>

                {/* Issue fields — only shown if not on_track */}
                {engagement && engagement !== 'on_track' && (
                  <div className="space-y-4 border-t border-white/10 pt-5">
                    <p className="text-xs text-amber-400/80 uppercase tracking-wider font-semibold">Issue Details</p>

                    {/* Issue Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Issue Type <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <select className={selectCls} value={issueType}
                          onChange={e => { setIssueType(e.target.value); setFieldErrors(er => ({...er, issueType: ''})) }}>
                          <option value="">— Select issue type —</option>
                          {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {fieldErrors.issueType && <p className="text-xs text-red-400 mt-1">{fieldErrors.issueType}</p>}
                    </div>

                    {/* Issue Description */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Please describe the issue <span className="text-amber-400">*</span>
                      </label>
                      <textarea className={textareaCls}
                        placeholder="Provide details about the concern or issue you have observed…"
                        value={issueDesc}
                        onChange={e => { setIssueDesc(e.target.value); setFieldErrors(er => ({...er, issueDesc: ''})) }}
                      />
                      {fieldErrors.issueDesc && <p className="text-xs text-red-400 mt-1">{fieldErrors.issueDesc}</p>}
                    </div>

                    {/* Recommended Action */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Recommended Action <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <select className={selectCls} value={recommendedAction}
                          onChange={e => { setRecommendedAction(e.target.value); setFieldErrors(er => ({...er, recommendedAction: ''})) }}>
                          <option value="">— Select recommended action —</option>
                          {RECOMMENDED_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {fieldErrors.recommendedAction && <p className="text-xs text-red-400 mt-1">{fieldErrors.recommendedAction}</p>}
                    </div>
                  </div>
                )}

                <button onClick={handleSubmit}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  style={{color:'#0f1f36'}}>
                  <Send size={16} /> Submit Check-in Report
                </button>

                <p className="text-xs text-slate-600 text-center leading-relaxed">
                  Your response is confidential and will only be seen by the thesis coordinator.
                </p>
              </div>
            )}

            {/* SUBMITTING */}
            {stage === 'submitting' && (
              <div className="text-center py-10">
                <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-300">Submitting your report…</p>
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
                  Your check-in report for <strong className="text-white">{student?.name}</strong> ({student?.student_id}) has been submitted successfully.
                </p>
                <div className={`rounded-2xl px-6 py-4 border-2 ${
                  engagement === 'on_track' ? 'bg-emerald-500/10 border-emerald-500/20' :
                  engagement === 'concerns' ? 'bg-amber-500/10 border-amber-500/20' :
                  'bg-red-500/10 border-red-500/20'
                }`}>
                  <p className="text-sm font-medium text-slate-200">
                    {ENGAGEMENT_OPTIONS.find(o => o.value === engagement)?.label}
                  </p>
                  {recommendedAction && recommendedAction !== 'No action needed' && (
                    <p className="text-xs text-slate-400 mt-1">Action: {recommendedAction}</p>
                  )}
                </div>
                <p className="text-slate-500 text-xs">The thesis coordinator has been notified. You can close this page.</p>
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
