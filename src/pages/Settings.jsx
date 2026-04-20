import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Loader2, CheckCircle2, Database, Mail, Key, Users, Calendar, Edit2, X } from 'lucide-react'
import TemplateEditor from '../components/TemplateEditor'
import { supabase, getSupervisors } from '../lib/supabase'

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card p-6">
      <h2 className="font-display font-semibold text-slate-100 flex items-center gap-2 mb-5">
        <Icon size={17} className="text-gold-400" /> {title}
      </h2>
      {children}
    </div>
  )
}


const GROUP_MILESTONES = [
  { id: 'proposal_defense', name: 'Proposal Defense' },
  { id: 'progress_1',       name: 'First Progress Report' },
  { id: 'progress_2',       name: 'Second Progress Report' },
]

// Initialize a blank group form
function blankGroup(milestoneId, groupName) {
  return { milestone_id: milestoneId, group_name: groupName, date: '', time_slot: '', capacity: 15, notes: '' }
}

function GroupManagement() {
  // formState: { proposal_defense: { A: {...}, B: {...} }, progress_1: {...}, progress_2: {...} }
  const [formState, setFormState] = useState(() => {
    const s = {}
    for (const m of GROUP_MILESTONES) {
      s[m.id] = { A: blankGroup(m.id, 'A'), B: blankGroup(m.id, 'B') }
    }
    return s
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState('')
  const [savedId, setSavedId] = useState('')
  const [errors, setErrors]   = useState({})

  useEffect(() => {
    async function load() {
      const next = {}
      for (const m of GROUP_MILESTONES) {
        const { data } = await supabase
          .from('milestone_groups').select('*')
          .eq('milestone_id', m.id).order('group_name')
        const rows = data || []
        next[m.id] = {
          A: rows.find(r => r.group_name === 'A') || blankGroup(m.id, 'A'),
          B: rows.find(r => r.group_name === 'B') || blankGroup(m.id, 'B'),
        }
      }
      setFormState(next)
      setLoading(false)
    }
    load()
  }, [])

  function setField(milestoneId, groupName, field, value) {
    setFormState(prev => ({
      ...prev,
      [milestoneId]: {
        ...prev[milestoneId],
        [groupName]: { ...prev[milestoneId][groupName], [field]: value }
      }
    }))
  }

  async function saveGroups(milestoneId) {
    setSaving(milestoneId)
    setErrors(e => ({ ...e, [milestoneId]: '' }))
    try {
      for (const groupName of ['A', 'B']) {
        const g = formState[milestoneId][groupName]
        const { error } = await supabase.from('milestone_groups').upsert({
          milestone_id: milestoneId,
          group_name:   groupName,
          date:         g.date      || null,
          time_slot:    g.time_slot || null,
          capacity:     parseInt(g.capacity) || 15,
          notes:        g.notes     || '',
        }, { onConflict: 'milestone_id,group_name' })
        if (error) throw error
      }
      setSavedId(milestoneId)
      setTimeout(() => setSavedId(''), 3000)
    } catch(e) {
      setErrors(prev => ({ ...prev, [milestoneId]: e.message || 'Save failed' }))
    }
    setSaving('')
  }

  return (
    <div className="card p-6">
      <h2 className="font-display font-semibold text-slate-100 flex items-center gap-2 mb-2">
        <Users size={17} className="text-gold-400" /> Group Management
      </h2>
      <p className="text-xs text-navy-400 mb-5">
        Set dates and capacity for Group A and Group B for each milestone.
        Students cannot select a full group.
      </p>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-navy-800/40 shimmer" />)}</div>
      ) : (
        <div className="space-y-6">
          {GROUP_MILESTONES.map(m => (
            <div key={m.id} className="border border-navy-700/40 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-200">{m.name}</h3>
                {savedId === m.id && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Saved successfully
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['A', 'B'].map(gn => {
                  const g = formState[m.id][gn]
                  return (
                    <div key={gn} className="bg-navy-800/40 rounded-xl p-4 space-y-3">
                      <p className="font-semibold text-gold-400">Group {gn}</p>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Date</label>
                        <input type="date" className="input"
                          value={g.date || ''}
                          onChange={e => setField(m.id, gn, 'date', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Time</label>
                        <input type="text" className="input" placeholder="e.g. 10:00 AM"
                          value={g.time_slot || ''}
                          onChange={e => setField(m.id, gn, 'time_slot', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Capacity (max students)</label>
                        <input type="number" className="input" min="1" max="50"
                          value={g.capacity || 15}
                          onChange={e => setField(m.id, gn, 'capacity', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Notes (optional)</label>
                        <input type="text" className="input" placeholder="e.g. Room 301, Building A"
                          value={g.notes || ''}
                          onChange={e => setField(m.id, gn, 'notes', e.target.value)} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {errors[m.id] && (
                <p className="text-xs text-red-400 mt-3">⚠ {errors[m.id]}</p>
              )}

              <button
                onClick={() => saveGroups(m.id)}
                disabled={saving === m.id}
                className="btn-primary mt-4 disabled:opacity-50"
              >
                {saving === m.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving === m.id ? 'Saving…' : `Save ${m.name} Groups`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [supervisors, setSupervisors] = useState([])
  const [newSup, setNewSup] = useState({ name: '', email: '', designation: '', institution: '', specialization: '', specOther: '' })
  const [addingSuper, setAddingSuper] = useState(false)
  const [editSup,     setEditSup]     = useState(null)   // { id, name, email, designation, institution, specialization, specOther }
  const [savingEdit,  setSavingEdit]  = useState(false)
  const [saved, setSaved] = useState('')
  const [dbStatus, setDbStatus] = useState('checking')

  useEffect(() => {
    // Check DB connectivity
    supabase.from('students').select('id', { count: 'exact', head: true })
      .then(({ error }) => setDbStatus(error ? 'error' : 'connected'))
      .catch(() => setDbStatus('error'))

    getSupervisors().then(setSupervisors).catch(console.error)
  }, [])

  async function addSupervisor() {
    if (!newSup.name.trim() || !newSup.email.trim()) return
    setAddingSuper(true)
    const resolved = { name: newSup.name, email: newSup.email, designation: newSup.designation || null, institution: newSup.institution || null, specialization: newSup.specialization === 'Other' ? newSup.specOther : newSup.specialization }
    const { error } = await supabase.from('supervisors').insert(resolved)
    if (!error) {
      setNewSup({ name: '', email: '', designation: '', institution: '', specialization: '', specOther: '' })
      getSupervisors().then(setSupervisors)
      setSaved('supervisor')
      setTimeout(() => setSaved(''), 3000)
    }
    setAddingSuper(false)
  }

  async function deleteSupervisor(id) {
    if (!confirm('Remove this supervisor? Students assigned to them will be unassigned.')) return
    await supabase.from('supervisors').delete().eq('id', id)
    getSupervisors().then(setSupervisors)
  }

  async function updateSupervisor() {
    if (!editSup?.name?.trim() || !editSup?.email?.trim()) return
    setSavingEdit(true)
    const spec = editSup.specialization === 'Other' ? editSup.specOther : editSup.specialization
    const { error } = await supabase.from('supervisors').update({
      name:           editSup.name,
      email:          editSup.email,
      designation:    editSup.designation || null,
      institution:    editSup.institution || null,
      specialization: spec || null,
    }).eq('id', editSup.id)
    if (!error) { setEditSup(null); getSupervisors().then(setSupervisors); setSaved('supervisor'); setTimeout(()=>setSaved(''),3000) }
    setSavingEdit(false)
  }

  function startEdit(s) {
    const knownSpecs = ['Clinical Chemistry','Molecular Biology','Microbiology','Haematology','Immunology']
    const isOther = s.specialization && !knownSpecs.includes(s.specialization)
    setEditSup({
      ...s,
      specialization: isOther ? 'Other' : (s.specialization || ''),
      specOther:      isOther ? s.specialization : '',
    })
  }

  return (
    <div className="p-8 space-y-6 fade-in">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Settings</h1>
        <p className="text-navy-400 mt-1">Configure integrations and manage coordinators</p>
      </div>

      {/* DB Status */}
      <Section title="Database Connection" icon={Database}>
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          dbStatus === 'connected' ? 'bg-emerald-900/20 border-emerald-700/40' :
          dbStatus === 'error'     ? 'bg-red-900/20 border-red-700/40' :
          'bg-navy-800/40 border-navy-700/40'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${
            dbStatus === 'connected' ? 'bg-emerald-400' :
            dbStatus === 'error'     ? 'bg-red-400' :
            'bg-yellow-400 animate-pulse'
          }`} />
          <div>
            <p className="text-sm font-medium text-slate-200">
              {dbStatus === 'connected' ? 'Supabase connected' :
               dbStatus === 'error'     ? 'Connection failed' :
               'Checking connection…'}
            </p>
            <p className="text-xs text-navy-400 mt-0.5">
              {dbStatus === 'connected'
                ? 'Database is reachable and accepting requests.'
                : dbStatus === 'error'
                ? 'Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
                : 'Testing connection to Supabase…'}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-navy-400 leading-relaxed">
          <p className="font-medium text-slate-300">Setup checklist:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Create a new project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-gold-400 hover:underline">supabase.com</a></li>
            <li>Run the SQL schema from <code className="bg-navy-800 px-1 py-0.5 rounded">supabase/schema.sql</code> in the SQL editor</li>
            <li>Copy your <strong>Project URL</strong> and <strong>anon key</strong> from Project Settings → API</li>
            <li>Add them to your <code className="bg-navy-800 px-1 py-0.5 rounded">.env</code> file (see <code className="bg-navy-800 px-1 py-0.5 rounded">.env.example</code>)</li>
            <li>Add the same keys as GitHub Secrets for deployment</li>
          </ul>
        </div>
      </Section>

      {/* EmailJS Config */}
      <Section title="Email Configuration (EmailJS)" icon={Mail}>
        <div className="space-y-3 text-xs text-navy-400 leading-relaxed">
          <p className="font-medium text-slate-300">EmailJS setup (free — 200 emails/month):</p>
          <ol className="space-y-1 ml-4 list-decimal">
            <li>Sign up at <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" className="text-gold-400 hover:underline">emailjs.com</a></li>
            <li>Connect your Gmail account as an Email Service</li>
            <li>Create three email templates — one for students, one for supervisors, one for reminders</li>
            <li>
              Each template should include these variables:
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[
                  ['Student template', ['{{to_name}}', '{{to_email}}', '{{subject}}', '{{message}}', '{{response_link}}', '{{milestone}}']],
                  ['Supervisor template', ['{{to_name}}', '{{to_email}}', '{{student_name}}', '{{subject}}', '{{message}}', '{{milestone}}']],
                  ['Reminder template', ['{{to_name}}', '{{to_email}}', '{{milestone}}', '{{due_date}}', '{{response_link}}']],
                ].map(([label, vars]) => (
                  <div key={label} className="bg-navy-800/60 rounded-lg p-2">
                    <p className="font-medium text-slate-400 mb-1">{label}</p>
                    {vars.map(v => <p key={v} className="font-mono text-navy-400">{v}</p>)}
                  </div>
                ))}
              </div>
            </li>
            <li>Copy your <strong>Public Key</strong>, <strong>Service ID</strong>, and <strong>Template IDs</strong> to <code className="bg-navy-800 px-1 py-0.5 rounded">.env</code></li>
          </ol>
        </div>
      </Section>

      {/* Supervisors */}
      <Section title="Supervisors" icon={Key}>
        {saved === 'supervisor' && (
          <div className="flex items-center gap-2 text-emerald-300 text-sm mb-4 bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-3">
            <CheckCircle2 size={15} /> Supervisor added successfully.
          </div>
        )}

        {/* Add supervisor */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-navy-400 mb-1">Name *</label>
            <input className="input" placeholder="Dr. Jane Smith" value={newSup.name} onChange={e => setNewSup(p => ({...p, name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Email *</label>
            <input className="input" type="email" placeholder="j.smith@univ.edu" value={newSup.email} onChange={e => setNewSup(p => ({...p, email: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Designation</label>
            <select className="input" value={newSup.designation} onChange={e => setNewSup(p => ({...p, designation: e.target.value}))}>
              <option value="">— Select —</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Professor">Professor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Institution</label>
            <select className="input" value={newSup.institution} onChange={e => setNewSup(p => ({...p, institution: e.target.value}))}>
              <option value="">— Select —</option>
              <option value="GMU Medical Laboratory Sciences">GMU Medical Laboratory Sciences</option>
              <option value="TRIPM">TRIPM</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-navy-400 mb-1">Specialization</label>
            <select className="input" value={newSup.specialization} onChange={e => setNewSup(p => ({...p, specialization: e.target.value, specOther: ''}))}>
              <option value="">— Select —</option>
              <option value="Clinical Chemistry">Clinical Chemistry</option>
              <option value="Molecular Biology">Molecular Biology</option>
              <option value="Microbiology">Microbiology</option>
              <option value="Haematology">Haematology</option>
              <option value="Immunology">Immunology</option>
              <option value="Other">Other…</option>
            </select>
            {newSup.specialization === 'Other' && (
              <input className="input mt-1.5" placeholder="Enter specialization" value={newSup.specOther} onChange={e => setNewSup(p => ({...p, specOther: e.target.value}))} />
            )}
          </div>
        </div>
        <button
          onClick={addSupervisor}
          disabled={addingSuper || !newSup.name || !newSup.email}
          className="btn-primary mb-5 disabled:opacity-50"
        >
          {addingSuper ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Supervisor
        </button>

        {/* Supervisor list */}
        {supervisors.length > 0 && (
          <div className="space-y-2">
            {supervisors.map(s => (
              <div key={s.id} className="rounded-xl bg-navy-800/30 border border-navy-700/30 overflow-hidden">

                {editSup?.id === s.id ? (
                  /* ── Edit mode ── */
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Name *</label>
                        <input className="input text-sm" value={editSup.name} onChange={e=>setEditSup(p=>({...p,name:e.target.value}))}/>
                      </div>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Email *</label>
                        <input className="input text-sm" type="email" value={editSup.email} onChange={e=>setEditSup(p=>({...p,email:e.target.value}))}/>
                      </div>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Designation</label>
                        <select className="input text-sm" value={editSup.designation||''} onChange={e=>setEditSup(p=>({...p,designation:e.target.value}))}>
                          <option value="">— Select —</option>
                          <option>Assistant Professor</option>
                          <option>Associate Professor</option>
                          <option>Professor</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-navy-400 mb-1">Institution</label>
                        <select className="input text-sm" value={editSup.institution||''} onChange={e=>setEditSup(p=>({...p,institution:e.target.value}))}>
                          <option value="">— Select —</option>
                          <option>GMU Medical Laboratory Sciences</option>
                          <option>TRIPM</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-navy-400 mb-1">Specialization</label>
                        <select className="input text-sm" value={editSup.specialization} onChange={e=>setEditSup(p=>({...p,specialization:e.target.value,specOther:''}))}>
                          <option value="">— Select —</option>
                          <option>Clinical Chemistry</option>
                          <option>Molecular Biology</option>
                          <option>Microbiology</option>
                          <option>Haematology</option>
                          <option>Immunology</option>
                          <option value="Other">Other…</option>
                        </select>
                        {editSup.specialization === 'Other' && (
                          <input className="input text-sm mt-1.5" placeholder="Enter specialization"
                            value={editSup.specOther} onChange={e=>setEditSup(p=>({...p,specOther:e.target.value}))}/>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={updateSupervisor} disabled={savingEdit} className="btn-primary text-xs disabled:opacity-50">
                        {savingEdit ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
                        {savingEdit ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={()=>setEditSup(null)} className="btn-secondary text-xs">
                        <X size={12}/> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{s.name}</p>
                      <p className="text-xs text-navy-400">{s.email}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {s.designation   && <span className="text-xs text-navy-300 bg-navy-700/40 border border-navy-600/40 px-2 py-0.5 rounded-lg">{s.designation}</span>}
                        {s.institution   && <span className="text-xs text-navy-300 bg-navy-700/40 border border-navy-600/40 px-2 py-0.5 rounded-lg">{s.institution}</span>}
                        {s.specialization && <span className="text-xs text-gold-300/80 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-lg">{s.specialization}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={()=>startEdit(s)} className="btn-ghost p-1.5 rounded-lg" title="Edit">
                        <Edit2 size={13}/>
                      </button>
                      <button onClick={()=>deleteSupervisor(s.id)} className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400" title="Delete">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </Section>

      {/* GitHub Deployment */}
      <Section title="GitHub Pages Deployment" icon={Database}>
        <div className="space-y-3 text-xs text-navy-400 leading-relaxed">
          <p className="font-medium text-slate-300">One-time GitHub setup:</p>
          <ol className="space-y-2 ml-4 list-decimal">
            <li>Create a new GitHub repository named <code className="bg-navy-800 px-1 py-0.5 rounded">thesis-tracker</code></li>
            <li>
              Add these 5 repository Secrets (Settings → Secrets → Actions):
              <div className="mt-2 space-y-1 font-mono bg-navy-800/60 rounded-xl p-3">
                {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_EMAILJS_PUBLIC_KEY',
                  'VITE_EMAILJS_SERVICE_ID', 'VITE_EMAILJS_STUDENT_TEMPLATE',
                  'VITE_EMAILJS_SUPERVISOR_TEMPLATE', 'VITE_EMAILJS_REMINDER_TEMPLATE',
                  'VITE_APP_URL'].map(k => (
                  <p key={k} className="text-navy-300">{k}</p>
                ))}
              </div>
            </li>
            <li>Push this code: <code className="bg-navy-800 px-1 py-0.5 rounded">git push origin main</code></li>
            <li>GitHub Actions will auto-build and deploy to GitHub Pages</li>
            <li>Enable Pages in repo Settings → Pages → Source: <strong>gh-pages branch</strong></li>
            <li>Your app will be live at <code className="bg-navy-800 px-1 py-0.5 rounded">https://USERNAME.github.io/thesis-tracker</code></li>
          </ol>
        </div>
      </Section>

      {/* Group Management */}
      <GroupManagement />

      {/* Email Template Editor */}
      <TemplateEditor />

    </div>
  )
}
