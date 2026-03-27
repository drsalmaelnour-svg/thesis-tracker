import { useState, useEffect } from 'react'
import {
  UserCheck, Users, ChevronDown, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, Filter, Send, Trash2, Info, X
} from 'lucide-react'
import {
  getStudentsWithProgress, getExternalExaminers,
  getAssessmentAssignments, upsertAssessmentAssignment,
  getExaminerResponseLink, logActivity
} from '../lib/supabase'
import { sendStudentEmail } from '../lib/emailService'

const ASSESSMENT_TYPES = [
  { id:'proposal_defense', label:'Proposal Defense',            course:'Thesis 1', examiners:'2 internal' },
  { id:'progress_1',       label:'First Progress Report',       course:'Thesis 2', examiners:'2 internal' },
  { id:'progress_2',       label:'Second Progress Report',      course:'Thesis 2', examiners:'2 internal' },
  { id:'defense_combined', label:'Thesis Defense (Before & After)', course:'Thesis 2', examiners:'1 internal + 1 external', combined:true },
  { id:'defense_before',   label:'Defense Before (Formative)',  course:'Thesis 2', examiners:'1 internal + 1 external' },
  { id:'defense_after',    label:'Defense After (Final)',        course:'Thesis 2', examiners:'1 internal + 1 external' },
]

const NEEDS_EXTERNAL_TYPES = ['defense_before','defense_after','defense_combined']

// see NEEDS_EXTERNAL_TYPES above

function badge(course) {
  return course === 'Thesis 1'
    ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
    : 'bg-navy-700/40 text-navy-300 border-navy-600/30'
}

