import { useState, useEffect, useRef } from 'react'
import {
  UserCheck, Users, ChevronDown, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, Send, X, UserPlus, Upload,
  Building2, Mail, BookOpen, Edit2, Save, Trash2,
  Search, Filter, ClipboardList, TrendingUp, Info,
  Lock, Unlock, Download, FileText, Eye, FileSpreadsheet
} from 'lucide-react'
import {
  getStudentsWithProgress, getExternalExaminers,
  upsertExternalExaminer, deleteExternalExaminer,
  getAssessmentAssignments, upsertAssessmentAssignment,
  getExaminerResponseLink, getExaminerPortalLink, logActivity,
  lockSubmission, getAllSubmissions
} from '../lib/supabase'
import { sendStudentEmail, sendSupervisorEmail } from '../lib/emailService'

// ── PDF / CSV helpers ────────────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
}

const GMU_NAVY = [30, 58, 95]
const GMU_GOLD = [212, 168, 67]
const SCORE_LABELS_MAP = { 4:'Exceptional', 3:'Meets Expectations', 2:'Needs Revision', 1:'Inadequate' }

async function generateIndividualPDF(student, assessmentType, subs, avg, getExaminerName, supervisors) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const typeName = ASSESSMENT_LABELS[assessmentType] || assessmentType

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...GMU_NAVY); doc.rect(0, 0, pageW, 42, 'F')
  doc.setFillColor(...GMU_GOLD); doc.rect(0, 42, pageW, 1.5, 'F')

  // Institution
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GMU_GOLD)
  doc.text('GULF MEDICAL UNIVERSITY', 14, 11)
  doc.setTextColor(180,210,240); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
  doc.text('MSc Medical Laboratory Sciences — Thesis Assessment Report', 14, 16)

  // Title
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,255,255)
  doc.text(typeName, 14, 28)

  // Date + confidential
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(180,210,240)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`, pageW-14, 11, {align:'right'})
  doc.setTextColor(...GMU_GOLD); doc.setFontSize(7.5); doc.setFont('helvetica','bold')
  doc.text('CONFIDENTIAL', pageW-14, 17, {align:'right'})

  // ── Student info ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40)
  const infoY = 50
  const fields = [
    ['Student Name', student.name],
    ['Registration No.', student.student_id || '—'],
    ['Supervisor', student.supervisors?.name || '—'],
    ['Program', student.program || 'MSc Medical Laboratory Sciences'],
    ['Assessment', typeName],
    ['Report Date', new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})],
  ]
  fields.forEach(([label, val], i) => {
    const x = i < 3 ? 14 : pageW/2 + 5
    const y = infoY + (i%3) * 7
    doc.setFont('helvetica','bold'); doc.setTextColor(...GMU_NAVY)
    doc.text(label + ':', x, y)
    doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40)
    doc.text(val, x + 32, y)
  })

  // ── Final mark banner ────────────────────────────────────────────────────────
  let curY = infoY + 24
  if (avg) {
    doc.setFillColor(...GMU_NAVY); doc.roundedRect(14, curY, pageW-28, 18, 2, 2, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255)
    doc.text('FINAL AVERAGE MARK', 20, curY+7)
    doc.setFontSize(14); doc.setTextColor(...GMU_GOLD)
    doc.text(`${avg.avgPct}%`, pageW-20, curY+7, {align:'right'})
    doc.setFontSize(8); doc.setTextColor(180,210,240); doc.setFont('helvetica','normal')
    subs.forEach((sub,i) => {
      doc.text(`Examiner ${i+1}: ${sub.total_score}/${sub.max_score} (${sub.percentage}%)`, 20 + i*60, curY+13)
    })
    curY += 24
  }

  // ── Per-examiner tables ───────────────────────────────────────────────────────
  subs.forEach((sub, si) => {
    const asgn     = sub.assessment_assignments
    const examName = asgn?.examiner_type==='external'
      ? asgn.external_examiners?.name
      : supervisors.find(s=>s.id===asgn?.examiner_id)?.name || '—'

    // Section label
    doc.setFillColor(...GMU_GOLD); doc.setDrawColor(...GMU_GOLD)
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GMU_NAVY)
    doc.text(`Examiner ${si+1}${sub.locked?' (Locked)':''}`, 14, curY+5)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,100,100)
    doc.text(examName, 14, curY+10)
    if (sub.total_score!==null) {
      doc.setFont('helvetica','bold'); doc.setTextColor(...GMU_NAVY)
      doc.text(`Score: ${sub.total_score}/${sub.max_score} (${sub.percentage}%)`, pageW-14, curY+7, {align:'right'})
    }
    curY += 14

    // Scores table
    if (sub.scores && Object.keys(sub.scores).length) {
      doc.autoTable({
        head: [['Criterion','Score','Level']],
        body: Object.entries(sub.scores).map(([crit,score])=>[
          crit, `${score} / 4`, SCORE_LABELS_MAP[score]||''
        ]),
        startY: curY,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: GMU_NAVY, textColor: 255, fontStyle:'bold', fontSize:8 },
        columnStyles: { 1:{ halign:'center', cellWidth:18 }, 2:{ cellWidth:34 } },
        alternateRowStyles: { fillColor: [245,248,252] },
        margin: { left:14, right:14 },
        didParseCell: (data) => {
          if (data.column.index===1 && data.section==='body') {
            const score = parseInt(data.cell.raw)
            if (score===4) data.cell.styles.textColor=[22,101,52]
            else if (score===3) data.cell.styles.textColor=[30,64,175]
            else if (score===2) data.cell.styles.textColor=[146,64,14]
            else data.cell.styles.textColor=[153,27,27]
          }
        }
      })
      curY = doc.lastAutoTable.finalY + 5
    }

    // Checklist
    if (sub.checklist?.checks) {
      doc.autoTable({
        head: [['Thesis Section','Status','Notes']],
        body: Object.entries(sub.checklist.checks).map(([item,val])=>[
          item,
          val==='ok'?'Satisfactory':'Needs Improvement',
          sub.checklist.notes?.[item]||''
        ]),
        startY: curY,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: GMU_NAVY, textColor: 255, fontStyle:'bold', fontSize:8 },
        columnStyles: { 1:{ cellWidth:30 }, 2:{ cellWidth:55 } },
        alternateRowStyles: { fillColor: [245,248,252] },
        margin: { left:14, right:14 },
      })
      curY = doc.lastAutoTable.finalY + 5
    }

    // Comments
    if (sub.comments) {
      doc.setFillColor(248,250,252); doc.setDrawColor(226,232,240)
      doc.roundedRect(14, curY, pageW-28, 14, 1, 1, 'FD')
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...GMU_NAVY)
      doc.text('COMMENTS', 18, curY+5)
      doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60)
      const lines = doc.splitTextToSize(sub.comments, pageW-36)
      doc.text(lines.slice(0,2), 18, curY+10)
      curY += 18
    }

    // Recommendation
    if (sub.recommendation) {
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GMU_NAVY)
      doc.text('Recommendation: ', 14, curY+5)
      doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40)
      doc.text(sub.recommendation, 48, curY+5)
      curY += 10
    }

    curY += 4
  })

  // ── Signature ────────────────────────────────────────────────────────────────
  const sigY = Math.min(curY + 10, pageH - 30)
  doc.setDrawColor(...GMU_GOLD); doc.setLineWidth(0.8)
  doc.line(14, sigY, 75, sigY)
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GMU_NAVY)
  doc.text('Dr. Salma Elnour', 14, sigY+6)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,100,100)
  doc.text('Thesis Coordinator', 14, sigY+11)
  doc.text('Gulf Medical University', 14, sigY+16)

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages()
  for (let i=1; i<=pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(150,150,150); doc.setFont('helvetica','normal')
    doc.text(`Page ${i} of ${pageCount}`, pageW/2, pageH-6, {align:'center'})
  }

  doc.save(`assessment-${student.student_id}-${assessmentType}-${new Date().toISOString().slice(0,10)}.pdf`)
}

async function generateCohortPDF(cohortYear, students, allSubs, supervisors) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(...GMU_NAVY); doc.rect(0, 0, pageW, 38, 'F')
  doc.setFillColor(...GMU_GOLD); doc.rect(0, 38, pageW, 1.5, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...GMU_GOLD)
  doc.text('GULF MEDICAL UNIVERSITY — MSc MEDICAL LABORATORY SCIENCES', 14, 10)
  doc.setFontSize(16); doc.setTextColor(255,255,255)
  doc.text(`${cohortYear} Cohort — Assessment Results Summary`, 14, 23)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(180,210,240)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}  |  ${students.length} Students`, 14, 32)
  doc.setTextColor(...GMU_GOLD); doc.setFont('helvetica','bold'); doc.setFontSize(7.5)
  doc.text('CONFIDENTIAL', pageW-14, 32, {align:'right'})

  // Build table
  const assessTypes = ['proposal_defense','progress_1','progress_2','defense_before','defense_after']
  const shortLabels = ['Proposal','Progress 1','Progress 2','Def. Before','Def. After']

  const head = [['Reg No.','Student Name','Supervisor',...shortLabels,'Overall Avg']]
  const body = students.map(student => {
    const row = [
      student.student_id || '',
      student.name,
      student.supervisors?.name || '—',
    ]
    let totalPct = 0, countPct = 0
    assessTypes.forEach(aType => {
      const subs = allSubs.filter(s =>
        s.student_id===student.id && s.assessment_type===aType && s.total_score!==null
      )
      if (subs.length >= 1) {
        const avg = subs.reduce((a,s)=>a+(s.percentage||0),0) / subs.length
        const rounded = Math.round(avg*10)/10
        row.push(`${rounded}%`)
        totalPct += rounded; countPct++
      } else {
        row.push('—')
      }
    })
    row.push(countPct ? `${Math.round(totalPct/countPct*10)/10}%` : '—')
    return row
  })

  doc.autoTable({
    head, body,
    startY: 46,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: GMU_NAVY, textColor: 255, fontStyle:'bold' },
    alternateRowStyles: { fillColor: [245,248,252] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 45 },
      2: { cellWidth: 38 },
    },
    margin: { left:14, right:14 },
    didParseCell: (data) => {
      if (data.section==='body' && data.column.index >= 3) {
        const val = parseFloat(data.cell.raw)
        if (!isNaN(val)) {
          if (val >= 75) data.cell.styles.textColor = [22,101,52]
          else if (val >= 50) data.cell.styles.textColor = [146,64,14]
          else data.cell.styles.textColor = [153,27,27]
        }
      }
    }
  })

  // Signature
  const finalY = doc.lastAutoTable.finalY + 12
  const sigY   = Math.min(finalY, pageH - 28)
  doc.setDrawColor(...GMU_GOLD); doc.setLineWidth(0.8)
  doc.line(14, sigY, 70, sigY)
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...GMU_NAVY)
  doc.text('Dr. Salma Elnour', 14, sigY+6)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,100,100)
  doc.text('Thesis Coordinator · Gulf Medical University', 14, sigY+11)

  const pages = doc.internal.getNumberOfPages()
  for (let i=1;i<=pages;i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(150,150,150)
    doc.text(`Page ${i} of ${pages}`, pageW/2, pageH-5, {align:'center'})
  }

  doc.save(`cohort-results-${cohortYear}-${new Date().toISOString().slice(0,10)}.pdf`)
}

