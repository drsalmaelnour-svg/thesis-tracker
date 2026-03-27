import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, XCircle, GraduationCap, ArrowRight, CheckCircle2, ClipboardList, Award } from 'lucide-react'

export default function ExaminerPortal() {
  const location = useLocation()
  const navigate = useNavigate()
  const token    = new URLSearchParams(location.search).get('t')

  const [stage,    setStage]    = useState('loading')
  const [data,     setData]     = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setErrorMsg('Invalid link. Please contact your thesis coordinator.'); setStage('error'); return }
    async function init() {
      try {
        const { supabase } = await import('../lib/supabase')

        // Find the assignment for this token
        const { data: asgn, error } = await supabase
          .from('assessment_assignments')
          .select(`*, students(id, name, student_id, program, enrollment_year, supervisors(name)), external_examiners(name, designation, institution)`)
          .eq('token', token)
          .single()
        if (error || !asgn) throw new Error('Invalid or expired link.')

        // Get examiner name
        let examinerName = '', examinerDesig = ''
        if (asgn.examiner_type === 'external') {
          examinerName  = asgn.external_examiners?.name || ''
          examinerDesig = asgn.external_examiners?.designation || ''
        } else {
          const { data: sup } = await supabase.from('supervisors').select('name, designation').eq('id', asgn.examiner_id).single()
          examinerName  = sup?.name || ''
          examinerDesig = sup?.designation || ''
        }

        // Find the paired assignment (before ↔ after) for same student + examiner number
        const pairedType = asgn.assessment_type === 'defense_before' ? 'defense_after' : 'defense_before'
        const { data: paired, error: pairedErr } = await supabase
          .from('assessment_assignments')
          .select('id, token, assessment_type')
          .eq('student_id', asgn.student_id)
          .eq('assessment_type', pairedType)
          .eq('examiner_number', asgn.examiner_number)
          .maybeSingle()
        if (pairedErr) console.warn('Paired assignment lookup:', pairedErr.message)

        // Check submission status for both
        const [sub1, sub2] = await Promise.all([
          supabase.from('assessment_submissions').select('id').eq('assignment_id', asgn.id).single(),
          paired ? supabase.from('assessment_submissions').select('id').eq('assignment_id', paired.id).single() : Promise.resolve({ data: null }),
        ])

        const beforeAsgn = asgn.assessment_type === 'defense_before' ? asgn : paired
        const afterAsgn  = asgn.assessment_type === 'defense_after'  ? asgn : paired
        const beforeSub  = asgn.assessment_type === 'defense_before' ? sub1.data : sub2.data
        const afterSub   = asgn.assessment_type === 'defense_after'  ? sub1.data : sub2.data

        setData({
          student:       asgn.students,
          examinerName,  examinerDesig,
          examinerNumber:asgn.examiner_number,
          beforeToken:   beforeAsgn?.token,
          afterToken:    afterAsgn?.token,
          beforeSubmitted: !!beforeSub,
          afterSubmitted:  !!afterSub,
        })
        setStage('portal')
      } catch(e) {
        setErrorMsg(e.message || 'Something went wrong.')
        setStage('error')
      }
    }
    init()
  }, [token])

  function goToForm(formToken) {
    navigate(`/examiner-response?t=${formToken}`)
  }

  if (stage === 'loading') return (
    <Page>
      <div className="text-center py-16">
        <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3"/>
        <p className="text-slate-300 text-sm">Verifying your link…</p>
      </div>
    </Page>
  )

  if (stage === 'error') return (
    <Page>
      <div className="text-center py-16 space-y-4">
        <XCircle size={48} className="text-red-400 mx-auto"/>
        <h2 className="text-xl font-bold text-white">Something went wrong</h2>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <p className="text-slate-600 text-xs">Please contact Dr. Salma Elnour directly.</p>
      </div>
    </Page>
  )

  const { student, examinerName, examinerDesig, beforeToken, afterToken, beforeSubmitted, afterSubmitted } = data || {}

  return (
    <Page>
      {/* Examiner greeting */}
      <div className="mb-6">
        <p className="text-xs text-amber-400/70 uppercase tracking-wider mb-1">Welcome</p>
        <h2 className="text-xl font-bold text-white">{examinerName}</h2>
        <p className="text-sm text-slate-400">{examinerDesig}</p>
      </div>

      {/* Student info card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 bg-white/[0.03]">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Student under evaluation</p>
        </div>
        <div className="grid grid-cols-2 gap-0">
          {[
            ['Student Name',     student?.name],
            ['Registration No.', student?.student_id],
            ['Supervisor',       student?.supervisors?.name],
            ['Program',          student?.program],
          ].map(([label, val]) => (
            <div key={label} className="px-5 py-3 border-b border-r border-white/10 last:border-r-0">
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <p className="text-sm text-white font-medium">{val || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Instruction */}
      <p className="text-sm text-slate-400 mb-5 leading-relaxed">
        Your assignment covers two evaluation stages. Please select the appropriate form below based on the current stage of the thesis defense process.
      </p>

      {/* Two evaluation cards */}
      <div className="grid grid-cols-1 gap-4">

        {/* Defense Before */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
          beforeSubmitted
            ? 'border-emerald-500/40 bg-emerald-900/10'
            : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/50'
        }`}>
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${beforeSubmitted?'bg-emerald-500/20':'bg-amber-500/15'}`}>
                  <ClipboardList size={18} className={beforeSubmitted?'text-emerald-400':'text-amber-400'}/>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-bold text-base">Stage 1 — Defense Before</p>
                    {beforeSubmitted && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10}/> Submitted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Formative evaluation — not scored. Assess the thesis readiness and provide structured guidance before the oral defense takes place.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {beforeToken && (
            <div className="px-5 pb-4">
              {beforeSubmitted ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 size={13}/> You have already submitted this evaluation.
                </div>
              ) : (
                <button onClick={() => goToForm(beforeToken)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{background:'#d4a843', color:'#0f1f36'}}>
                  Begin Evaluation <ArrowRight size={15}/>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Defense After */}
        <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
          afterSubmitted
            ? 'border-emerald-500/40 bg-emerald-900/10'
            : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50'
        }`}>
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${afterSubmitted?'bg-emerald-500/20':'bg-blue-500/15'}`}>
                <Award size={18} className={afterSubmitted?'text-emerald-400':'text-blue-400'}/>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-bold text-base">Stage 2 — Defense After</p>
                  {afterSubmitted && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10}/> Submitted
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Final scored assessment. Complete after the oral defense once the student has submitted their corrections.
                </p>
              </div>
            </div>
          </div>
          {afterToken && (
            <div className="px-5 pb-4">
              {afterSubmitted ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 size={13}/> You have already submitted this evaluation.
                </div>
              ) : (
                <button onClick={() => goToForm(afterToken)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all"
                  style={{borderColor:'#3b82f6', color:'#93c5fd', background:'rgba(59,130,246,0.1)'}}>
                  Begin Evaluation <ArrowRight size={15}/>
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-600 text-center mt-6 leading-relaxed">
        Your evaluations are strictly confidential.<br/>
        Please contact Dr. Salma Elnour, Thesis Coordinator, if you have any questions.
      </p>
    </Page>
  )
}

function Page({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{background:'linear-gradient(135deg,#0f1f36 0%,#1e3a5f 60%,#0f1f36 100%)'}}>
      <div className="w-full max-w-lg">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/10"
            style={{background:'linear-gradient(135deg,#1e3a5f,#254474)'}}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <GraduationCap size={24} className="text-amber-400"/>
              </div>
              <div>
                <p className="text-xs text-amber-400/70 uppercase tracking-wider">Gulf Medical University</p>
                <h1 className="text-white font-bold text-lg">Thesis Evaluation Portal</h1>
                <p className="text-xs text-slate-400 mt-0.5">MSc Medical Laboratory Sciences</p>
              </div>
            </div>
          </div>
          <div className="px-8 py-6">{children}</div>
        </div>
        <p className="text-center text-slate-600 text-xs mt-4">
          Thesis Coordination System · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
