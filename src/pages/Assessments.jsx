import { useState, useEffect, useRef } from 'react'
import {
  UserCheck, Users, ChevronDown, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, Send, X, UserPlus, Upload,
  Building2, Mail, BookOpen, Edit2, Save, Trash2,
  Search, Filter, ClipboardList, TrendingUp, Info
} from 'lucide-react'
import {
  getStudentsWithProgress, getExternalExaminers,
  upsertExternalExaminer, deleteExternalExaminer,
  getAssessmentAssignments, upsertAssessmentAssignment,
  getExaminerResponseLink, getExaminerPortalLink, logActivity
} from '../lib/supabase'
import { sendStudentEmail } from '../lib/emailService'

// ── Constants ─────────────────────────────────────────────────────────────────
const ASSESSMENT_TYPES = [
  { id:'proposal_defense',  label:'Proposal Defense',              course:'Thesis 1', examiners:'2 internal' },
  { id:'progress_1',        label:'First Progress Report',         course:'Thesis 2', examiners:'2 internal' },
  { id:'progress_2',        label:'Second Progress Report',        course:'Thesis 2', examiners:'2 internal' },
  { id:'defense_combined',  label:'Thesis Defense (Before & After)',course:'Thesis 2', examiners:'1 internal + 1 external', combined:true },
  { id:'defense_before',    label:'Defense Before (Formative)',    course:'Thesis 2', examiners:'1 internal + 1 external' },
  { id:'defense_after',     label:'Defense After (Final)',         course:'Thesis 2', examiners:'1 internal + 1 external' },
]
const NEEDS_EXTERNAL = ['defense_before','defense_after','defense_combined']
const BLANK_EXAMINER = { name:'', email:'', designation:'', institution:'', specialization:'' }

