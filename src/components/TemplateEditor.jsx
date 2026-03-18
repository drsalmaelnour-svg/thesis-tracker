import { useState, useEffect } from 'react'
import { Save, Loader2, CheckCircle2, RotateCcw, ChevronDown } from 'lucide-react'
import { getEmailTemplates, saveEmailTemplate } from '../lib/supabase'
import { EMAIL_TEMPLATES, SUPERVISOR_TEMPLATES } from '../lib/emailTemplates'

// Merge default templates with DB overrides
function buildTemplateList() {
  const list = []
  for (const [key, tpl] of Object.entries(EMAIL_TEMPLATES)) {
    list.push({ key, ...tpl, type: 'student' })
  }
  for (const [key, tpl] of Object.entries(SUPERVISOR_TEMPLATES)) {
    list.push({ key, ...tpl, type: 'supervisor' })
  }
  return list
}

export default function TemplateEditor() {
  const defaults   = buildTemplateList()
  const [templates, setTemplates] = useState(defaults)
  const [selected, setSelected]   = useState(defaults[0]?.key || '')
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    // Load any saved overrides from DB
    getEmailTemplates().then(dbTemplates => {
      if (dbTemplates.length > 0) {
        const merged = defaults.map(t => {
          const override = dbTemplates.find(d => d.template_key === t.key)
          return override ? { ...t, subject: override.subject, body: override.body } : t
        })
        setTemplates(merged)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const tpl = templates.find(t => t.key === selected)
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body) }
  }, [selected, templates])

  async function handleSave() {
    setSaving(true)
    const tpl = templates.find(t => t.key === selected)
    await saveEmailTemplate(selected, tpl.label, subject, body)
    // Update local state
    setTemplates(prev => prev.map(t => t.key === selected ? { ...t, subject, body } : t))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleReset() {
    const original = buildTemplateList().find(t => t.key === selected)
    if (original) { setSubject(original.subject); setBody(original.body) }
  }

  const current = templates.find(t => t.key === selected)

  return (
    <div className="card p-6">
      <h2 className="font-display font-semibold text-slate-100 flex items-center gap-2 mb-5">
        ✉️ Email Templates
      </h2>
      <p className="text-xs text-navy-400 mb-5 leading-relaxed">
        Edit the wording of any email template. Changes are saved to the database and apply immediately to all future emails.
        Use <code className="bg-navy-800 px-1 py-0.5 rounded">{'{{milestone}}'}</code> and <code className="bg-navy-800 px-1 py-0.5 rounded">{'[Student Name]'}</code> as placeholders.
      </p>

      {loading ? (
        <div className="h-40 rounded-xl bg-navy-800/40 shimmer" />
      ) : (
        <div className="space-y-4">
          {/* Template selector */}
          <div>
            <label className="block text-xs text-navy-400 mb-1.5">Select Template</label>
            <div className="relative">
              <select className="input appearance-none pr-8" value={selected}
                onChange={e => setSelected(e.target.value)}>
                <optgroup label="Student Templates">
                  {templates.filter(t=>t.type==='student').map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Supervisor Templates">
                  {templates.filter(t=>t.type==='supervisor').map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"/>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs text-navy-400 mb-1.5">Subject Line</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs text-navy-400 mb-1.5">Message Body</label>
            <textarea
              className="input resize-none leading-relaxed"
              style={{ minHeight: '220px' }}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button onClick={handleReset} className="btn-ghost text-xs flex items-center gap-1.5">
              <RotateCcw size={13}/> Reset to default
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                saved ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'btn-primary'
              } disabled:opacity-50`}>
              {saving ? <Loader2 size={14} className="animate-spin"/> :
               saved  ? <CheckCircle2 size={14}/> : <Save size={14}/>}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
