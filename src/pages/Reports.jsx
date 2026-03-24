import { useState, useEffect, useRef } from 'react'
import {
  FileText, Download, Printer, FileSpreadsheet, Loader2,
  Users, AlertCircle, GraduationCap, CheckCircle2, User,
  ClipboardList, Filter, ChevronDown, RefreshCw, Mail,
  Send, Clock, MessageSquare, Bell, Activity
} from 'lucide-react'
import { getStudentsWithProgress, getSupervisorCheckins, MILESTONES } from '../lib/supabase'
import { sendStudentEmail } from '../lib/emailService'
import { formatDistanceToNow } from 'date-fns'

const SIGNATURE = { name: 'Dr. Salma Elnour', title: 'Thesis Coordinator' }

const GROUP_MILESTONE_LIST = [
  { id: 'proposal_defense', name: 'Proposal Defense' },
  { id: 'progress_1',       name: 'First Progress Report' },
  { id: 'progress_2',       name: 'Second Progress Report' },
]

const FIELD_LABELS = {
  orcid_id:        'ORCID iD',
  proposal_title:  'Proposal Title',
  irb_number:      'IRB Reference Number',
  approval_date:   'IRB Approval Date',
  defense_date:    'Defense Date',
  defense_time:    'Preferred Time',
  final_title:     'Final Thesis Title',
  submission_date: 'Submission Date',
  submission_notes:'Submission Notes',
  committee_notes: 'Committee Notes',
  progress_summary:'Progress Summary',
}
function fieldLabel(key) {
  return FIELD_LABELS[key] || key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
}

const ACTIVITY_TYPE_LABELS = {
  email:     '📧 Email Sent',
  reminder:  '🔔 Reminder Sent',
  milestone: '✅ Milestone Updated',
  checkin:   '📋 Check-in',
  note:      '📝 Note Added',
}

// ── Script loader ─────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

// ── Export helpers ────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] == null ? '' : String(r[h])
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g,'""')}"` : v
      }).join(',')
    )
  ].join('\n')
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename)
}

async function downloadExcel(rows, filename, sheetName) {
  await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js')
  const XLSX = window.XLSX
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0]||{}).map(k=>({ wch: Math.max(k.length+2, 16) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31))
  XLSX.writeFile(wb, filename)
}

