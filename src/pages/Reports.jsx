import { useState, useEffect, useRef } from 'react'
import {
  FileText, Download, Printer, FileSpreadsheet, Filter,
  ChevronDown, Loader2, Users, AlertCircle, Calendar, GraduationCap, CheckCircle2
} from 'lucide-react'
import { getStudentsWithProgress, MILESTONES } from '../lib/supabase'

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
          ? `"${v.replace(/"/g, '""')}"`
          : v
      }).join(',')
    )
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

async function downloadExcel(rows, filename, sheetName = 'Report') {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

async function downloadPDF(title, rows, filename) {
  const { jsPDF } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  const autoTable = (await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')).default
  const doc = new jsPDF({ orientation: rows.length && Object.keys(rows[0]).length > 6 ? 'landscape' : 'portrait' })

  doc.setFontSize(16)
  doc.setTextColor(30, 58, 95)
  doc.text('Thesis Coordination System', 14, 15)
  doc.setFontSize(12)
  doc.setTextColor(80, 80, 80)
  doc.text(title, 14, 23)
  doc.setFontSize(9)
  doc.setTextColor(140, 140, 140)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 30)

  if (rows.length) {
    doc.autoTable({
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.values(r).map(v => v == null ? '' : String(v))),
      startY: 35,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    })
  } else {
    doc.text('No data found.', 14, 40)
  }

  doc.save(filename)
}

// ── Report builders ───────────────────────────────────────────────────────────

function buildFullProgress(students) {
  return students.map(s => {
    const row = {
      'Student ID':   s.student_id || '',
      'Name':         s.name,
      'Email':        s.email,
      'Program':      s.program || '',
      'Supervisor':   s.supervisors?.name || '',
    }
    for (const m of MILESTONES) {
      const sm = (s.student_milestones || []).find(x => x.milestone_id === m.id)
      row[m.name] = sm?.status === 'completed'
        ? `✓ ${sm.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : ''}`
        : sm?.status || 'Pending'
    }
    const done = (s.student_milestones || []).filter(m => m.status === 'completed').length
    row['Progress'] = `${done}/${MILESTONES.length}`
    return row
  })
}

function buildOverdue(students) {
  const rows = []
  for (const s of students) {
    const overdue = (s.student_milestones || []).filter(m => m.status === 'overdue')
    for (const sm of overdue) {
      const m = MILESTONES.find(x => x.id === sm.milestone_id)
      rows.push({
        'Student ID':  s.student_id || '',
        'Name':        s.name,
        'Email':       s.email,
        'Supervisor':  s.supervisors?.name || '',
        'Milestone':   m?.name || sm.milestone_id,
        'Due Date':    sm.due_date ? new Date(sm.due_date).toLocaleDateString('en-GB') : 'Not set',
        'Notes':       sm.notes || '',
      })
    }
  }
  return rows
}

function buildGroups(students, milestoneId) {
  const rows = []
  for (const s of students) {
    const sm = (s.student_milestones || []).find(x => x.milestone_id === milestoneId)
    if (sm?.group_name) {
      const rd = sm.response_data || {}
      rows.push({
        'Student ID': s.student_id || '',
        'Name':       s.name,
        'Email':      s.email,
        'Supervisor': s.supervisors?.name || '',
        'Group':      sm.group_name,
        'Date':       rd.date || '',
        'Time':       rd.time_slot || '',
        'Status':     sm.status,
      })
    }
  }
  return rows.sort((a, b) => a.Group.localeCompare(b.Group))
}

