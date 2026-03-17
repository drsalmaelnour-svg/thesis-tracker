import { useState, useEffect, useRef } from 'react'
import {
  FileText, Download, Printer, FileSpreadsheet,
  Loader2, Users, AlertCircle, GraduationCap, CheckCircle2, User
} from 'lucide-react'
import { getStudentsWithProgress, MILESTONES } from '../lib/supabase'

const SIGNATURE = { name: 'Dr Salma Elnour', title: 'Thesis Coordinator' }

// ── Friendly label map for response_data keys ────────────────────────────────
const FIELD_LABELS = {
  orcid_id:        'ORCID iD',
  proposal_title:  'Proposal Title',
  irb_number:      'IRB Number',
  approval_date:   'Approval Date',
  defense_date:    'Defense Date',
  defense_time:    'Defense Time',
  final_title:     'Final Thesis Title',
  submission_date: 'Submission Date',
  submission_notes:'Submission Notes',
  committee_notes: 'Committee Notes',
  progress_summary:'Progress Summary',
  group:           'Group',
}

function label(key) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
  trigger(blob, filename)
}

async function downloadExcel(rows, filename, sheetName) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
  const ws = XLSX.utils.json_to_sheet(rows)
  // Auto column widths
  const cols = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }))
  ws['!cols'] = cols
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

async function downloadPDF(title, rows, filename, studentName = null) {
  const jspdfModule = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default?.jsPDF
  await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')

  const isLandscape = rows.length && Object.keys(rows[0]).length > 6
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait' })
  const pageW = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, pageW, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Thesis Coordination System', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 20)
  doc.setFontSize(8)
  doc.setTextColor(180, 200, 230)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 28)

  if (studentName) {
    doc.setTextColor(212, 168, 67)
    doc.text(`Student: ${studentName}`, pageW - 14, 28, { align: 'right' })
  }

  if (rows.length) {
    doc.autoTable({
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.values(r).map(v => v == null ? '' : String(v))),
      startY: 38,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: { 0: { cellWidth: 'auto' } },
      margin: { left: 14, right: 14 },
    })
  } else {
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(10)
    doc.text('No data found for this report.', 14, 50)
  }

  // Signature footer
  const finalY = doc.lastAutoTable?.finalY || 60
  const sigY = Math.min(finalY + 20, doc.internal.pageSize.getHeight() - 30)
  doc.setDrawColor(200, 200, 200)
  doc.line(14, sigY, 80, sigY)
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(SIGNATURE.name, 14, sigY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(SIGNATURE.title, 14, sigY + 12)

  doc.save(filename)
}

function trigger(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ── Report builders ───────────────────────────────────────────────────────────

function responseFields(sm) {
  if (!sm?.response_data) return {}
  const rd = sm.response_data
  const out = {}
  for (const [k, v] of Object.entries(rd)) {
    if (v && k !== 'group') out[label(k)] = v
  }
  return out
}

function buildFullProgress(students) {
  return students.map(s => {
    const row = {
      'Reg No':      s.student_id || '',
      'Name':        s.name,
      'Email':       s.email,
      'Program':     s.program || '',
      'Supervisor':  s.supervisors?.name || '',
    }
    for (const m of MILESTONES) {
      const sm = (s.student_milestones || []).find(x => x.milestone_id === m.id)
      const status = sm?.status || 'Pending'
      let cell = status.charAt(0).toUpperCase() + status.slice(1)
      if (status === 'completed' && sm?.completed_at)
        cell = `Done (${new Date(sm.completed_at).toLocaleDateString('en-GB')})`
      row[m.name] = cell
    }
    const done = (s.student_milestones || []).filter(m => m.status === 'completed').length
    row['Progress'] = `${done}/${MILESTONES.length}`
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
        'Supervisor': s.supervisors?.name || '',
        'Milestone':  m?.name || sm.milestone_id,
        'Due Date':   sm.due_date ? new Date(sm.due_date).toLocaleDateString('en-GB') : 'Not set',
      })
    }
  }
  return rows
}

function buildGroups(students, milestoneId) {
  const rows = []
  for (const s of students) {
    const sm = (s.student_milestones || []).find(x => x.milestone_id === milestoneId)
    const rd = sm?.response_data || {}
    rows.push({
      'Reg No':     s.student_id || '',
      'Name':       s.name,
      'Email':      s.email,
      'Supervisor': s.supervisors?.name || '',
      'Group':      sm?.group_name || 'Not assigned',
      'Date':       rd.defense_date || rd.date || '',
      'Time':       rd.defense_time || rd.time_slot || '',
      'Status':     sm?.status ? sm.status.charAt(0).toUpperCase() + sm.status.slice(1) : 'Pending',
    })
  }
  return rows.sort((a, b) => a.Group.localeCompare(b.Group))
}