export default function AssignExaminers() {
  const [students,   setStudents]   = useState([])
  const [supervisors,setSupervisors]= useState([])
  const [externals,  setExternals]  = useState([])
  const [assignments,setAssignments]= useState([])
  const [loading,    setLoading]    = useState(true)

  // Filters
  const [cohortFilter,  setCohortFilter]   = useState('all')
  const [assessmentType,setAssessmentType] = useState('proposal_defense')

  // Single assignment state
  const [selStudent, setSelStudent] = useState('')
  const [ex1, setEx1] = useState('')  // examiner 1 id
  const [ex2, setEx2] = useState('')  // examiner 2 id
  const [ex1Type, setEx1Type] = useState('internal')
  const [ex2Type, setEx2Type] = useState('internal')
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  // Email modal state
  const [emailModal, setEmailModal]     = useState(null) // { assignment, examinerName, examinerEmail }
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody]       = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent]       = useState(false)

  // Bulk assign state
  const [bulkEx1,     setBulkEx1]     = useState('')
  const [bulkEx2,     setBulkEx2]     = useState('')
  const [bulkEx1Type, setBulkEx1Type] = useState('internal')
  const [bulkEx2Type, setBulkEx2Type] = useState('internal')
  const [bulkSaving,  setBulkSaving]  = useState(false)
  const [bulkMsg,     setBulkMsg]     = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const [studs, exts, asgns, sups] = await Promise.all([
        getStudentsWithProgress(),
        getExternalExaminers(),
        getAssessmentAssignments(),
        supabase.from('supervisors').select('*').order('name'),
      ])
      setStudents(studs)
      setExternals(exts)
      setAssignments(asgns)
      setSupervisors(sups.data || [])
      if (studs.length) setSelStudent(studs[0].id)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // When student or assessment changes, pre-fill existing assignments
  useEffect(() => {
    if (!selStudent || !assessmentType) return
    const existing = assignments.filter(a =>
      a.student_id === selStudent && a.assessment_type === assessmentType
    )
    const e1 = existing.find(a=>a.examiner_number===1)
    const e2 = existing.find(a=>a.examiner_number===2)
    setEx1(e1?.examiner_id || e1?.external_examiner_id || '')
    setEx2(e2?.examiner_id || e2?.external_examiner_id || '')
    setEx1Type(e1?.examiner_type || 'internal')
    setEx2Type(e2?.examiner_type || (NEEDS_EXTERNAL.includes(assessmentType) ? 'external' : 'internal'))
  }, [selStudent, assessmentType, assignments])

  const cohortYears     = [...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
  const filteredStudents = cohortFilter==='all' ? students
    : students.filter(s=>Number(s.enrollment_year)===Number(cohortFilter))

  const currentStudent  = students.find(s=>s.id===selStudent)
  const needsExternal   = NEEDS_EXTERNAL_TYPES.includes(assessmentType)
  const isCombined      = assessmentType === 'defense_combined'

  // Internal examiners for this student = all supervisors EXCEPT their own supervisor
  function internalOptions(studentId) {
    const s = students.find(x=>x.id===studentId)
    return supervisors.filter(sup => sup.id !== s?.supervisor_id)
  }

  function examinerOptions(studentId, examinerType) {
    if (examinerType === 'external') return externals
    return internalOptions(studentId)
  }

  function getExaminerEmail(asgn) {
    if (!asgn) return ''
    if (asgn.examiner_type === 'external') return asgn.external_examiners?.email || ''
    return supervisors.find(s => s.id === asgn.examiner_id)?.email || ''
  }

  function openEmailModal(asgn) {
    const name  = getExaminerName(asgn)
    const email = getExaminerEmail(asgn)
    const typeName = ASSESSMENT_TYPES.find(t => t.id === assessmentType)?.label || assessmentType
    const student  = students.find(s => s.id === asgn.student_id)
    const link     = getExaminerResponseLink(asgn.token)
    setEmailSubject(`Thesis Assessment — ${typeName} — ${student?.name || ''}`)
    setEmailBody(
      `Dear ${name},

I hope this message finds you well.

You have been assigned as an examiner for the ${typeName} of the following student:

Student: ${student?.name || ''}
Registration No.: ${student?.student_id || ''}
Supervisor: ${student?.supervisors?.name || ''}

Please complete your evaluation using the link below. All student information has been pre-filled for your convenience.

Your evaluation is strictly confidential.

Please complete this at your earliest convenience.

Best regards,
Dr. Salma Elnour
Thesis Coordinator
Gulf Medical University`
    )
    setEmailModal({ asgn, name, email, link })
    setEmailSent(false)
  }

  async function sendExaminerEmail() {
    if (!emailModal) return
    setEmailSending(true)
    try {
      const { supabase } = await import('../lib/supabase')
      // Use sendStudentEmail with the examiner as recipient
      await sendStudentEmail({
        student: { name: emailModal.name, email: emailModal.email, token: '' },
        milestoneId: null,
        subject: emailSubject,
        message: emailBody,
        response_link: emailModal.link,
      })
      // Mark email_sent_at
      await supabase.from('assessment_assignments')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', emailModal.asgn.id)
      setEmailSent(true)
      load()
    } catch(e) {
      console.error(e)
    }
    setEmailSending(false)
  }

  async function handleSave() {
    if (!ex1) { setSaveMsg({ok:false, msg:'Please select Examiner 1.'}); return }
    if (!ex2) { setSaveMsg({ok:false, msg:'Please select Examiner 2.'}); return }
    if (ex1 === ex2) { setSaveMsg({ok:false, msg:'Examiner 1 and Examiner 2 must be different.'}); return }
    setSaving(true); setSaveMsg(null)
    try {
      const types = isCombined ? ['defense_before','defense_after'] : [assessmentType]
      for (const aType of types) {
        await upsertAssessmentAssignment({
          student_id: selStudent, assessment_type: aType,
          examiner_number: 1, examiner_type: ex1Type,
          examiner_id: ex1Type==='internal' ? ex1 : null,
          external_examiner_id: ex1Type==='external' ? ex1 : null,
        })
        await upsertAssessmentAssignment({
          student_id: selStudent, assessment_type: aType,
          examiner_number: 2, examiner_type: ex2Type,
          examiner_id: ex2Type==='internal' ? ex2 : null,
          external_examiner_id: ex2Type==='external' ? ex2 : null,
        })
      }
      const typeName = ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.label
      await logActivity(selStudent, 'milestone', `Examiners assigned for ${typeName}`)
      setSaveMsg({ok:true, msg: isCombined
        ? 'Examiners assigned for both Defense Before and Defense After.'
        : 'Examiners assigned successfully.'})
      load()
    } catch(e) {
      setSaveMsg({ok:false, msg: e.message || 'Failed to save.'})
    }
    setSaving(false)
  }

  async function handleBulkAssign() {
    if (!bulkEx1 || !bulkEx2) { setBulkMsg({ok:false, msg:'Please select both examiners.'}); return }
    if (bulkEx1 === bulkEx2) { setBulkMsg({ok:false, msg:'Examiner 1 and 2 must be different.'}); return }
    setBulkSaving(true); setBulkMsg(null)
    const types = isCombined ? ['defense_before','defense_after'] : [assessmentType]
    let count = 0
    for (const s of filteredStudents) {
      try {
        for (const aType of types) {
          await upsertAssessmentAssignment({
            student_id: s.id, assessment_type: aType,
            examiner_number: 1, examiner_type: bulkEx1Type,
            examiner_id: bulkEx1Type==='internal' ? bulkEx1 : null,
            external_examiner_id: bulkEx1Type==='external' ? bulkEx1 : null,
          })
          await upsertAssessmentAssignment({
            student_id: s.id, assessment_type: aType,
            examiner_number: 2, examiner_type: bulkEx2Type,
            examiner_id: bulkEx2Type==='internal' ? bulkEx2 : null,
            external_examiner_id: bulkEx2Type==='external' ? bulkEx2 : null,
          })
        }
        count++
      } catch(e) { console.error(e) }
    }
    setBulkMsg({ok:true, msg:`Assigned to ${count} student${count!==1?'s':''} successfully.`})
    setBulkSaving(false)
    load()
  }

  // Get assignment status for a student
  function getAssignmentStatus(studentId) {
    const asgn = assignments.filter(a=>a.student_id===studentId&&a.assessment_type===assessmentType)
    if (asgn.length >= 2) return 'assigned'
    if (asgn.length === 1) return 'partial'
    return 'none'
  }

  function getExaminerName(asgn) {
    if (!asgn) return '—'
    if (asgn.examiner_type==='external') return asgn.external_examiners?.name || '—'
    return supervisors.find(s=>s.id===asgn.examiner_id)?.name || '—'
  }

  function SelectExaminer({ label, value, onChange, type, onTypeChange, studentId, showTypeToggle=false }) {
    const opts = examinerOptions(studentId || selStudent, type)
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-navy-400">{label}</label>
          {showTypeToggle && needsExternal && (
            <div className="flex gap-1">
              {['internal','external'].map(t => (
                <button key={t} onClick={()=>{ onTypeChange(t); onChange('') }}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                    type===t ? 'border-gold-500/40 bg-gold-500/10 text-gold-300' : 'border-navy-600/50 text-navy-400'
                  }`}>{t}</button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <select className="input text-sm appearance-none pr-7"
            value={value} onChange={e=>onChange(e.target.value)}>
            <option value="">— Select {type} examiner —</option>
            {opts.map(e=>(
              <option key={e.id} value={e.id}>
                {e.name}{e.designation ? ` — ${e.designation}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Assign Examiners</h1>
          <p className="text-navy-400 mt-1">Assign internal and external examiners per student per assessment</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw size={14} className={loading?'animate-spin':''}/> Refresh
        </button>
      </div>

      {/* Assessment type + cohort filter */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <label className="block text-xs text-navy-400 mb-2 uppercase tracking-wider">Assessment Type</label>
          <div className="relative">
            <select className="input text-sm appearance-none pr-7"
              value={assessmentType} onChange={e=>setAssessmentType(e.target.value)}>
              {ASSESSMENT_TYPES.map(t=>(
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
          </div>
          {assessmentType && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-lg border ${badge(ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.course)}`}>
                {ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.course}
              </span>
              <span className="text-xs text-navy-500">
                {ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.examiners}
              </span>
            </div>
          )}
        </div>
        <div className="card p-4">
          <label className="block text-xs text-navy-400 mb-2 uppercase tracking-wider">Cohort Filter</label>
          <div className="relative">
            <select className="input text-sm appearance-none pr-7"
              value={cohortFilter} onChange={e=>setCohortFilter(e.target.value)}>
              <option value="all">All Cohorts</option>
              {cohortYears.map(y=><option key={y} value={y}>{y} Cohort — {students.filter(s=>Number(s.enrollment_year)===Number(y)).length} students</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Student list */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-4 text-sm flex items-center gap-2">
            <Users size={14} className="text-gold-400"/> Students
            <span className="text-xs text-navy-500 font-normal">({filteredStudents.length})</span>
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {filteredStudents.map(s => {
              const status = getAssignmentStatus(s.id)
              return (
                <button key={s.id} onClick={()=>setSelStudent(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    selStudent===s.id
                      ? 'border-gold-500/40 bg-gold-500/10'
                      : 'border-transparent hover:border-navy-600/50 hover:bg-navy-800/30'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    status==='assigned' ? 'bg-emerald-400' :
                    status==='partial'  ? 'bg-amber-400' : 'bg-navy-600'
                  }`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-300 truncate">{s.name}</p>
                    <p className="text-xs text-navy-500 font-mono">{s.student_id}</p>
                  </div>
                  {status==='assigned' && <CheckCircle2 size={12} className="text-emerald-400 shrink-0"/>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-navy-700/50 flex gap-3 text-xs text-navy-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Assigned</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Partial</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-navy-600 inline-block"/>None</span>
          </div>
        </div>

        {/* Single assignment */}
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-slate-100 text-sm flex items-center gap-2">
            <UserCheck size={14} className="text-gold-400"/> Assign Examiners
          </h2>

          {currentStudent && (
            <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
              <p className="text-xs font-medium text-slate-200">{currentStudent.name}</p>
              <p className="text-xs text-navy-400 font-mono">{currentStudent.student_id}</p>
              {currentStudent.supervisors && (
                <p className="text-xs text-navy-500 mt-0.5">Supervisor: {currentStudent.supervisors.name}</p>
              )}
            </div>
          )}

          {needsExternal && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-900/10 border border-amber-700/20">
              <Info size={12} className="text-amber-400 shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-300/80">This assessment requires 1 internal + 1 external examiner. Use the type toggle to switch.</p>
            </div>
          )}

          <SelectExaminer label="Examiner 1" value={ex1} onChange={setEx1}
            type={ex1Type} onTypeChange={setEx1Type} showTypeToggle />

          <SelectExaminer label="Examiner 2" value={ex2} onChange={setEx2}
            type={ex2Type} onTypeChange={setEx2Type} showTypeToggle />

          {saveMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              saveMsg.ok ? 'bg-emerald-900/20 text-emerald-300 border border-emerald-700/40'
              : 'bg-red-900/20 text-red-300 border border-red-700/40'
            }`}>
              {saveMsg.ok ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
              {saveMsg.msg}
            </div>
          )}

          <button onClick={handleSave} disabled={saving||!selStudent}
            className="btn-primary w-full justify-center disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <UserCheck size={14}/>}
            {saving ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>

        {/* Bulk assign */}
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold text-slate-100 text-sm flex items-center gap-2">
            <Users size={14} className="text-gold-400"/> Bulk Assign
            <span className="text-xs text-navy-500 font-normal">({filteredStudents.length} students)</span>
          </h2>

          <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
            <p className="text-xs text-navy-400 leading-relaxed">
              Assign the same examiners to all <strong className="text-slate-300">{filteredStudents.length} student{filteredStudents.length!==1?'s':''}</strong> in the current cohort filter for <strong className="text-slate-300">{ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.label}</strong>.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-navy-400">Examiner 1</label>
              {needsExternal && (
                <div className="flex gap-1">
                  {['internal','external'].map(t=>(
                    <button key={t} onClick={()=>{setBulkEx1Type(t);setBulkEx1('')}}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                        bulkEx1Type===t ? 'border-gold-500/40 bg-gold-500/10 text-gold-300' : 'border-navy-600/50 text-navy-400'
                      }`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7"
                value={bulkEx1} onChange={e=>setBulkEx1(e.target.value)}>
                <option value="">— Select examiner —</option>
                {(bulkEx1Type==='external' ? externals : supervisors).map(e=>(
                  <option key={e.id} value={e.id}>{e.name}{e.designation?` — ${e.designation}`:''}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-navy-400">Examiner 2</label>
              {needsExternal && (
                <div className="flex gap-1">
                  {['internal','external'].map(t=>(
                    <button key={t} onClick={()=>{setBulkEx2Type(t);setBulkEx2('')}}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                        bulkEx2Type===t ? 'border-gold-500/40 bg-gold-500/10 text-gold-300' : 'border-navy-600/50 text-navy-400'
                      }`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7"
                value={bulkEx2} onChange={e=>setBulkEx2(e.target.value)}>
                <option value="">— Select examiner —</option>
                {(bulkEx2Type==='external' ? externals : supervisors).map(e=>(
                  <option key={e.id} value={e.id}>{e.name}{e.designation?` — ${e.designation}`:''}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>

          {bulkMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              bulkMsg.ok ? 'bg-emerald-900/20 text-emerald-300 border border-emerald-700/40'
              : 'bg-red-900/20 text-red-300 border border-red-700/40'
            }`}>
              {bulkMsg.ok ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
              {bulkMsg.msg}
            </div>
          )}

          <button onClick={handleBulkAssign} disabled={bulkSaving||!filteredStudents.length}
            className="btn-secondary w-full justify-center disabled:opacity-50">
            {bulkSaving ? <Loader2 size={14} className="animate-spin"/> : <Users size={14}/>}
            {bulkSaving ? 'Assigning…' : `Assign to All ${filteredStudents.length} Students`}
          </button>
        </div>

      </div>

      {/* Assignment overview table */}
      <div className="card p-5">
        <h2 className="font-display font-semibold text-slate-100 mb-4 text-sm">
          Current Assignments — {ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.label}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-navy-700/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-navy-800/60 border-b border-navy-700/50">
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Student</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Reg No</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Examiner 1</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Examiner 2</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Send Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s,i) => {
                const asgn  = assignments.filter(a=>a.student_id===s.id&&a.assessment_type===assessmentType)
                const a1    = asgn.find(a=>a.examiner_number===1)
                const a2    = asgn.find(a=>a.examiner_number===2)
                const status= asgn.length>=2?'assigned':asgn.length===1?'partial':'none'
                return (
                  <tr key={s.id} className={`border-b border-navy-700/20 ${i%2===0?'':'bg-navy-800/10'} hover:bg-navy-700/20 transition-colors`}>
                    <td className="px-4 py-3 text-slate-300 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-navy-400 font-mono">{s.student_id}</td>
                    <td className="px-4 py-3 text-slate-300">{a1 ? getExaminerName(a1) : <span className="text-navy-600">Not assigned</span>}</td>
                    <td className="px-4 py-3 text-slate-300">{a2 ? getExaminerName(a2) : <span className="text-navy-600">Not assigned</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs font-medium ${
                        status==='assigned' ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' :
                        status==='partial'  ? 'bg-amber-900/20 border-amber-700/40 text-amber-300' :
                        'bg-navy-800/40 border-navy-700/40 text-navy-400'
                      }`}>
                        {status==='assigned'?'✓ Assigned':status==='partial'?'⚠ Partial':'— None'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {[a1,a2].filter(Boolean).map((asgn,ai) => {
                          const isDefBefore = asgn.assessment_type === 'defense_before'
                          return (
                            <button key={ai}
                              onClick={()=>openEmailModal(asgn, isDefBefore)}
                              title={isDefBefore ? `Send combined Before+After link to Examiner ${ai+1}` : `Send link to Examiner ${ai+1}`}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-all ${
                                asgn.email_sent_at
                                  ? 'border-emerald-700/40 text-emerald-400 bg-emerald-900/10'
                                  : 'btn-secondary'
                              }`}>
                              <Send size={10}/> E{ai+1}
                              {isDefBefore && <span className="text-gold-400/70">×2</span>}
                              {asgn.email_sent_at && <CheckCircle2 size={10}/>}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg fade-in shadow-2xl border-navy-600/60">
            <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
              <div>
                <h3 className="font-display font-semibold text-slate-100">Send Evaluation Link</h3>
                <p className="text-xs text-navy-400 mt-1">To: {emailModal.name} · {emailModal.email}</p>
              </div>
              <button onClick={()=>setEmailModal(null)} className="btn-ghost p-2 rounded-lg">
                <X size={16}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {emailModal.isCombined ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
                    <p className="text-xs text-navy-400 mb-1">Defense Before link (Stage 1)</p>
                    <p className="text-xs text-gold-400 font-mono truncate">{emailModal.link}</p>
                  </div>
                  {emailModal.linkAfter && (
                    <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
                      <p className="text-xs text-navy-400 mb-1">Defense After link (Stage 2)</p>
                      <p className="text-xs text-emerald-400 font-mono truncate">{emailModal.linkAfter}</p>
                    </div>
                  )}
                  <p className="text-xs text-amber-400/70">Both links are included in the message body above.</p>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
                  <p className="text-xs text-navy-400 mb-1">Response link (auto-included)</p>
                  <p className="text-xs text-gold-400 font-mono truncate">{emailModal.link}</p>
                </div>
              )}
              <div>
                <label className="block text-xs text-navy-400 mb-1.5">Subject</label>
                <input className="input text-sm" value={emailSubject}
                  onChange={e=>setEmailSubject(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-navy-400 mb-1.5">Message — edit before sending</label>
                <textarea className="input text-sm resize-none leading-relaxed"
                  style={{minHeight:'180px'}}
                  value={emailBody} onChange={e=>setEmailBody(e.target.value)}/>
              </div>
              {emailSent && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 px-3 py-2 rounded-lg">
                  <CheckCircle2 size={13}/> Email sent successfully to {emailModal.email}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={sendExaminerEmail} disabled={emailSending||emailSent}
                  className="btn-primary disabled:opacity-50">
                  {emailSending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                  {emailSending ? 'Sending…' : emailSent ? 'Sent ✓' : 'Send Email'}
                </button>
                <button onClick={()=>setEmailModal(null)} className="btn-secondary">
                  <X size={14}/> Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
