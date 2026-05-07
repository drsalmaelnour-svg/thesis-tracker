import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { GraduationCap, Upload, CheckCircle2, AlertCircle, Loader2, X, FileText, Lock } from 'lucide-react'

const UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbz-6zIaHlAgNsEKEjkbx_MqAHapSLxZN8Pa18ACSul98UH4RHrOykcRfG5mEY4wKAn_/exec'

const IMPACT_CRITERIA = [
  { key:'has_publication',       supKey:'supervisor_has_publication',       label:'Published in a peer-reviewed journal or indexed in SCOPUS',        hint:'Upload your publication, acceptance letter, or DOI confirmation', type:'Publication' },
  { key:'has_ip',                supKey:'supervisor_has_ip',                label:'Intellectual Property developed (patent, copyright, trademark)',     hint:'Upload your IP certificate or registration document',             type:'Intellectual Property' },
  { key:'has_industry_partner',  supKey:'supervisor_has_industry_partner',  label:'Research supported by an industry partner',                         hint:'Upload the MOU, agreement, or letter of support',                 type:'Industry Partnership', extra:'partner_name' },
  { key:'has_public_events',     supKey:'supervisor_has_public_events',     label:'Presented at 5 or more public events (conferences, symposiums)',     hint:'Upload invitation letters, programmes, or certificates',           type:'Public Events' },
  { key:'has_policy_citation',   supKey:'supervisor_has_policy_citation',   label:'Research cited in a government or policy document',                  hint:'Upload the policy document referencing your research',             type:'Policy Citation' },
  { key:'has_commercialisation', supKey:'supervisor_has_commercialisation', label:'Revenue generated from research output (≥ AED 50,000)',              hint:'Upload financial records or commercialisation agreement',          type:'Commercialisation' },
]

function getCurrentYear() {
  const n=new Date(); const y=n.getFullYear(); const m=n.getMonth()+1
  return m>=9?`${y}-${y+1}`:`${y-1}-${y}`
}

