import { useState, useEffect } from 'react'
import {
  FileText, Download, Printer, FileSpreadsheet, Loader2,
  Filter, ChevronDown, RefreshCw, Mail, Send
} from 'lucide-react'
import { getStudentsWithProgress, getSupervisorCheckins, MILESTONES } from '../lib/supabase'
import { sendStudentEmail } from '../lib/emailService'

// ── Constants ─────────────────────────────────────────────────────────────────
const INSTITUTION = 'Gulf Medical University'
const SIGNATURE   = { name: 'Dr. Salma Elnour', title: 'Thesis Coordinator' }

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
const fLabel = k => FIELD_LABELS[k] || k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())

const ACT_LABELS = {
  email:     'Email Sent',
  reminder:  'Reminder Sent',
  milestone: 'Milestone Updated',
  checkin:   'Check-in Submitted',
  note:      'Note Added',
}

const GROUP_MILESTONES = [
  { id: 'proposal_defense', name: 'Proposal Defense' },
  { id: 'progress_1',       name: 'First Progress Report' },
  { id: 'progress_2',       name: 'Second Progress Report' },
]

const REPORT_GROUPS = [
  {
    label: 'Student Reports',
    options: [
      { id: 'full_progress',    label: 'Full Progress Report' },
      { id: 'overdue',          label: 'Overdue Students' },
      { id: 'milestone_status', label: 'By Milestone — Student Responses' },
      { id: 'groups',           label: 'Group Assignments' },
      { id: 'individual',       label: 'Individual Student Report' },
    ]
  },
  {
    label: 'Supervisor Reports',
    options: [
      { id: 'supervisor_checkins', label: 'Supervisor Check-ins' },
      { id: 'issues_only',         label: 'Issues & Actions Only' },
    ]
  },
  {
    label: 'Communication History',
    options: [
      { id: 'comm_student', label: 'Per Student' },
      { id: 'comm_cohort',  label: 'Per Cohort' },
    ]
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : ''
const fmtShort= d => d ? new Date(d).toLocaleDateString('en-GB') : ''
const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''

// Expected columns per milestone — always shown even if empty
const MILESTONE_COLUMNS = {
  orcid:            ['orcid_id'],
  irb_approval:     ['proposal_title', 'irb_number', 'approval_date'],
  proposal_defense: ['committee_notes'],
  progress_1:       ['submission_date', 'progress_summary'],
  progress_2:       ['submission_date', 'progress_summary'],
  defense_schedule: ['defense_date', 'defense_time'],
  thesis_submission: ['final_title', 'submission_date', 'submission_notes'],
}

function extractResponses(sm, milestoneId) {
  // Build base row with expected columns for this milestone (empty by default)
  const expectedKeys = MILESTONE_COLUMNS[milestoneId] || []
  const out = {}
  for (const k of expectedKeys) out[fLabel(k)] = ''

  if (!sm?.response_data) return out

  // Handle both parsed JSON object and raw JSON string
  let rd = sm.response_data
  if (typeof rd === 'string') {
    try { rd = JSON.parse(rd) } catch { return out }
  }
  if (!rd || typeof rd !== 'object') return out

  // Fill in actual values
  for (const [k, v] of Object.entries(rd)) {
    if (v !== null && v !== undefined && v !== '' && k !== 'group') {
      out[fLabel(k)] = String(v)
    }
  }
  return out
}

// Strict cohort filter — number vs string safe
function filterByCohort(students, cohort) {
  if (cohort === 'all') return students
  return students.filter(s => Number(s.enrollment_year) === Number(cohort))
}

// ── Report builders ───────────────────────────────────────────────────────────
function buildFullProgress(students) {
  return students.map(s => {
    const row = {
      'Reg No':     s.student_id || '',
      'Student Name': s.name,
      'Email':      s.email,
      'Cohort':     s.enrollment_year || '',
      'Program':    s.program || '',
      'Supervisor': s.supervisors?.name || 'Unassigned',
    }
    for (const m of MILESTONES) {
      const sm = (s.student_milestones||[]).find(x=>x.milestone_id===m.id)
      row[m.name] = sm?.status === 'completed'
        ? `Completed — ${fmtShort(sm.completed_at)}`
        : sm?.status ? sm.status.charAt(0).toUpperCase()+sm.status.slice(1)
        : 'Pending'
    }
    const done = (s.student_milestones||[]).filter(m=>m.status==='completed').length
    row['Overall Progress'] = `${done} of ${MILESTONES.length} (${Math.round(done/MILESTONES.length*100)}%)`
    return row
  })
}

function buildOverdue(students) {
  const rows = []
  for (const s of students) {
    for (const sm of (s.student_milestones||[]).filter(m=>m.status==='overdue')) {
      const m = MILESTONES.find(x=>x.id===sm.milestone_id)
      rows.push({
        'Reg No':      s.student_id || '',
        'Student Name':s.name,
        'Email':       s.email,
        'Cohort':      s.enrollment_year || '',
        'Supervisor':  s.supervisors?.name || '',
        'Milestone':   m?.name || sm.milestone_id,
        'Due Date':    sm.due_date ? fmtDate(sm.due_date) : 'No deadline set',
      })
    }
  }
  return rows
}

function buildMilestoneStatus(students, milestoneId, milestoneGroupsData) {
  const needsGroup = ['proposal_defense','progress_1','progress_2'].includes(milestoneId)
  const groupMap = {}
  for (const g of (milestoneGroupsData[milestoneId]||[])) groupMap[g.group_name] = g

  return students.map(s => {
    const sm     = (s.student_milestones||[]).find(x=>x.milestone_id===milestoneId)
    const status = sm?.status || 'pending'
    const row = {
      'Reg No':      s.student_id || '',
      'Student Name':s.name,
      'Email':       s.email,
      'Cohort':      s.enrollment_year || '',
      'Supervisor':  s.supervisors?.name || '',
    }
    // Group info from coordinator settings
    if (needsGroup && sm?.group_name) {
      const g = groupMap[sm.group_name] || {}
      row['Group']        = `Group ${sm.group_name}`
      row['Session Date'] = g.date ? fmtDate(g.date) : ''
      row['Time']         = g.time_slot || ''
      row['Location']     = g.notes || ''
    }
    // Actual submitted response data
    Object.assign(row, extractResponses(sm, milestoneId))
    return row
  })
}

function buildMultiMilestone(students, milestoneIds, milGroupsData) {
  // Build one row per student with columns for each selected milestone
  const MILESTONE_COLUMNS = {
    orcid:            ['orcid_id'],
    irb_approval:     ['proposal_title','irb_number','approval_date'],
    proposal_defense: ['committee_notes'],
    progress_1:       ['submission_date','progress_summary'],
    progress_2:       ['submission_date','progress_summary','proposed_completion'],
    defense_schedule: ['defense_date','defense_time'],
    thesis_submission:['final_title','submission_date','submission_notes'],
  }

  return students.map(s => {
    const row = {
      'Reg No':       s.student_id || '',
      'Student Name': s.name,
      'Supervisor':   s.supervisors?.name || '',
    }
    for (const mId of milestoneIds) {
      const m      = MILESTONES.find(x => x.id === mId)
      const sm     = (s.student_milestones||[]).find(x => x.milestone_id === mId)
      const status = sm?.status || 'pending'
      const prefix = m?.name || mId

      // Extract actual response fields only — no status
      let rd = sm?.response_data || {}
      if (typeof rd === 'string') { try { rd = JSON.parse(rd) } catch { rd = {} } }
      const expectedKeys = MILESTONE_COLUMNS[mId] || []
      for (const k of expectedKeys) {
        row[`${prefix} — ${fLabel(k)}`] = rd[k] || ''
      }
    }
    return row
  })
}

function buildGroups(students, milestoneId, milestoneGroupsData) {
  const groupMap = {}
  for (const g of (milestoneGroupsData[milestoneId]||[])) groupMap[g.group_name] = g
  const milestoneName = MILESTONES.find(m=>m.id===milestoneId)?.name || milestoneId

  return students.map(s => {
    const sm        = (s.student_milestones||[]).find(x=>x.milestone_id===milestoneId)
    const groupName = sm?.group_name || ''
    const g         = groupMap[groupName] || {}
    return {
      'Reg No':       s.student_id || '',
      'Student Name': s.name,
      'Email':        s.email,
      'Cohort':       s.enrollment_year || '',
      'Supervisor':   s.supervisors?.name || '',
      'Milestone':    milestoneName,
      'Group':        groupName ? `Group ${groupName}` : 'Not assigned',
      'Session Date': g.date ? fmtDate(g.date) : '',
      'Time':         g.time_slot || '',
      'Location':     g.notes || '',
      'Status':       sm?.status ? sm.status.charAt(0).toUpperCase()+sm.status.slice(1) : 'Pending',
    }
  }).sort((a,b) => a.Group.localeCompare(b.Group))
}

function buildIndividual(student) {
  return MILESTONES.map(m => {
    const sm     = (student.student_milestones||[]).find(x=>x.milestone_id===m.id)
    const status = sm?.status || 'pending'
    const row = {
      'Milestone':      m.name,
      'Status':         status.charAt(0).toUpperCase()+status.slice(1),
      'Group':          sm?.group_name ? `Group ${sm.group_name}` : '',
      'Completed Date': sm?.completed_at ? fmtDate(sm.completed_at) : '',
    }
    Object.assign(row, extractResponses(sm, m.id))
    return row
  })
}

function buildSupervisorCheckins(checkins) {
  return checkins.map(c => ({
    'Supervisor':         c.supervisors?.name || '',
    'Student Name':       c.students?.name    || '',
    'Reg No':             c.students?.student_id || '',
    'Engagement Status':  c.engagement_status==='on_track' ? 'On Track'
                        : c.engagement_status==='concerns'  ? 'Concerns'
                        :                                     'Urgent',
    'Issue Type':         c.issue_type        || '',
    'Issue Description':  c.issue_description || '',
    'Recommended Action': c.recommended_action|| '',
    'Date Submitted':     fmtDate(c.submitted_at),
  }))
}

function buildIssuesOnly(checkins) {
  return checkins
    .filter(c=>c.engagement_status!=='on_track')
    .map(c => ({
      'Supervisor':         c.supervisors?.name || '',
      'Student Name':       c.students?.name    || '',
      'Reg No':             c.students?.student_id || '',
      'Status':             c.engagement_status==='concerns' ? 'Concerns' : 'Urgent',
      'Issue Type':         c.issue_type        || '',
      'Issue Description':  c.issue_description || '',
      'Recommended Action': c.recommended_action|| '',
      'Date Submitted':     fmtDate(c.submitted_at),
    }))
}

function buildCommStudent(student, activities) {
  return activities.map(a => ({
    'Date':        fmtShort(a.created_at),
    'Time':        fmtTime(a.created_at),
    'Type':        ACT_LABELS[a.type] || a.type,
    'Description': a.description,
  })).sort((a,b)=>new Date(a.Date)-new Date(b.Date))
}

function buildCommCohort(students, activityByStudent) {
  const rows = []
  for (const s of students) {
    for (const a of (activityByStudent[s.id]||[])) {
      rows.push({
        'Date':          fmtShort(a.created_at),
        'Time':          fmtTime(a.created_at),
        'Reg No':        s.student_id || '',
        'Student Name':  s.name,
        'Supervisor':    s.supervisors?.name || '',
        'Type':          ACT_LABELS[a.type] || a.type,
        'Description':   a.description,
      })
    }
  }
  return rows.sort((a,b)=>new Date(a.Date+' '+a.Time)-new Date(b.Date+' '+b.Time))
}

// ── Script loader ─────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((res,rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
}

// ── Export helpers ────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h]==null ? '' : String(r[h])
      return v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g,'""')}"` : v
    }).join(','))
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}))
  a.download = filename; a.click()
}

