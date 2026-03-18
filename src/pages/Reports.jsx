import { useState, useEffect, useRef } from 'react'
import {
  FileText, Download, Printer, FileSpreadsheet, Loader2,
  Users, AlertCircle, GraduationCap, CheckCircle2, User,
  ClipboardList, Filter, ChevronDown, RefreshCw
} from 'lucide-react'
import { getStudentsWithProgress, getSupervisorCheckins, MILESTONES } from '../lib/supabase'

const SIGNATURE = { name: 'Dr. Salma Elnour', title: 'Thesis Coordinator' }

const GROUP_MILESTONE_LIST = [
  { id: 'proposal_defense', name: 'Proposal Defense' },
  { id: 'progress_1',       name: 'First Progress Report' },
  { id: 'progress_2',       name: 'Second Progress Report' },
]

// ── Field label map ───────────────────────────────────────────────────────────
const FIELD_LABELS = {
  orcid_id:         'ORCID iD',
  proposal_title:   'Proposal Title',
  irb_number:       'IRB Reference Number',
  approval_date:    'IRB Approval Date',
  defense_date:     'Defense Date',
  defense_time:     'Preferred Time',
  final_title:      'Final Thesis Title',
  submission_date:  'Submission Date',
  submission_notes: 'Submission Notes',
  committee_notes:  'Committee Notes',
  progress_summary: 'Progress Summary',
}
function fieldLabel(key) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Script loader for PDF/Excel ───────────────────────────────────────────────
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
          ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    )
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename)
}

async function downloadExcel(rows, filename, sheetName) {
  await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js')
  const XLSX = window.XLSX
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

async function downloadPDF(title, rows, filename, subtitle = '') {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF
  if (!jsPDF) throw new Error('PDF library failed to load')

  const isLandscape = rows.length && Object.keys(rows[0]).length > 6
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait' })
  const pageW = doc.internal.pageSize.getWidth()

  // Navy header
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, pageW, 36, 'F')
  doc.setTextColor(212, 168, 67)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('THESIS COORDINATION SYSTEM', 14, 11)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.text(title, 14, 22)
  if (subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(180, 200, 230)
    doc.text(subtitle, 14, 30)
  }
  doc.setTextColor(180, 200, 230)
  doc.setFontSize(8)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW - 14, 30, { align: 'right' })

  if (rows.length) {
    doc.autoTable({
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.values(r).map(v => v == null ? '' : String(v))),
      startY: 42,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      margin: { left: 14, right: 14 },
    })
  }

  // Signature
  const pageH = doc.internal.pageSize.getHeight()
  const sigY  = pageH - 28
  doc.setDrawColor(200, 200, 200)
  doc.line(14, sigY, 75, sigY)
  doc.setTextColor(30, 58, 95); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text(SIGNATURE.name, 14, sigY + 6)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100); doc.setFontSize(8)
  doc.text(SIGNATURE.title, 14, sigY + 12)

  doc.save(filename)
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename; a.click()
}

// ── Report builders ───────────────────────────────────────────────────────────

// Extract all submitted response fields from student milestone
function extractResponseData(sm) {
  if (!sm?.response_data) return {}
  const out = {}
  for (const [k, v] of Object.entries(sm.response_data)) {
    if (v && k !== 'group') out[fieldLabel(k)] = v
  }
  return out
}

function buildFullProgress(students) {
  return students.map(s => {
    const row = {
      'Reg No':       s.student_id || '',
      'Name':         s.name,
      'Email':        s.email,
      'Program':      s.program    || '',
      'Cohort':       s.enrollment_year || '',
      'Supervisor':   s.supervisors?.name || 'Unassigned',
    }
    for (const m of MILESTONES) {
      const sm     = (s.student_milestones || []).find(x => x.milestone_id === m.id)
      const status = sm?.status || 'pending'
      row[m.name] = status === 'completed'
        ? `✓ ${sm.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : ''}`
        : status.charAt(0).toUpperCase() + status.slice(1)
    }
    const done = (s.student_milestones || []).filter(m => m.status === 'completed').length
    row['Overall Progress'] = `${done}/${MILESTONES.length} (${Math.round(done/MILESTONES.length*100)}%)`
    return row
  })
}

