import { useState, useEffect, useRef } from 'react'
import {
  UserPlus, Upload, Trash2, RefreshCw, Search,
  CheckCircle2, AlertCircle, Loader2, Building2,
  Mail, BookOpen, Users, Edit2, Save, X
} from 'lucide-react'
import { getExternalExaminers, upsertExternalExaminer, deleteExternalExaminer } from '../lib/supabase'

const BLANK = { name:'', email:'', designation:'', institution:'', specialization:'' }

function ExaminerCard({ examiner, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  async function handleDelete() {
    setDeleting(true)
    await onDelete(examiner.id)
  }
  return (
    <div className="card p-4 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-navy-700 flex items-center justify-center text-sm font-bold text-gold-400 shrink-0">
            {examiner.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">{examiner.name}</p>
            <p className="text-xs text-navy-400">{examiner.designation}</p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={()=>onEdit(examiner)} className="btn-ghost p-1.5 rounded-lg" title="Edit">
            <Edit2 size={13}/>
          </button>
          <button onClick={handleDelete} disabled={deleting} className="btn-ghost p-1.5 rounded-lg text-red-400/60 hover:text-red-400" title="Remove">
            {deleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-navy-400">
          <Building2 size={11} className="shrink-0"/>{examiner.institution || '—'}
        </div>
        <div className="flex items-center gap-2 text-xs text-navy-400">
          <Mail size={11} className="shrink-0"/>{examiner.email}
        </div>
        {examiner.specialization && (
          <div className="flex items-center gap-2 text-xs text-navy-400">
            <BookOpen size={11} className="shrink-0"/>{examiner.specialization}
          </div>
        )}
      </div>
    </div>
  )
}

function ExaminerForm({ initial = BLANK, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    setSaving(true); setError('')
    try {
      await onSave(form)
    } catch(e) {
      setError(e.message || 'Failed to save.')
    }
    setSaving(false)
  }

  return (
    <div className="card p-5 border-gold-500/30">
      <h3 className="font-semibold text-slate-100 text-sm mb-4">
        {initial.id ? 'Edit Examiner' : 'Add External Examiner'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key:'name',           label:'Full Name *',          placeholder:'Dr. John Smith'                },
          { key:'email',          label:'Email Address *',       placeholder:'j.smith@university.ac.ae'      },
          { key:'designation',    label:'Designation',           placeholder:'Associate Professor'           },
          { key:'institution',    label:'Institution',           placeholder:'University of Sharjah'         },
          { key:'specialization', label:'Area of Specialization',placeholder:'Clinical Biochemistry'        },
        ].map(f => (
          <div key={f.key} className={f.key==='specialization' ? 'col-span-2' : ''}>
            <label className="block text-xs text-navy-400 mb-1">{f.label}</label>
            <input className="input text-sm" placeholder={f.placeholder}
              value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}/>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
          {saving ? 'Saving…' : 'Save Examiner'}
        </button>
        <button onClick={onCancel} className="btn-secondary"><X size={14}/> Cancel</button>
      </div>
    </div>
  )
}

export default function Examiners() {
  const [examiners, setExaminers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()

  async function load() {
    setLoading(true)
    try { setExaminers(await getExternalExaminers()) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSave(form) {
    await upsertExternalExaminer(form)
    setShowForm(false); setEditItem(null)
    load()
  }

  async function handleDelete(id) {
    await deleteExternalExaminer(id)
    load()
  }

  async function handleImport(file) {
    setImporting(true); setImportResult(null)
    try {
      const text  = await file.text()
      const lines = text.trim().split('\n').slice(1)
      let added = 0, failed = 0
      for (const line of lines) {
        const cols = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
        const [name, email, designation, institution, specialization] = cols
        if (!name || !email) { failed++; continue }
        try {
          await upsertExternalExaminer({ name, email, designation, institution, specialization })
          added++
        } catch { failed++ }
      }
      setImportResult({ added, failed })
      load()
    } catch(e) {
      setImportResult({ error: e.message })
    }
    setImporting(false)
  }

  function downloadTemplate() {
    const csv = [
      'Full Name,Email,Designation,Institution,Area of Specialization',
      'Dr. John Smith,j.smith@university.ac.ae,Associate Professor,University of Sharjah,Clinical Biochemistry',
      'Dr. Fatima Al-Rashidi,f.rashidi@ajman.ac.ae,Assistant Professor,Ajman University,Haematology',
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
    a.download = 'external_examiners_template.csv'; a.click()
  }

  const filtered = examiners.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.institution||'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 space-y-6 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">External Examiners</h1>
          <p className="text-navy-400 mt-1">Manage the pool of external examiners for thesis assessments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw size={14} className={loading?'animate-spin':''}/> Refresh
          </button>
          <button onClick={downloadTemplate} className="btn-secondary">
            <Upload size={14}/> Download Template
          </button>
          <button onClick={()=>fileRef.current.click()} disabled={importing} className="btn-secondary disabled:opacity-50">
            {importing ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e=>handleImport(e.target.files[0])}/>
          <button onClick={()=>{setShowForm(true);setEditItem(null)}} className="btn-primary">
            <UserPlus size={14}/> Add Examiner
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-navy-400 mb-1">Total External Examiners</p>
          <p className="text-2xl font-display font-bold text-gold-400">{examiners.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-navy-400 mb-1">Institutions Represented</p>
          <p className="text-2xl font-display font-bold text-slate-100">
            {new Set(examiners.map(e=>e.institution).filter(Boolean)).size}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-navy-400 mb-1">Available for Assignment</p>
          <p className="text-2xl font-display font-bold text-emerald-400">{examiners.filter(e=>e.active).length}</p>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
          importResult.error ? 'bg-red-900/20 border-red-700/40 text-red-300'
          : 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
        }`}>
          {importResult.error
            ? <><AlertCircle size={14}/> Import failed: {importResult.error}</>
            : <><CheckCircle2 size={14}/> Imported {importResult.added} examiner{importResult.added!==1?'s':''}
              {importResult.failed>0 && ` · ${importResult.failed} skipped (missing name or email)`}</>
          }
        </div>
      )}

      {/* Add/Edit form */}
      {(showForm || editItem) && (
        <ExaminerForm
          initial={editItem || BLANK}
          onSave={handleSave}
          onCancel={()=>{setShowForm(false);setEditItem(null)}}
        />
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"/>
        <input className="input pl-9 text-sm" placeholder="Search examiners…"
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i=><div key={i} className="h-36 rounded-xl bg-navy-800/40 shimmer"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-navy-500">
          <Users size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm font-medium">
            {search ? 'No examiners match your search.' : 'No external examiners yet.'}
          </p>
          <p className="text-xs mt-1">Add them individually or import via CSV.</p>
          <button onClick={()=>setShowForm(true)} className="btn-primary mt-4 inline-flex">
            <UserPlus size={14}/> Add First Examiner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(e => (
            <ExaminerCard key={e.id} examiner={e}
              onEdit={ex=>{setEditItem(ex);setShowForm(false)}}
              onDelete={handleDelete}/>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="card p-5 border-navy-700/30">
        <h3 className="font-semibold text-slate-200 text-sm mb-3 flex items-center gap-2">
          <BookOpen size={14} className="text-gold-400"/> CSV Import Format
        </h3>
        <p className="text-xs text-navy-400 leading-relaxed">
          Your CSV should have these columns in order:
          <span className="font-mono bg-navy-800/60 px-1.5 py-0.5 rounded ml-1 text-slate-300">
            Full Name, Email, Designation, Institution, Area of Specialization
          </span>
        </p>
        <p className="text-xs text-navy-500 mt-2">
          Name and Email are required. All other fields are optional. Download the template above to get started.
        </p>
      </div>

    </div>
  )
}