function courseBadge(course) {
  return course === 'Thesis 1'
    ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
    : 'bg-navy-700/40 text-navy-300 border-navy-600/30'
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick, count }) {
  return (
    <button onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
        active ? 'border-gold-500 text-gold-300' : 'border-transparent text-navy-400 hover:text-slate-300'
      }`}>
      {label}
      {count !== undefined && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active?'bg-gold-500/20 text-gold-400':'bg-navy-700/60 text-navy-400'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Assessments() {
  const [activeTab,   setActiveTab]   = useState('overview')
  const [students,    setStudents]    = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [externals,   setExternals]   = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [cohort,      setCohort]      = useState('all')

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
      setStudents(studs); setExternals(exts)
      setAssignments(asgns); setSupervisors(sups.data || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const cohortYears = [...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
  const filtered    = cohort==='all' ? students : students.filter(s=>Number(s.enrollment_year)===Number(cohort))

  // Helper: get assignment status for student + assessment
  function assignStatus(studentId, assessmentType) {
    const asgn = assignments.filter(a=>a.student_id===studentId&&a.assessment_type===assessmentType)
    if (asgn.length>=2) return 'assigned'
    if (asgn.length===1) return 'partial'
    return 'none'
  }

  function getExaminerName(asgn) {
    if (!asgn) return '—'
    if (asgn.examiner_type==='external') return asgn.external_examiners?.name || '—'
    return supervisors.find(s=>s.id===asgn.examiner_id)?.name || '—'
  }
  function getExaminerEmail(asgn) {
    if (!asgn) return ''
    if (asgn.examiner_type==='external') return asgn.external_examiners?.email || ''
    return supervisors.find(s=>s.id===asgn.examiner_id)?.email || ''
  }

  return (
    <div className="p-8 space-y-5 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Assessments</h1>
          <p className="text-navy-400 mt-1">Manage examiners, assignments and evaluation results</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cohort filter — applies to all tabs */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-navy-500"/>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7 py-2"
                value={cohort} onChange={e=>setCohort(e.target.value)}>
                <option value="all">All Cohorts</option>
                {cohortYears.map(y=>(
                  <option key={y} value={y}>{y} Cohort — {students.filter(s=>Number(s.enrollment_year)===Number(y)).length} students</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={14} className={loading?'animate-spin':''}/> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-navy-700/50">
        <Tab label="Overview"  active={activeTab==='overview'}  onClick={()=>setActiveTab('overview')} />
        <Tab label="Examiners" active={activeTab==='examiners'} onClick={()=>setActiveTab('examiners')} count={externals.length}/>
        <Tab label="Assign"    active={activeTab==='assign'}    onClick={()=>setActiveTab('assign')} />
        <Tab label="Results"   active={activeTab==='results'}   onClick={()=>setActiveTab('results')} />
      </div>

      {/* Tab content */}
      {activeTab==='overview'  && <OverviewTab  students={filtered} assignments={assignments} assignStatus={assignStatus} cohort={cohort}/>}
      {activeTab==='examiners' && <ExaminersTab externals={externals} onRefresh={load}/>}
      {activeTab==='assign'    && <AssignTab    students={filtered} supervisors={supervisors} externals={externals} assignments={assignments} onRefresh={load} getExaminerName={getExaminerName} getExaminerEmail={getExaminerEmail}/>}
      {activeTab==='results'   && <ResultsTab   students={filtered} assignments={assignments} supervisors={supervisors} externals={externals} getExaminerName={getExaminerName}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════
function OverviewTab({ students, assignments, assignStatus, cohort }) {
  const displayTypes = ASSESSMENT_TYPES.filter(t=>!t.combined)

  const stats = displayTypes.map(t => {
    const assigned = students.filter(s=>assignStatus(s.id,t.id)==='assigned').length
    return { ...t, assigned, total: students.length, pct: students.length ? Math.round(assigned/students.length*100) : 0 }
  })

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-navy-400 mb-1">Students in view</p>
          <p className="text-3xl font-display font-bold text-gold-400">{students.length}</p>
          <p className="text-xs text-navy-500 mt-1">{cohort==='all'?'All cohorts':`${cohort} cohort`}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-navy-400 mb-1">Fully assigned</p>
          <p className="text-3xl font-display font-bold text-emerald-400">
            {students.filter(s=>displayTypes.every(t=>assignStatus(s.id,t.id)==='assigned')).length}
          </p>
          <p className="text-xs text-navy-500 mt-1">All 5 assessments assigned</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-navy-400 mb-1">Pending assignment</p>
          <p className="text-3xl font-display font-bold text-amber-400">
            {students.filter(s=>displayTypes.some(t=>assignStatus(s.id,t.id)==='none')).length}
          </p>
          <p className="text-xs text-navy-500 mt-1">Have at least one unassigned</p>
        </div>
      </div>

      {/* Assignment progress per assessment */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-slate-100 mb-4 text-sm">Assignment Progress by Assessment</h3>
        <div className="space-y-3">
          {stats.map(t => (
            <div key={t.id} className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-lg border shrink-0 ${courseBadge(t.course)}`}>{t.course}</span>
              <span className="text-sm text-slate-300 w-52 shrink-0">{t.label}</span>
              <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${t.pct>=80?'bg-emerald-500':t.pct>=50?'bg-amber-500':'bg-red-500'}`}
                  style={{width:`${t.pct}%`}}/>
              </div>
              <span className="text-xs text-navy-400 shrink-0 w-20 text-right">{t.assigned} / {t.total} ({t.pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-student overview table */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-slate-100 mb-4 text-sm">Student Assignment Status</h3>
        <div className="overflow-x-auto rounded-xl border border-navy-700/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-navy-800/60 border-b border-navy-700/50">
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Student</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Cohort</th>
                {displayTypes.map(t=>(
                  <th key={t.id} className="text-center px-3 py-3 text-navy-300 font-semibold whitespace-nowrap">{t.label.split(' ').slice(0,2).join(' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s,i)=>(
                <tr key={s.id} className={`border-b border-navy-700/20 ${i%2===0?'':'bg-navy-800/10'}`}>
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-navy-400">{s.enrollment_year}</td>
                  {displayTypes.map(t=>{
                    const st = assignStatus(s.id,t.id)
                    return (
                      <td key={t.id} className="px-3 py-2.5 text-center">
                        <span className={`inline-block w-5 h-5 rounded-full text-xs font-bold leading-5 ${
                          st==='assigned'?'bg-emerald-500/20 text-emerald-400':
                          st==='partial' ?'bg-amber-500/20 text-amber-400':
                          'bg-navy-700/40 text-navy-600'
                        }`}>
                          {st==='assigned'?'✓':st==='partial'?'!':'—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// EXAMINERS TAB
// ══════════════════════════════════════════════════════════════
function ExaminersTab({ externals, onRefresh }) {
  const [search,     setSearch]     = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [importing,  setImporting]  = useState(false)
  const [importMsg,  setImportMsg]  = useState(null)
  const fileRef = useRef()

  async function handleSave(form) {
    await upsertExternalExaminer(form)
    setShowForm(false); setEditItem(null); onRefresh()
  }
  async function handleDelete(id) {
    await deleteExternalExaminer(id); onRefresh()
  }
  async function handleImport(file) {
    setImporting(true); setImportMsg(null)
    const text  = await file.text()
    const lines = text.trim().split('\n').slice(1)
    let added=0, failed=0
    for (const line of lines) {
      const [name,email,designation,institution,specialization] = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
      if (!name||!email) { failed++; continue }
      try { await upsertExternalExaminer({name,email,designation,institution,specialization}); added++ }
      catch { failed++ }
    }
    setImportMsg({added,failed}); setImporting(false); onRefresh()
  }
  function downloadTemplate() {
    const csv = ['Full Name,Email,Designation,Institution,Area of Specialization',
      'Dr. John Smith,j.smith@uni.ac.ae,Associate Professor,University of Sharjah,Clinical Biochemistry'].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download='external_examiners_template.csv'; a.click()
  }

  const shown = externals.filter(e=>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.institution||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"/>
          <input className="input pl-8 text-sm py-2" placeholder="Search examiners…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="btn-secondary text-xs"><Upload size={13}/> Template</button>
          <button onClick={()=>fileRef.current.click()} disabled={importing} className="btn-secondary text-xs disabled:opacity-50">
            {importing?<Loader2 size={13} className="animate-spin"/>:<Upload size={13}/>} Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleImport(e.target.files[0])}/>
          <button onClick={()=>{setShowForm(true);setEditItem(null)}} className="btn-primary text-xs">
            <UserPlus size={13}/> Add Examiner
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${importMsg.error?'bg-red-900/20 border-red-700/40 text-red-300':'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'}`}>
          <CheckCircle2 size={13}/> Imported {importMsg.added} examiners{importMsg.failed>0?` · ${importMsg.failed} skipped`:''}
        </div>
      )}

      {(showForm||editItem) && (
        <ExaminerForm initial={editItem||BLANK_EXAMINER} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditItem(null)}}/>
      )}

      <div className="grid grid-cols-3 gap-4">
        {shown.length===0 ? (
          <div className="col-span-3 card p-10 text-center text-navy-500">
            <Users size={28} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">{search?'No matches.':'No external examiners yet.'}</p>
          </div>
        ) : shown.map(e=>(
          <div key={e.id} className="card p-4 group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-bold text-gold-400 shrink-0">
                  {e.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{e.name}</p>
                  <p className="text-xs text-navy-400">{e.designation}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={()=>{setEditItem(e);setShowForm(false)}} className="btn-ghost p-1 rounded-lg"><Edit2 size={12}/></button>
                <button onClick={()=>handleDelete(e.id)} className="btn-ghost p-1 rounded-lg text-red-400/60 hover:text-red-400"><Trash2 size={12}/></button>
              </div>
            </div>
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-navy-400"><Building2 size={10}/>{e.institution||'—'}</div>
              <div className="flex items-center gap-1.5 text-xs text-navy-400"><Mail size={10}/>{e.email}</div>
              {e.specialization && <div className="flex items-center gap-1.5 text-xs text-navy-400"><BookOpen size={10}/>{e.specialization}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExaminerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!form.name.trim()||!form.email.trim()) { setErr('Name and email required.'); return }
    setSaving(true); try { await onSave(form) } catch(e) { setErr(e.message) } setSaving(false)
  }
  return (
    <div className="card p-5 border-gold-500/30">
      <h3 className="font-semibold text-slate-100 text-sm mb-4">{initial.id?'Edit':'Add'} External Examiner</h3>
      <div className="grid grid-cols-2 gap-3">
        {[['name','Full Name *','Dr. John Smith'],['email','Email *','j.smith@uni.ac.ae'],
          ['designation','Designation','Associate Professor'],['institution','Institution','University of Sharjah'],
          ['specialization','Specialization (optional)','Clinical Biochemistry']
        ].map(([k,l,p])=>(
          <div key={k} className={k==='specialization'?'col-span-2':''}>
            <label className="block text-xs text-navy-400 mb-1">{l}</label>
            <input className="input text-sm" placeholder={p} value={form[k]||''} onChange={e=>setForm(v=>({...v,[k]:e.target.value}))}/>
          </div>
        ))}
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving?<Loader2 size={13} className="animate-spin"/>:<Save size={13}/>} {saving?'Saving…':'Save'}
        </button>
        <button onClick={onCancel} className="btn-secondary"><X size={13}/> Cancel</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ASSIGN TAB
// ══════════════════════════════════════════════════════════════
function AssignTab({ students, supervisors, externals, assignments, onRefresh, getExaminerName, getExaminerEmail }) {
  const [assessmentType, setAssessmentType] = useState('proposal_defense')
  const [selStudent,     setSelStudent]     = useState(students[0]?.id||'')
  const [ex1, setEx1] = useState(''); const [ex1Type, setEx1Type] = useState('internal')
  const [ex2, setEx2] = useState(''); const [ex2Type, setEx2Type] = useState('internal')
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [bulkEx1, setBulkEx1] = useState(''); const [bulkEx1Type, setBulkEx1Type] = useState('internal')
  const [bulkEx2, setBulkEx2] = useState(''); const [bulkEx2Type, setBulkEx2Type] = useState('internal')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkMsg,    setBulkMsg]    = useState(null)
  const [emailModal, setEmailModal] = useState(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody,    setEmailBody]    = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent,    setEmailSent]    = useState(false)

  const needsExternal = NEEDS_EXTERNAL.includes(assessmentType)
  const isCombined    = assessmentType === 'defense_combined'

  useEffect(() => { if (students.length) setSelStudent(students[0].id) }, [students])

  useEffect(() => {
    if (!selStudent||!assessmentType||isCombined) return
    const asgn = assignments.filter(a=>a.student_id===selStudent&&a.assessment_type===assessmentType)
    const a1=asgn.find(a=>a.examiner_number===1); const a2=asgn.find(a=>a.examiner_number===2)
    setEx1(a1?.examiner_id||a1?.external_examiner_id||'')
    setEx2(a2?.examiner_id||a2?.external_examiner_id||'')
    setEx1Type(a1?.examiner_type||'internal')
    setEx2Type(a2?.examiner_type||(needsExternal?'external':'internal'))
  }, [selStudent, assessmentType, assignments])

  function internalOpts(studentId) {
    const s = students.find(x=>x.id===studentId)
    return supervisors.filter(sup=>sup.id!==s?.supervisor_id)
  }
  function examOpts(studentId, type) {
    return type==='external' ? externals : internalOpts(studentId)
  }

  async function handleSave() {
    if (!ex1||!ex2) { setSaveMsg({ok:false,msg:'Please select both examiners.'}); return }
    if (ex1===ex2)  { setSaveMsg({ok:false,msg:'Both examiners must be different.'}); return }
    setSaving(true); setSaveMsg(null)
    const types = isCombined ? ['defense_before','defense_after'] : [assessmentType]
    try {
      for (const aType of types) {
        await upsertAssessmentAssignment({ student_id:selStudent, assessment_type:aType, examiner_number:1, examiner_type:ex1Type, examiner_id:ex1Type==='internal'?ex1:null, external_examiner_id:ex1Type==='external'?ex1:null })
        await upsertAssessmentAssignment({ student_id:selStudent, assessment_type:aType, examiner_number:2, examiner_type:ex2Type, examiner_id:ex2Type==='internal'?ex2:null, external_examiner_id:ex2Type==='external'?ex2:null })
      }
      const label = ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.label
      await logActivity(selStudent,'milestone',`Examiners assigned for ${label}`)
      setSaveMsg({ok:true,msg:isCombined?'Assigned for both Defense Before & After.':'Assigned successfully.'})
      onRefresh()
    } catch(e) { setSaveMsg({ok:false,msg:e.message||'Failed.'}) }
    setSaving(false)
  }

  async function handleBulkAssign() {
    if (!bulkEx1||!bulkEx2) { setBulkMsg({ok:false,msg:'Select both examiners.'}); return }
    if (bulkEx1===bulkEx2)  { setBulkMsg({ok:false,msg:'Must be different.'}); return }
    setBulkSaving(true); setBulkMsg(null)
    const types = isCombined?['defense_before','defense_after']:[assessmentType]
    let count=0
    for (const s of students) {
      try {
        for (const aType of types) {
          await upsertAssessmentAssignment({ student_id:s.id, assessment_type:aType, examiner_number:1, examiner_type:bulkEx1Type, examiner_id:bulkEx1Type==='internal'?bulkEx1:null, external_examiner_id:bulkEx1Type==='external'?bulkEx1:null })
          await upsertAssessmentAssignment({ student_id:s.id, assessment_type:aType, examiner_number:2, examiner_type:bulkEx2Type, examiner_id:bulkEx2Type==='internal'?bulkEx2:null, external_examiner_id:bulkEx2Type==='external'?bulkEx2:null })
        }
        count++
      } catch(e) { console.error(e) }
    }
    setBulkMsg({ok:true,msg:`Assigned to ${count} student${count!==1?'s':''}.`})
    setBulkSaving(false); onRefresh()
  }

  function openEmail(asgn, combined=false) {
    const name    = getExaminerName(asgn)
    const email   = getExaminerEmail(asgn)
    const student = students.find(s=>s.id===asgn.student_id)
    const link    = combined
      ? getExaminerPortalLink(asgn.token)
      : getExaminerResponseLink(asgn.token)

    if (combined) {
      // Find the after assignment for same student + same examiner number
      const afterA = assignments.find(a =>
        a.student_id === asgn.student_id &&
        a.assessment_type === 'defense_after' &&
        a.examiner_number === asgn.examiner_number
      )
      const linkAfter = afterA ? getExaminerResponseLink(afterA.token) : null

      setEmailSubject(`Thesis Defense Evaluation — ${student?.name||''} (${student?.student_id||''})`)
      setEmailBody(
`Dear ${name},

You have been assigned as an examiner for the Thesis Defense of the following student:

Student:          ${student?.name||''}
Registration No.: ${student?.student_id||''}
Supervisor:       ${student?.supervisors?.name||''}

Please click the button below to access your Thesis Evaluation Portal. You will find both evaluation stages in one place:

  • Stage 1 — Defense Before (Formative)
    Complete before the oral defense to assess thesis readiness.

  • Stage 2 — Defense After (Final Scored)
    Complete after the defense once corrections are submitted.

All student information is pre-filled. Your evaluations are strictly confidential.

Please do not hesitate to contact me if you have any questions.

Best regards,
Dr. Salma Elnour
Thesis Coordinator
Gulf Medical University`)
      setEmailModal({ asgn, name, email, link, linkAfter, combined: true })

    } else {
      const typeName = ASSESSMENT_TYPES.find(t=>t.id===asgn.assessment_type)?.label||''
      setEmailSubject(`Thesis Assessment — ${typeName} — ${student?.name||''}`)
      setEmailBody(
`Dear ${name},

You have been assigned as an examiner for the ${typeName} of the following student:

Student:          ${student?.name||''}
Registration No.: ${student?.student_id||''}
Supervisor:       ${student?.supervisors?.name||''}

Please use the button below to access your evaluation form. All student information has been pre-filled for your convenience.

Your evaluation is strictly confidential.

Please complete this at your earliest convenience.

Best regards,
Dr. Salma Elnour
Thesis Coordinator
Gulf Medical University`)
      setEmailModal({ asgn, name, email, link, combined: false })
    }
    setEmailSent(false)
  }

  async function sendEmail() {
    if (!emailModal) return
    setEmailSending(true)
    try {
      await sendStudentEmail({ student:{name:emailModal.name,email:emailModal.email,token:''}, milestoneId:null, subject:emailSubject, message:emailBody, response_link:emailModal.link })
      const { supabase } = await import('../lib/supabase')
      await supabase.from('assessment_assignments').update({email_sent_at:new Date().toISOString()}).eq('id',emailModal.asgn.id)
      setEmailSent(true); onRefresh()
    } catch(e) { console.error(e) }
    setEmailSending(false)
  }

  // current student assignments for selected type
  const curAsgn = assignments.filter(a=>a.student_id===selStudent&&(isCombined?a.assessment_type==='defense_before':a.assessment_type===assessmentType))

  function StatusMsg({ ok, msg }) {
    return (
      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${ok?'bg-emerald-900/20 text-emerald-300 border border-emerald-700/40':'bg-red-900/20 text-red-300 border border-red-700/40'}`}>
        {ok?<CheckCircle2 size={12}/>:<AlertCircle size={12}/>} {msg}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Assessment type selector */}
      <div className="card p-4">
        <label className="block text-xs text-navy-400 mb-2 uppercase tracking-wider font-medium">Assessment Type</label>
        <div className="relative max-w-sm">
          <select className="input text-sm appearance-none pr-7"
            value={assessmentType} onChange={e=>setAssessmentType(e.target.value)}>
            {ASSESSMENT_TYPES.map(t=>(
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
        </div>
        {isCombined && (
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-300/80">
            <Info size={12}/> This will assign examiners to both Defense Before and Defense After in one action and send one combined email.
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Student list */}
        <div className="card p-4">
          <h3 className="font-semibold text-slate-200 text-sm mb-3 flex items-center gap-2">
            <Users size={13} className="text-gold-400"/> Students
          </h3>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {students.map(s=>{
              const aType = isCombined?'defense_before':assessmentType
              const asgn  = assignments.filter(a=>a.student_id===s.id&&a.assessment_type===aType)
              const status= asgn.length>=2?'assigned':asgn.length===1?'partial':'none'
              return (
                <button key={s.id} onClick={()=>setSelStudent(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center gap-2 ${
                    selStudent===s.id?'border-gold-500/40 bg-gold-500/10':'border-transparent hover:border-navy-600/50 hover:bg-navy-800/30'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${status==='assigned'?'bg-emerald-400':status==='partial'?'bg-amber-400':'bg-navy-600'}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-300 truncate">{s.name}</p>
                    <p className="text-xs text-navy-500 font-mono">{s.student_id}</p>
                  </div>
                  {status==='assigned'&&<CheckCircle2 size={11} className="text-emerald-400 shrink-0"/>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Single assign */}
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <UserCheck size={13} className="text-gold-400"/> Assign to Student
          </h3>
          {students.find(s=>s.id===selStudent) && (
            <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30 text-xs">
              <p className="font-medium text-slate-200">{students.find(s=>s.id===selStudent)?.name}</p>
              <p className="text-navy-400 font-mono">{students.find(s=>s.id===selStudent)?.student_id}</p>
            </div>
          )}
          {needsExternal && (
            <div className="flex items-start gap-2 px-2 py-2 rounded-xl bg-amber-900/10 border border-amber-700/20">
              <Info size={11} className="text-amber-400 shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-300/80">Requires 1 internal + 1 external</p>
            </div>
          )}
          {/* Examiner 1 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-navy-400">Examiner 1</label>
              {needsExternal && (
                <div className="flex gap-1">
                  {['internal','external'].map(t=>(
                    <button key={t} onClick={()=>{setEx1Type(t);setEx1('')}}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${ex1Type===t?'border-gold-500/40 bg-gold-500/10 text-gold-300':'border-navy-600/50 text-navy-400'}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7" value={ex1} onChange={e=>setEx1(e.target.value)}>
                <option value="">— Select —</option>
                {examOpts(selStudent,ex1Type).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>
          {/* Examiner 2 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-navy-400">Examiner 2</label>
              {needsExternal && (
                <div className="flex gap-1">
                  {['internal','external'].map(t=>(
                    <button key={t} onClick={()=>{setEx2Type(t);setEx2('')}}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${ex2Type===t?'border-gold-500/40 bg-gold-500/10 text-gold-300':'border-navy-600/50 text-navy-400'}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7" value={ex2} onChange={e=>setEx2(e.target.value)}>
                <option value="">— Select —</option>
                {examOpts(selStudent,ex2Type).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>
          {saveMsg && <StatusMsg ok={saveMsg.ok} msg={saveMsg.msg}/>}
          <button onClick={handleSave} disabled={saving||!selStudent} className="btn-primary w-full justify-center disabled:opacity-50">
            {saving?<Loader2 size={13} className="animate-spin"/>:<UserCheck size={13}/>}
            {saving?'Saving…':'Save Assignment'}
          </button>
        </div>

        {/* Bulk assign */}
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Users size={13} className="text-gold-400"/> Bulk Assign
            <span className="text-xs text-navy-500 font-normal">({students.length})</span>
          </h3>
          <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30 text-xs text-navy-400">
            Assign same examiners to all <strong className="text-slate-300">{students.length}</strong> students in current cohort view.
          </div>
          {/* Bulk Examiner 1 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-navy-400">Examiner 1</label>
              {needsExternal && (
                <div className="flex gap-1">
                  {['internal','external'].map(t=>(
                    <button key={t} onClick={()=>{setBulkEx1Type(t);setBulkEx1('')}}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${bulkEx1Type===t?'border-gold-500/40 bg-gold-500/10 text-gold-300':'border-navy-600/50 text-navy-400'}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7" value={bulkEx1} onChange={e=>setBulkEx1(e.target.value)}>
                <option value="">— Select —</option>
                {(bulkEx1Type==='external'?externals:supervisors).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>
          {/* Bulk Examiner 2 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-navy-400">Examiner 2</label>
              {needsExternal && (
                <div className="flex gap-1">
                  {['internal','external'].map(t=>(
                    <button key={t} onClick={()=>{setBulkEx2Type(t);setBulkEx2('')}}
                      className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${bulkEx2Type===t?'border-gold-500/40 bg-gold-500/10 text-gold-300':'border-navy-600/50 text-navy-400'}`}>{t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7" value={bulkEx2} onChange={e=>setBulkEx2(e.target.value)}>
                <option value="">— Select —</option>
                {(bulkEx2Type==='external'?externals:supervisors).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>
          {bulkMsg && <StatusMsg ok={bulkMsg.ok} msg={bulkMsg.msg}/>}
          <button onClick={handleBulkAssign} disabled={bulkSaving||!students.length} className="btn-secondary w-full justify-center disabled:opacity-50">
            {bulkSaving?<Loader2 size={13} className="animate-spin"/>:<Users size={13}/>}
            {bulkSaving?'Assigning…':`Assign to All ${students.length}`}
          </button>
        </div>
      </div>

      {/* Assignment table */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-slate-100 mb-4 text-sm">
          Current Assignments — {ASSESSMENT_TYPES.find(t=>t.id===assessmentType)?.label}
        </h3>
        <div className="overflow-x-auto rounded-xl border border-navy-700/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-navy-800/60 border-b border-navy-700/50">
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Student</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Examiner 1</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Examiner 2</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-navy-300 font-semibold">Send Link</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s,i)=>{
                const aType = isCombined?'defense_before':assessmentType
                const asgn  = assignments.filter(a=>a.student_id===s.id&&a.assessment_type===aType)
                const a1=asgn.find(a=>a.examiner_number===1), a2=asgn.find(a=>a.examiner_number===2)
                const status= asgn.length>=2?'assigned':asgn.length===1?'partial':'none'
                return (
                  <tr key={s.id} className={`border-b border-navy-700/20 ${i%2===0?'':'bg-navy-800/10'} hover:bg-navy-700/20`}>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-300 font-medium">{s.name}</p>
                      <p className="text-navy-500 font-mono">{s.student_id}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{a1?getExaminerName(a1):<span className="text-navy-600">—</span>}</td>
                    <td className="px-4 py-2.5 text-slate-300">{a2?getExaminerName(a2):<span className="text-navy-600">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-lg border font-medium ${
                        status==='assigned'?'bg-emerald-900/20 border-emerald-700/40 text-emerald-300':
                        status==='partial' ?'bg-amber-900/20 border-amber-700/40 text-amber-300':
                        'bg-navy-800/40 border-navy-700/40 text-navy-400'
                      }`}>{status==='assigned'?'✓ Assigned':status==='partial'?'⚠ Partial':'— None'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {[a1,a2].filter(Boolean).map((asgn,ai)=>{
                          const isDefBefore = asgn.assessment_type==='defense_before'
                          return (
                            <button key={ai} onClick={()=>openEmail(asgn,isDefBefore||isCombined)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-all ${
                                asgn.email_sent_at?'border-emerald-700/40 text-emerald-400 bg-emerald-900/10':'btn-secondary'
                              }`}>
                              <Send size={10}/> E{ai+1}
                              {(isDefBefore||isCombined)&&<span className="text-gold-400/70">×2</span>}
                              {asgn.email_sent_at&&<CheckCircle2 size={10}/>}
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
          <div className="card w-full max-w-lg fade-in shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
              <div>
                <h3 className="font-display font-semibold text-slate-100">Send Evaluation Link</h3>
                <p className="text-xs text-navy-400 mt-0.5">To: {emailModal.name} · {emailModal.email}</p>
              </div>
              <button onClick={()=>setEmailModal(null)} className="btn-ghost p-2 rounded-lg"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-3">
              {emailModal.combined ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
                    <p className="text-xs text-navy-400 mb-1">Stage 1 — Defense Before</p>
                    <p className="text-xs text-gold-400 font-mono truncate">{emailModal.link}</p>
                  </div>
                  {emailModal.linkAfter && (
                    <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
                      <p className="text-xs text-navy-400 mb-1">Stage 2 — Defense After</p>
                      <p className="text-xs text-emerald-400 font-mono truncate">{emailModal.linkAfter}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-navy-800/40 border border-navy-700/30">
                  <p className="text-xs text-navy-400 mb-1">Evaluation link</p>
                  <p className="text-xs text-gold-400 font-mono truncate">{emailModal.link}</p>
                </div>
              )}
              <div>
                <label className="block text-xs text-navy-400 mb-1">Subject</label>
                <input className="input text-sm" value={emailSubject} onChange={e=>setEmailSubject(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs text-navy-400 mb-1">Message — edit before sending</label>
                <textarea className="input text-sm resize-none leading-relaxed" style={{minHeight:'160px'}}
                  value={emailBody} onChange={e=>setEmailBody(e.target.value)}/>
              </div>
              {emailSent && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 px-3 py-2 rounded-lg">
                  <CheckCircle2 size={12}/> Sent to {emailModal.email}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={sendEmail} disabled={emailSending||emailSent} className="btn-primary disabled:opacity-50">
                  {emailSending?<Loader2 size={13} className="animate-spin"/>:<Send size={13}/>}
                  {emailSending?'Sending…':emailSent?'Sent ✓':'Send Email'}
                </button>
                <button onClick={()=>setEmailModal(null)} className="btn-secondary"><X size={13}/> Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// RESULTS TAB (placeholder — Phase 3)
// ══════════════════════════════════════════════════════════════
function ResultsTab({ students, assignments, supervisors, externals, getExaminerName }) {
  return (
    <div className="card p-12 text-center text-navy-500">
      <TrendingUp size={32} className="mx-auto mb-3 opacity-30"/>
      <p className="text-sm font-medium">Results & Final Marks</p>
      <p className="text-xs mt-1 opacity-70">Coming in Phase 3 — examiner response forms and score aggregation</p>
    </div>
  )
}