function buildMilestoneStatus(students, milestoneId) {
  return students.map(s => {
    const sm = (s.student_milestones || []).find(x => x.milestone_id === milestoneId)
    const status = sm?.status || 'pending'
    const row = {
      'Reg No':         s.student_id || '',
      'Name':           s.name,
      'Email':          s.email,
      'Supervisor':     s.supervisors?.name || '',
      'Status':         status.charAt(0).toUpperCase() + status.slice(1),
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
    }
    // Group for group milestones
    if (['proposal_defense','progress_1','progress_2'].includes(milestoneId)) {
      row['Group'] = sm?.group_name || ''
    }
    // All response fields
    const rf = responseFields(sm)
    Object.assign(row, rf)
    return row
  })
}

function buildIndividual(student) {
  return MILESTONES.map(m => {
    const sm = (student.student_milestones || []).find(x => x.milestone_id === m.id)
    const status = sm?.status || 'pending'
    const rf = responseFields(sm)
    const row = {
      'Milestone':      m.name,
      'Status':         status.charAt(0).toUpperCase() + status.slice(1),
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
      'Group':          sm?.group_name || '',
    }
    Object.assign(row, rf)
    return row
  })
}

// ── Config ────────────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: 'full_progress',    icon: GraduationCap, label: 'Full Progress Report',  desc: 'All students × all milestones' },
  { id: 'overdue',          icon: AlertCircle,   label: 'Overdue Students',      desc: 'Students with overdue milestones' },
  { id: 'groups',           icon: Users,         label: 'Group Assignments',     desc: 'Group A/B lists with dates' },
  { id: 'milestone_status', icon: CheckCircle2,  label: 'By Milestone',          desc: 'All student responses for one milestone (e.g. all ORCIDs)' },
  { id: 'individual',       icon: User,          label: 'Individual Student',    desc: 'Full report for one student' },
]