async function downloadExcel(rows, filename, sheetName, subtitle = '') {
  await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js')
  const XLSX = window.XLSX
  if (!rows.length) return

  const headers   = Object.keys(rows[0])
  const colCount  = headers.length
  const dateStr   = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })

  // Build worksheet data manually so we can add header rows
  const wsData = []

  // Row 1 — Institution
  const r1 = Array(colCount).fill('')
  r1[0] = 'GULF MEDICAL UNIVERSITY — MSc Medical Laboratory Sciences'
  wsData.push(r1)

  // Row 2 — Report title
  const r2 = Array(colCount).fill('')
  r2[0] = sheetName
  wsData.push(r2)

  // Row 3 — Subtitle / date / confidential
  const r3 = Array(colCount).fill('')
  r3[0] = subtitle || ''
  r3[Math.max(0, colCount - 2)] = `Generated: ${dateStr}`
  r3[colCount - 1] = 'CONFIDENTIAL'
  wsData.push(r3)

  // Row 4 — blank spacer
  wsData.push(Array(colCount).fill(''))

  // Row 5 — column headers
  wsData.push(headers)

  // Data rows
  rows.forEach(row => wsData.push(headers.map(h => row[h] ?? '')))

  // Row after data — blank
  wsData.push(Array(colCount).fill(''))

  // Signature rows
  const sigRow1 = Array(colCount).fill(''); sigRow1[0] = 'Dr. Salma Elnour'
  const sigRow2 = Array(colCount).fill(''); sigRow2[0] = 'Thesis Coordinator'
  const sigRow3 = Array(colCount).fill(''); sigRow3[0] = 'Gulf Medical University'
  wsData.push(sigRow1, sigRow2, sigRow3)

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // ── Column widths ─────────────────────────────────────────────────────────
  ws['!cols'] = headers.map(h => ({
    wch: Math.max(h.length + 4, 16, Math.min(
      50,
      Math.max(...rows.map(r => String(r[h]||'').length), 0) + 2
    ))
  }))

  // ── Merge cells for header rows ───────────────────────────────────────────
  ws['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:colCount-1} }, // institution
    { s:{r:1,c:0}, e:{r:1,c:colCount-1} }, // title
  ]

  // ── Cell styles ───────────────────────────────────────────────────────────
  const navyFill  = { patternType:'solid', fgColor:{ rgb:'1E3A5F' } }
  const goldFill  = { patternType:'solid', fgColor:{ rgb:'D4A843' } }
  const lightFill = { patternType:'solid', fgColor:{ rgb:'F1F5F9' } }
  const altFill   = { patternType:'solid', fgColor:{ rgb:'E8EFF7' } }

  const whiteFont  = { bold:true, color:{ rgb:'FFFFFF' }, name:'Calibri', sz:11 }
  const goldFont   = { bold:true, color:{ rgb:'D4A843' }, name:'Calibri', sz:13 }
  const navyFont   = { bold:true, color:{ rgb:'1E3A5F' }, name:'Calibri', sz:10 }
  const darkFont   = { color:{ rgb:'1E293B' }, name:'Calibri', sz:10 }
  const mutedFont  = { color:{ rgb:'64748B' }, name:'Calibri', sz:9, italic:true }
  const sigFont    = { bold:true, color:{ rgb:'1E3A5F' }, name:'Calibri', sz:10 }

  const border = {
    top:    { style:'thin', color:{ rgb:'CBD5E1' } },
    bottom: { style:'thin', color:{ rgb:'CBD5E1' } },
    left:   { style:'thin', color:{ rgb:'CBD5E1' } },
    right:  { style:'thin', color:{ rgb:'CBD5E1' } },
  }
  const headerBorder = {
    top:    { style:'medium', color:{ rgb:'D4A843' } },
    bottom: { style:'medium', color:{ rgb:'D4A843' } },
    left:   { style:'thin',   color:{ rgb:'1E3A5F' } },
    right:  { style:'thin',   color:{ rgb:'1E3A5F' } },
  }

  function cellAddr(r, c) {
    const col = c < 26
      ? String.fromCharCode(65 + c)
      : String.fromCharCode(64 + Math.floor(c/26)) + String.fromCharCode(65 + (c%26))
    return `${col}${r+1}`
  }

  // Style row 0 — institution (navy bg, gold text)
  for (let col=0; col<colCount; col++) {
    const addr = cellAddr(0, col)
    if (!ws[addr]) ws[addr] = { t:'s', v:'' }
    ws[addr].s = { fill:navyFill, font: col===0 ? { bold:true, color:{rgb:'D4A843'}, name:'Calibri', sz:11 } : whiteFont, alignment:{ horizontal:'left', vertical:'center' } }
  }

  // Style row 1 — title (navy bg, white bold large)
  for (let col=0; col<colCount; col++) {
    const addr = cellAddr(1, col)
    if (!ws[addr]) ws[addr] = { t:'s', v:'' }
    ws[addr].s = { fill:navyFill, font:{ bold:true, color:{rgb:'FFFFFF'}, name:'Calibri', sz:14 }, alignment:{ horizontal:'left', vertical:'center' } }
  }

  // Style row 2 — subtitle (light bg, muted)
  for (let col=0; col<colCount; col++) {
    const addr = cellAddr(2, col)
    if (!ws[addr]) ws[addr] = { t:'s', v:'' }
    ws[addr].s = { fill:lightFill, font:mutedFont, alignment:{ horizontal: col >= colCount-2 ? 'right' : 'left', vertical:'center' } }
  }

  // Style row 4 — column headers (navy bg, white bold)
  for (let col=0; col<colCount; col++) {
    const addr = cellAddr(4, col)
    if (!ws[addr]) ws[addr] = { t:'s', v:headers[col] }
    ws[addr].s = { fill:navyFill, font:whiteFont, border:headerBorder, alignment:{ horizontal:'center', vertical:'center', wrapText:true } }
  }

  // Style data rows — alternating
  const dataStart = 5
  rows.forEach((row, ri) => {
    const fill = ri % 2 === 0 ? { patternType:'none' } : altFill
    for (let col=0; col<colCount; col++) {
      const addr = cellAddr(dataStart + ri, col)
      if (!ws[addr]) ws[addr] = { t:'s', v:'' }
      ws[addr].s = { fill, font:darkFont, border, alignment:{ horizontal:'left', vertical:'center', wrapText:true } }
    }
  })

  // Row heights
  ws['!rows'] = wsData.map((_, i) => {
    if (i === 0) return { hpt: 22 }
    if (i === 1) return { hpt: 28 }
    if (i === 2) return { hpt: 18 }
    if (i === 4) return { hpt: 22 }
    return { hpt: 18 }
  })

  // Style signature rows
  const sigStart = 5 + rows.length + 1
  ;[0,1,2].forEach(ri => {
    const addr = cellAddr(sigStart + ri, 0)
    if (!ws[addr]) ws[addr] = { t:'s', v:'' }
    ws[addr].s = { font: ri === 0 ? sigFont : mutedFont }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

async function downloadPDF(title, subtitle, rows, filename) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF
  if (!jsPDF) throw new Error('PDF library failed to load')

  const landscape = rows.length && Object.keys(rows[0]).length > 6
  const doc  = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // ── Professional header ───────────────────────────────────────────────────
  // Navy background bar
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, pageW, 44, 'F')

  // Gold accent line
  doc.setFillColor(212, 168, 67)
  doc.rect(0, 44, pageW, 1.5, 'F')

  // Institution name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(212, 168, 67)
  doc.text(INSTITUTION.toUpperCase(), 14, 11)

  // Report title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(title, 14, 24)

  // Subtitle (cohort / student name)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(180, 210, 240)
    doc.text(subtitle, 14, 33)
  }

  // Date top right
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 210, 240)
  const dateStr = `Generated: ${fmtDate(new Date())}`
  doc.text(dateStr, pageW - 14, 11, { align: 'right' })

  // Confidential tag top right
  doc.setFontSize(7)
  doc.setTextColor(212, 168, 67)
  doc.text('CONFIDENTIAL', pageW - 14, 33, { align: 'right' })

  // ── Table ─────────────────────────────────────────────────────────────────
  if (rows.length) {
    doc.autoTable({
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.values(r).map(v => v==null ? '' : String(v))),
      startY: 50,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor:  [30, 58, 95],
        textColor:  [255, 255, 255],
        fontStyle:  'bold',
        fontSize:   8,
      },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Page number footer
        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Page ${data.pageNumber}`,
          pageW / 2, pageH - 8,
          { align: 'center' }
        )
      }
    })
  } else {
    doc.setTextColor(120,120,120)
    doc.setFontSize(10)
    doc.text('No data found for this report.', 14, 55)
  }

  // ── Signature footer ──────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable?.finalY || 60
  const sigY   = Math.min(finalY + 16, pageH - 28)

  doc.setDrawColor(212, 168, 67)
  doc.setLineWidth(0.5)
  doc.line(14, sigY, 80, sigY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 58, 95)
  doc.text(SIGNATURE.name, 14, sigY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(SIGNATURE.title, 14, sigY + 12)
  doc.text(INSTITUTION, 14, sigY + 18)

  doc.save(filename)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [students,         setStudents]         = useState([])
  const [checkins,         setCheckins]         = useState([])
  const [milGroupsData,    setMilGroupsData]    = useState({})
  const [actByStudent,     setActByStudent]     = useState({})
  const [loading,          setLoading]          = useState(true)
  const [generating,       setGenerating]       = useState(false)

  // Filters & selectors
  const [reportType,       setReportType]       = useState('full_progress')
  const [cohortFilter,     setCohortFilter]     = useState('all')
  const [milFilter,        setMilFilter]        = useState(['orcid'])  // now an array
  const [groupMil,         setGroupMil]         = useState('proposal_defense')
  const [selStudent,       setSelStudent]       = useState('')

  // Email send
  const [emailTo,          setEmailTo]          = useState('')
  const [emailSending,     setEmailSending]     = useState(false)
  const [emailResult,      setEmailResult]      = useState(null)
  const [showEmail,        setShowEmail]        = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('../lib/supabase')
        const [studs, chks, grps] = await Promise.all([
          getStudentsWithProgress(),
          getSupervisorCheckins(),
          supabase.from('milestone_groups').select('*').order('group_name'),
        ])
        setStudents(studs)
        setCheckins(chks)
        if (studs.length) setSelStudent(studs[0].id)

        const gMap = {}
        for (const g of (grps.data||[])) {
          if (!gMap[g.milestone_id]) gMap[g.milestone_id] = []
          gMap[g.milestone_id].push(g)
        }
        setMilGroupsData(gMap)

        // Load all activity logs
        const aMap = {}
        for (const s of studs) {
          const { data: acts } = await supabase
            .from('activity_log')
            .select('*')
            .eq('student_id', s.id)
            .order('created_at', { ascending: true })
          aMap[s.id] = acts || []
        }
        setActByStudent(aMap)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Strict cohort filtering
  const cohortYears     = [...new Set(students.map(s=>s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
  const filteredStudents = filterByCohort(students, cohortFilter)
  const filteredCheckins = cohortFilter==='all' ? checkins
    : checkins.filter(c => Number(students.find(s=>s.id===c.student_id)?.enrollment_year) === Number(cohortFilter))

  function getRows() {
    switch(reportType) {
      case 'full_progress':       return buildFullProgress(filteredStudents)
      case 'overdue':             return buildOverdue(filteredStudents)
      case 'milestone_status':    return milFilter.length === 1
        ? buildMilestoneStatus(filteredStudents, milFilter[0], milGroupsData)
        : buildMultiMilestone(filteredStudents, milFilter, milGroupsData)
      case 'groups':              return buildGroups(filteredStudents, groupMil, milGroupsData)
      case 'individual': {
        const s = students.find(x=>x.id===selStudent)
        return s ? buildIndividual(s) : []
      }
      case 'supervisor_checkins': return buildSupervisorCheckins(filteredCheckins)
      case 'issues_only':         return buildIssuesOnly(filteredCheckins)
      case 'comm_student': {
        const s = students.find(x=>x.id===selStudent)
        return s ? buildCommStudent(s, actByStudent[s.id]||[]) : []
      }
      case 'comm_cohort':
        return buildCommCohort(filteredStudents, actByStudent)
      default: return []
    }
  }

  function getTitle() {
    const c = cohortFilter!=='all' ? `${cohortFilter} Cohort` : 'All Cohorts'
    switch(reportType) {
      case 'full_progress':       return 'Full Student Progress Report'
      case 'overdue':             return 'Overdue Students Report'
      case 'groups':              return `Group Assignments — ${GROUP_MILESTONES.find(m=>m.id===groupMil)?.name}`
      case 'milestone_status':    return milFilter.length===1
        ? `${MILESTONES.find(m=>m.id===milFilter[0])?.name} — Student Responses`
        : `Combined Milestone Report — ${milFilter.map(id=>MILESTONES.find(m=>m.id===id)?.name||id).join(', ')}`
      case 'individual':          return `Individual Report — ${students.find(s=>s.id===selStudent)?.name||''}`
      case 'supervisor_checkins': return 'Supervisor Check-in Report'
      case 'issues_only':         return 'Student Issues & Recommended Actions'
      case 'comm_student':        return `Communication History — ${students.find(s=>s.id===selStudent)?.name||''}`
      case 'comm_cohort':         return `Communication History — ${c}`
      default: return 'Report'
    }
  }

  function getSubtitle() {
    const parts = []
    if (cohortFilter!=='all') parts.push(`${cohortFilter} Cohort`)
    if (reportType==='individual'||reportType==='comm_student') {
      const s = students.find(x=>x.id===selStudent)
      if (s?.student_id) parts.push(`Reg No: ${s.student_id}`)
    }
    parts.push(`${filteredStudents.length} Students`)
    return parts.join('  |  ')
  }

  function fname(ext) {
    return `thesis-report-${reportType}-${new Date().toISOString().slice(0,10)}.${ext}`
  }

  async function exportAs(fmt) {
    setGenerating(true)
    try {
      const rows = getRows()
      if (!rows.length) { alert('No data to export.'); setGenerating(false); return }
      if (fmt==='csv')   downloadCSV(rows, fname('csv'))
      if (fmt==='excel') await downloadExcel(rows, fname('xlsx'), getTitle(), getSubtitle())
      if (fmt==='pdf')   await downloadPDF(getTitle(), getSubtitle(), rows, fname('pdf'))
      if (fmt==='print') window.print()
    } catch(e) { alert('Export failed: '+(e.message||String(e))) }
    setGenerating(false)
  }

  async function sendReport() {
    if (!emailTo.trim()) return
    setEmailSending(true); setEmailResult(null)
    try {
      const rows    = getRows()
      const title   = getTitle()
      const headers = rows.length ? Object.keys(rows[0]) : []
      const preview = rows.slice(0,15).map(r =>
        headers.map(h=>`${h}: ${r[h]||'—'}`).join('  |  ')
      ).join('\n')
      const more = rows.length>15 ? `\n\n(${rows.length-15} more records — please export to PDF or Excel for full report)` : ''

      await sendStudentEmail({
        student:     { name: 'Coordinator', email: emailTo, token: '' },
        milestoneId: null,
        subject:     `${title} — ${fmtDate(new Date())}`,
        message:     `Please find below the ${title}.\n\nGenerated: ${fmtDate(new Date())}\nTotal Records: ${rows.length}\n\n${preview}${more}\n\n${SIGNATURE.name}\n${SIGNATURE.title}\n${INSTITUTION}`,
      })
      setEmailResult({ ok: true, msg: `Report sent to ${emailTo}` })
    } catch(e) {
      setEmailResult({ ok: false, msg: 'Failed to send. Please try again.' })
    }
    setEmailSending(false)
  }

  const rows    = getRows()
  const headers = rows.length ? Object.keys(rows[0]) : []

  return (
    <div className="p-8 space-y-6 fade-in">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Reports</h1>
          <p className="text-navy-400 mt-1">Generate and export professional reports</p>
        </div>
        <button onClick={()=>window.location.reload()} className="btn-secondary">
          <RefreshCw size={15}/> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">

        {/* ── Left panel ── */}
        <div className="space-y-4">

          {/* Cohort filter */}
          <div className="card p-5 border-gold-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={15} className="text-gold-400"/>
              <h3 className="font-semibold text-slate-100 text-sm">Cohort</h3>
            </div>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7 bg-navy-900/80"
                value={cohortFilter} onChange={e=>setCohortFilter(e.target.value)}>
                <option value="all">All Cohorts</option>
                {cohortYears.map(y=>(
                  <option key={y} value={y}>{y} Cohort — {filterByCohort(students,y).length} students</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
            {cohortFilter!=='all' && (
              <div className="mt-2.5 px-3 py-2 rounded-lg bg-gold-500/10 border border-gold-500/20">
                <p className="text-xs text-gold-300 font-medium">
                  {filteredStudents.length} student{filteredStudents.length!==1?'s':''} in {cohortFilter} cohort
                </p>
              </div>
            )}
          </div>

          {/* Report type */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-100 text-sm mb-3">Report Type</h3>
            <div className="relative">
              <select className="input text-sm appearance-none pr-7 bg-navy-900/80"
                value={reportType} onChange={e=>setReportType(e.target.value)}>
                {REPORT_GROUPS.map(g=>(
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map(o=>(
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>

          {/* Contextual selectors */}
          {reportType==='milestone_status' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-100 text-sm">Select Milestones</h3>
                <button onClick={() => setMilFilter(MILESTONES.map(m=>m.id))}
                  className="text-xs text-gold-400 hover:text-gold-300 transition-colors">
                  Select all
                </button>
              </div>
              <div className="space-y-2">
                {MILESTONES.map(m => (
                  <label key={m.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                    milFilter.includes(m.id)
                      ? 'border-gold-500/40 bg-gold-500/10'
                      : 'border-navy-700/40 hover:border-navy-600/50'
                  }`}>
                    <input type="checkbox" className="accent-amber-400"
                      checked={milFilter.includes(m.id)}
                      onChange={e => setMilFilter(prev =>
                        e.target.checked ? [...prev, m.id] : prev.filter(x => x !== m.id)
                      )}/>
                    <span className="text-sm">{m.icon}</span>
                    <span className={`text-xs font-medium ${milFilter.includes(m.id)?'text-gold-300':'text-navy-400'}`}>
                      {m.name}
                    </span>
                  </label>
                ))}
              </div>
              {milFilter.length > 1 && (
                <p className="text-xs text-gold-400/70 mt-2">{milFilter.length} milestones — combined report</p>
              )}
            </div>
          )}
          {reportType==='groups' && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-100 text-sm mb-3">Select Milestone</h3>
              <div className="relative">
                <select className="input text-sm appearance-none pr-7" value={groupMil} onChange={e=>setGroupMil(e.target.value)}>
                  {GROUP_MILESTONES.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
              </div>
            </div>
          )}
          {(reportType==='individual'||reportType==='comm_student') && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-100 text-sm mb-3">Select Student</h3>
              <div className="relative">
                <select className="input text-sm appearance-none pr-7" value={selStudent} onChange={e=>setSelStudent(e.target.value)}>
                  {filteredStudents.map(s=>(
                    <option key={s.id} value={s.id}>{s.name} — {s.student_id||s.email}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
              </div>
            </div>
          )}

          {/* Export */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-100 text-sm mb-3">Export</h3>
            <div className="space-y-2">
              {[
                { fmt:'excel', icon:FileSpreadsheet, label:'Excel (.xlsx)', color:'text-emerald-400' },
                { fmt:'csv',   icon:FileText,        label:'CSV',           color:'text-blue-400'    },
                { fmt:'pdf',   icon:FileText,        label:'PDF',           color:'text-red-400'     },
                { fmt:'print', icon:Printer,         label:'Print',         color:'text-slate-400'   },
              ].map(({fmt,icon:Icon,label,color})=>(
                <button key={fmt} onClick={()=>exportAs(fmt)}
                  disabled={generating||!rows.length}
                  className="w-full btn-secondary justify-between disabled:opacity-40 text-xs py-2">
                  <span className="flex items-center gap-2">
                    <Icon size={13} className={color}/>{label}
                  </span>
                  {generating ? <Loader2 size={11} className="animate-spin"/> : <Download size={11} className="text-navy-500"/>}
                </button>
              ))}

              {/* Email */}
              <button onClick={()=>setShowEmail(v=>!v)}
                className="w-full btn-secondary justify-between text-xs py-2">
                <span className="flex items-center gap-2">
                  <Mail size={13} className="text-amber-400"/>Send by Email
                </span>
                <ChevronDown size={11} className={`text-navy-500 transition-transform ${showEmail?'rotate-180':''}`}/>
              </button>
              {showEmail && (
                <div className="space-y-2 pt-1">
                  <input className="input text-xs py-2" type="email"
                    placeholder="Recipient email address…"
                    value={emailTo} onChange={e=>setEmailTo(e.target.value)}/>
                  <button onClick={sendReport}
                    disabled={emailSending||!emailTo.trim()||!rows.length}
                    className="btn-primary w-full justify-center text-xs py-2 disabled:opacity-50">
                    {emailSending?<Loader2 size={12} className="animate-spin"/>:<Send size={12}/>}
                    {emailSending?'Sending…':'Send Report'}
                  </button>
                  {emailResult && (
                    <p className={`text-xs px-2 py-1.5 rounded-lg ${emailResult.ok?'text-emerald-300 bg-emerald-900/20 border border-emerald-700/40':'text-red-300 bg-red-900/20 border border-red-700/40'}`}>
                      {emailResult.msg}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Records count + signature */}
            <div className="mt-4 pt-3 border-t border-navy-700/50 space-y-1">
              <p className="text-xs text-navy-500">{rows.length} record{rows.length!==1?'s':''}</p>
              <p className="text-xs font-semibold text-gold-400">{SIGNATURE.name}</p>
              <p className="text-xs text-navy-400">{SIGNATURE.title}</p>
            </div>
          </div>

        </div>

        {/* ── Preview panel ── */}
        <div className="col-span-3 card p-6">

          {/* Preview header */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-display font-semibold text-slate-100 text-lg">{getTitle()}</h2>
              <p className="text-xs text-navy-400 mt-1">{getSubtitle()}</p>
            </div>
            <span className="text-xs text-navy-500 bg-navy-800/60 border border-navy-700/40 px-3 py-1 rounded-lg shrink-0 ml-4">
              Preview — first 10 rows
            </span>
          </div>

          <div className="h-px bg-navy-700/50 mb-5"/>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i=><div key={i} className="h-9 rounded-xl bg-navy-800/40 shimmer"/>)}
            </div>
          ) : rows.length===0 ? (
            <div className="text-center py-20">
              <FileText size={36} className="mx-auto mb-3 text-navy-700"/>
              <p className="text-sm font-medium text-navy-500">No data available for this report</p>
              {cohortFilter!=='all' && (
                <p className="text-xs text-navy-600 mt-1">No records found for the {cohortFilter} cohort</p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-navy-700/40">
                <table className="w-full">
                  <thead>
                    <tr className="bg-navy-800/80 border-b border-navy-700/50">
                      {headers.map(h=>(
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-navy-200 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0,10).map((row,i)=>(
                      <tr key={i} className={`border-b border-navy-700/20 transition-colors hover:bg-navy-700/20 ${i%2===0?'bg-transparent':'bg-navy-800/10'}`}>
                        {headers.map(h=>(
                          <td key={h} className="px-4 py-2.5 text-xs text-slate-300 max-w-[180px]">
                            <span className="block truncate" title={row[h]==null?'':String(row[h])}>
                              {!row[h] || row[h]===''
                                ? <span className="text-navy-700">—</span>
                                : String(row[h])
                              }
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
                  Showing 10 of {rows.length} records — export to view all
                </p>
              )}

              {/* Signature footer in preview */}
              <div className="mt-8 pt-5 border-t border-navy-700/40 flex items-end justify-between">
                <div>
                  <div className="w-40 border-t-2 border-gold-500/60 mb-2"/>
                  <p className="text-sm font-bold text-gold-400">{SIGNATURE.name}</p>
                  <p className="text-xs text-navy-400 mt-0.5">{SIGNATURE.title}</p>
                  <p className="text-xs text-navy-500">{INSTITUTION}</p>
                </div>
                <p className="text-xs text-navy-600 italic">{fmtDate(new Date())}</p>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
