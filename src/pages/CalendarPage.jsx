import { useState, useEffect, useRef } from 'react'
import {
  Calendar, Plus, Trash2, Save, Loader2, Send, Upload,
  ChevronDown, Edit2, X, Download, FileSpreadsheet
} from 'lucide-react'
import {
  getStudentsWithProgress, getCalendarEvents,
  upsertCalendarEvent, deleteCalendarEvent, MILESTONES
} from '../lib/supabase'
import { sendStudentEmail } from '../lib/emailService'

const EVENT_COLORS = [
  { value: 'gold',    label: 'Gold',    cls: 'bg-gold-500/20 border-gold-500/40 text-gold-300'       },
  { value: 'blue',    label: 'Blue',    cls: 'bg-blue-500/20 border-blue-500/40 text-blue-300'        },
  { value: 'emerald', label: 'Green',   cls: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { value: 'red',     label: 'Red',     cls: 'bg-red-500/20 border-red-500/40 text-red-300'           },
  { value: 'purple',  label: 'Purple',  cls: 'bg-purple-500/20 border-purple-500/40 text-purple-300'  },
]

function colorCls(color) {
  return EVENT_COLORS.find(c=>c.value===color)?.cls || EVENT_COLORS[0].cls
}

function blank(cohortYear) {
  return { id: null, cohort_year: cohortYear, title: '', event_date: '', milestone_id: '', description: '', color: 'gold' }
}

export default function CalendarPage() {
  const [students, setStudents]       = useState([])
  const [cohortYears, setCohortYears] = useState([])
  const [activeCohort, setActiveCohort] = useState(null)
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [editing, setEditing]         = useState(null) // event being edited
  const [saving, setSaving]           = useState(false)
  const [sending, setSending]         = useState(false)
  const [sendResult, setSendResult]   = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    getStudentsWithProgress().then(s => {
      setStudents(s)
      const years = [...new Set(s.map(x=>x.enrollment_year).filter(Boolean))].sort((a,b)=>b-a)
      setCohortYears(years)
      if (years.length) setActiveCohort(years[0])
    })
  }, [])

  useEffect(() => {
    if (!activeCohort) return
    setLoading(true)
    getCalendarEvents(activeCohort).then(e => { setEvents(e); setLoading(false) })
  }, [activeCohort])

  async function saveEvent() {
    if (!editing?.title.trim() || !editing?.event_date) return
    setSaving(true)
    const event = { ...editing, cohort_year: activeCohort }
    if (!event.id) event.id = crypto.randomUUID()
    await upsertCalendarEvent(event)
    setEditing(null)
    setEvents(await getCalendarEvents(activeCohort))
    setSaving(false)
  }

  async function removeEvent(id) {
    await deleteCalendarEvent(id)
    setEvents(await getCalendarEvents(activeCohort))
  }

  async function sendCalendarToStudents() {
    setSending(true); setSendResult(null)
    const cohortStudents = students.filter(s=>s.enrollment_year===activeCohort)
    const sorted = [...events].sort((a,b)=>new Date(a.event_date)-new Date(b.event_date))
    const calendarText = sorted.map(e =>
      `📅 ${new Date(e.event_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} — ${e.title}${e.description?`\n   ${e.description}`:''}`
    ).join('\n\n')

    let sent = 0
    for (const student of cohortStudents) {
      await sendStudentEmail({
        student,
        milestoneId: null,
        subject: `${activeCohort} Cohort — Thesis Academic Calendar`,
        message: `Please find below your thesis program calendar for the ${activeCohort} cohort.\n\n${calendarText}\n\nPlease note these dates in your personal calendar and ensure you are on track with each milestone.\n\nFor any questions, please do not hesitate to contact the thesis coordination office.`,
      })
      sent++
      await new Promise(r=>setTimeout(r,350))
    }
    setSendResult(`Calendar sent to ${sent} student${sent!==1?'s':''} in the ${activeCohort} cohort.`)
    setSending(false)
  }

  // Parse uploaded CSV
  async function handleFileUpload(file) {
    const text = await file.text()
    const lines = text.trim().split('\n').slice(1) // skip header
    const newEvents = []
    for (const line of lines) {
      const [title, event_date, milestone_id, description, color] = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
      if (title && event_date) {
        newEvents.push({
          id: crypto.randomUUID(),
          cohort_year: activeCohort,
          title, event_date, color: color||'gold',
          milestone_id: milestone_id||'',
          description: description||'',
        })
      }
    }
    for (const e of newEvents) await upsertCalendarEvent(e)
    setEvents(await getCalendarEvents(activeCohort))
  }

  // Export calendar as CSV template
  function exportTemplate() {
    const rows = [
      'Title,Date (YYYY-MM-DD),Milestone ID (optional),Description (optional),Color (gold/blue/emerald/red/purple)',
      'ORCID Registration Deadline,2025-02-01,orcid,All students must register,gold',
      'Proposal Defense Week,2025-04-15,proposal_defense,Group A and B sessions,blue',
      'IRB Submission Deadline,2025-05-01,irb_approval,,red',
    ].join('\n')
    const blob = new Blob([rows], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `calendar-template-${activeCohort}.csv`; a.click()
  }

  const sorted = [...events].sort((a,b)=>new Date(a.event_date)-new Date(b.event_date))

  // Group by month
  const byMonth = {}
  for (const e of sorted) {
    const month = new Date(e.event_date).toLocaleDateString('en-GB',{month:'long',year:'numeric'})
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(e)
  }

  return (
    <div className="p-8 space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Academic Calendar</h1>
          <p className="text-navy-400 mt-1">Manage and share thesis timelines per cohort</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportTemplate} className="btn-secondary">
            <FileSpreadsheet size={14}/> Download Template
          </button>
          <button onClick={()=>fileRef.current.click()} className="btn-secondary">
            <Upload size={14}/> Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e=>handleFileUpload(e.target.files[0])}/>
          <button onClick={sendCalendarToStudents} disabled={sending||!events.length}
            className="btn-primary disabled:opacity-50">
            {sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}
            {sending?'Sending…':'Send to Students'}
          </button>
        </div>
      </div>

      {/* Cohort tabs */}
      <div className="flex gap-1 border-b border-navy-700/50">
        {cohortYears.map(year=>(
          <button key={year} onClick={()=>setActiveCohort(year)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeCohort===year ? 'border-gold-500 text-gold-300' : 'border-transparent text-navy-400 hover:text-slate-300'
            }`}>
            {year} Cohort
            <span className="ml-2 text-xs text-navy-500">
              ({students.filter(s=>s.enrollment_year===year).length} students)
            </span>
          </button>
        ))}
      </div>

      {sendResult && (
        <div className="p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
          ✓ {sendResult}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">

        {/* Calendar view */}
        <div className="col-span-2 space-y-6">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 rounded-xl bg-navy-800/40 shimmer"/>)}</div>
          ) : Object.keys(byMonth).length === 0 ? (
            <div className="card p-12 text-center text-navy-500">
              <Calendar size={36} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm font-medium">No events yet for {activeCohort} cohort</p>
              <p className="text-xs mt-1">Add events manually or upload a CSV file.</p>
              <button onClick={()=>setEditing(blank(activeCohort))} className="btn-primary mt-4">
                <Plus size={14}/> Add First Event
              </button>
            </div>
          ) : (
            Object.entries(byMonth).map(([month, monthEvents]) => (
              <div key={month} className="card p-5">
                <h3 className="font-display font-semibold text-gold-400 mb-4 text-sm uppercase tracking-wider">{month}</h3>
                <div className="space-y-2">
                  {monthEvents.map(e => (
                    <div key={e.id} className={`flex items-start gap-3 p-3 rounded-xl border ${colorCls(e.color)} group`}>
                      <div className="text-center shrink-0 w-12">
                        <p className="text-lg font-bold leading-none">{new Date(e.event_date).getDate()}</p>
                        <p className="text-xs opacity-70">{new Date(e.event_date).toLocaleDateString('en-GB',{weekday:'short'})}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{e.title}</p>
                        {e.milestone_id && (
                          <p className="text-xs opacity-70 mt-0.5">
                            {MILESTONES.find(m=>m.id===e.milestone_id)?.icon} {MILESTONES.find(m=>m.id===e.milestone_id)?.name}
                          </p>
                        )}
                        {e.description && <p className="text-xs opacity-60 mt-0.5">{e.description}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={()=>setEditing({...e})} className="btn-ghost p-1.5 rounded-lg"><Edit2 size={12}/></button>
                        <button onClick={()=>removeEvent(e.id)} className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <button onClick={()=>setEditing(blank(activeCohort))}
            className="btn-secondary w-full justify-center border-dashed">
            <Plus size={15}/> Add Event
          </button>
        </div>

        {/* Add/Edit form */}
        <div>
          {editing ? (
            <div className="card p-5 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-slate-100 text-sm">
                  {editing.id ? 'Edit Event' : 'New Event'}
                </h3>
                <button onClick={()=>setEditing(null)} className="btn-ghost p-1.5 rounded-lg"><X size={15}/></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-navy-400 mb-1">Title *</label>
                  <input className="input text-sm" placeholder="e.g. Proposal Defense Week"
                    value={editing.title} onChange={e=>setEditing(v=>({...v,title:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs text-navy-400 mb-1">Date *</label>
                  <input type="date" className="input text-sm"
                    value={editing.event_date} onChange={e=>setEditing(v=>({...v,event_date:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs text-navy-400 mb-1">Milestone (optional)</label>
                  <select className="input text-sm" value={editing.milestone_id}
                    onChange={e=>setEditing(v=>({...v,milestone_id:e.target.value}))}>
                    <option value="">— None —</option>
                    {MILESTONES.map(m=><option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-navy-400 mb-1">Description (optional)</label>
                  <textarea className="input text-sm resize-none h-16"
                    placeholder="Additional notes…"
                    value={editing.description}
                    onChange={e=>setEditing(v=>({...v,description:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs text-navy-400 mb-1.5">Color</label>
                  <div className="flex gap-2">
                    {EVENT_COLORS.map(c=>(
                      <button key={c.value} onClick={()=>setEditing(v=>({...v,color:c.value}))}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          editing.color===c.value ? 'border-white scale-110' : 'border-transparent opacity-60'
                        } ${c.cls}`}
                        title={c.label}/>
                    ))}
                  </div>
                </div>
                <button onClick={saveEvent} disabled={saving||!editing.title.trim()||!editing.event_date}
                  className="btn-primary w-full justify-center disabled:opacity-50">
                  {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
                  {saving?'Saving…':'Save Event'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-slate-100 mb-3 text-sm">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-navy-400">Total events</span><span className="text-slate-200 font-medium">{events.length}</span></div>
                <div className="flex justify-between"><span className="text-navy-400">Cohort students</span><span className="text-slate-200 font-medium">{students.filter(s=>s.enrollment_year===activeCohort).length}</span></div>
                <div className="flex justify-between"><span className="text-navy-400">Upcoming</span>
                  <span className="text-slate-200 font-medium">
                    {events.filter(e=>new Date(e.event_date)>=new Date()).length}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-navy-700/50 space-y-2 text-xs text-navy-400 leading-relaxed">
                <p className="font-medium text-slate-300">CSV Upload Format:</p>
                <p>Title, Date (YYYY-MM-DD), Milestone ID, Description, Color</p>
                <button onClick={exportTemplate} className="text-gold-400 hover:underline mt-1">
                  Download template CSV →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
