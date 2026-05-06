import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { GraduationCap, Upload, CheckCircle2, AlertCircle, Loader2, X, FileText } from 'lucide-react'

const UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbz-6zIaHlAgNsEKEjkbx_MqAHapSLxZN8Pa18ACSul98UH4RHrOykcRfG5mEY4wKAn_/exec'

const IMPACT_CRITERIA = [
  { key: 'supervisor_has_publication',      studentKey: 'has_publication',      label: 'Published in a peer-reviewed journal or indexed in SCOPUS',         type: 'Publication' },
  { key: 'supervisor_has_ip',               studentKey: 'has_ip',               label: 'Intellectual Property developed (patent, copyright, trademark)',      type: 'Intellectual Property' },
  { key: 'supervisor_has_industry_partner', studentKey: 'has_industry_partner', label: 'Research supported by an industry partner',                          type: 'Industry Partnership' },
  { key: 'supervisor_has_public_events',    studentKey: 'has_public_events',    label: 'Presented at 5 or more public events',                               type: 'Public Events' },
  { key: 'supervisor_has_policy_citation',  studentKey: 'has_policy_citation',  label: 'Cited in a government or policy document',                           type: 'Policy Citation' },
  { key: 'supervisor_has_commercialisation',studentKey: 'has_commercialisation',label: 'Revenue generated from research output (≥ AED 50,000)',              type: 'Commercialisation' },
]

