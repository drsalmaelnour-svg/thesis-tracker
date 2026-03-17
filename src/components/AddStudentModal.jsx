import { useState, useEffect } from 'react'
import { X, UserPlus, Loader2 } from 'lucide-react'
import { supabase, getSupervisors, MILESTONES } from '../lib/supabase'

export default function AddStudentModal({ onClose, onSuccess }) {
  const [supervisors, setSupervisors] = useState([])
  const [form, setForm] = useState({
    name: '', email: '', student_id: '', program: '',
    thesis_title: '', supervisor_id: '', enrollment_year: new Date().getFullYear()
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSupervisors().then(setSupervisors).catch(console.error)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      // Insert student
      const token = crypto.randomUUID()
      const { data: student, error: sErr } = await supabase
        .from('students')
        .insert({ ...form, token })
        .select()
        .single()

      if (sErr) throw sErr

      // Seed all milestones as pending
      const milestoneRows = MILESTONES.map(m => ({
        student_id: student.id,
        milestone_id: m.id,
        status: 'pending',
      }))
      await supabase.from('student_milestones').insert(milestoneRows)

      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg fade-in shadow-2xl border-navy-600/60">
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <h3 className="font-display font-semibold text-slate-100">Add Student</h3>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Full Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Student full name" />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="student@university.edu" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Student ID</label>
              <input className="input" value={form.student_id} onChange={e => set('student_id', e.target.value)} placeholder="20241234" />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Enrollment Year</label>
              <input className="input" type="number" value={form.enrollment_year} onChange={e => set('enrollment_year', +e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Program</label>
            <input className="input" value={form.program} onChange={e => set('program', e.target.value)} placeholder="e.g. MSc Computer Science" />
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Thesis Title</label>
            <input className="input" value={form.thesis_title} onChange={e => set('thesis_title', e.target.value)} placeholder="Working title (can be updated later)" />
          </div>
          <div>
            <label className="block text-xs text-navy-400 mb-1">Supervisor</label>
            <select className="input" value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)}>
              <option value="">— Select supervisor —</option>
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm border bg-red-900/20 border-red-700/40 text-red-300">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-navy-700/50">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {saving ? 'Adding…' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  )
}
