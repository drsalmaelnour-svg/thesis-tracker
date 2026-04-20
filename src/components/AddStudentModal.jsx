import { useState, useEffect } from 'react'
import { X, UserPlus, Save, Loader2 } from 'lucide-react'
import { supabase, getSupervisors, MILESTONES } from '../lib/supabase'

// Works for both Add and Edit — pass `student` prop to edit
export default function AddStudentModal({ onClose, onSuccess, student: existing }) {
  const isEdit = !!existing
  const [supervisors, setSupervisors] = useState([])
  const [form, setForm] = useState({
    name:            existing?.name            || '',
    email:           existing?.email           || '',
    student_id:      existing?.student_id      || '',
    program:         existing?.program         || '',
    thesis_title:    existing?.thesis_title    || '',
    supervisor_id:   existing?.supervisor_id   || '',
    enrollment_year: existing?.enrollment_year || new Date().getFullYear(),
    research_area:   existing?.research_area   || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [allSpecs, setAllSpecs] = useState([])

  useEffect(() => {
    getSupervisors().then(sups => {
      setSupervisors(sups)
    }).catch(console.error)

    // Load all specializations from both internal and external examiners
    async function loadSpecs() {
      try {
        const { supabase } = await import('../lib/supabase')
        const [{ data: sups }, { data: exts }] = await Promise.all([
          supabase.from('supervisors').select('specialization').not('specialization','is',null),
          supabase.from('external_examiners').select('specialization').not('specialization','is',null),
        ])
        const specs = [...new Set([
          ...(sups||[]).map(s=>s.specialization),
          ...(exts||[]).map(e=>e.specialization),
        ].filter(Boolean))].sort()
        setAllSpecs(specs)
      } catch(e) { console.error(e) }
    }
    loadSpecs()
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
      if (isEdit) {
        // Update existing student
        const { error: uErr } = await supabase
          .from('students')
          .update({
            name:            form.name,
            email:           form.email,
            student_id:      form.student_id,
            program:         form.program,
            thesis_title:    form.thesis_title,
            supervisor_id:   form.supervisor_id || null,
            enrollment_year: form.enrollment_year,
            research_area:   form.research_area || null,
            updated_at:      new Date().toISOString(),
          })
          .eq('id', existing.id)
        if (uErr) throw uErr
      } else {
        // Insert new student
        const token = crypto.randomUUID()
        const { data: student, error: sErr } = await supabase
          .from('students')
          .insert({ ...form, token })
          .select()
          .single()
        if (sErr) throw sErr

        // Seed milestones
        await supabase.from('student_milestones').insert(
          MILESTONES.map(m => ({
            student_id:   student.id,
            milestone_id: m.id,
            status:       'pending',
          }))
        )
      }

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

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <div>
            <h3 className="font-display font-semibold text-slate-100">
              {isEdit ? 'Edit Student' : 'Add Student'}
            </h3>
            {isEdit && (
              <p className="text-xs text-navy-400 mt-0.5">Editing: {existing.name}</p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18} /></button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Full Name *</label>
              <input className="input" value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Student full name" />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Email *</label>
              <input className="input" type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="student@university.edu" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Registration No.</label>
              <input className="input" value={form.student_id}
                onChange={e => set('student_id', e.target.value)}
                placeholder="e.g. MScML01" />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Enrollment Year</label>
              <input className="input" type="number" value={form.enrollment_year}
                onChange={e => set('enrollment_year', +e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-navy-400 mb-1">Program</label>
            <input className="input" value={form.program}
              onChange={e => set('program', e.target.value)}
              placeholder="e.g. MSc Medical Laboratory Sciences" />
          </div>

          <div>
            <label className="block text-xs text-navy-400 mb-1">Thesis Title</label>
            <input className="input" value={form.thesis_title}
              onChange={e => set('thesis_title', e.target.value)}
              placeholder="Working title (can be updated later)" />
          </div>

          <div>
            <label className="block text-xs text-navy-400 mb-1">Supervisor</label>
            <select className="input" value={form.supervisor_id}
              onChange={e => set('supervisor_id', e.target.value)}>
              <option value="">— Select supervisor —</option>
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-navy-400 mb-1">Research Area</label>
            <select className="input" value={form.research_area}
              onChange={e => set('research_area', e.target.value)}>
              <option value="">— Select research area —</option>
              {allSpecs.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {allSpecs.length === 0 && (
              <p className="text-xs text-navy-600 mt-1">Add specializations to examiners first to populate this list.</p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm border bg-red-900/20 border-red-700/40 text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-navy-700/50">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving
              ? <Loader2 size={15} className="animate-spin" />
              : isEdit ? <Save size={15} /> : <UserPlus size={15} />
            }
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  )
}
