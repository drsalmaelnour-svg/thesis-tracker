import { useState, useEffect } from 'react'
import { Send, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, Users, ChevronDown } from 'lucide-react'
import { getStudentsWithProgress, getSupervisors, getSupervisorCheckins, getCheckinLink } from '../lib/supabase'
import { sendSupervisorEmail } from '../lib/emailService'
import { formatDistanceToNow } from 'date-fns'

const STATUS_CONFIG = {
  on_track: { label: 'On Track',          color: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300', dot: 'bg-emerald-400', emoji: '🟢' },
  concerns: { label: 'Needs Attention',   color: 'bg-amber-900/30 border-amber-700/40 text-amber-300',     dot: 'bg-amber-400',   emoji: '🟡' },
  urgent:   { label: 'Urgent Follow-up',  color: 'bg-red-900/30 border-red-700/40 text-red-300',           dot: 'bg-red-400',     emoji: '🔴' },
}

export default function SupervisorCheckins() {
  const [students, setStudents]       = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [checkins, setCheckins]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState({})
  const [bulkSending, setBulkSending] = useState(false)
  const [results, setResults]         = useState([])
  const [selectedSupervisor, setSelectedSupervisor] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const [s, sup, c] = await Promise.all([
        getStudentsWithProgress(),
        getSupervisors(),
        getSupervisorCheckins(),
      ])
      setStudents(s)
      setSupervisors(sup)
      setCheckins(c)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Get latest checkin per student
  function latestCheckin(studentId) {
    return checkins.find(c => c.student_id === studentId)
  }

  // Students filtered by supervisor
  const filteredStudents = selectedSupervisor === 'all'
    ? students
    : students.filter(s => s.supervisor_id === selectedSupervisor)

  async function sendCheckin(student) {
    const key = student.id
    setSending(s => ({ ...s, [key]: 'sending' }))
    try {
      const link = await getCheckinLink(student.supervisor_id, student.id)
      if (!link) throw new Error('No supervisor token — please make sure supervisors have been saved in Settings.')

      await sendSupervisorEmail({
        supervisor: student.supervisors,
        student,
        milestoneId: null,
        subject: `Check-in Request — ${student.name} (${student.student_id || ''})`,
        message: `We would appreciate a brief update on the engagement and progress of your student.<br><br>
Please click the button below to complete a short check-in form. It will only take a moment and helps us ensure every student receives the support they need.<br><br>
<em>Your response is confidential and will only be seen by the thesis coordinator.</em>`,
        response_link: link,
      })

      setSending(s => ({ ...s, [key]: 'sent' }))
      setTimeout(() => setSending(s => ({ ...s, [key]: null })), 4000)
    } catch(e) {
      console.error(e)
      setSending(s => ({ ...s, [key]: 'error' }))
      setTimeout(() => setSending(s => ({ ...s, [key]: null })), 4000)
    }
  }

  async function sendAllCheckins() {
    setBulkSending(true)
    setResults([])
    const toSend = filteredStudents.filter(s => s.supervisor_id && s.supervisors)
    for (const student of toSend) {
      await sendCheckin(student)
      await new Promise(r => setTimeout(r, 400))
    }
    setBulkSending(false)
    setResults([{ msg: `Check-in emails sent to ${toSend.length} supervisors.` }])
    load()
  }

  // Summary stats
  const total    = checkins.length
  const onTrack  = checkins.filter(c => c.engagement_status === 'on_track').length
  const concerns = checkins.filter(c => c.engagement_status === 'concerns').length
  const urgent   = checkins.filter(c => c.engagement_status === 'urgent').length

  return (
    <div className="p-8 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Supervisor Check-ins</h1>
          <p className="text-navy-400 mt-1">Monitor student engagement reported by supervisors</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={sendAllCheckins} disabled={bulkSending} className="btn-primary disabled:opacity-50">
            {bulkSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {bulkSending ? 'Sending…' : 'Send Check-ins to All'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Reports',    value: total,    color: 'text-gold-400'    },
          { label: '🟢 On Track',      value: onTrack,  color: 'text-emerald-400' },
          { label: '🟡 Needs Attention',value: concerns, color: 'text-amber-400'  },
          { label: '🔴 Urgent',        value: urgent,   color: 'text-red-400'     },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-navy-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-display font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
          ✓ {results[0].msg}
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        {/* Student list + send buttons */}
        <div className="col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-slate-100">Send Check-in Requests</h2>
            <div className="relative">
              <select
                className="input text-xs py-1.5 pr-7 appearance-none"
                value={selectedSupervisor}
                onChange={e => setSelectedSupervisor(e.target.value)}
              >
                <option value="all">All Supervisors</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-navy-800/40 shimmer" />)}</div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map(student => {
                const latest  = latestCheckin(student.id)
                const st      = sending[student.id]
                const status  = latest ? STATUS_CONFIG[latest.engagement_status] : null
                return (
                  <div key={student.id} className="flex items-center gap-3 p-3 rounded-xl bg-navy-800/20 border border-navy-700/30">
                    <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-semibold text-gold-400 shrink-0">
                      {student.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{student.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-navy-400 font-mono">{student.student_id || ''}</p>
                        {student.supervisors && <p className="text-xs text-navy-500">· {student.supervisors.name}</p>}
                      </div>
                    </div>
                    {status && (
                      <span className={`text-xs px-2 py-1 rounded-lg border shrink-0 ${status.color}`}>
                        {status.emoji} {status.label}
                      </span>
                    )}
                    {latest && (
                      <p className="text-xs text-navy-500 shrink-0">
                        {formatDistanceToNow(new Date(latest.submitted_at), { addSuffix: true })}
                      </p>
                    )}
                    {student.supervisor_id ? (
                      <button
                        onClick={() => sendCheckin(student)}
                        disabled={st === 'sending'}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          st === 'sent'    ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' :
                          st === 'error'   ? 'bg-red-900/20 border-red-700/40 text-red-300' :
                          st === 'sending' ? 'btn-secondary opacity-70' :
                          'btn-secondary'
                        }`}
                      >
                        {st === 'sending' && <Loader2 size={11} className="animate-spin" />}
                        {st === 'sent'    && <CheckCircle2 size={11} />}
                        {st === 'error'   && <AlertCircle size={11} />}
                        {!st             && <Send size={11} />}
                        {st === 'sent' ? 'Sent!' : st === 'error' ? 'Failed' : st === 'sending' ? '…' : 'Send'}
                      </button>
                    ) : (
                      <span className="text-xs text-navy-600 italic shrink-0">No supervisor</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Latest reports */}
        <div className="col-span-2 card p-5">
          <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gold-400" /> Latest Reports
          </h2>
          {checkins.length === 0 ? (
            <p className="text-sm text-navy-500">No check-in reports yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {checkins.map(c => {
                const cfg = STATUS_CONFIG[c.engagement_status]
                return (
                  <div key={c.id} className={`p-3 rounded-xl border ${cfg.color}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-sm font-semibold">{c.students?.name}</p>
                        <p className="text-xs opacity-70 font-mono">{c.students?.student_id}</p>
                      </div>
                      <span className="text-lg shrink-0">{cfg.emoji}</span>
                    </div>
                    <p className="text-xs opacity-80 font-medium">{cfg.label}</p>
                    {c.issue_type && (
                      <p className="text-xs opacity-70 mt-1">⚠ {c.issue_type}</p>
                    )}
                    {c.issue_description && (
                      <p className="text-xs opacity-70 mt-1 leading-relaxed line-clamp-2">{c.issue_description}</p>
                    )}
                    {c.recommended_action && c.recommended_action !== 'No action needed' && (
                      <p className="text-xs font-medium mt-1.5 opacity-90">→ {c.recommended_action}</p>
                    )}
                    <p className="text-xs opacity-50 mt-2">
                      {c.supervisors?.name} · {formatDistanceToNow(new Date(c.submitted_at), { addSuffix: true })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