function generateCohortCSV(cohortYear, students, allSubs) {
  const assessTypes  = ['proposal_defense','progress_1','progress_2','defense_before','defense_after']
  const shortLabels  = ['Proposal Defense','First Progress Report','Second Progress Report','Defense Before','Defense After']
  const headers = ['Reg No.','Student Name','Email','Cohort','Supervisor',...shortLabels,'Overall Average']
  const rows = students.map(student => {
    const row = [
      student.student_id||'', student.name, student.email||'',
      student.enrollment_year||'', student.supervisors?.name||'',
    ]
    let totalPct=0, countPct=0
    assessTypes.forEach(aType => {
      const subs = allSubs.filter(s=>s.student_id===student.id&&s.assessment_type===aType&&s.total_score!==null)
      if (subs.length) {
        const avg = subs.reduce((a,s)=>a+(s.percentage||0),0) / subs.length
        row.push((Math.round(avg*10)/10).toString())
        totalPct += Math.round(avg*10)/10; countPct++
      } else {
        row.push('')
      }
    })
    row.push(countPct ? (Math.round(totalPct/countPct*10)/10).toString() : '')
    return row
  })

  const csv = [headers, ...rows].map(r =>
    r.map(v => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g,'""')}"` : v).join(',')
  ).join('\n')

  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}))
  a.download = `cohort-results-${cohortYear}-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

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
// RESULTS TAB
// ══════════════════════════════════════════════════════════════
const ASSESSMENT_LABELS = {
  proposal_defense: 'Proposal Defense',
  progress_1:       'First Progress Report',
  progress_2:       'Second Progress Report',
  defense_before:   'Defense Before',
  defense_after:    'Defense After',
}

function ResultsTab({ students, assignments, supervisors, externals, getExaminerName }) {
  const [submissions,   setSubmissions]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [selStudent,    setSelStudent]     = useState(students[0]?.id || '')
  const [selType,       setSelType]       = useState('proposal_defense')
  const [locking,       setLocking]       = useState(null)
  const [emailSending,  setEmailSending]  = useState(null)
  const [emailResult,   setEmailResult]   = useState(null)

  useEffect(() => {
    if (!students.length) return
    const ids = students.map(s => s.id)
    getAllSubmissions(ids).then(subs => {
      setSubmissions(subs); setLoading(false)
    }).catch(e => { console.error(e); setLoading(false) })
  }, [students])

  function getExaminerForAssignment(asgn) {
    if (!asgn) return { name: '—', email: '' }
    if (asgn.examiner_type === 'external') {
      return { name: asgn.external_examiners?.name || '—', email: asgn.external_examiners?.email || '' }
    }
    const sup = supervisors.find(s => s.id === asgn.examiner_id)
    return { name: sup?.name || '—', email: sup?.email || '' }
  }

  // Get submissions for selected student + type
  function getStudentSubs(studentId, assessmentType) {
    return submissions.filter(s =>
      s.student_id === studentId && s.assessment_type === assessmentType
    ).sort((a,b) => (a.assessment_assignments?.examiner_number||0) - (b.assessment_assignments?.examiner_number||0))
  }

  // Calculate averages
  function calcAverage(subs) {
    const scored = subs.filter(s => s.total_score !== null && s.max_score)
    if (!scored.length) return null
    const avgScore = scored.reduce((a,s) => a + s.total_score, 0) / scored.length
    const avgPct   = scored.reduce((a,s) => a + (s.percentage||0), 0) / scored.length
    return { avgScore: Math.round(avgScore * 10) / 10, avgPct: Math.round(avgPct * 10) / 10, max: scored[0].max_score }
  }

  async function handleLock(subId, lock) {
    setLocking(subId)
    try {
      await lockSubmission(subId, lock)
      // Notify examiner if locking
      if (lock) {
        const sub  = submissions.find(s => s.id === subId)
        const asgn = sub?.assessment_assignments
        if (asgn) {
          const { name, email } = getExaminerForAssignment(asgn)
          const student = students.find(s => s.id === sub.student_id)
          if (email) {
            await sendStudentEmail({
              student: { name, email, token: '' },
              milestoneId: null,
              subject: `Evaluation Locked — ${student?.name || ''} — ${ASSESSMENT_LABELS[sub.assessment_type] || sub.assessment_type}`,
              message: `Dear ${name},