export default function ResearchImpact() {
  const location = useLocation()
  const token    = new URLSearchParams(location.search).get('t')

  const [student,     setStudent]     = useState(null)
  const [impact,      setImpact]      = useState(null)   // existing submission if any
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [submitted,   setSubmitted]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  const [checks,      setChecks]      = useState({})
  const [files,       setFiles]       = useState({})
  const [partnerName, setPartnerName] = useState('')
  const [comments,    setComments]    = useState('')
  const [noImpact,    setNoImpact]    = useState(false)

  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return }
    async function load() {
      try {
        const { supabase } = await import('../lib/supabase')
        const { data: studentData, error: sErr } = await supabase
          .from('students')
          .select('*, departments(name,primary_color,accent_color), supervisors(id,name,email)')
          .eq('impact_token', token).single()
        if (sErr || !studentData) { setError('This link is invalid or has expired.'); return }

        // Load existing impact submission (supervisor may have already submitted)
        const { data: existingImpact } = await supabase
          .from('research_impact').select('*')
          .eq('student_id', studentData.id)
          .eq('academic_year', getCurrentYear())
          .maybeSingle()

        setStudent(studentData)
        setImpact(existingImpact)

        if (existingImpact) {
          // Allow resubmission if needs_info
          if (existingImpact.status === 'needs_info') {
            setImpact(existingImpact)
            // Pre-fill from previous submission
            const preChecks = {}
            IMPACT_CRITERIA.forEach(c => { if (existingImpact[c.key]) preChecks[c.key] = true })
            setChecks(preChecks)
            setPartnerName(existingImpact.industry_partner_name || '')
            setComments(existingImpact.student_comments || '')
            setNoImpact(existingImpact.no_impact || false)
            return
          }
          // Already submitted or approved
          setSubmitted(true)
          setStudent(studentData)
          return
        }
      } catch(e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [token])

  // Check if a criterion was filled by supervisor (locked for student)
  function isLockedBySupervisor(criterion) {
    return !!(impact?.supervisor_submitted_at && impact[criterion.supKey])
  }

  async function uploadFile(impactType, file) {
    setFiles(prev => ({ ...prev, [impactType]: { file, uploading: true, done: false, url: '', fileName: file.name } }))
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload  = e => res(e.target.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const form = new FormData()
      form.append('studentName',  student.name)
      form.append('thesisTitle',  student.thesis_title || 'No Title')
      form.append('year',         getCurrentYear())
      form.append('level',        student.program_level || 'Postgraduate')
      form.append('dept',         student.departments?.name || 'Medical Laboratory Sciences')
      form.append('impactType',   impactType)
      form.append('fileName',     file.name)
      form.append('mimeType',     file.type)
      form.append('file',         base64)
      const res  = await fetch(UPLOAD_URL, { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setFiles(prev => ({ ...prev, [impactType]: { file, uploading: false, done: true, url: data.viewUrl, fileName: data.fileName } }))
    } catch(e) {
      setFiles(prev => ({ ...prev, [impactType]: { file, uploading: false, done: false, error: e.message, fileName: file.name } }))
    }
  }

  async function handleSubmit() {
    const anyChecked = Object.values(checks).some(Boolean)
    if (!anyChecked && !noImpact) {
      setError('Please select at least one impact criterion or indicate no impact.')
      return
    }
    // Check non-locked criteria have evidence
    for (const c of IMPACT_CRITERIA) {
      if (checks[c.key] && !isLockedBySupervisor(c) && (!files[c.type] || !files[c.type].done)) {
        setError(`Please upload evidence for: ${c.label}`)
        return
      }
    }
    setSubmitting(true); setError('')
    try {
      const { supabase } = await import('../lib/supabase')

      // Build evidence array — only student-uploaded files (not supervisor's)
      const evidence_files = IMPACT_CRITERIA
        .filter(c => checks[c.key] && !isLockedBySupervisor(c) && files[c.type]?.done)
        .map(c => ({ impactType: c.type, fileName: files[c.type].fileName, fileUrl: files[c.type].url }))

      const payload = {
        has_publication:       !!checks.has_publication,
        has_ip:                !!checks.has_ip,
        has_industry_partner:  !!checks.has_industry_partner,
        has_public_events:     !!checks.has_public_events,
        has_policy_citation:   !!checks.has_policy_citation,
        has_commercialisation: !!checks.has_commercialisation,
        no_impact:             noImpact,
        industry_partner_name: partnerName || null,
        evidence_files,
        student_comments:      comments || null,
        status:                'pending',
        submitted_at:          new Date().toISOString(),
      }

      if (impact?.id) {
        // Update existing record (supervisor submitted first)
        await supabase.from('research_impact').update(payload).eq('id', impact.id)
      } else {
        await supabase.from('research_impact').insert({
          ...payload,
          student_id:    student.id,
          department_id: student.department_id,
          academic_year: getCurrentYear(),
          program_level: student.program_level || 'Postgraduate',
          thesis_title:  student.thesis_title,
        })
      }
      setSubmitted(true)
    } catch(e) { setError(e.message) }
    setSubmitting(false)
  }

  const primary = student?.departments?.primary_color || '#1e3a5f'
  const accent  = student?.departments?.accent_color  || '#d4a843'
  const supName = student?.supervisors?.name || 'your supervisor'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#f1f5f9'}}>
      <Loader2 size={32} className="animate-spin" style={{color:primary}}/>
    </div>
  )
  if (error && !student) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#f1f5f9'}}>
      <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
        <AlertCircle size={40} className="mx-auto mb-4 text-red-400"/>
        <p className="text-gray-700">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-12" style={{background:'#f1f5f9'}}>
      {/* Header */}
      <div className="px-4 pt-8 pb-6 text-center" style={{background:primary}}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{background:`${accent}22`,border:`1px solid ${accent}44`}}>
          <GraduationCap size={28} style={{color:accent}}/>
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Research Impact Declaration</h1>
        <p className="text-sm" style={{color:`${accent}cc`}}>Gulf Medical University</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {/* Student info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4" style={{borderColor:accent}}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Your Details</p>
          <p className="font-semibold text-gray-800">{student?.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{student?.program} · {student?.program_level}</p>
          {student?.thesis_title && (
            <div className="mt-3 p-3 rounded-xl" style={{background:`${accent}11`}}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color:accent}}>Thesis Title</p>
              <p className="text-sm text-gray-700 font-medium">{student.thesis_title}</p>
            </div>
          )}
        </div>

        {/* Coordinator requested more info */}
        {impact?.status === 'needs_info' && impact?.coordinator_notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm text-amber-700 font-medium mb-1">⚠ Additional information requested by your coordinator</p>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">{impact.coordinator_notes}</p>
            <p className="text-xs text-amber-600 mt-2">Please update your submission below and resubmit.</p>
          </div>
        )}

        {/* Supervisor pre-filled notice */}
        {impact?.supervisor_submitted_at && !impact?.submitted_at && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-sm text-blue-700 font-medium mb-1">📋 Your supervisor has already filled in some details</p>
            <p className="text-xs text-blue-600">
              {supName} has submitted their confirmation. Fields marked with 🔒 were filled by your supervisor and cannot be changed.
              You may still add any additional impact criteria they may have missed.
            </p>
          </div>
        )}

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4" style={{color:accent}}/>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Submitted Successfully</h2>
            <p className="text-gray-500 text-sm">Your research impact declaration has been received. Your coordinator will review it shortly.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                Please indicate whether your thesis research has achieved any of the following impacts.
                For each criterion you select, upload the supporting evidence file.
              </p>
            </div>

            {/* Impact criteria */}
            <div className="space-y-3">
              {IMPACT_CRITERIA.map(criterion => {
                const locked = isLockedBySupervisor(criterion)
                return (
                  <div key={criterion.key}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden transition-all"
                    style={checks[criterion.key]
                      ? {border:`2px solid ${locked?'#3b82f6':accent}`}
                      : {border:'2px solid transparent'}}>

                    <button
                      onClick={() => {
                        if (locked || noImpact) return
                        setChecks(prev => ({...prev, [criterion.key]: !prev[criterion.key]}))
                      }}
                      className="w-full flex items-start gap-3 p-4 text-left"
                      disabled={locked || noImpact}>
                      <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={locked
                          ? {background:'#3b82f6',borderColor:'#3b82f6'}
                          : checks[criterion.key]
                            ? {background:accent,borderColor:accent}
                            : {borderColor:'#d1d5db'}}>
                        {locked
                          ? <Lock size={10} color="white"/>
                          : checks[criterion.key]
                            ? <CheckCircle2 size={12} color="white"/>
                            : null}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">{criterion.label}</p>
                          {locked && (
                            <span className="px-2 py-0.5 rounded-lg text-xs bg-blue-100 text-blue-600 font-medium shrink-0">
                              🔒 Filled by {supName.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        {!locked && <p className="text-xs text-gray-400 mt-0.5">{criterion.hint}</p>}
                        {locked && (
                          <p className="text-xs text-blue-500 mt-0.5">
                            Your supervisor has confirmed this impact type.
                            {impact?.supervisor_evidence_files?.find(e=>e.impactType?.includes(criterion.type)) && (
                              <span className="ml-1">Evidence uploaded by supervisor.</span>
                            )}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Upload area — only for non-locked selected criteria */}
                    {checks[criterion.key] && !locked && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                        {criterion.extra === 'partner_name' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Industry Partner Name</label>
                            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400"
                              placeholder="e.g. Dubai Health Authority"
                              value={partnerName} onChange={e=>setPartnerName(e.target.value)}/>
                          </div>
                        )}
                        {!files[criterion.type]?.done ? (
                          <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-amber-400"
                            style={{borderColor:`${accent}44`}}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:`${accent}15`}}>
                              {files[criterion.type]?.uploading
                                ? <Loader2 size={16} className="animate-spin" style={{color:accent}}/>
                                : <Upload size={16} style={{color:accent}}/>}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                {files[criterion.type]?.uploading?'Uploading to Google Drive…':'Upload Evidence File'}
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
                              <p className="text-xs" style={{color:accent}}>✓ Uploaded to Google Drive</p>
                            </div>
                            <button onClick={()=>setFiles(prev=>{const n={...prev};delete n[criterion.type];return n})}
                              className="text-gray-400 hover:text-red-400 shrink-0"><X size={14}/></button>
                          </div>
                        )}
                        {files[criterion.type]?.error && (
                          <p className="text-xs text-red-500">{files[criterion.type].error}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* No impact */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden"
                style={noImpact?{border:'2px solid #94a3b8'}:{border:'2px solid transparent'}}>
                <button onClick={()=>{setNoImpact(v=>!v); if(!noImpact) setChecks({})}}
                  className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                    style={noImpact?{background:'#94a3b8',borderColor:'#94a3b8'}:{borderColor:'#d1d5db'}}>
                    {noImpact&&<CheckCircle2 size={12} color="white"/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">None of the above apply to my research</p>
                    <p className="text-xs text-gray-400 mt-0.5">My thesis does not yet meet any of the above impact criteria</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                Additional Comments (optional)
              </label>
              <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-amber-400"
                rows={3} placeholder="Any additional context about your research impact…"
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
              {submitting?<><Loader2 size={16} className="animate-spin"/>Submitting…</>:'Submit Research Impact Declaration'}
            </button>

            <p className="text-center text-xs text-gray-400 pb-4">
              Your evidence files are saved securely to Gulf Medical University Google Drive.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
