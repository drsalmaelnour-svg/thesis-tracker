import { useState, useRef } from 'react'
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react'
import { supabase, MILESTONES } from '../lib/supabase'

async function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one student row.')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').replace(/\xa0/g, '').trim())
  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    })
}

function mapRow(row) {
  return {
    student_id:       row['Reg No']             || '',
    name:             row['Student Name']        || '',
    email:            row['Student Email']       || '',
    supervisor_name:  (row['Supervisor'] || '').trim(),
    supervisor_email: (row['Supervisor Email'] || '').trim(),
  }
}

export default function ImportModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('upload')
  const [rows, setRows] = useState([])
  const [fileError, setFileError] = useState('')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState({ success: 0, failed: 0, updated: 0 })
  const fileRef = useRef()

  async function handleFile(file) {
    setFileError('')
    try {
      const text = await file.text()
      const rawRows = await parseCSV(text)
      const mapped = rawRows.map(mapRow).filter(r => r.name || r.email)
      if (mapped.length === 0) throw new Error('No valid student rows found in the file.')
      setRows(mapped)
      setStep('preview')
    } catch (e) {
      setFileError(e.message || 'Could not read file.')
    }
  }

  async function runImport() {
    setStep('importing')
    setProgress(0)
    let success = 0, failed = 0, updated = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        let supervisorId = null
        if (row.supervisor_email) {
          const { data: existingSup } = await supabase
            .from('supervisors').select('id').eq('email', row.supervisor_email).maybeSingle()
          if (existingSup) {
            supervisorId = existingSup.id
          } else if (row.supervisor_name) {
            const { data: newSup } = await supabase
              .from('supervisors').insert({ name: row.supervisor_name, email: row.supervisor_email }).select('id').single()
            supervisorId = newSup?.id
          }
        }

        const { data: existingStudent } = await supabase
          .from('students').select('id').eq('email', row.email).maybeSingle()

        if (existingStudent) {
          await supabase.from('students').update({
            name: row.name, student_id: row.student_id, supervisor_id: supervisorId,
          }).eq('id', existingStudent.id)
          updated++
        } else {
          const token = crypto.randomUUID()
          const { data: newStudent, error: insertErr } = await supabase
            .from('students')
            .insert({ name: row.name, email: row.email, student_id: row.student_id, supervisor_id: supervisorId, token })
            .select('id').single()
          if (insertErr) throw insertErr
          await supabase.from('student_milestones').insert(
            MILESTONES.map(m => ({ student_id: newStudent.id, milestone_id: m.id, status: 'pending' }))
          )
          success++
        }
      } catch (e) {
        console.error('Row failed:', row.email, e)
        failed++
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100))
      await new Promise(r => setTimeout(r, 150))
    }
    setResults({ success, failed, updated })
    setStep('done')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl fade-in shadow-2xl border-navy-600/60">
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Import Students from CSV</h3>
            <p className="text-xs text-navy-400 mt-0.5">Supports: Reg No, Student Name, Student Email, Supervisor, Supervisor Email</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-5">
              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
                className="border-2 border-dashed border-navy-600/60 hover:border-gold-500/50 rounded-2xl p-10 text-center cursor-pointer transition-all group"
              >
                <FileSpreadsheet size={36} className="mx-auto mb-3 text-navy-500 group-hover:text-gold-400 transition-colors" />
                <p className="text-slate-300 font-medium">Drop your CSV file here</p>
                <p className="text-navy-400 text-sm mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              </div>
              {fileError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-sm">
                  <AlertCircle size={15} /> {fileError}
                </div>
              )}
              <div className="bg-navy-800/40 rounded-xl p-4">
                <p className="text-xs text-navy-400 font-medium mb-2">Expected CSV columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Reg No', 'Student Name', 'Student Email', 'Supervisor', 'Supervisor Email'].map(col => (
                    <span key={col} className="bg-navy-700/60 text-navy-300 text-xs px-2 py-1 rounded-lg font-mono">{col}</span>
                  ))}
                </div>
                <p className="text-xs text-navy-500 mt-2">Existing students will be updated, not duplicated.</p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
                <CheckCircle2 size={15} /> Found {rows.length} student{rows.length !== 1 ? 's' : ''} ready to import
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-navy-700/40">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-navy-900">
                    <tr className="border-b border-navy-700/50">
                      <th className="text-left p-3 text-xs text-navy-400 font-medium">Reg No</th>
                      <th className="text-left p-3 text-xs text-navy-400 font-medium">Name</th>
                      <th className="text-left p-3 text-xs text-navy-400 font-medium">Email</th>
                      <th className="text-left p-3 text-xs text-navy-400 font-medium">Supervisor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-navy-700/20 hover:bg-navy-800/30">
                        <td className="p-3 text-navy-400 text-xs">{row.student_id || '—'}</td>
                        <td className="p-3 text-slate-200">{row.name}</td>
                        <td className="p-3 text-navy-400 text-xs">{row.email}</td>
                        <td className="p-3 text-navy-400 text-xs">{row.supervisor_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-navy-400">Supervisors will be created automatically if they don't exist yet.</p>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 size={36} className="text-gold-400 animate-spin mx-auto" />
              <p className="text-slate-200 font-medium">Importing students…</p>
              <div className="w-full bg-navy-800 rounded-full h-2">
                <div className="bg-gold-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-navy-400 text-sm">{progress}% complete</p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
              <h3 className="font-display text-xl font-semibold text-slate-100">Import Complete!</h3>
              <div className="flex justify-center gap-3">
                {results.success > 0 && (
                  <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-5 py-3">
                    <p className="text-2xl font-bold text-emerald-300">{results.success}</p>
                    <p className="text-xs text-emerald-400">New students</p>
                  </div>
                )}
                {results.updated > 0 && (
                  <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-5 py-3">
                    <p className="text-2xl font-bold text-blue-300">{results.updated}</p>
                    <p className="text-xs text-blue-400">Updated</p>
                  </div>
                )}
                {results.failed > 0 && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-5 py-3">
                    <p className="text-2xl font-bold text-red-300">{results.failed}</p>
                    <p className="text-xs text-red-400">Failed</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-navy-700/50">
          <button onClick={onClose} className="btn-secondary">{step === 'done' ? 'Close' : 'Cancel'}</button>
          {step === 'preview' && (
            <button onClick={runImport} className="btn-primary">
              <Upload size={15} /> Import {rows.length} Students
            </button>
          )}
          {step === 'done' && (
            <button onClick={() => { onSuccess?.(); onClose() }} className="btn-primary">
              <CheckCircle2 size={15} /> View Students
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