function buildMilestoneStatus(students, milestoneId) {
  const m = MILESTONES.find(x => x.id === milestoneId)
  return students.map(s => {
    const sm = (s.student_milestones || []).find(x => x.milestone_id === milestoneId)
    const rd = sm?.response_data || {}
    const row = {
      'Student ID':     s.student_id || '',
      'Name':           s.name,
      'Email':          s.email,
      'Supervisor':     s.supervisors?.name || '',
      'Status':         sm?.status || 'Pending',
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
    }
    // Add milestone-specific fields
    if (milestoneId === 'orcid' && rd.orcid_id)            row['ORCID'] = rd.orcid_id
    if (milestoneId === 'irb_approval') {
      row['Proposal Title'] = rd.proposal_title || ''
      row['IRB Number']     = rd.irb_number     || ''
      row['Approval Date']  = rd.approval_date  || ''
    }
    if (milestoneId === 'defense_schedule') {
      row['Defense Date'] = rd.defense_date || ''
      row['Defense Time'] = rd.defense_time || ''
    }
    if (milestoneId === 'thesis_submission') {
      row['Final Title']       = rd.final_title      || ''
      row['Submission Date']   = rd.submission_date  || ''
    }
    if (['proposal_defense','progress_1','progress_2'].includes(milestoneId)) {
      row['Group'] = sm?.group_name || ''
    }
    return row
  })
}