const GROUP_MILESTONE_LIST = [
  { id: 'proposal_defense', name: 'Proposal Defense' },
  { id: 'progress_1',       name: 'First Progress Report' },
  { id: 'progress_2',       name: 'Second Progress Report' },
]

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Reports() {
  const [students, setStudents]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [reportType, setReportType]           = useState('full_progress')
  const [milestoneFilter, setMilestoneFilter] = useState('orcid')
  const [groupMilestone, setGroupMilestone]   = useState('proposal_defense')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [generating, setGenerating]           = useState(false)

  useEffect(() => {
    getStudentsWithProgress().then(data => {
      setStudents(data)
      if (data.length) setSelectedStudent(data[0].id)
      setLoading(false)
    })
  }, [])

  function getRows() {
    switch (reportType) {
      case 'full_progress':    return buildFullProgress(students)
      case 'overdue':          return buildOverdue(students)
      case 'groups':           return buildGroups(students, groupMilestone)
      case 'milestone_status': return buildMilestoneStatus(students, milestoneFilter)
      case 'individual': {
        const s = students.find(x => x.id === selectedStudent)
        return s ? buildIndividual(s) : []
      }
      default: return []
    }
  }

  function getTitle() {
    switch (reportType) {
      case 'full_progress':    return 'Full Student Progress Report'
      case 'overdue':          return 'Overdue Students Report'
      case 'groups':           return `Group Assignments — ${GROUP_MILESTONE_LIST.find(m => m.id === groupMilestone)?.name}`
      case 'milestone_status': return `${MILESTONES.find(m => m.id === milestoneFilter)?.name} — All Students`
      case 'individual':       return `Student Report — ${students.find(s => s.id === selectedStudent)?.name || ''}`
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
      const sName = reportType === 'individual' ? students.find(s => s.id === selectedStudent)?.name : null
      if (!rows.length) { alert('No data to export for this report.'); setGenerating(false); return }
      if (format === 'csv')   downloadCSV(rows, fname('csv'))
      if (format === 'excel') await downloadExcel(rows, fname('xlsx'), title)
      if (format === 'pdf')   await downloadPDF(title, rows, fname('pdf'), sName)
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
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Reports</h1>
        <p className="text-navy-400 mt-1">Export student responses and progress in Excel, CSV, PDF or print</p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left config */}
        <div className="space-y-4">

          {/* Report type */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4">Report Type</h2>
            <div className="space-y-2">
              {REPORT_TYPES.map(r => (
                <button key={r.id} onClick={() => setReportType(r.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    reportType === r.id
                      ? 'border-gold-500/40 bg-gold-500/10'
                      : 'border-navy-700/40 hover:border-navy-600/60 bg-navy-800/20'
                  }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <r.icon size={14} className={reportType === r.id ? 'text-gold-400' : 'text-navy-400'} />
                    <p className={`text-sm font-medium ${reportType === r.id ? 'text-gold-300' : 'text-slate-300'}`}>{r.label}</p>
                  </div>
                  <p className="text-xs text-navy-500 ml-5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          {(reportType === 'milestone_status' || reportType === 'groups' || reportType === 'individual') && (
            <div className="card p-5 space-y-3">
              <h2 className="font-display font-semibold text-slate-100">Filter</h2>
              {reportType === 'milestone_status' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
                  <select className="input" value={milestoneFilter} onChange={e => setMilestoneFilter(e.target.value)}>
                    {MILESTONES.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                  </select>
                </div>
              )}
              {reportType === 'groups' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Milestone</label>
                  <select className="input" value={groupMilestone} onChange={e => setGroupMilestone(e.target.value)}>
                    {GROUP_MILESTONE_LIST.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              {reportType === 'individual' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Student</label>
                  <select className="input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_id || s.email})</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Export */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4">Export</h2>
            <div className="space-y-2">
              {[
                { fmt: 'excel', icon: FileSpreadsheet, label: 'Excel (.xlsx)', color: 'text-emerald-400' },
                { fmt: 'csv',   icon: FileText,        label: 'CSV',           color: 'text-blue-400'    },
                { fmt: 'pdf',   icon: FileText,        label: 'PDF',           color: 'text-red-400'     },
                { fmt: 'print', icon: Printer,         label: 'Print View',    color: 'text-slate-400'   },
              ].map(({ fmt, icon: Icon, label: lbl, color }) => (
                <button key={fmt} onClick={() => exportAs(fmt)}
                  disabled={generating || !rows.length}
                  className="w-full btn-secondary justify-between disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="flex items-center gap-2">
                    <Icon size={15} className={color} /> {lbl}
                  </span>
                  {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} className="text-navy-500" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-navy-500 mt-3 text-center">
              {rows.length} record{rows.length !== 1 ? 's' : ''} · {headers.length} columns
            </p>
            <div className="mt-3 pt-3 border-t border-navy-700/50">
              <p className="text-xs text-navy-500">Signed by</p>
              <p className="text-xs text-gold-400 font-medium">{SIGNATURE.name}</p>
              <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="col-span-2 card p-5">
          {/* Print header */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <div style={{background:'#1e3a5f',color:'white',padding:'16px',borderRadius:'8px',marginBottom:'16px'}}>
              <div style={{fontSize:'18px',fontWeight:'bold'}}>Thesis Coordination System</div>
              <div style={{fontSize:'13px',marginTop:'4px'}}>{getTitle()}</div>
              <div style={{fontSize:'10px',marginTop:'4px',opacity:0.7}}>
                Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 print:hidden">
            <h2 className="font-display font-semibold text-slate-100">{getTitle()}</h2>
            <span className="text-xs text-navy-400 bg-navy-800/60 px-2.5 py-1 rounded-lg">
              Showing first 8 rows
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-navy-800/40 shimmer" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-navy-500">
              <FileText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No data for this report.</p>
              <p className="text-xs mt-1">Students may not have submitted responses yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-navy-700/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-navy-700/50 bg-navy-800/60">
                      {headers.map(h => (
                        <th key={h} className="text-left p-3 text-navy-300 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-b border-navy-700/20 hover:bg-navy-800/20">
                        {headers.map(h => (
                          <td key={h} className="p-3 text-slate-300 max-w-[180px]">
                            <span className="block truncate" title={row[h] == null ? '' : String(row[h])}>
                              {row[h] == null ? <span className="text-navy-600">—</span> : String(row[h]) || <span className="text-navy-600">—</span>}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 8 && (
                <p className="text-xs text-navy-500 text-center mt-2">
                  + {rows.length - 8} more rows — export to see all
                </p>
              )}

              {/* Signature preview */}
              <div className="mt-6 pt-4 border-t border-navy-700/50 print:block">
                <div className="border-t border-navy-600/50 w-40 mb-2" />
                <p className="text-sm font-semibold text-gold-400">{SIGNATURE.name}</p>
                <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@media print {
        body > * { display: none !important; }
        #root > div { display: none !important; }
        .print\\:block { display: block !important; }
      }`}</style>
    </div>
  )
}
