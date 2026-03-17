import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Loader2, CheckCircle2, Database, Mail, Key } from 'lucide-react'
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

export default function Settings() {
  const [supervisors, setSupervisors] = useState([])
  const [newSup, setNewSup] = useState({ name: '', email: '', department: '' })
  const [addingSuper, setAddingSuper] = useState(false)
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
    const { error } = await supabase.from('supervisors').insert(newSup)
    if (!error) {
      setNewSup({ name: '', email: '', department: '' })
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
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-navy-400 mb-1">Name *</label>
            <input className="input" placeholder="Dr. Jane Smith" value={newSup.name} onChange={e => setNewSup(p => ({...p, name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Email *</label>
            <input className="input" type="email" placeholder="j.smith@univ.edu" value={newSup.email} onChange={e => setNewSup(p => ({...p, email: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Department</label>
            <input className="input" placeholder="e.g. Computer Science" value={newSup.department} onChange={e => setNewSup(p => ({...p, department: e.target.value}))} />
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
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-navy-800/30 border border-navy-700/30">
                <div>
                  <p className="text-sm font-medium text-slate-200">{s.name}</p>
                  <p className="text-xs text-navy-400">{s.email}</p>
                  {s.department && <p className="text-xs text-navy-500">{s.department}</p>}
                </div>
                <button
                  onClick={() => deleteSupervisor(s.id)}
                  className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
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
    </div>
  )
}