function buildIndividual(student) {
  return MILESTONES.map(m => {
    const sm = (student.student_milestones || []).find(x => x.milestone_id === m.id)
    const rd = sm?.response_data || {}
    return {
      'Milestone':      m.name,
      'Status':         sm?.status || 'Pending',
      'Completed Date': sm?.completed_at ? new Date(sm.completed_at).toLocaleDateString('en-GB') : '',
      'Group':          sm?.group_name || '',
      'Details':        Object.entries(rd).filter(([,v]) => v).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`).join(' | '),
      'Notes':          sm?.notes || '',
    }
  })
}

// ── Report type configs ───────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: 'full_progress',    icon: GraduationCap, label: 'Full Progress Report',    desc: 'All students with all milestone statuses' },
  { id: 'overdue',          icon: AlertCircle,   label: 'Overdue Students',        desc: 'Students with overdue milestones' },
  { id: 'groups',           icon: Users,         label: 'Group Assignments',       desc: 'Which students are in Group A/B per milestone' },
  { id: 'milestone_status', icon: CheckCircle2,  label: 'By Milestone',            desc: 'All students for a specific milestone (e.g. export all ORCIDs)' },
  { id: 'individual',       icon: FileText,      label: 'Individual Student',      desc: 'Full report for one student' },
]

const GROUP_MILESTONES_LIST = [
  { id: 'proposal_defense', name: 'Proposal Defense' },
  { id: 'progress_1',       name: 'First Progress Report' },
  { id: 'progress_2',       name: 'Second Progress Report' },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const [students, setStudents]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [reportType, setReportType]     = useState('full_progress')
  const [milestoneFilter, setMilestoneFilter] = useState('orcid')
  const [groupMilestone, setGroupMilestone]   = useState('proposal_defense')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [preview, setPreview]           = useState([])
  const [generating, setGenerating]     = useState(false)
  const printRef = useRef()

  useEffect(() => {
    getStudentsWithProgress().then(data => {
      setStudents(data)
      if (data.length) setSelectedStudent(data[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!students.length) return
    setPreview(getRows().slice(0, 5))
  }, [reportType, milestoneFilter, groupMilestone, selectedStudent, students])

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

  function getReportTitle() {
    switch (reportType) {
      case 'full_progress':    return 'Full Student Progress Report'
      case 'overdue':          return 'Overdue Students Report'
      case 'groups':           return `Group Assignments — ${GROUP_MILESTONES_LIST.find(m => m.id === groupMilestone)?.name}`
      case 'milestone_status': return `Milestone Report — ${MILESTONES.find(m => m.id === milestoneFilter)?.name}`
      case 'individual':       return `Individual Report — ${students.find(s => s.id === selectedStudent)?.name || ''}`
      default: return 'Report'
    }
  }

  function getFilename(ext) {
    return `thesis-${reportType}-${new Date().toISOString().slice(0,10)}.${ext}`
  }

  async function exportAs(format) {
    setGenerating(true)
    try {
      const rows  = getRows()
      const title = getReportTitle()
      if (format === 'csv')   downloadCSV(rows, getFilename('csv'))
      if (format === 'excel') await downloadExcel(rows, getFilename('xlsx'), title.slice(0,30))
      if (format === 'pdf')   await downloadPDF(title, rows, getFilename('pdf'))
      if (format === 'print') {
        setPreview(rows)
        setTimeout(() => window.print(), 300)
      }
    } catch(e) {
      console.error(e)
      alert('Export failed: ' + e.message)
    }
    setGenerating(false)
  }

  const rows = getRows()
  const headers = rows.length ? Object.keys(rows[0]) : []

  return (
    <div className="p-8 space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Reports</h1>
        <p className="text-navy-400 mt-1">Generate and export reports in Excel, CSV, PDF or print</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="col-span-1 space-y-4">

          {/* Report type */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4">Report Type</h2>
            <div className="space-y-2">
              {REPORT_TYPES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setReportType(r.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    reportType === r.id
                      ? 'border-gold-500/40 bg-gold-500/10'
                      : 'border-navy-700/40 hover:border-navy-600/60 bg-navy-800/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <r.icon size={14} className={reportType === r.id ? 'text-gold-400' : 'text-navy-400'} />
                    <p className={`text-sm font-medium ${reportType === r.id ? 'text-gold-300' : 'text-slate-300'}`}>
                      {r.label}
                    </p>
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
                    {GROUP_MILESTONES_LIST.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {reportType === 'individual' && (
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Student</label>
                  <select className="input" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Export buttons */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4">Export</h2>
            <div className="space-y-2">
              {[
                { fmt: 'excel', icon: FileSpreadsheet, label: 'Excel (.xlsx)', color: 'text-emerald-400' },
                { fmt: 'csv',   icon: FileText,        label: 'CSV',           color: 'text-blue-400'    },
                { fmt: 'pdf',   icon: FileText,        label: 'PDF',           color: 'text-red-400'     },
                { fmt: 'print', icon: Printer,         label: 'Print View',    color: 'text-slate-400'   },
              ].map(({ fmt, icon: Icon, label, color }) => (
                <button
                  key={fmt}
                  onClick={() => exportAs(fmt)}
                  disabled={generating || !rows.length}
                  className="w-full btn-secondary justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <Icon size={15} className={color} />
                    {label}
                  </span>
                  {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} className="text-navy-500" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-navy-500 mt-3 text-center">
              {rows.length} record{rows.length !== 1 ? 's' : ''} in this report
            </p>
          </div>
        </div>

        {/* Preview panel */}
        <div className="col-span-2 card p-5" ref={printRef}>
          {/* Print header — only visible when printing */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <h1 className="text-xl font-bold text-gray-900">Thesis Coordination System</h1>
            <h2 className="text-lg text-gray-700 mt-1">{getReportTitle()}</h2>
            <p className="text-sm text-gray-500 mt-1">Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="flex items-center justify-between mb-4 print:hidden">
            <h2 className="font-display font-semibold text-slate-100">{getReportTitle()}</h2>
            <span className="text-xs text-navy-400 bg-navy-800/60 px-2.5 py-1 rounded-lg">
              Preview — first 5 rows
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
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-navy-700/40">
              <table className="w-full text-xs print:text-xs">
                <thead>
                  <tr className="border-b border-navy-700/50 bg-navy-800/60 print:bg-gray-100">
                    {headers.map(h => (
                      <th key={h} className="text-left p-3 text-navy-400 print:text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(preview.length ? preview : rows).map((row, i) => (
                    <tr key={i} className="border-b border-navy-700/20 hover:bg-navy-800/20 print:border-gray-200">
                      {headers.map(h => (
                        <td key={h} className="p-3 text-slate-300 print:text-gray-800 max-w-[200px] truncate">
                          {row[h] == null ? '' : String(row[h])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && (
                <p className="text-xs text-navy-500 text-center py-2 print:hidden">
                  + {rows.length - 5} more rows — export to see all data
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #root > * { display: none !important; }
          .print\\:block { display: block !important; }
          [class*="Sidebar"], nav, aside { display: none !important; }
        }
      `}</style>
    </div>
  )
}
