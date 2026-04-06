import { useState, useEffect } from 'react'
import {
  Send, Loader2, RefreshCw, AlertCircle, CheckCircle2,
  Clock, Users, ChevronDown, GraduationCap, ClipboardList, Filter
} from 'lucide-react'
import CheckinDetailModal from '../components/CheckinDetailModal'
import {
  getStudentsWithProgress, getSupervisorCheckins,
  getStudentCheckins, getCheckinLink, getStudentCheckinLink
} from '../lib/supabase'
import { sendStudentEmail, sendSupervisorEmail } from '../lib/emailService'
import { formatDistanceToNow } from 'date-fns'

const STUDENT_STATUS = {
  on_track:      { label: 'On Track',       emoji: '🟢', color: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' },
  some_concerns: { label: 'Some Concerns',  emoji: '🟡', color: 'bg-amber-900/30 border-amber-700/40 text-amber-300'     },
  struggling:    { label: 'Struggling',     emoji: '🔴', color: 'bg-red-900/30 border-red-700/40 text-red-300'           },
}

const COORD_STATUS = {
  new:         { label:'New',         dot:'bg-blue-400',    badge:'bg-blue-500/15 border-blue-500/40 text-blue-300'       },
  in_progress: { label:'In Progress', dot:'bg-amber-400',   badge:'bg-amber-500/15 border-amber-500/40 text-amber-300'    },
  resolved:    { label:'Resolved',    dot:'bg-emerald-400', badge:'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
}

const SUPERVISOR_STATUS = {
  on_track: { label: 'On Track',         emoji: '🟢', color: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300' },
  concerns: { label: 'Needs Attention',  emoji: '🟡', color: 'bg-amber-900/30 border-amber-700/40 text-amber-300'       },
  urgent:   { label: 'Urgent Follow-up', emoji: '🔴', color: 'bg-red-900/30 border-red-700/40 text-red-300'             },
}

const MEETING_LABELS = {
  regularly:    'Meets regularly',
  occasionally: 'Meets occasionally',
  not_met:      'Has not met recently',
}

const WRITING_LABELS = {
  proposal_writing: 'Writing/finalising proposal',
  data_collection:  'Collecting/analysing data',
  thesis_writing:   'Writing thesis chapters',
  reviewing:        'Reviewing/revising',
  ahead:            'Ahead of schedule',
  on_track:         'On track',
  behind:           'Behind schedule',
  not_started:      'Not yet started',
}

export default function Checkins() {
  const [students, setStudents]           = useState([])
  const [supCheckins, setSupCheckins]     = useState([])
  const [stuCheckins, setStuCheckins]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [sendingStudent, setSendingStudent] = useState({})
  const [sendingSuper, setSendingSuper]   = useState({})
  const [bulkSending, setBulkSending]     = useState(null) // 'students'|'supervisors'|null
  const [cohortFilter, setCohortFilter]   = useState('all')
  const [activeTab, setActiveTab]         = useState('overview')
  const [statusFilter, setStatusFilter]   = useState('active') // 'active' | 'resolved'
  const [selectedCheckin, setSelectedCheckin] = useState(null)
  const [checkinType, setCheckinType]     = useState('student') // overview|students|supervisors

  async function load() {
    setLoading(true)
    try {
      const [s, sc, stc] = await Promise.all([
        getStudentsWithProgress(),
        getSupervisorCheckins(),
        getStudentCheckins(),
      ])
      setStudents(s); setSupCheckins(sc); setStuCheckins(stc)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const cohortYears = [...new Set(students.map(s => s.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
  const filtered = cohortFilter === 'all' ? students : students.filter(s => String(s.enrollment_year) === String(cohortFilter))

  const latestStudentCheckin  = (sid) => stuCheckins.find(c => c.student_id === sid)
  const latestSupervisorCheckin = (sid) => supCheckins.find(c => c.student_id === sid)

  // Stats
  const stuOnTrack  = stuCheckins.filter(c=>c.overall_status==='on_track').length
  const stuConcerns = stuCheckins.filter(c=>c.overall_status==='some_concerns').length
  const stuStruggle = stuCheckins.filter(c=>c.overall_status==='struggling').length
  const supOnTrack  = supCheckins.filter(c=>c.engagement_status==='on_track').length
  const supConcerns = supCheckins.filter(c=>c.engagement_status==='concerns').length
  const supUrgent   = supCheckins.filter(c=>c.engagement_status==='urgent').length

  async function sendStudentCheckin(student) {
    const key = student.id
    setSendingStudent(s => ({...s,[key]:'sending'}))
    try {
      const link = getStudentCheckinLink(student.token)
      await sendStudentEmail({
        student,
        milestoneId: null,
        subject: 'Thesis Progress Check-in — Action Required',
        message: `We would like to hear how your thesis is progressing.\n\nPlease take a few minutes to complete your thesis check-in using the button below. Your responses help us ensure you receive the right support at the right time.\n\nThis is completely confidential.`,
        response_link: link,
      })
      setSendingStudent(s => ({...s,[key]:'sent'}))
      setTimeout(() => setSendingStudent(s => ({...s,[key]:null})), 4000)
    } catch(e) {
      console.error(e)
      setSendingStudent(s => ({...s,[key]:'error'}))
      setTimeout(() => setSendingStudent(s => ({...s,[key]:null})), 4000)
    }
  }

  async function sendSupervisorCheckin(student) {
    const key = student.id
    setSendingSuper(s => ({...s,[key]:'sending'}))
    try {
      const link = await getCheckinLink(student.supervisor_id, student.id)
      if (!link) throw new Error('No supervisor token')
      await sendSupervisorEmail({
        supervisor: student.supervisors,
        student,
        milestoneId: null,
        subject: `Check-in Request — ${student.name} (${student.student_id || ''})`,
        message: `We would appreciate a brief update on the engagement and progress of your student.\n\nPlease click the button below to complete a short check-in form. It will only take a moment.`,
        response_link: link,
      })
      setSendingSuper(s => ({...s,[key]:'sent'}))
      setTimeout(() => setSendingSuper(s => ({...s,[key]:null})), 4000)
    } catch(e) {
      console.error(e)
      setSendingSuper(s => ({...s,[key]:'error'}))
      setTimeout(() => setSendingSuper(s => ({...s,[key]:null})), 4000)
    }
  }

  async function sendAllStudents() {
    setBulkSending('students')
    for (const s of filtered) { await sendStudentCheckin(s); await new Promise(r=>setTimeout(r,400)) }
    setBulkSending(null); load()
  }

  async function sendAllSupervisors() {
    setBulkSending('supervisors')
    for (const s of filtered.filter(s=>s.supervisor_id&&s.supervisors)) {
      await sendSupervisorCheckin(s); await new Promise(r=>setTimeout(r,400))
    }
    setBulkSending(null); load()
  }

  function SendBtn({ status, onSend, label = 'Send' }) {
    return (
      <button onClick={onSend} disabled={status==='sending'}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
          status==='sent'    ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' :
          status==='error'   ? 'bg-red-900/20 border-red-700/40 text-red-300' :
          status==='sending' ? 'btn-secondary opacity-70' : 'btn-secondary'
        }`}>
        {status==='sending' && <Loader2 size={11} className="animate-spin" />}
        {status==='sent'    && <CheckCircle2 size={11} />}
        {status==='error'   && <AlertCircle size={11} />}
        {!status            && <Send size={11} />}
        {status==='sent' ? 'Sent!' : status==='error' ? 'Failed' : status==='sending' ? '…' : label}
      </button>
    )
  }

  return (
    <div className="p-8 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Check-ins</h1>
          <p className="text-navy-400 mt-1">Monitor progress from both students and supervisors</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={sendAllStudents} disabled={!!bulkSending} className="btn-secondary disabled:opacity-50">
            {bulkSending==='students' ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
            Send to Students
          </button>
          <button onClick={sendAllSupervisors} disabled={!!bulkSending} className="btn-primary disabled:opacity-50">
            {bulkSending==='supervisors' ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
            Send to Supervisors
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: '🟢 Students OK',    value: stuOnTrack,  color: 'text-emerald-300' },
          { label: '🟡 Some Concerns',  value: stuConcerns, color: 'text-amber-300'   },
          { label: '🔴 Struggling',     value: stuStruggle, color: 'text-red-300'     },
          { label: '🟢 Supervisors OK', value: supOnTrack,  color: 'text-emerald-300' },
          { label: '🟡 Sup Concerns',   value: supConcerns, color: 'text-amber-300'   },
          { label: '🔴 Sup Urgent',     value: supUrgent,   color: 'text-red-300'     },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-navy-400 mb-1 leading-tight">{s.label}</p>
            <p className={`text-2xl font-display font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cohort filter + tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {['overview','students','supervisors'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                activeTab === tab
                  ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
                  : 'border-navy-700/40 text-navy-400 hover:text-slate-300'
              }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-navy-500" />
          <div className="relative">
            <select className="input text-xs py-1.5 pr-7 appearance-none"
              value={cohortFilter} onChange={e => setCohortFilter(e.target.value)}>
              <option value="all">All Cohorts</option>
              {cohortYears.map(y => <option key={y} value={y}>{y} Cohort</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
        {/* Status filter */}
        <div className="flex items-center gap-2">
          {[
            { v:'active',   label:'Active',   count: stuCheckins.filter(c=>c.coordinator_status!=='resolved').length + supCheckins.filter(c=>c.coordinator_status!=='resolved').length },
            { v:'resolved', label:'Resolved', count: stuCheckins.filter(c=>c.coordinator_status==='resolved').length + supCheckins.filter(c=>c.coordinator_status==='resolved').length },
          ].map(opt => (
            <button key={opt.v} onClick={() => setStatusFilter(opt.v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                statusFilter===opt.v
                  ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                  : 'border-navy-700/40 text-navy-400 hover:text-slate-300'
              }`}>
              {opt.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter===opt.v?'bg-gold-500/20 text-gold-400':'bg-navy-700/60 text-navy-500'}`}>
                {opt.count}
              </span>
            </button>
          ))}
          {statusFilter === 'active' && stuCheckins.filter(c=>c.coordinator_status==='new'&&c.overall_status==='struggling').length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-red-300 bg-red-900/20 border border-red-700/40 px-3 py-1.5 rounded-xl ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block"/>
              {stuCheckins.filter(c=>c.coordinator_status==='new'&&c.overall_status==='struggling').length} struggling — not yet reviewed
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Student latest check-ins */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <GraduationCap size={16} className="text-gold-400" /> Student Check-ins
            </h2>
            {stuCheckins.length === 0 ? (
              <p className="text-sm text-navy-500">No student check-ins yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {stuCheckins
                  .filter(c => statusFilter==='resolved'
                    ? c.coordinator_status==='resolved'
                    : c.coordinator_status!=='resolved')
                  .slice(0,8).map(c => {
                  const effectiveStatus = c.override_status || c.overall_status
                  const cfg = STUDENT_STATUS[effectiveStatus]
                  return (
                    <div key={c.id}
                      onClick={() => { setSelectedCheckin(c); setCheckinType('student') }}
                      className={`p-3 rounded-xl border cursor-pointer hover:opacity-90 transition-opacity ${cfg.color}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-semibold">{c.students?.name}</p>
                          <p className="text-xs opacity-70 font-mono">{c.students?.student_id}</p>
                        </div>
                        <span className="text-lg shrink-0">{cfg.emoji}</span>
                      </div>
                      <p className="text-xs opacity-80">{MEETING_LABELS[c.supervisor_meetings] || ''}</p>
                      <p className="text-xs opacity-80">{WRITING_LABELS[c.writing_status] || ''}</p>
                      {c.override_status && c.override_status !== c.overall_status && (
                        <p className="text-xs opacity-50 mt-1 line-through">{STUDENT_STATUS[c.overall_status]?.label} (original)</p>
                      )}
                      {c.challenges && <p className="text-xs opacity-70 mt-1 line-clamp-1">⚠ {c.challenges}</p>}
                      {c.support_needed && <p className="text-xs opacity-70 mt-0.5 line-clamp-1">→ {c.support_needed}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs opacity-50">{formatDistanceToNow(new Date(c.submitted_at), {addSuffix:true})}</p>
                        {c.coordinator_status && c.coordinator_status !== 'new' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-lg border font-medium ${COORD_STATUS[c.coordinator_status]?.badge}`}>
                            {COORD_STATUS[c.coordinator_status]?.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-40 mt-1">Click to read full response →</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Supervisor latest check-ins */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <ClipboardList size={16} className="text-gold-400" /> Supervisor Check-ins
            </h2>
            {supCheckins.length === 0 ? (
              <p className="text-sm text-navy-500">No supervisor check-ins yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {supCheckins
                  .filter(c => statusFilter==='resolved'
                    ? c.coordinator_status==='resolved'
                    : c.coordinator_status!=='resolved')
                  .slice(0,8).map(c => {
                  const cfg = SUPERVISOR_STATUS[c.engagement_status]
                  return (
                    <div key={c.id}
                      onClick={() => { setSelectedCheckin(c); setCheckinType('supervisor') }}
                      className={`p-3 rounded-xl border cursor-pointer hover:opacity-90 transition-opacity ${cfg.color}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-semibold">{c.students?.name}</p>
                          <p className="text-xs opacity-70 font-mono">{c.students?.student_id}</p>
                        </div>
                        <span className="text-lg shrink-0">{cfg.emoji}</span>
                      </div>
                      <p className="text-xs opacity-80 font-medium">{cfg.label}</p>
                      {c.issue_type && <p className="text-xs opacity-70 mt-1">⚠ {c.issue_type}</p>}
                      {c.issue_description && <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{c.issue_description}</p>}
                      {c.recommended_action && c.recommended_action !== 'No action needed' && (
                        <p className="text-xs font-medium mt-1 opacity-90">→ {c.recommended_action}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs opacity-50">{c.supervisors?.name} · {formatDistanceToNow(new Date(c.submitted_at), {addSuffix:true})}</p>
                        {c.coordinator_status && c.coordinator_status !== 'new' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-lg border font-medium ${COORD_STATUS[c.coordinator_status]?.badge}`}>
                            {COORD_STATUS[c.coordinator_status]?.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-40 mt-1">Click to read full response →</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ── STUDENTS TAB ── */}
      {activeTab === 'students' && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-4">Send Student Check-ins</h2>
          <div className="space-y-2">
            {filtered.map(student => {
              const latest = latestStudentCheckin(student.id)
              const st     = sendingStudent[student.id]
              const cfg    = latest ? STUDENT_STATUS[latest.overall_status] : null
              return (
                <div key={student.id} className="flex items-center gap-3 p-3 rounded-xl bg-navy-800/20 border border-navy-700/30">
                  <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-semibold text-gold-400 shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{student.name}</p>
                    <p className="text-xs text-navy-400 font-mono">{student.student_id}</p>
                  </div>
                  {cfg && (
                    <span className={`text-xs px-2 py-1 rounded-lg border shrink-0 ${cfg.color}`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  )}
                  {latest && (
                    <p className="text-xs text-navy-500 shrink-0">
                      {formatDistanceToNow(new Date(latest.submitted_at), {addSuffix:true})}
                    </p>
                  )}
                  <SendBtn status={st} onSend={() => sendStudentCheckin(student)} label="Send" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SUPERVISORS TAB ── */}
      {activeTab === 'supervisors' && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-4">Send Supervisor Check-ins</h2>
          <div className="space-y-2">
            {filtered.map(student => {
              const latest = latestSupervisorCheckin(student.id)
              const st     = sendingSuper[student.id]
              const cfg    = latest ? SUPERVISOR_STATUS[latest.engagement_status] : null
              return (
                <div key={student.id} className="flex items-center gap-3 p-3 rounded-xl bg-navy-800/20 border border-navy-700/30">
                  <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-semibold text-gold-400 shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{student.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-navy-400 font-mono">{student.student_id}</p>
                      {student.supervisors && <p className="text-xs text-navy-500">· {student.supervisors.name}</p>}
                    </div>
                  </div>
                  {cfg && (
                    <span className={`text-xs px-2 py-1 rounded-lg border shrink-0 ${cfg.color}`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  )}
                  {latest && (
                    <p className="text-xs text-navy-500 shrink-0">
                      {formatDistanceToNow(new Date(latest.submitted_at), {addSuffix:true})}
                    </p>
                  )}
                  {student.supervisor_id
                    ? <SendBtn status={st} onSend={() => sendSupervisorCheckin(student)} label="Send" />
                    : <span className="text-xs text-navy-600 italic shrink-0">No supervisor</span>
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedCheckin && (
        <CheckinDetailModal
          checkin={selectedCheckin}
          type={checkinType}
          onClose={() => setSelectedCheckin(null)}
        />
      )}
    </div>
  )
}
