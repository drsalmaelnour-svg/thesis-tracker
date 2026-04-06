import { useState } from 'react'
import { X, Save, Loader2, CheckCircle2 } from 'lucide-react'

// Fields per milestone
const MILESTONE_FIELDS = {
  orcid: [
    { id:'orcid_id', label:'ORCID iD', type:'text', placeholder:'0000-0000-0000-0000', pattern:/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, note:'Format: 0000-0000-0000-0000' },
  ],
  irb_approval: [
    { id:'proposal_title', label:'Proposal Title',       type:'text', placeholder:'Enter exact title of the research proposal' },
    { id:'irb_number',     label:'IRB Approval Number',  type:'text', placeholder:'e.g. IRB-2025-001' },
    { id:'approval_date',  label:'IRB Approval Date',    type:'date', placeholder:'' },
  ],
  proposal_defense: [
    { id:'committee_notes', label:'Committee Notes / Feedback', type:'textarea', placeholder:'Any notes from the proposal defense committee' },
  ],
  progress_1: [
    { id:'submission_date',   label:'Submission Date',     type:'date',     placeholder:'' },
    { id:'progress_summary',  label:'Progress Summary',    type:'textarea', placeholder:'Brief summary of progress at first report stage' },
  ],
  progress_2: [
    { id:'submission_date',   label:'Submission Date',     type:'date',     placeholder:'' },
    { id:'progress_summary',  label:'Progress Summary',    type:'textarea', placeholder:'Brief summary of progress at second report stage' },
    { id:'proposed_completion', label:'Proposed Completion Date', type:'date', placeholder:'' },
  ],
  defense_schedule: [
    { id:'defense_date', label:'Defense Date', type:'date',   placeholder:'' },
    { id:'defense_time', label:'Preferred Time', type:'select',
      options:['10:00 AM','11:00 AM','12:00 PM','01:00 PM','02:00 PM','03:00 PM'] },
  ],
  thesis_submission: [
    { id:'final_title',       label:'Final Thesis Title',  type:'text',     placeholder:'Exact title of submitted thesis' },
    { id:'submission_date',   label:'Submission Date',     type:'date',     placeholder:'' },
    { id:'submission_notes',  label:'Notes',               type:'textarea', placeholder:'Any additional submission notes' },
  ],
}

const FIELD_LABELS = {
  orcid_id:'ORCID iD', proposal_title:'Proposal Title', irb_number:'IRB Number',
  approval_date:'IRB Approval Date', committee_notes:'Committee Notes',
  submission_date:'Submission Date', progress_summary:'Progress Summary',
  proposed_completion:'Proposed Completion Date', defense_date:'Defense Date',
  defense_time:'Preferred Time', final_title:'Final Thesis Title',
  submission_notes:'Notes',
}

export default function MilestoneDataModal({ student, milestone, studentMilestone, onSave, onClose }) {
  const fields = MILESTONE_FIELDS[milestone.id] || []
  const existing = (() => {
    const rd = studentMilestone?.response_data
    if (!rd) return {}
    if (typeof rd === 'string') { try { return JSON.parse(rd) } catch { return {} } }
    return rd || {}
  })()

  const [form,   setForm]   = useState({ ...existing })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  function set(key, val) { setForm(f => ({...f, [key]: val})) }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const { supabase } = await import('../lib/supabase')

      // Check if milestone record exists
      const { data: existing } = await supabase
        .from('student_milestones')
        .select('id')
        .eq('student_id', student.id)
        .eq('milestone_id', milestone.id)
        .single()

      if (existing) {
        await supabase.from('student_milestones')
          .update({
            response_data: form,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('student_milestones').insert({
          student_id:    student.id,
          milestone_id:  milestone.id,
          status:        'completed',
          response_data: form,
          completed_at:  new Date().toISOString(),
        })
      }

      // Log activity
      await supabase.from('activity_log').insert({
        student_id:  student.id,
        type:        'milestone',
        description: `Coordinator updated data for "${milestone.name}"`,
        metadata:    { milestoneId: milestone.id },
      })

      setSaved(true)
      setTimeout(() => { onSave(); onClose() }, 800)
    } catch(e) {
      setError(e.message || 'Failed to save.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg fade-in shadow-2xl border-navy-600/60 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50 shrink-0">
          <div>
            <h3 className="font-display font-semibold text-slate-100">
              {milestone.icon} {milestone.name}
            </h3>
            <p className="text-xs text-navy-400 mt-0.5">
              {student.name} · {student.student_id}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg shrink-0">
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-navy-400">No data fields for this milestone.</p>
          ) : (
            fields.map(f => (
              <div key={f.id}>
                <label className="block text-xs font-medium text-navy-300 mb-1.5">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="input resize-none h-24 leading-relaxed text-sm"
                    placeholder={f.placeholder}
                    value={form[f.id] || ''}
                    onChange={e => set(f.id, e.target.value)}
                  />
                ) : f.type === 'select' ? (
                  <select className="input text-sm" value={form[f.id]||''} onChange={e=>set(f.id,e.target.value)}>
                    <option value="">— Select time —</option>
                    {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    className={`input text-sm ${f.id==='orcid_id'?'font-mono tracking-widest':''}`}
                    placeholder={f.placeholder}
                    value={form[f.id] || ''}
                    onChange={e => set(f.id, e.target.value)}
                  />
                )}
                {f.note && <p className="text-xs text-navy-500 mt-1">{f.note}</p>}
              </div>
            ))
          )}

          {/* Show current stored data if no editable fields */}
          {fields.length === 0 && Object.keys(existing).length > 0 && (
            <div className="space-y-2">
              {Object.entries(existing).filter(([k,v])=>v&&k!=='group').map(([k,v])=>(
                <div key={k} className="flex gap-2 text-sm">
                  <span className="text-navy-400 shrink-0">{FIELD_LABELS[k]||k}:</span>
                  <span className="text-slate-300">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-navy-700/50 shrink-0 flex gap-2">
          <button onClick={handleSave} disabled={saving||saved||fields.length===0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${
              saved ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'btn-primary'
            }`}>
            {saving ? <Loader2 size={14} className="animate-spin"/> :
             saved  ? <CheckCircle2 size={14}/> : <Save size={14}/>}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Data'}
          </button>
          <button onClick={onClose} className="btn-secondary text-sm">
            <X size={14}/> Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