This is to inform you that your evaluation for the following student has been reviewed and locked by the thesis coordinator:

Student: ${student?.name || ''}
Registration No.: ${student?.student_id || ''}
Assessment: ${ASSESSMENT_LABELS[sub.assessment_type] || sub.assessment_type}
Your Score: ${sub.total_score} / ${sub.max_score} (${sub.percentage}%)

If you believe a correction is necessary, please contact Dr. Salma Elnour directly.

Thank you for your contribution to the thesis assessment process.

Best regards,
Dr. Salma Elnour
Thesis Coordinator
Gulf Medical University`,
            })
          }
        }
      }
      // Refresh
      const ids = students.map(s => s.id)
      const subs = await getAllSubmissions(ids)
      setSubmissions(subs)
    } catch(e) { console.error(e) }
    setLocking(null)
  }

  async function handleLockAll(studentId, assessmentType, lock) {
    const subs = getStudentSubs(studentId, assessmentType)
    for (const sub of subs) await handleLock(sub.id, lock)
  }

  async function sendReport(type) {
    // type: 'student' | 'supervisor' | 'download'
    const student = students.find(s => s.id === selStudent)
    if (!student) return
    const subs    = getStudentSubs(selStudent, selType)
    if (!subs.length) { setEmailResult({ ok: false, msg: 'No submissions found.' }); return }
    const avg     = calcAverage(subs)
    const typeName= ASSESSMENT_LABELS[selType] || selType

    // Build report text
    let report = `THESIS ASSESSMENT REPORT\n`
    report += `Gulf Medical University — MSc Medical Laboratory Sciences\n`
    report += `${'─'.repeat(50)}\n\n`
    report += `Student:     ${student.name}\n`
    report += `Reg No.:     ${student.student_id}\n`
    report += `Assessment:  ${typeName}\n`
    report += `Date:        ${new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}\n\n`

    if (avg) {
      report += `FINAL RESULT\n${'─'.repeat(30)}\n`
      report += `Examiner 1 Score: ${subs[0]?.total_score || '—'} / ${subs[0]?.max_score || '—'} (${subs[0]?.percentage || '—'}%)\n`
      if (subs[1]) report += `Examiner 2 Score: ${subs[1]?.total_score || '—'} / ${subs[1]?.max_score || '—'} (${subs[1]?.percentage || '—'}%)\n`
      report += `Average Score:    ${avg.avgScore} / ${avg.max} (${avg.avgPct}%)\n\n`
    }

    subs.forEach((sub, i) => {
      const examLabel = type === 'student' ? `Examiner ${i+1}` : getExaminerForAssignment(sub.assessment_assignments).name
      report += `${examLabel}\n${'─'.repeat(30)}\n`
      report += `Recommendation: ${sub.recommendation || '—'}\n`
      if (sub.comments) report += `Comments: ${sub.comments}\n`
      report += `\n`
    })

    if (type === 'pdf') {
      try {
        await generateIndividualPDF(student, selType, subs, avg,
          (asgn) => {
            if (!asgn) return '—'
            if (asgn.examiner_type==='external') return asgn.external_examiners?.name||'—'
            return supervisors.find(s=>s.id===asgn.examiner_id)?.name||'—'
          },
          supervisors
        )
      } catch(e) { setEmailResult({ ok:false, msg:'PDF generation failed: '+e.message }) }
      return
    }

    if (type === 'student') {
      setEmailSending('student')
      try {
        await sendStudentEmail({
          student,
          milestoneId: null,
          subject: `Thesis Assessment Result — ${typeName}`,
          message: `Dear ${student.name},\n\nPlease find below your thesis assessment result for ${typeName}.\n\n${report}\n\nIf you have any questions, please do not hesitate to contact the thesis coordination office.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`,
        })
        setEmailResult({ ok: true, msg: `Report sent to ${student.email}` })
      } catch(e) { setEmailResult({ ok: false, msg: e.message }) }
      setEmailSending(null)
    } else if (type === 'supervisor') {
      const sup = student.supervisors
      if (!sup?.email) { setEmailResult({ ok: false, msg: 'No supervisor email found.' }); return }
      setEmailSending('supervisor')
      try {
        await sendSupervisorEmail({
          supervisor: sup,
          student,
          milestoneId: null,
          subject: `Student Assessment Result — ${student.name} — ${typeName}`,
          message: `Dear ${sup.name},\n\nPlease find below the assessment result for your student ${student.name} (${student.student_id}) for ${typeName}.\n\n${report}\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator`,
        })
        setEmailResult({ ok: true, msg: `Report sent to ${sup.email}` })
      } catch(e) { setEmailResult({ ok: false, msg: e.message }) }
      setEmailSending(null)
    }
  }

  const student = students.find(s => s.id === selStudent)
  const curSubs = getStudentSubs(selStudent, selType)
  const avg     = calcAverage(curSubs)
  const allTypes= ['proposal_defense','progress_1','progress_2','defense_before','defense_after']

  return (
    <div className="space-y-5">

      {/* Student + assessment selector */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <label className="block text-xs text-navy-400 mb-2 uppercase tracking-wider">Student</label>
          <div className="relative">
            <select className="input text-sm appearance-none pr-7" value={selStudent} onChange={e=>{setSelStudent(e.target.value);setEmailResult(null)}}>
              {students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.student_id}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
          </div>
        </div>
        <div className="card p-4">
          <label className="block text-xs text-navy-400 mb-2 uppercase tracking-wider">Assessment Type</label>
          <div className="relative">
            <select className="input text-sm appearance-none pr-7" value={selType} onChange={e=>{setSelType(e.target.value);setEmailResult(null)}}>
              {allTypes.map(t=><option key={t} value={t}>{ASSESSMENT_LABELS[t]}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center"><Loader2 size={24} className="animate-spin text-gold-400 mx-auto"/></div>
      ) : curSubs.length === 0 ? (
        <div className="card p-12 text-center text-navy-500">
          <ClipboardList size={28} className="mx-auto mb-2 opacity-30"/>
          <p className="text-sm font-medium">No submissions yet</p>
          <p className="text-xs mt-1 opacity-70">Examiners have not submitted their evaluation for this assessment.</p>
        </div>
      ) : (
        <>
          {/* Average mark banner */}
          {avg && (
            <div className="card p-5 border-gold-500/30" style={{background:'linear-gradient(135deg,#1e3a5f,#254474)'}}>
              <p className="text-xs text-gold-400/70 uppercase tracking-wider mb-1">Final Average Mark</p>
              <div className="flex items-end gap-4">
                <p className="text-4xl font-display font-bold text-white">{avg.avgPct}%</p>
                <p className="text-lg text-gold-400 font-semibold mb-1">{avg.avgScore} / {avg.max}</p>
              </div>
              <div className="flex gap-4 mt-2">
                {curSubs.map((sub,i) => (
                  <p key={i} className="text-xs text-slate-300">
                    Examiner {i+1}: {sub.total_score}/{sub.max_score} ({sub.percentage}%)
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Submissions */}
          {curSubs.map((sub, i) => {
            const examInfo = getExaminerForAssignment(sub.assessment_assignments)
            return (
              <div key={sub.id} className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-slate-100 text-sm">Examiner {i+1}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-lg border border-navy-600/50 text-navy-400">
                        {sub.assessment_assignments?.examiner_type === 'external' ? 'External' : 'Internal'}
                      </span>
                      {sub.locked && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border border-amber-700/40 bg-amber-900/20 text-amber-300">
                          <Lock size={10}/> Locked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-400 mt-0.5">{examInfo.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.total_score !== null && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-gold-400">{sub.total_score}/{sub.max_score}</p>
                        <p className="text-xs text-navy-400">{sub.percentage}%</p>
                      </div>
                    )}
                    <button onClick={() => handleLock(sub.id, !sub.locked)} disabled={locking===sub.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        sub.locked
                          ? 'border-amber-700/40 bg-amber-900/10 text-amber-300 hover:bg-amber-900/20'
                          : 'btn-secondary'
                      }`}>
                      {locking===sub.id ? <Loader2 size={12} className="animate-spin"/> :
                       sub.locked ? <><Unlock size={12}/> Unlock</> : <><Lock size={12}/> Lock</>}
                    </button>
                  </div>
                </div>

                {/* Scores table */}
                {sub.scores && Object.keys(sub.scores).length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-navy-700/40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-navy-800/60 border-b border-navy-700/50">
                          <th className="text-left px-3 py-2 text-navy-300 font-semibold">Criterion</th>
                          <th className="text-center px-3 py-2 text-navy-300 font-semibold w-16">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(sub.scores).map(([criterion, score], ci) => (
                          <tr key={ci} className={`border-b border-navy-700/20 ${ci%2===0?'':'bg-navy-800/10'}`}>
                            <td className="px-3 py-2 text-slate-300">{criterion}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`font-bold ${
                                score===4?'text-emerald-400':score===3?'text-blue-400':score===2?'text-amber-400':'text-red-400'
                              }`}>{score} / 4</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Checklist (formative) */}
                {sub.checklist?.checks && (
                  <div className="space-y-1.5">
                    {Object.entries(sub.checklist.checks).map(([item, val]) => (
                      <div key={item} className="flex items-start gap-2 text-xs">
                        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded font-bold ${
                          val==='ok'?'bg-emerald-900/20 text-emerald-400':'bg-red-900/20 text-red-400'
                        }`}>{val==='ok'?'✓':'✗'}</span>
                        <span className="text-slate-300">{item}</span>
                        {sub.checklist.notes?.[item] && (
                          <span className="text-red-300/70 ml-1">— {sub.checklist.notes[item]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {sub.comments && (
                  <div className="bg-navy-800/20 rounded-xl p-3 border border-navy-700/30">
                    <p className="text-xs text-navy-400 font-medium mb-1 uppercase tracking-wider">Comments</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{sub.comments}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-navy-500">
                  <span>Recommendation: <span className="text-slate-300 font-medium">{sub.recommendation || '—'}</span></span>
                  <span>Submitted: {sub.submission_date || new Date(sub.submitted_at).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            )
          })}

          {/* Lock all + Send reports */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-slate-100 mb-4 text-sm">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>handleLockAll(selStudent,selType,true)}
                disabled={curSubs.every(s=>s.locked)||!!locking}
                className="btn-secondary text-xs disabled:opacity-40">
                <Lock size={13}/> Lock All Examiners
              </button>
              <button onClick={()=>handleLockAll(selStudent,selType,false)}
                disabled={curSubs.every(s=>!s.locked)||!!locking}
                className="btn-secondary text-xs disabled:opacity-40">
                <Unlock size={13}/> Unlock All
              </button>
              <div className="w-px h-6 bg-navy-700/50 self-center mx-1"/>
              <button onClick={()=>sendReport('pdf')} disabled={emailSending==='pdf'} className="btn-secondary text-xs disabled:opacity-50">
                {emailSending==='pdf'?<Loader2 size={13} className="animate-spin"/>:<FileText size={13}/>}
                Download PDF
              </button>
              <button onClick={()=>sendReport('student')} disabled={emailSending==='student'} className="btn-secondary text-xs disabled:opacity-50">
                {emailSending==='student'?<Loader2 size={13} className="animate-spin"/>:<Send size={13}/>}
                Send to Student
              </button>
              <button onClick={()=>sendReport('supervisor')} disabled={emailSending==='supervisor'} className="btn-secondary text-xs disabled:opacity-50">
                {emailSending==='supervisor'?<Loader2 size={13} className="animate-spin"/>:<Send size={13}/>}
                Send to Supervisor
              </button>
            </div>
            {emailResult && (
              <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                emailResult.ok?'bg-emerald-900/20 text-emerald-300 border border-emerald-700/40':'bg-red-900/20 text-red-300 border border-red-700/40'
              }`}>
                {emailResult.ok?<CheckCircle2 size={12}/>:<AlertCircle size={12}/>} {emailResult.msg}
              </div>
            )}
          </div>
        </>
      )}

      {/* Cohort results */}
      <CohortResultsSection students={students} submissions={submissions} cohort={students[0]?.enrollment_year||''}/>
    </div>
  )
}

