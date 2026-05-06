import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Edit2, Save, X, Bell, Loader2,
  Plus, Trash2, Clock, MessageSquare, CheckCircle2, AlertCircle,
  Calendar, Activity
} from 'lucide-react'
import {
  getStudent, updateMilestoneStatus, MILESTONES,
  getStudentNotes, addStudentNote, deleteStudentNote,
  getStudentActivity, logActivity,
  getStudentDeadlineOverrides, upsertStudentDeadlineOverride,
  getCohortDeadlines
} from '../lib/supabase'
import EmailModal from '../components/EmailModal'
import MilestoneDataModal from '../components/MilestoneDataModal'
import AddStudentModal from '../components/AddStudentModal'
import { sendReminder } from '../lib/emailService'
import { formatDistanceToNow } from 'date-fns'

const TABS = ['Milestones', 'Notes', 'Activity', 'Deadlines', 'Research Impact']

const ACTIVITY_ICONS = {
  email:     { icon: Mail,          color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  milestone: { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  checkin:   { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  note:      { icon: MessageSquare, color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  reminder:  { icon: Bell,          color: 'text-orange-400',  bg: 'bg-orange-500/10'  },
}

export default function StudentDetail() {
  const { id } = useParams()
  const [student, setStudent]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('Milestones')
  const [showEmail, setShowEmail]   = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [editMilestone, setEditMilestone] = useState(null) // { milestone, studentMilestone }
  const [reminderStatus, setReminderStatus] = useState({})

  // Notes
  const [notes, setNotes]           = useState([])
  const [impact, setImpact]         = useState(null)
  const [sendingImpact, setSendingImpact] = useState(false)
  const [impactMsg, setImpactMsg]   = useState('')
  const [newNote, setNewNote]       = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Activity
  const [activityLog, setActivityLog] = useState([])

  // Deadlines
  const [cohortDeadlines, setCohortDeadlines]   = useState([])
  const [overrideDeadlines, setOverrideDeadlines] = useState([])
  const [editingDeadline, setEditingDeadline]   = useState(null)
  const [deadlineDate, setDeadlineDate]         = useState('')
  const [savingDeadline, setSavingDeadline]     = useState(false)

  async function load() {
    try {
      const s = await getStudent(id)
      setStudent(s)
      const [n, a, od, cd] = await Promise.all([
        getStudentNotes(id),
        getStudentActivity(id),
        getStudentDeadlineOverrides(id),
        s.enrollment_year ? getCohortDeadlines(s.enrollment_year) : Promise.resolve([]),
      ])
      setNotes(n); setActivityLog(a)
      setOverrideDeadlines(od); setCohortDeadlines(cd)

      // Load research impact
      try {
        const { supabase } = await import('../lib/supabase')
        const { data } = await supabase
          .from('research_impact').select('*')
          .eq('student_id', id)
          .order('submitted_at', { ascending: false })
          .limit(1).single()
        setImpact(data)
      } catch(e) { /* no submission yet */ }

    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function sendImpactSurvey() {
    if (!student) return
    setSendingImpact(true); setImpactMsg('')
    try {
      const { sendResearchImpactEmail } = await import('../lib/emailService')
      const appUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '')
      const result = await sendResearchImpactEmail(student, appUrl)
      if (result.ok) {
        setImpactMsg('✓ Survey email sent to ' + student.email)
      } else {
        setImpactMsg('Email failed — Survey link: ' + appUrl + '/#/research-impact?t=' + student.impact_token)
      }
    } catch(e) { setImpactMsg('Error: ' + e.message) }
    setSendingImpact(false)
  }

  async function updateImpactStatus(status, notes) {
    if (!impact) return
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase
        .from('research_impact')
        .update({ status, coordinator_notes: notes, reviewed_at: new Date().toISOString() })
        .eq('id', impact.id).select().single()
      setImpact(data)
    } catch(e) { console.error(e) }
  }

  useEffect(() => { load() }, [id])

  async function handleMilestoneUpdate(milestoneId, status) {
    await updateMilestoneStatus(id, milestoneId, status)
    const m = MILESTONES.find(x=>x.id===milestoneId)
    await logActivity(id, 'milestone', `Milestone "${m?.name}" marked as ${status}`, { milestoneId, status })
    load()
  }

  async function handleSendReminder(milestoneId) {
    setReminderStatus(s=>({...s,[milestoneId]:'sending'}))
    const m = MILESTONES.find(x=>x.id===milestoneId)
    const res = await sendReminder({ student, supervisor: student.supervisors, milestoneId })
    if (res.ok) await logActivity(id, 'reminder', `Reminder sent for "${m?.name}"`, { milestoneId })
    setReminderStatus(s=>({...s,[milestoneId]:res.ok?'sent':'error'}))
    setTimeout(()=>setReminderStatus(s=>({...s,[milestoneId]:null})),3000)
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    setSavingNote(true)
    await addStudentNote(id, newNote.trim())
    setNewNote('')
    const [n, a] = await Promise.all([getStudentNotes(id), getStudentActivity(id)])
    setNotes(n); setActivityLog(a)
    setSavingNote(false)
  }

  async function handleDeleteNote(noteId) {
    await deleteStudentNote(noteId)
    setNotes(await getStudentNotes(id))
  }

  async function handleSaveDeadline(milestoneId) {
    if (!deadlineDate) return
    setSavingDeadline(true)
    await upsertStudentDeadlineOverride(id, milestoneId, deadlineDate)
    await logActivity(id, 'note', `Deadline overridden for "${MILESTONES.find(m=>m.id===milestoneId)?.name}" to ${deadlineDate}`)
    setEditingDeadline(null); setDeadlineDate('')
    const od = await getStudentDeadlineOverrides(id)
    setOverrideDeadlines(od)
    setSavingDeadline(false)
  }

  function getDeadline(milestoneId) {
    const override = overrideDeadlines.find(d=>d.milestone_id===milestoneId)
    if (override) return { date: override.due_date, isOverride: true }
    const cohort = cohortDeadlines.find(d=>d.milestone_id===milestoneId)
    if (cohort) return { date: cohort.due_date, isOverride: false }
    return null
  }

  if (loading) return (
    <div className="p-8">
      <div className="h-8 w-48 rounded-xl bg-navy-800/40 shimmer mb-6"/>
      <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-20 rounded-xl bg-navy-800/40 shimmer"/>)}</div>
    </div>
  )

  if (!student) return (
    <div className="p-8 text-center text-navy-400">
      <p>Student not found.</p>
      <Link to="/students" className="btn-secondary mt-4 inline-flex">← Back</Link>
    </div>
  )

  const milestoneMap = Object.fromEntries((student.student_milestones||[]).map(sm=>[sm.milestone_id,sm]))
  const done = (student.student_milestones||[]).filter(m=>m.status==='completed').length

  return (
    <div className="p-8 space-y-6 fade-in">
      {/* Back + Header */}
      <div>
        <Link to="/students" className="flex items-center gap-2 text-navy-400 hover:text-gold-300 text-sm mb-4 transition-colors w-fit">
          <ArrowLeft size={15}/> Back to Students
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-navy-700 flex items-center justify-center text-2xl font-display font-bold text-gold-400">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold text-slate-100">{student.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-navy-400 text-sm">{student.email}</p>
                {student.student_id && <span className="text-xs font-mono bg-navy-800/60 text-navy-300 px-2 py-0.5 rounded-lg">{student.student_id}</span>}
                {student.enrollment_year && <span className="text-xs bg-gold-500/15 text-gold-400 border border-gold-500/25 px-2 py-0.5 rounded-lg">{student.enrollment_year} Cohort</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowEdit(true)} className="btn-secondary"><Edit2 size={14}/> Edit</button>
            <button onClick={()=>setShowEmail(true)} className="btn-primary"><Mail size={14}/> Send Email</button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-300">{done}/{MILESTONES.length} milestones completed</p>
          <p className="text-sm font-semibold text-gold-400">{Math.round((done/MILESTONES.length)*100)}%</p>
        </div>
        <div className="flex gap-0.5">
          {MILESTONES.map((m,i) => {
            const sm = milestoneMap[m.id]
            const status = sm?.status || 'pending'
            return (
              <div key={m.id} title={`${m.name}: ${status}`}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  status==='completed'   ? 'bg-emerald-500' :
                  status==='in_progress' ? 'bg-blue-500' :
                  status==='overdue'     ? 'bg-red-500' : 'bg-navy-700'
                }`}/>
            )
          })}
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Program',    value: student.program },
          { label: 'Supervisor',    value: student.supervisors?.name },
          { label: 'Research Area', value: student.research_area },
          { label: 'Thesis',        value: student.thesis_title },
        ].filter(x=>x.value).map(({ label, value }) => (
          <div key={label} className={`card p-4 ${label==='Research Area'?'border-gold-500/20':''}`}>
            <p className="text-xs text-navy-400 mb-1">{label}</p>
            <p className="text-sm text-slate-200 leading-relaxed">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-700/50 pb-0">
        {TABS.map(tab => (
          <button key={tab} onClick={()=>setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab===tab
                ? 'border-gold-500 text-gold-300'
                : 'border-transparent text-navy-400 hover:text-slate-300'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── MILESTONES TAB ── */}
      {activeTab==='Milestones' && (
        <div className="space-y-2">
          {MILESTONES.map((m,i) => {
            const sm     = milestoneMap[m.id]
            const status = sm?.status || 'pending'
            const rStatus= reminderStatus[m.id]
            const deadline = getDeadline(m.id)
            const isOverdue = deadline && new Date(deadline.date) < new Date() && status !== 'completed'
            return (
              <div key={m.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all
                ${status==='completed'   ? 'border-emerald-700/30 bg-emerald-900/10' :
                  status==='overdue'     ? 'border-red-700/30 bg-red-900/10' :
                  status==='in_progress' ? 'border-blue-700/30 bg-blue-900/10' :
                  isOverdue              ? 'border-red-700/20 bg-red-900/5' :
                  'border-navy-700/40 bg-navy-800/20'}`}>
                <span className="text-navy-500 text-xs w-4 shrink-0">{i+1}</span>
                <span className="text-base shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{m.name}</p>
                  {sm?.completed_at && <p className="text-xs text-navy-400">Completed {new Date(sm.completed_at).toLocaleDateString('en-GB')}</p>}
                  {deadline && status !== 'completed' && (
                    <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400' : 'text-navy-400'}`}>
                      {isOverdue ? '⚠ Overdue · ' : 'Due: '}
                      {new Date(deadline.date).toLocaleDateString('en-GB')}
                      {deadline.isOverride && <span className="ml-1 text-gold-500/60">(custom)</span>}
                    </p>
                  )}
                  {sm?.response_data && Object.keys(sm.response_data).length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {Object.entries(sm.response_data).filter(([k,v])=>v&&k!=='group').map(([k,v])=>(
                        <p key={k} className="text-xs">
                          <span className="text-navy-400 capitalize">{k.replace(/_/g,' ')}: </span>
                          <span className="text-emerald-300 font-medium">{v}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {sm?.group_name && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gold-500/15 text-gold-300 border border-gold-500/25 px-2 py-0.5 rounded-lg mt-1">
                      Group {sm.group_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditMilestone({ milestone: m, studentMilestone: sm })}
                    title="View / edit submitted data"
                    className="btn-ghost p-1.5 rounded-lg">
                    <Edit2 size={13}/>
                  </button>
                  {status !== 'completed' && (
                    <button onClick={()=>handleSendReminder(m.id)} disabled={rStatus==='sending'}
                      title="Send reminder"
                      className={`btn-ghost p-1.5 rounded-lg text-xs ${rStatus==='sent'?'text-emerald-400':rStatus==='error'?'text-red-400':''}`}>
                      <Bell size={13}/>
                    </button>
                  )}
                  <select value={status}
                    onChange={e=>handleMilestoneUpdate(m.id, e.target.value)}
                    className="bg-navy-800 border border-navy-600/50 text-xs text-slate-300 rounded-lg px-2 py-1 outline-none cursor-pointer">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── NOTES TAB ── */}
      {activeTab==='Notes' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-200 mb-3 text-sm">Add Note</h3>
            <textarea
              className="input resize-none h-24 leading-relaxed"
              placeholder="Add a private note about this student — meeting summaries, observations, follow-up actions…"
              value={newNote}
              onChange={e=>setNewNote(e.target.value)}
            />
            <button onClick={handleAddNote} disabled={savingNote||!newNote.trim()}
              className="btn-primary mt-3 disabled:opacity-50">
              {savingNote ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
              {savingNote ? 'Saving…' : 'Add Note'}
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="text-center py-10 text-navy-500">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">No notes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="card p-4 group">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-300 leading-relaxed flex-1">{note.content}</p>
                    <button onClick={()=>handleDeleteNote(note.id)}
                      className="btn-ghost p-1.5 rounded-lg text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                  <p className="text-xs text-navy-500 mt-2">
                    {formatDistanceToNow(new Date(note.created_at), {addSuffix:true})}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab==='Activity' && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 mb-4 text-sm flex items-center gap-2">
            <Activity size={15} className="text-gold-400"/> Full Activity Timeline
          </h3>
          {activityLog.length === 0 ? (
            <div className="text-center py-10 text-navy-500">
              <Clock size={28} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityLog.map(a => {
                const cfg  = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.note
                const Icon = cfg.icon
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color}/>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300 leading-relaxed">{a.description}</p>
                      <p className="text-xs text-navy-500 mt-0.5">
                        {new Date(a.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                        {' · '}{formatDistanceToNow(new Date(a.created_at), {addSuffix:true})}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DEADLINES TAB ── */}
      {activeTab==='Deadlines' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-navy-400 mb-2">
            <span className="w-3 h-3 rounded bg-gold-500/30 inline-block"/>  Custom override
            <span className="w-3 h-3 rounded bg-navy-700 inline-block ml-2"/>  Cohort default
          </div>
          {MILESTONES.map(m => {
            const deadline = getDeadline(m.id)
            const isEditing = editingDeadline === m.id
            const sm = milestoneMap[m.id]
            const status = sm?.status || 'pending'
            return (
              <div key={m.id} className="card p-4 flex items-center gap-3">
                <span className="text-base shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{m.name}</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="date" className="input py-1 text-xs"
                        value={deadlineDate} onChange={e=>setDeadlineDate(e.target.value)}/>
                      <button onClick={()=>handleSaveDeadline(m.id)} disabled={savingDeadline||!deadlineDate}
                        className="btn-primary py-1 px-3 text-xs disabled:opacity-50">
                        {savingDeadline?<Loader2 size={11} className="animate-spin"/>:<Save size={11}/>} Save
                      </button>
                      <button onClick={()=>setEditingDeadline(null)} className="btn-ghost p-1 rounded-lg">
                        <X size={13}/>
                      </button>
                    </div>
                  ) : deadline ? (
                    <p className={`text-xs mt-0.5 ${deadline.isOverride?'text-gold-400':'text-navy-400'}`}>
                      {deadline.isOverride ? '★ Custom: ' : 'Cohort: '}
                      {new Date(deadline.date).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}
                    </p>
                  ) : (
                    <p className="text-xs text-navy-600 mt-0.5">No deadline set</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                    status==='completed'   ? 'badge-completed' :
                    status==='overdue'     ? 'badge-overdue' :
                    status==='in_progress' ? 'badge-progress' : 'badge-pending'
                  }`}>{status}</span>
                  {status !== 'completed' && (
                    <button onClick={()=>{setEditingDeadline(m.id);setDeadlineDate(deadline?.date||'')}}
                      className="btn-ghost p-1.5 rounded-lg" title="Set custom deadline">
                      <Calendar size={13}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── RESEARCH IMPACT TAB ── */}
      {activeTab==='Research Impact' && (
        <div className="space-y-4">
          {!impact ? (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-100 mb-1">Research Impact Survey</h3>
              <p className="text-xs text-navy-400 mb-4">
                Send {student?.name} a link to declare their research impact for KPI 4.4.
                They will complete the form and upload evidence directly to Google Drive.
              </p>
              <button onClick={sendImpactSurvey} disabled={sendingImpact || !student?.email}
                className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2">
                {sendingImpact ? <><Loader2 size={14} className="animate-spin"/>Sending…</> : '📧 Send Research Impact Survey'}
              </button>
              {impactMsg && <p className="text-xs mt-3 text-emerald-400 break-all">{impactMsg}</p>}
              {!student?.email && <p className="text-xs mt-2 text-amber-400">⚠ No email address on file.</p>}
            </div>
          ) : (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">Research Impact Declaration</h3>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  impact.status==='approved'   ? 'bg-emerald-500/15 text-emerald-400' :
                  impact.status==='needs_info' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-navy-600/50 text-navy-300'
                }`}>
                  {impact.status==='approved' ? '✓ Approved' : impact.status==='needs_info' ? '⚠ Needs Info' : '● Pending Review'}
                </span>
              </div>
              <p className="text-xs text-navy-400">Submitted {new Date(impact.submitted_at).toLocaleDateString('en-GB')}</p>
              {impact.supervisor_submitted_at && (
                <p className="text-xs text-emerald-400">✓ Supervisor confirmed {new Date(impact.supervisor_submitted_at).toLocaleDateString('en-GB')}</p>
              )}
              {!impact.supervisor_submitted_at && student?.supervisors?.email && (
                <p className="text-xs text-amber-400">⏳ Awaiting supervisor confirmation</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {[['has_publication','Publication'],['has_ip','Intellectual Property'],['has_industry_partner','Industry Partnership'],
                  ['has_public_events','Public Events'],['has_policy_citation','Policy Citation'],['has_commercialisation','Commercialisation']
                ].map(([key, label]) => (
                  <div key={key} className={`px-3 py-2 rounded-xl text-xs font-medium ${
                    impact[key] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-navy-800/30 text-navy-600 border border-navy-700/20'
                  }`}>{impact[key] ? '✓' : '✗'} {label}</div>
                ))}
                {impact.no_impact && <div className="col-span-2 px-3 py-2 rounded-xl text-xs bg-navy-700/30 text-navy-400 border border-navy-700/20">No impact criteria met</div>}
              </div>
              {impact.evidence_files?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-2">Evidence Files</p>
                  <div className="space-y-2">
                    {impact.evidence_files.map((f, i) => (
                      <a key={i} href={f.fileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-navy-800/30 border border-navy-700/30 hover:border-gold-500/40 transition-all group">
                        <span>📄</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gold-300 truncate">{f.impactType}</p>
                          <p className="text-xs text-navy-400 truncate">{f.fileName}</p>
                        </div>
                        <span className="text-xs text-navy-500 group-hover:text-gold-400">Open ↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {impact.status==='pending' && (
                <div className="flex gap-2 pt-2 border-t border-navy-700/40">
                  <button onClick={()=>updateImpactStatus('approved','')}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all">✓ Approve</button>
                  <button onClick={()=>{const n=prompt('What additional information is needed?');if(n)updateImpactStatus('needs_info',n)}}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">⚠ Request Info</button>
                </div>
              )}
              <div className="pt-2 border-t border-navy-700/30">
                <button onClick={sendImpactSurvey} disabled={sendingImpact} className="text-xs text-navy-500 hover:text-navy-300 transition-colors">
                  {sendingImpact?'Sending…':'↺ Resend survey to student'}
                </button>
                {student?.supervisors?.email && (
                  <button onClick={async () => {
                    setSendingImpact(true); setImpactMsg('')
                    try {
                      const { sendSupervisorImpactEmail } = await import('../lib/emailService')
                      const appUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '')
                      const result = await sendSupervisorImpactEmail(student, student.supervisors, appUrl)
                      setImpactMsg(result.ok ? '✓ Confirmation request sent to supervisor' : 'Failed: ' + result.message)
                    } catch(e) { setImpactMsg('Error: ' + e.message) }
                    setSendingImpact(false)
                  }} disabled={sendingImpact} className="text-xs text-navy-500 hover:text-navy-300 transition-colors ml-4">
                    📧 Send to Supervisor
                  </button>
                )}
                {impactMsg && <p className="text-xs mt-1 text-emerald-400 break-all">{impactMsg}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {showEmail && <EmailModal student={student} onClose={()=>setShowEmail(false)}/>}
      {showEdit  && <AddStudentModal student={student} onClose={()=>setShowEdit(false)} onSuccess={load}/>}
      {editMilestone && (
        <MilestoneDataModal
          student={student}
          milestone={editMilestone.milestone}
          studentMilestone={editMilestone.studentMilestone}
          onSave={load}
          onClose={()=>setEditMilestone(null)}
        />
      )}
    </div>
  )
}