async function downloadPDF(title, rows, filename, subtitle='') {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF
  if (!jsPDF) throw new Error('PDF library failed to load')
  const isLandscape = rows.length && Object.keys(rows[0]).length > 6
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait' })
  const pageW = doc.internal.pageSize.getWidth()
  // Header
  doc.setFillColor(30,58,95); doc.rect(0,0,pageW,38,'F')
  doc.setTextColor(212,168,67); doc.setFontSize(9); doc.setFont('helvetica','bold')
  doc.text('THESIS COORDINATION SYSTEM', 14, 12)
  doc.setTextColor(255,255,255); doc.setFontSize(15)
  doc.text(title, 14, 24)
  if (subtitle) {
    doc.setFontSize(9); doc.setTextColor(180,200,230)
    doc.text(subtitle, 14, 33)
  }
  doc.setFontSize(8); doc.setTextColor(180,200,230)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`, pageW-14, 33, {align:'right'})
  if (rows.length) {
    doc.autoTable({
      head: [Object.keys(rows[0])],
      body: rows.map(r=>Object.values(r).map(v=>v==null?'':String(v))),
      startY: 44,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30,58,95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245,248,252] },
      margin: { left: 14, right: 14 },
    })
  }
  // Signature
  const pageH = doc.internal.pageSize.getHeight()
  const sigY = pageH - 28
  doc.setDrawColor(200,200,200); doc.line(14, sigY, 75, sigY)
  doc.setTextColor(30,58,95); doc.setFontSize(9); doc.setFont('helvetica','bold')
  doc.text(SIGNATURE.name, 14, sigY+6)
  doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100); doc.setFontSize(8)
  doc.text(SIGNATURE.title, 14, sigY+12)
  doc.save(filename)
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

// ── Report builders ───────────────────────────────────────────────────────────
function extractResponses(sm) {
  if (!sm?.response_data) return {}
  const out = {}
  for (const [k,v] of Object.entries(sm.response_data)) {
    if (v && k !== 'group') out[fieldLabel(k)] = v
  }
  return out
}

function buildFullProgress(students) {
  return students.map(s => {
    const row = {
      'Reg No':     s.student_id || '',
      'Name':       s.name,
      'Email':      s.email,
      'Cohort':     s.enrollment_year || '',
      'Program':    s.program || '',
      'Supervisor': s.supervisors?.name || '',
    }
    for (const m of MILESTONES) {
      const sm = (s.student_milestones||[]).find(x=>x.milestone_id===m.id)
      row[m.name] = sm?.status==='completed'
        ? `✓ ${sm.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : ''}`
        : sm?.status ? sm.status.charAt(0).toUpperCase()+sm.status.slice(1) : 'Pending'
    }
    const done = (s.student_milestones||[]).filter(m=>m.status==='completed').length
    row['Progress'] = `${done}/${MILESTONES.length} (${Math.round(done/MILESTONES.length*100)}%)`
    return row
  })
}

function buildOverdue(students) {
  const rows = []
  for (const s of students) {
    for (const sm of (s.student_milestones||[]).filter(m=>m.status==='overdue')) {
      const m = MILESTONES.find(x=>x.id===sm.milestone_id)
      rows.push({
        'Reg No':     s.student_id || '',
        'Name':       s.name,
        'Email':      s.email,
        'Cohort':     s.enrollment_year || '',
        'Supervisor': s.supervisors?.name || '',
        'Milestone':  m?.name || sm.milestone_id,
        'Due Date':   sm.due_date ? new Date(sm.due_date).toLocaleDateString('en-GB') : 'Not set',
      })
    }
  }
  return rows
}

function buildMilestoneStatus(students, milestoneId) {
  const needsGroup = ['proposal_defense','progress_1','progress_2'].includes(milestoneId)
  return students.map(s => {
    const sm     = (s.student_milestones||[]).find(x=>x.milestone_id===milestoneId)
    const status = sm?.status || 'pending'
    const row = {
      'Reg No':     s.student_id || '',
      'Name':       s.name,
      'Email':      s.email,
      'Cohort':     s.enrollment_year || '',
      'Supervisor': s.supervisors?.name || '',
      'Status':     status.charAt(0).toUpperCase()+status.slice(1),
    }
    if (needsGroup) row['Group'] = sm?.group_name || ''
    // Actual response data — not dates
    Object.assign(row, extractResponses(sm))
    return row
  })
}

function buildGroups(students, milestoneId, milestoneGroupsData) {
  const groupMap = {}
  for (const g of (milestoneGroupsData[milestoneId]||[])) groupMap[g.group_name] = g
  return students.map(s => {
    const sm        = (s.student_milestones||[]).find(x=>x.milestone_id===milestoneId)
    const groupName = sm?.group_name || ''
    const groupInfo = groupMap[groupName] || {}
    return {
      'Reg No':     s.student_id || '',
      'Name':       s.name,
      'Email':      s.email,
      'Cohort':     s.enrollment_year || '',
      'Supervisor': s.supervisors?.name || '',
      'Group':      groupName || 'Not selected',
      'Session Date': groupInfo.date ? new Date(groupInfo.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : '',
      'Time':       groupInfo.time_slot || '',
      'Location':   groupInfo.notes || '',
      'Status':     sm?.status ? sm.status.charAt(0).toUpperCase()+sm.status.slice(1) : 'Pending',
    }
  }).sort((a,b)=>a.Group.localeCompare(b.Group))
}

function buildIndividual(student) {
  return MILESTONES.map(m => {
    const sm     = (student.student_milestones||[]).find(x=>x.milestone_id===m.id)
    const status = sm?.status || 'pending'
    const row = {
      'Milestone':      m.name,
      'Status':         status.charAt(0).toUpperCase()+status.slice(1),
      'Group':          sm?.group_name || '',
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
    }
    Object.assign(row, extractResponses(sm))
    return row
  })
}

function buildSupervisorCheckins(checkins) {
  return checkins.map(c => ({
    'Supervisor':          c.supervisors?.name || '',
    'Student':             c.students?.name    || '',
    'Reg No':              c.students?.student_id || '',
    'Engagement Status':   c.engagement_status==='on_track' ? '🟢 On Track' :
                           c.engagement_status==='concerns' ? '🟡 Concerns' : '🔴 Urgent',
    'Issue Type':          c.issue_type        || '',
    'Issue Description':   c.issue_description || '',
    'Recommended Action':  c.recommended_action|| '',
    'Date Submitted':      new Date(c.submitted_at).toLocaleDateString('en-GB'),
  }))
}

function buildIssuesOnly(checkins) {
  return checkins.filter(c=>c.engagement_status!=='on_track').map(c => ({
    'Supervisor':          c.supervisors?.name || '',
    'Student':             c.students?.name    || '',
    'Reg No':              c.students?.student_id || '',
    'Status':              c.engagement_status==='concerns' ? '🟡 Concerns' : '🔴 Urgent',
    'Issue Type':          c.issue_type        || '',
    'Issue Description':   c.issue_description || '',
    'Recommended Action':  c.recommended_action|| '',
    'Date Submitted':      new Date(c.submitted_at).toLocaleDateString('en-GB'),
  }))
}

// Communication history builders
function buildCommHistoryAllStudents(students, activityByStudent) {
  const rows = []
  for (const s of students) {
    const activities = activityByStudent[s.id] || []
    for (const a of activities) {
      rows.push({
        'Reg No':     s.student_id || '',
        'Student':    s.name,
        'Cohort':     s.enrollment_year || '',
        'Supervisor': s.supervisors?.name || '',
        'Type':       ACTIVITY_TYPE_LABELS[a.type] || a.type,
        'Description':a.description,
        'Date':       new Date(a.created_at).toLocaleDateString('en-GB'),
        'Time':       new Date(a.created_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
      })
    }
  }
  return rows.sort((a,b)=>new Date(b.Date)-new Date(a.Date))
}

function buildCommHistoryPerStudent(student, activities, groupBy) {
  if (groupBy === 'milestone') {
    const rows = []
    for (const m of MILESTONES) {
      const mActivities = activities.filter(a =>
        a.description.toLowerCase().includes(m.name.toLowerCase()) ||
        (a.metadata?.milestoneId === m.id)
      )
      for (const a of mActivities) {
        rows.push({
          'Milestone':   m.name,
          'Type':        ACTIVITY_TYPE_LABELS[a.type] || a.type,
          'Description': a.description,
          'Date':        new Date(a.created_at).toLocaleDateString('en-GB'),
          'Time':        new Date(a.created_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
        })
      }
    }
    return rows
  } else {
    return activities.map(a => ({
      'Type':        ACTIVITY_TYPE_LABELS[a.type] || a.type,
      'Description': a.description,
      'Date':        new Date(a.created_at).toLocaleDateString('en-GB'),
      'Time':        new Date(a.created_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
    })).sort((a,b)=>new Date(a.Date+' '+a.Time)-new Date(b.Date+' '+b.Time))
  }
}

// ── Report configs ────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  {
    group: 'Student Reports',
    items: [
      { id: 'full_progress',    icon: GraduationCap, label: 'Full Progress',       desc: 'All students × all milestones with completion status' },
      { id: 'overdue',          icon: AlertCircle,   label: 'Overdue Students',    desc: 'Students with overdue milestones' },
      { id: 'milestone_status', icon: CheckCircle2,  label: 'By Milestone',        desc: 'All students for one milestone with their actual submitted responses' },
      { id: 'groups',           icon: Users,         label: 'Group Assignments',   desc: 'Group A/B lists with session dates and locations' },
      { id: 'individual',       icon: User,          label: 'Individual Student',  desc: 'Complete record for one student' },
    ]
  },
  {
    group: 'Supervisor Reports',
    items: [
      { id: 'supervisor_checkins', icon: ClipboardList, label: 'All Check-ins',    desc: 'All supervisor responses with engagement details' },
      { id: 'issues_only',         icon: AlertCircle,   label: 'Issues & Actions', desc: 'Only 🟡🔴 flagged students with issue details and recommended actions' },
    ]
  },
  {
    group: 'Communication History',
    items: [
      { id: 'comm_all',      icon: Activity, label: 'All Students',     desc: 'Complete communication log across all students' },
      { id: 'comm_student',  icon: MessageSquare, label: 'Per Student', desc: 'Full communication timeline for one student' },
    ]
  },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [students, setStudents]                   = useState([])
  const [checkins, setCheckins]                   = useState([])
  const [milestoneGroupsData, setMilestoneGroupsData] = useState({})
  const [activityByStudent, setActivityByStudent] = useState({})
  const [loading, setLoading]                     = useState(true)
  const [generating, setGenerating]               = useState(false)

  // Filters
  const [reportType, setReportType]           = useState('full_progress')
  const [milestoneFilter, setMilestoneFilter] = useState('orcid')
  const [groupMilestone, setGroupMilestone]   = useState('proposal_defense')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [cohortFilter, setCohortFilter]       = useState('all')
  const [commGroupBy, setCommGroupBy]         = useState('chronological') // 'chronological' | 'milestone'

  // Email sending state
  const [showEmailSend, setShowEmailSend]   = useState(false)
  const [emailTo, setEmailTo]               = useState('')
  const [emailSending, setEmailSending]     = useState(false)
  const [emailResult, setEmailResult]       = useState(null)

  useEffect(() => {
    async function loadAll() {
      try {
        const { supabase } = await import('../lib/supabase')
        const [studs, chks, grps] = await Promise.all([
          getStudentsWithProgress(),
          getSupervisorCheckins(),
          supabase.from('milestone_groups').select('*').order('group_name'),
        ])
        setStudents(studs)
        setCheckins(chks)
        if (studs.length) setSelectedStudent(studs[0].id)

        // Group milestone groups data
        const grouped = {}
        for (const g of (grps.data||[])) {
          if (!grouped[g.milestone_id]) grouped[g.milestone_id] = []
          grouped[g.milestone_id].push(g)
        }
        setMilestoneGroupsData(grouped)

        // Load activity logs for all students
        const actMap = {}
        for (const s of studs) {
          const { data: acts } = await supabase
            .from('activity_log').select('*').eq('student_id', s.id).order('created_at', {ascending: false})
          actMap[s.id] = acts || []
        }
        setActivityByStudent(actMap)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    loadAll()
  }, [])

  const cohortYears = [...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)

  const filteredStudents = cohortFilter==='all'
    ? students
    : students.filter(s=>String(s.enrollment_year)===String(cohortFilter))

  const filteredCheckins = cohortFilter==='all'
    ? checkins
    : checkins.filter(c=>{
        const stu = students.find(s=>s.id===c.student_id)
        return String(stu?.enrollment_year)===String(cohortFilter)
      })

  function getRows() {
    switch(reportType) {
      case 'full_progress':       return buildFullProgress(filteredStudents)
      case 'overdue':             return buildOverdue(filteredStudents)
      case 'groups':              return buildGroups(filteredStudents, groupMilestone, milestoneGroupsData)
      case 'milestone_status':    return buildMilestoneStatus(filteredStudents, milestoneFilter)
      case 'individual': {
        const s = students.find(x=>x.id===selectedStudent)
        return s ? buildIndividual(s) : []
      }
      case 'supervisor_checkins': return buildSupervisorCheckins(filteredCheckins)
      case 'issues_only':         return buildIssuesOnly(filteredCheckins)
      case 'comm_all':
        return buildCommHistoryAllStudents(filteredStudents, activityByStudent)
      case 'comm_student': {
        const s = students.find(x=>x.id===selectedStudent)
        return s ? buildCommHistoryPerStudent(s, activityByStudent[s.id]||[], commGroupBy) : []
      }
      default: return []
    }
  }

  function getTitle() {
    const cohortSuffix = cohortFilter!=='all' ? ` — ${cohortFilter} Cohort` : ''
    switch(reportType) {
      case 'full_progress':       return `Full Student Progress Report${cohortSuffix}`
      case 'overdue':             return `Overdue Students Report${cohortSuffix}`
      case 'groups':              return `Group Assignments — ${GROUP_MILESTONE_LIST.find(m=>m.id===groupMilestone)?.name}${cohortSuffix}`
      case 'milestone_status':    return `${MILESTONES.find(m=>m.id===milestoneFilter)?.name} — Student Responses${cohortSuffix}`
      case 'individual':          return `Individual Report — ${students.find(s=>s.id===selectedStudent)?.name||''}`
      case 'supervisor_checkins': return `Supervisor Check-in Reports${cohortSuffix}`
      case 'issues_only':         return `Student Issues & Actions${cohortSuffix}`
      case 'comm_all':            return `Communication History — All Students${cohortSuffix}`
      case 'comm_student':        return `Communication History — ${students.find(s=>s.id===selectedStudent)?.name||''}`
      default: return 'Report'
    }
  }

  function fname(ext) {
    return `thesis-${reportType}-${new Date().toISOString().slice(0,10)}.${ext}`
  }

  async function exportAs(format) {
    setGenerating(true)
    try {
      const rows  = getRows()
      const title = getTitle()
      const sub   = cohortFilter!=='all' ? `${cohortFilter} Cohort` : ''
      if (!rows.length) { alert('No data to export for this report.'); setGenerating(false); return }
      if (format==='csv')   downloadCSV(rows, fname('csv'))
      if (format==='excel') await downloadExcel(rows, fname('xlsx'), title)
      if (format==='pdf')   await downloadPDF(title, rows, fname('pdf'), sub)
      if (format==='print') window.print()
    } catch(e) {
      console.error(e); alert('Export failed: '+(e.message||String(e)))
    }
    setGenerating(false)
  }

  async function sendByEmail() {
    if (!emailTo.trim()) return
    setEmailSending(true); setEmailResult(null)
    try {
      const rows  = getRows()
      const title = getTitle()
      if (!rows.length) { setEmailResult({ ok: false, msg: 'No data to send.' }); setEmailSending(false); return }

      // Build a plain text summary of the report
      const headers = Object.keys(rows[0])
      const summary = rows.slice(0,20).map((row,i) =>
        headers.map(h => `${h}: ${row[h]||'—'}`).join(' | ')
      ).join('\n')
      const note = rows.length > 20 ? `\n\n... and ${rows.length-20} more records. Please export to Excel or PDF for the full report.` : ''

      // Send via a dummy student object with the target email
      await sendStudentEmail({
        student: { name: 'Coordinator', email: emailTo, token: '' },
        milestoneId: null,
        subject: title,
        message: `Please find below the ${title}.\n\nGenerated: ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}\nTotal records: ${rows.length}\n\n${summary}${note}`,
      })
      setEmailResult({ ok: true, msg: `Report sent to ${emailTo}` })
    } catch(e) {
      setEmailResult({ ok: false, msg: 'Failed to send: '+e.message })
    }
    setEmailSending(false)
  }

  const rows    = getRows()
  const headers = rows.length ? Object.keys(rows[0]) : []

  return (
    <div className="p-8 space-y-6 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Reports</h1>
          <p className="text-navy-400 mt-1">Generate, export and share detailed reports</p>
        </div>
        <button onClick={()=>window.location.reload()} className="btn-secondary">
          <RefreshCw size={15}/> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">

        {/* ── Left panel ── */}
        <div className="space-y-4">

          {/* Cohort filter */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-gold-400"/>
              <h2 className="font-semibold text-slate-200 text-sm">Cohort</h2>
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7"
                value={cohortFilter} onChange={e=>setCohortFilter(e.target.value)}>
                <option value="all">All Cohorts</option>
                {cohortYears.map(y=><option key={y} value={y}>{y} Cohort</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
            {cohortFilter!=='all' && (
              <p className="text-xs text-gold-400/70 mt-2">
                {filteredStudents.length} student{filteredStudents.length!==1?'s':''}
              </p>
            )}
          </div>

          {/* Report types — dropdown */}
          <div className="card p-4">
            <h2 className="font-display font-semibold text-slate-100 mb-3 text-sm">Report Type</h2>
            <div className="relative">
              <select
                className="input text-sm appearance-none pr-7"
                value={reportType}
                onChange={e => setReportType(e.target.value)}
              >
                {REPORT_TYPES.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
            {/* Description of selected report */}
            {(() => {
              const current = REPORT_TYPES.flatMap(g=>g.items).find(r=>r.id===reportType)
              return current ? (
                <p className="text-xs text-navy-500 mt-2 leading-relaxed">{current.desc}</p>
              ) : null
            })()}
          </div>

          {/* Contextual filters */}
          {(reportType==='milestone_status'||reportType==='groups'||reportType==='individual'||reportType==='comm_student') && (
            <div className="card p-4 space-y-3">
              <h2 className="font-display font-semibold text-slate-100 text-sm">Filter</h2>
              {reportType==='milestone_status' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
                  <div className="relative">
                    <select className="input text-sm appearance-none pr-7" value={milestoneFilter} onChange={e=>setMilestoneFilter(e.target.value)}>
                      {MILESTONES.map(m=><option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
                  </div>
                </div>
              )}
              {reportType==='groups' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
                  <div className="relative">
                    <select className="input text-sm appearance-none pr-7" value={groupMilestone} onChange={e=>setGroupMilestone(e.target.value)}>
                      {GROUP_MILESTONE_LIST.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
                  </div>
                </div>
              )}
              {(reportType==='individual'||reportType==='comm_student') && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Student</label>
                  <div className="relative">
                    <select className="input text-sm appearance-none pr-7" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>
                      {filteredStudents.map(s=><option key={s.id} value={s.id}>{s.name} ({s.student_id||s.email})</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
                  </div>
                </div>
              )}
              {reportType==='comm_student' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Group By</label>
                  <div className="flex gap-2">
                    {[['chronological','Chronological'],['milestone','By Milestone']].map(([v,l])=>(
                      <button key={v} onClick={()=>setCommGroupBy(v)}
                        className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          commGroupBy===v ? 'border-gold-500/40 bg-gold-500/10 text-gold-300' : 'border-navy-600/50 text-navy-400'
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export */}
          <div className="card p-4">
            <h2 className="font-display font-semibold text-slate-100 mb-3 text-sm">Export & Share</h2>
            <div className="space-y-2">
              {[
                { fmt: 'excel', icon: FileSpreadsheet, label: 'Excel (.xlsx)', color: 'text-emerald-400' },
                { fmt: 'csv',   icon: FileText,        label: 'CSV',           color: 'text-blue-400'   },
                { fmt: 'pdf',   icon: FileText,        label: 'PDF',           color: 'text-red-400'    },
                { fmt: 'print', icon: Printer,         label: 'Print',         color: 'text-slate-400'  },
              ].map(({fmt, icon: Icon, label, color})=>(
                <button key={fmt} onClick={()=>exportAs(fmt)}
                  disabled={generating||!rows.length}
                  className="w-full btn-secondary justify-between disabled:opacity-40 text-xs py-2">
                  <span className="flex items-center gap-2"><Icon size={13} className={color}/>{label}</span>
                  {generating?<Loader2 size={11} className="animate-spin"/>:<Download size={11} className="text-navy-500"/>}
                </button>
              ))}

              {/* Send by email */}
              <button onClick={()=>setShowEmailSend(v=>!v)}
                className="w-full btn-secondary justify-between text-xs py-2">
                <span className="flex items-center gap-2"><Mail size={13} className="text-amber-400"/>Send by Email</span>
                <ChevronDown size={11} className={`text-navy-500 transition-transform ${showEmailSend?'rotate-180':''}`}/>
              </button>
              {showEmailSend && (
                <div className="space-y-2 pt-1">
                  <input className="input text-xs py-2" type="email"
                    placeholder="Enter recipient email…"
                    value={emailTo} onChange={e=>setEmailTo(e.target.value)}/>
                  <button onClick={sendByEmail} disabled={emailSending||!emailTo.trim()||!rows.length}
                    className="btn-primary w-full justify-center text-xs py-2 disabled:opacity-50">
                    {emailSending?<Loader2 size={12} className="animate-spin"/>:<Send size={12}/>}
                    {emailSending?'Sending…':'Send Report'}
                  </button>
                  {emailResult && (
                    <p className={`text-xs px-2 py-1.5 rounded-lg ${emailResult.ok?'text-emerald-300 bg-emerald-900/20':'text-red-300 bg-red-900/20'}`}>
                      {emailResult.msg}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-navy-700/50 space-y-0.5">
              <p className="text-xs text-navy-500">{rows.length} record{rows.length!==1?'s':''} · {headers.length} columns</p>
              <p className="text-xs text-gold-400 font-medium">{SIGNATURE.name}</p>
              <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
            </div>
          </div>

        </div>

        {/* ── Preview panel ── */}
        <div className="col-span-3 card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-slate-100">{getTitle()}</h2>
              <p className="text-xs text-navy-400 mt-1">
                {rows.length} records
                {cohortFilter!=='all' && <span className="ml-2 text-gold-400/70">· {cohortFilter} Cohort</span>}
              </p>
            </div>
            <span className="text-xs text-navy-500 bg-navy-800/60 px-2.5 py-1 rounded-lg shrink-0 ml-4">
              Showing first 10 rows
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-10 rounded-xl bg-navy-800/40 shimmer"/>)}</div>
          ) : rows.length===0 ? (
            <div className="text-center py-20 text-navy-500">
              <FileText size={36} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm font-medium">No data for this report</p>
              <p className="text-xs mt-1 opacity-70">
                {cohortFilter!=='all'
                  ? `No data found for the ${cohortFilter} cohort.`
                  : 'No data available yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-navy-700/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-navy-700/50 bg-navy-800/60">
                      {headers.map(h=>(
                        <th key={h} className="text-left px-3 py-3 text-navy-300 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0,10).map((row,i)=>(
                      <tr key={i} className={`border-b border-navy-700/20 ${i%2===0?'':'bg-navy-800/10'} hover:bg-navy-700/20 transition-colors`}>
                        {headers.map(h=>(
                          <td key={h} className="px-3 py-2.5 text-slate-300 max-w-[200px]">
                            <span className="block truncate" title={row[h]==null?'':String(row[h])}>
                              {row[h]==null||row[h]===''
                                ? <span className="text-navy-700">—</span>
                                : String(row[h])}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length>10 && (
                <p className="text-xs text-navy-500 text-center mt-3">
                  Showing 10 of {rows.length} records — export to see all
                </p>
              )}

              {/* Signature */}
              <div className="mt-6 pt-4 border-t border-navy-700/50 flex items-end justify-between">
                <div>
                  <div className="w-36 border-t border-navy-600/60 mb-2"/>
                  <p className="text-sm font-semibold text-gold-400">{SIGNATURE.name}</p>
                  <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
                </div>
                <p className="text-xs text-navy-600">
                  {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
                </p>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