export default function SupervisorResearchImpact() {
  const location = useLocation()
  const token    = new URLSearchParams(location.search).get('t')

  const [data,      setData]      = useState(null)  // { student, impact }
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting,setSubmitting]= useState(false)

  const [checks,   setChecks]   = useState({})
  const [files,    setFiles]    = useState({})
  const [comments, setComments] = useState('')

  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return }
    async function load() {
      try {
        const { supabase } = await import('../lib/supabase')
        // Find student by supervisor token
        const { data: student, error: sErr } = await supabase
          .from('students')
          .select('*, departments(name,primary_color,accent_color), supervisors(id,name,email)')
          .eq('supervisor_impact_token', token)
          .single()
        if (sErr || !student) { setError('This link is invalid or has expired.'); return }

        // Get existing student impact submission
        const { data: impact } = await supabase
          .from('research_impact')
          .select('*')
          .eq('student_id', student.id)
          .order('submitted_at', { ascending: false })
          .limit(1).single()

        // Check if supervisor already submitted
        if (impact?.supervisor_submitted_at) {
          setSubmitted(true)
          setData({ student, impact })
          return
        }

        // Pre-fill checks from student submission
        if (impact) {
          const pre = {}
          IMPACT_CRITERIA.forEach(c => {
            if (impact[c.studentKey]) pre[c.key] = true
          })
          setChecks(pre)
        }

        setData({ student, impact })
      } catch(e) { setError(e.message) }
      finally    { setLoading(false) }
    }
    load()
  }, [token])

  async function uploadFile(impactType, file) {
    const student = data.student
    setFiles(prev => ({ ...prev, [impactType]: { file, uploading: true, done: false } }))
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload  = e => res(e.target.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const form = new FormData()
      form.append('studentName', student.name)
      form.append('thesisTitle', student.thesis_title || 'No Title')
      form.append('year',        getCurrentYear())
      form.append('level',       student.program_level || 'Postgraduate')
      form.append('dept',        student.departments?.name || 'Medical Laboratory Sciences')
      form.append('impactType',  'Supervisor — ' + impactType)
      form.append('fileName',    file.name)
      form.append('mimeType',    file.type)
      form.append('file',        base64)
      const res  = await fetch(UPLOAD_URL, { method: 'POST', body: form })
      const resp = await res.json()
      if (!resp.success) throw new Error(resp.error)
      setFiles(prev => ({ ...prev, [impactType]: { file, uploading: false, done: true, url: resp.viewUrl, fileName: resp.fileName } }))
    } catch(e) {
      setFiles(prev => ({ ...prev, [impactType]: { file, uploading: false, done: false, error: e.message } }))
    }
  }

  function getCurrentYear() {
    const n = new Date(); const y = n.getFullYear(); const m = n.getMonth()+1
    return m >= 9 ? `${y}-${y+1}` : `${y-1}-${y}`
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const evidence_files = IMPACT_CRITERIA
        .filter(c => checks[c.key] && files[c.type]?.done)
        .map(c => ({ impactType: 'Supervisor — ' + c.type, fileName: files[c.type].fileName, fileUrl: files[c.type].url }))

      const update = {
        supervisor_confirmed:              true,
        supervisor_comments:               comments || null,
        supervisor_evidence_files:         evidence_files,
        supervisor_submitted_at:           new Date().toISOString(),
        supervisor_has_publication:        !!checks.supervisor_has_publication,
        supervisor_has_ip:                 !!checks.supervisor_has_ip,
        supervisor_has_industry_partner:   !!checks.supervisor_has_industry_partner,
        supervisor_has_public_events:      !!checks.supervisor_has_public_events,
        supervisor_has_policy_citation:    !!checks.supervisor_has_policy_citation,
        supervisor_has_commercialisation:  !!checks.supervisor_has_commercialisation,
      }

      if (data.impact) {
        await supabase.from('research_impact').update(update).eq('id', data.impact.id)
      } else {
        // No student submission yet — create one
        await supabase.from('research_impact').insert({
          student_id:    data.student.id,
          department_id: data.student.department_id,
          academic_year: getCurrentYear(),
          program_level: data.student.program_level || 'Postgraduate',
          thesis_title:  data.student.thesis_title,
          no_impact:     false,
          evidence_files: [],
          ...update,
        })
      }
      setSubmitted(true)
    } catch(e) { setError(e.message) }
    setSubmitting(false)
  }

  const primary = data?.student?.departments?.primary_color || '#1e3a5f'
  const accent  = data?.student?.departments?.accent_color  || '#d4a843'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#f1f5f9'}}>
      <Loader2 size={32} className="animate-spin" style={{color:'#1e3a5f'}}/>
    </div>
  )

  if (error && !data) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#f1f5f9'}}>
      <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
        <AlertCircle size={40} className="mx-auto mb-4 text-red-400"/>
        <p className="text-gray-700">{error}</p>
      </div>
    </div>
  )

  const { student, impact } = data || {}

  return (
    <div className="min-h-screen pb-12" style={{background:'#f1f5f9'}}>
      <div className="px-4 pt-8 pb-6 text-center" style={{background:primary}}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{background:`${accent}22`, border:`1px solid ${accent}44`}}>
          <GraduationCap size={28} style={{color:accent}}/>
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Supervisor Research Impact Confirmation</h1>
        <p className="text-sm" style={{color:`${accent}cc`}}>Gulf Medical University</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">

        {/* Student + thesis info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4" style={{borderColor:accent}}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Student Thesis</p>
          <p className="font-semibold text-gray-800">{student?.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{student?.program} · {student?.program_level}</p>
          {student?.thesis_title && (
            <div className="mt-3 p-3 rounded-xl" style={{background:`${accent}11`}}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color:accent}}>Thesis Title</p>
              <p className="text-sm text-gray-700 font-medium">{student.thesis_title}</p>
            </div>
          )}
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4" style={{color:accent}}/>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Confirmation Submitted</h2>
            <p className="text-gray-500 text-sm">Thank you. Your confirmation has been recorded and the coordinator will be notified.</p>
          </div>
        ) : (
          <>
            {/* Student submission summary */}
            {impact && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  What the student declared
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {IMPACT_CRITERIA.map(c => (
                    <div key={c.key} className={`px-3 py-2 rounded-xl text-xs font-medium ${
                      impact[c.studentKey]
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-100'
                    }`}>
                      {impact[c.studentKey] ? '✓' : '✗'} {c.label.split('(')[0].trim()}
                    </div>
                  ))}
                  {impact.no_impact && (
                    <div className="col-span-2 px-3 py-2 rounded-xl text-xs bg-gray-50 text-gray-500 border border-gray-100">
                      Student indicated no impact criteria met
                    </div>
                  )}
                </div>
                {impact.evidence_files?.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {impact.evidence_files.map((f,i) => (
                      <a key={i} href={f.fileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                        📄 {f.impactType} — {f.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!impact && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm text-amber-700">The student has not yet submitted their declaration. You may still submit your confirmation and it will be recorded.</p>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                Please confirm the research impact for this thesis. You may check additional criteria the student may have missed, and upload supplementary evidence where applicable.
              </p>
            </div>

            {/* Impact criteria */}
            <div className="space-y-3">
              {IMPACT_CRITERIA.map(criterion => (
                <div key={criterion.key}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden transition-all"
                  style={checks[criterion.key] ? {border:`2px solid ${accent}`} : {border:'2px solid transparent'}}>
                  <button onClick={()=>setChecks(p=>({...p,[criterion.key]:!p[criterion.key]}))}
                    className="w-full flex items-start gap-3 p-4 text-left">
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                      style={checks[criterion.key] ? {background:accent,borderColor:accent} : {borderColor:'#d1d5db'}}>
                      {checks[criterion.key] && <CheckCircle2 size={12} color="white"/>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{criterion.label}</p>
                      {impact?.[criterion.studentKey] && (
                        <p className="text-xs text-emerald-600 mt-0.5">✓ Student declared this</p>
                      )}
                    </div>
                  </button>

                  {checks[criterion.key] && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      {!files[criterion.type]?.done ? (
                        <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer"
                          style={{borderColor:`${accent}44`}}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{background:`${accent}15`}}>
                            {files[criterion.type]?.uploading
                              ? <Loader2 size={16} className="animate-spin" style={{color:accent}}/>
                              : <Upload size={16} style={{color:accent}}/>}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {files[criterion.type]?.uploading ? 'Uploading…' : 'Upload Additional Evidence (optional)'}
                            </p>
                            <p className="text-xs text-gray-400">PDF, Word, image or any document</p>
                          </div>
                          <input type="file" className="hidden"
                            disabled={files[criterion.type]?.uploading}
                            onChange={e=>e.target.files[0]&&uploadFile(criterion.type,e.target.files[0])}/>
                        </label>
                      ) : (
                        <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:`${accent}11`}}>
                          <FileText size={18} style={{color:accent}} className="shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{files[criterion.type].fileName}</p>
                            <p className="text-xs" style={{color:accent}}>✓ Uploaded</p>
                          </div>
                          <button onClick={()=>setFiles(p=>{const n={...p};delete n[criterion.type];return n})}
                            className="text-gray-400 hover:text-red-400"><X size={14}/></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Comments */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                Additional Comments (optional)
              </label>
              <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                rows={3} placeholder="Any additional context or corrections…"
                value={comments} onChange={e=>setComments(e.target.value)}/>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5"/>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:primary}}>
              {submitting ? <><Loader2 size={16} className="animate-spin"/>Submitting…</> : 'Submit Confirmation'}
            </button>

            <p className="text-center text-xs text-gray-400 pb-4">
              Evidence files are saved securely to Gulf Medical University Google Drive.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