function CohortResultsSection({ students, submissions, cohort }) {
  const [generating, setGenerating] = useState(false)
  const cohortYear = students[0]?.enrollment_year || 'All'
  const { supabase: _ } = { supabase: null } // placeholder

  async function downloadCohortPDF() {
    setGenerating('pdf')
    try {
      const { supabase } = await import('../lib/supabase')
      const { data: sups } = await supabase.from('supervisors').select('*')
      await generateCohortPDF(cohortYear, students, submissions, sups||[])
    } catch(e) { alert('PDF failed: '+e.message) }
    setGenerating(null)
  }

  function downloadCohortCSV() {
    generateCohortCSV(cohortYear, students, submissions)
  }

  return (
    <div className="card p-5 border-gold-500/20">
      <h3 className="font-display font-semibold text-slate-100 mb-1 text-sm flex items-center gap-2">
        <FileSpreadsheet size={14} className="text-gold-400"/> Cohort Results — {cohortYear}
      </h3>
      <p className="text-xs text-navy-400 mb-4 leading-relaxed">
        Download all students' final marks averaged from both examiners. PDF for sharing, CSV for uploading to Moodle.
      </p>
      <div className="flex gap-2">
        <button onClick={downloadCohortPDF} disabled={generating==='pdf'||!students.length}
          className="btn-primary disabled:opacity-50 text-xs">
          {generating==='pdf'?<Loader2 size={13} className="animate-spin"/>:<FileText size={13}/>}
          {generating==='pdf'?'Generating…':'Download Cohort PDF'}
        </button>
        <button onClick={downloadCohortCSV} disabled={!students.length}
          className="btn-secondary text-xs disabled:opacity-50">
          <FileSpreadsheet size={13}/> Download CSV for Moodle
        </button>
      </div>
      <p className="text-xs text-navy-600 mt-2">
        CSV columns: Reg No., Student Name, Email, Cohort, Supervisor, score per assessment, Overall Average
      </p>
    </div>
  )
}