function buildOverdue(students) {
  const rows = []
  for (const s of students) {
    for (const sm of (s.student_milestones || []).filter(m => m.status === 'overdue')) {
      const m = MILESTONES.find(x => x.id === sm.milestone_id)
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

function buildGroups(students, milestoneId, milestoneGroupsData) {
  const groupMap = {}
  for (const g of (milestoneGroupsData[milestoneId] || [])) groupMap[g.group_name] = g
  const milestoneName = MILESTONES.find(m => m.id === milestoneId)?.name || milestoneId

  return students.map(s => {
    const sm        = (s.student_milestones || []).find(x => x.milestone_id === milestoneId)
    const groupName = sm?.group_name || ''
    const groupInfo = groupMap[groupName] || {}
    const groupDate = groupInfo.date
      ? new Date(groupInfo.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    return {
      'Reg No':     s.student_id || '',
      'Name':       s.name,
      'Email':      s.email,
      'Cohort':     s.enrollment_year || '',
      'Supervisor': s.supervisors?.name || '',
      'Milestone':  milestoneName,
      'Group':      groupName || 'Not selected',
      'Date':       groupDate,
      'Time':       groupInfo.time_slot || '',
      'Location':   groupInfo.notes || '',
      'Status':     sm?.status ? sm.status.charAt(0).toUpperCase() + sm.status.slice(1) : 'Pending',
    }
  }).sort((a, b) => a.Group.localeCompare(b.Group))
}

function buildMilestoneStatus(students, milestoneId) {
  const needsGroup = ['proposal_defense','progress_1','progress_2'].includes(milestoneId)
  return students.map(s => {
    const sm     = (s.student_milestones || []).find(x => x.milestone_id === milestoneId)
    const status = sm?.status || 'pending'
    const row    = {
      'Reg No':         s.student_id || '',
      'Name':           s.name,
      'Email':          s.email,
      'Cohort':         s.enrollment_year || '',
      'Supervisor':     s.supervisors?.name || '',
      'Status':         status.charAt(0).toUpperCase() + status.slice(1),
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
    }
    if (needsGroup) row['Group'] = sm?.group_name || ''
    // Add ALL actual submitted response data
    Object.assign(row, extractResponseData(sm))
    return row
  })
}

function buildIndividual(student) {
  return MILESTONES.map(m => {
    const sm     = (student.student_milestones || []).find(x => x.milestone_id === m.id)
    const status = sm?.status || 'pending'
    const row    = {
      'Milestone':      m.name,
      'Status':         status.charAt(0).toUpperCase() + status.slice(1),
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
      'Group':          sm?.group_name || '',
    }
    Object.assign(row, extractResponseData(sm))
    return row
  })
}

function buildSupervisorCheckins(checkins) {
  return checkins.map(c => ({
    'Supervisor':         c.supervisors?.name  || '',
    'Student':            c.students?.name     || '',
    'Reg No':             c.students?.student_id || '',
    'Engagement Status':  c.engagement_status === 'on_track'  ? '🟢 On Track'  :
                          c.engagement_status === 'concerns'  ? '🟡 Concerns'  : '🔴 Urgent',
    'Issue Type':         c.issue_type         || '',
    'Issue Description':  c.issue_description  || '',
    'Recommended Action': c.recommended_action || '',
    'Submitted':          new Date(c.submitted_at).toLocaleDateString('en-GB'),
  }))
}

function buildIssuesOnly(checkins) {
  return checkins
    .filter(c => c.engagement_status !== 'on_track')
    .map(c => ({
      'Supervisor':         c.supervisors?.name  || '',
      'Student':            c.students?.name     || '',
      'Reg No':             c.students?.student_id || '',
      'Status':             c.engagement_status === 'concerns' ? '🟡 Concerns' : '🔴 Urgent',
      'Issue Type':         c.issue_type         || '',
      'Issue Description':  c.issue_description  || '',
      'Recommended Action': c.recommended_action || '',
      'Submitted':          new Date(c.submitted_at).toLocaleDateString('en-GB'),
    }))
}

// ── Report configs ────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  {
    group: 'Student Reports',
    items: [
      { id: 'full_progress',    icon: GraduationCap, label: 'Full Progress',        desc: 'All students × all milestones' },
      { id: 'overdue',          icon: AlertCircle,   label: 'Overdue Students',     desc: 'Students with overdue milestones' },
      { id: 'milestone_status', icon: CheckCircle2,  label: 'By Milestone',         desc: 'All students for one milestone with their submitted responses' },
      { id: 'groups',           icon: Users,         label: 'Group Assignments',    desc: 'Group A/B lists with coordinator-set dates' },
      { id: 'individual',       icon: User,          label: 'Individual Student',   desc: 'Complete record for one student' },
    ]
  },
  {
    group: 'Supervisor Reports',
    items: [
      { id: 'supervisor_checkins', icon: ClipboardList, label: 'All Check-ins',     desc: 'All supervisor engagement responses' },
      { id: 'issues_only',         icon: AlertCircle,   label: 'Issues & Actions',  desc: 'Only 🟡🔴 flagged students with issue details' },
    ]
  },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [students, setStudents]                   = useState([])
  const [checkins, setCheckins]                   = useState([])
  const [milestoneGroupsData, setMilestoneGroupsData] = useState({})
  const [loading, setLoading]                     = useState(true)
  const [generating, setGenerating]               = useState(false)

  // Filters
  const [reportType, setReportType]           = useState('full_progress')
  const [milestoneFilter, setMilestoneFilter] = useState('orcid')
  const [groupMilestone, setGroupMilestone]   = useState('proposal_defense')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [cohortFilter, setCohortFilter]       = useState('all')

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
        const grouped = {}
        for (const g of (grps.data || [])) {
          if (!grouped[g.milestone_id]) grouped[g.milestone_id] = []
          grouped[g.milestone_id].push(g)
        }
        setMilestoneGroupsData(grouped)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    loadAll()
  }, [])

  // Available cohort years
  const cohortYears = [...new Set(students.map(s => s.enrollment_year).filter(Boolean))].sort((a,b) => b-a)

  // Apply cohort filter
  const filteredStudents = cohortFilter === 'all'
    ? students
    : students.filter(s => String(s.enrollment_year) === String(cohortFilter))

  const filteredCheckins = cohortFilter === 'all'
    ? checkins
    : checkins.filter(c => {
        const stu = students.find(s => s.id === c.student_id)
        return String(stu?.enrollment_year) === String(cohortFilter)
      })

  function getRows() {
    switch(reportType) {
      case 'full_progress':      return buildFullProgress(filteredStudents)
      case 'overdue':            return buildOverdue(filteredStudents)
      case 'groups':             return buildGroups(filteredStudents, groupMilestone, milestoneGroupsData)
      case 'milestone_status':   return buildMilestoneStatus(filteredStudents, milestoneFilter)
      case 'individual': {
        const s = students.find(x => x.id === selectedStudent)
        return s ? buildIndividual(s) : []
      }
      case 'supervisor_checkins': return buildSupervisorCheckins(filteredCheckins)
      case 'issues_only':         return buildIssuesOnly(filteredCheckins)
      default: return []
    }
  }

  function getTitle() {
    const cohortSuffix = cohortFilter !== 'all' ? ` — ${cohortFilter} Cohort` : ''
    switch(reportType) {
      case 'full_progress':       return `Full Student Progress Report${cohortSuffix}`
      case 'overdue':             return `Overdue Students Report${cohortSuffix}`
      case 'groups':              return `Group Assignments — ${GROUP_MILESTONE_LIST.find(m=>m.id===groupMilestone)?.name}${cohortSuffix}`
      case 'milestone_status':    return `${MILESTONES.find(m=>m.id===milestoneFilter)?.name} — Student Responses${cohortSuffix}`
      case 'individual':          return `Individual Report — ${students.find(s=>s.id===selectedStudent)?.name || ''}`
      case 'supervisor_checkins': return `Supervisor Check-in Reports${cohortSuffix}`
      case 'issues_only':         return `Student Issues & Recommended Actions${cohortSuffix}`
      default: return 'Report'
    }
  }

  function fname(ext) {
    return `thesis-report-${reportType}-${new Date().toISOString().slice(0,10)}.${ext}`
  }

  async function exportAs(format) {
    setGenerating(true)
    try {
      const rows  = getRows()
      const title = getTitle()
      const sub   = cohortFilter !== 'all' ? `${cohortFilter} Cohort` : ''
      if (!rows.length) { alert('No data to export for this report.'); setGenerating(false); return }
      if (format === 'csv')   downloadCSV(rows, fname('csv'))
      if (format === 'excel') await downloadExcel(rows, fname('xlsx'), title)
      if (format === 'pdf')   await downloadPDF(title, rows, fname('pdf'), sub)
      if (format === 'print') window.print()
    } catch(e) {
      console.error(e)
      alert('Export failed: ' + (e.message || String(e)))
    }
    setGenerating(false)
  }

  const rows    = getRows()
  const headers = rows.length ? Object.keys(rows[0]) : []

  return (
    <div className="p-8 space-y-6 fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Reports</h1>
          <p className="text-navy-400 mt-1">Generate and export detailed reports in Excel, CSV or PDF</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-secondary">
          <RefreshCw size={15} /> Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">

        {/* ── Left panel ── */}
        <div className="col-span-1 space-y-4">

          {/* Cohort filter — prominent at the top */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-gold-400" />
              <h2 className="font-semibold text-slate-200 text-sm">Cohort Filter</h2>
            </div>
            <div className="relative">
              <select className="input appearance-none pr-7 text-sm"
                value={cohortFilter} onChange={e => setCohortFilter(e.target.value)}>
                <option value="all">All Cohorts</option>
                {cohortYears.map(y => (
                  <option key={y} value={y}>{y} Cohort</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
            </div>
            {cohortFilter !== 'all' && (
              <p className="text-xs text-gold-400/70 mt-2">
                Showing {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} from {cohortFilter}
              </p>
            )}
          </div>

          {/* Report types grouped */}
          <div className="card p-4">
            <h2 className="font-display font-semibold text-slate-100 mb-3 text-sm">Report Type</h2>
            <div className="space-y-4">
              {REPORT_TYPES.map(group => (
                <div key={group.group}>
                  <p className="text-xs text-navy-500 uppercase tracking-wider font-semibold mb-2">{group.group}</p>
                  <div className="space-y-1">
                    {group.items.map(r => (
                      <button key={r.id} onClick={() => setReportType(r.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                          reportType === r.id
                            ? 'border-gold-500/40 bg-gold-500/10'
                            : 'border-transparent hover:border-navy-600/60 hover:bg-navy-800/20'
                        }`}>
                        <div className="flex items-center gap-2">
                          <r.icon size={13} className={reportType === r.id ? 'text-gold-400' : 'text-navy-500'} />
                          <p className={`text-xs font-medium ${reportType === r.id ? 'text-gold-300' : 'text-slate-400'}`}>{r.label}</p>
                        </div>
                        <p className="text-xs text-navy-600 mt-0.5 ml-5 leading-tight">{r.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contextual filters */}
          {(reportType === 'milestone_status' || reportType === 'groups' || reportType === 'individual') && (
            <div className="card p-4 space-y-3">
              <h2 className="font-display font-semibold text-slate-100 text-sm">Filter</h2>
              {reportType === 'milestone_status' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
                  <div className="relative">
                    <select className="input text-sm appearance-none pr-7" value={milestoneFilter} onChange={e => setMilestoneFilter(e.target.value)}>
                      {MILESTONES.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
                  </div>
                </div>
              )}
              {reportType === 'groups' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
                  <div className="relative">
                    <select className="input text-sm appearance-none pr-7" value={groupMilestone} onChange={e => setGroupMilestone(e.target.value)}>
                      {GROUP_MILESTONE_LIST.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
                  </div>
                </div>
              )}
              {reportType === 'individual' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Student</label>
                  <div className="relative">
                    <select className="input text-sm appearance-none pr-7" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                      {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_id || s.email})</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Export */}
          <div className="card p-4">
            <h2 className="font-display font-semibold text-slate-100 mb-3 text-sm">Export</h2>
            <div className="space-y-2">
              {[
                { fmt: 'excel', icon: FileSpreadsheet, label: 'Excel (.xlsx)', color: 'text-emerald-400' },
                { fmt: 'csv',   icon: FileText,        label: 'CSV',           color: 'text-blue-400'    },
                { fmt: 'pdf',   icon: FileText,        label: 'PDF',           color: 'text-red-400'     },
                { fmt: 'print', icon: Printer,         label: 'Print',         color: 'text-slate-400'   },
              ].map(({ fmt, icon: Icon, label, color }) => (
                <button key={fmt} onClick={() => exportAs(fmt)}
                  disabled={generating || !rows.length}
                  className="w-full btn-secondary justify-between disabled:opacity-40 disabled:cursor-not-allowed text-xs py-2">
                  <span className="flex items-center gap-2">
                    <Icon size={13} className={color} /> {label}
                  </span>
                  {generating ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} className="text-navy-500" />}
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-navy-700/50 space-y-0.5">
              <p className="text-xs text-navy-500">{rows.length} record{rows.length !== 1 ? 's' : ''} · {headers.length} columns</p>
              <p className="text-xs text-gold-400 font-medium">{SIGNATURE.name}</p>
              <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
            </div>
          </div>

        </div>

        {/* ── Preview panel ── */}
        <div className="col-span-3 card p-6">

          {/* Preview header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold text-slate-100">{getTitle()}</h2>
              <p className="text-xs text-navy-400 mt-1">
                {rows.length} records
                {cohortFilter !== 'all' && <span className="ml-2 text-gold-400/70">· {cohortFilter} Cohort</span>}
              </p>
            </div>
            <span className="text-xs text-navy-500 bg-navy-800/60 px-2.5 py-1 rounded-lg shrink-0 ml-4">
              Preview — first 8 rows
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl bg-navy-800/40 shimmer" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-navy-500">
              <FileText size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No data for this report</p>
              <p className="text-xs mt-1 opacity-70">
                {cohortFilter !== 'all'
                  ? `No students found in the ${cohortFilter} cohort for this report.`
                  : 'Students may not have submitted responses yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-navy-700/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-navy-700/50 bg-navy-800/60">
                      {headers.map(h => (
                        <th key={h} className="text-left px-3 py-3 text-navy-300 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className={`border-b border-navy-700/20 ${i % 2 === 0 ? '' : 'bg-navy-800/10'} hover:bg-navy-700/20 transition-colors`}>
                        {headers.map(h => (
                          <td key={h} className="px-3 py-2.5 text-slate-300 max-w-[200px]">
                            <span className="block truncate" title={row[h] == null ? '' : String(row[h])}>
                              {row[h] == null || row[h] === ''
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

              {rows.length > 8 && (
                <p className="text-xs text-navy-500 text-center mt-3">
                  Showing 8 of {rows.length} records — export to see all
                </p>
              )}

              {/* Signature */}
              <div className="mt-6 pt-4 border-t border-navy-700/50 flex items-end justify-between">
                <div>
                  <div className="w-36 border-t border-navy-600/60 mb-2" />
                  <p className="text-sm font-semibold text-gold-400">{SIGNATURE.name}</p>
                  <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
                </div>
                <p className="text-xs text-navy-600">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
