import { useState, useRef } from 'react'
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Upload, Edit2, Save } from 'lucide-react'
import { supabase, MILESTONES } from '../lib/supabase'
import { useDept } from '../context/DeptContext'

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
    supervisor_name:  (row['Supervisor']         || '').trim(),
    supervisor_email: (row['Supervisor Email']   || '').trim(),
    program:          row['Program']             || '',
    program_level:    row['Program Level']       || 'Postgraduate',
    enrollment_year:  row['Enrollment Year']     || '',
    thesis_title:     row['Thesis Title']        || '',
    research_area:    row['Research Area']       || '',
    group:            row['Group']               || '',
  }
}

const EDITABLE_COLS = [
  { key: 'student_id',      label: 'Reg No',         width: 'w-24' },
  { key: 'name',            label: 'Student Name',   width: 'w-36' },
  { key: 'email',           label: 'Email',          width: 'w-40' },
  { key: 'supervisor_name', label: 'Supervisor',     width: 'w-32' },
  { key: 'supervisor_email',label: 'Sup. Email',     width: 'w-40' },
  { key: 'program',         label: 'Program',        width: 'w-40' },
  { key: 'program_level',   label: 'Level',          width: 'w-28' },
  { key: 'enrollment_year', label: 'Year',           width: 'w-16' },
  { key: 'thesis_title',    label: 'Thesis Title',   width: 'w-48' },
  { key: 'research_area',   label: 'Research Area',  width: 'w-32' },
  { key: 'group',           label: 'Group',          width: 'w-24' },
]

export default function ImportModal({ onClose, onSuccess }) {
  const { effectiveDeptId } = useDept() || {}
  const [step,      setStep]      = useState('upload')
  const [rows,      setRows]      = useState([])
  const [fileError, setFileError] = useState('')
  const [progress,  setProgress]  = useState(0)
  const [results,   setResults]   = useState({ success: 0, failed: 0, updated: 0 })
  const [editingRow,setEditingRow]= useState(null)
  const [editForm,  setEditForm]  = useState({})
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
    } catch(e) {
      setFileError(e.message || 'Could not read file.')
    }
  }

  function startEdit(idx) {
    setEditingRow(idx)
    setEditForm({ ...rows[idx] })
  }

  function saveEdit(idx) {
    const updated = [...rows]
    updated[idx] = { ...editForm }
    setRows(updated)
    setEditingRow(null)
  }

  async function runImport() {
    setStep('importing')
    setProgress(0)
    let success = 0, failed = 0, updated = 0

    // Build group map: groupName → research_groups.id
    const groupMap = {}
    const groupRows = rows.filter(r => r.group && r.program_level === 'Undergraduate')
    const uniqueGroups = [...new Set(groupRows.map(r => r.group))]

    for (const groupName of uniqueGroups) {
      try {
        const groupRow = groupRows.find(r => r.group === groupName)
        // Check if group exists
        const { data: existing } = await supabase
          .from('research_groups')
          .select('id')
          .eq('name', groupName)
          .eq('department_id', effectiveDeptId)
          .maybeSingle()

        if (existing) {
          groupMap[groupName] = existing.id
          // Update shared fields
          await supabase.from('research_groups').update({
            thesis_title:  groupRow.thesis_title  || null,
            research_area: groupRow.research_area || null,
            academic_year: groupRow.enrollment_year ? parseInt(groupRow.enrollment_year) : null,
            updated_at:    new Date().toISOString(),
          }).eq('id', existing.id)
        } else {
          const { data: newGroup } = await supabase
            .from('research_groups')
            .insert({
              name:          groupName,
              department_id: effectiveDeptId,
              academic_year: groupRow.enrollment_year ? parseInt(groupRow.enrollment_year) : null,
              program_level: 'Undergraduate',
              thesis_title:  groupRow.thesis_title  || null,
              research_area: groupRow.research_area || null,
            })
            .select('id').single()
          groupMap[groupName] = newGroup?.id
        }
      } catch(e) { console.error('Group failed:', groupName, e) }
    }

    // Import students
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        // Resolve supervisor
        let supervisorId = null
        if (row.supervisor_email) {
          const { data: existingSup } = await supabase
            .from('supervisors').select('id').eq('email', row.supervisor_email).maybeSingle()
          if (existingSup) {
            supervisorId = existingSup.id
          } else if (row.supervisor_name) {
            const { data: newSup } = await supabase
              .from('supervisors')
              .insert({ name: row.supervisor_name, email: row.supervisor_email })
              .select('id').single()
            supervisorId = newSup?.id
          }
        }

        const groupId = row.group ? groupMap[row.group] || null : null

        const studentPayload = {
          name:              row.name,
          student_id:        row.student_id        || null,
          supervisor_id:     supervisorId,
          program:           row.program           || null,
          program_level:     row.program_level     || 'Postgraduate',
          enrollment_year:   row.enrollment_year   ? parseInt(row.enrollment_year) : null,
          thesis_title:      row.thesis_title      || null,
          research_area:     row.research_area     || null,
          research_group_id: groupId,
          department_id:     effectiveDeptId       || null,
        }

        const { data: existingStudent } = await supabase
          .from('students').select('id').eq('email', row.email).maybeSingle()

        if (existingStudent) {
          await supabase.from('students').update(studentPayload).eq('id', existingStudent.id)
          updated++
        } else {
          const token                  = crypto.randomUUID()
          const impact_token           = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('')
          const supervisor_impact_token= Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('')

          const { data: newStudent, error: insertErr } = await supabase
            .from('students')
            .insert({ ...studentPayload, email: row.email, token, impact_token, supervisor_impact_token })
            .select('id').single()
          if (insertErr) throw insertErr

          await supabase.from('student_milestones').insert(
            MILESTONES.map(m => ({ student_id: newStudent.id, milestone_id: m.id, status: 'pending' }))
          )

          // Update group supervisor from first student in group
          if (groupId && supervisorId) {
            await supabase.from('research_groups').update({ supervisor_id: supervisorId }).eq('id', groupId)
          }

          success++
        }
      } catch(e) {
        console.error('Row failed:', row.email, e)
        failed++
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100))
      await new Promise(r => setTimeout(r, 120))
    }

    setResults({ success, failed, updated })
    setStep('done')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-6xl max-h-[90vh] flex flex-col fade-in shadow-2xl border-navy-600/60">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50 shrink-0">
          <div>
            <h3 className="font-display font-semibold text-slate-100">Import Students from CSV</h3>
            <p className="text-xs text-navy-400 mt-0.5">
              All columns supported · Click any row to edit before importing
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">

          {/* ── Upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              <div
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
                className="border-2 border-dashed border-navy-600/60 hover:border-gold-500/50 rounded-2xl p-10 text-center cursor-pointer transition-all group">
                <FileSpreadsheet size={36} className="mx-auto mb-3 text-navy-500 group-hover:text-gold-400 transition-colors"/>
                <p className="text-slate-300 font-medium">Drop your CSV file here</p>
                <p className="text-navy-400 text-sm mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])}/>
              </div>

              {fileError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-sm">
                  <AlertCircle size={15}/> {fileError}
                </div>
              )}

              <div className="bg-navy-800/40 rounded-xl p-4">
                <p className="text-xs text-navy-400 font-medium mb-2">Supported CSV columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EDITABLE_COLS.map(col => (
                    <span key={col.key} className="bg-navy-700/60 text-navy-300 text-xs px-2 py-1 rounded-lg font-mono">{col.label}</span>
                  ))}
                </div>
                <p className="text-xs text-navy-500 mt-2">
                  Required: Reg No, Student Name, Student Email · All other columns optional · Existing students will be updated.
                </p>
              </div>
            </div>
          )}

          {/* ── Editable Preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
                <CheckCircle2 size={15}/>
                Found {rows.length} student{rows.length !== 1 ? 's' : ''} — click any row to edit before importing
              </div>

              <div className="overflow-auto rounded-xl border border-navy-700/40 max-h-[50vh]">
                <table className="w-full text-xs" style={{minWidth:'1100px'}}>
                  <thead className="sticky top-0 bg-navy-900 z-10">
                    <tr className="border-b border-navy-700/50">
                      <th className="p-2 text-navy-400 font-medium text-left w-8">#</th>
                      {EDITABLE_COLS.map(col => (
                        <th key={col.key} className={`p-2 text-navy-400 font-medium text-left ${col.width}`}>{col.label}</th>
                      ))}
                      <th className="p-2 w-12"/>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={`border-b border-navy-700/20 ${editingRow === i ? 'bg-navy-800/60' : 'hover:bg-navy-800/30'}`}>
                        <td className="p-2 text-navy-600">{i+1}</td>

                        {editingRow === i ? (
                          <>
                            {EDITABLE_COLS.map(col => (
                              <td key={col.key} className="p-1">
                                {col.key === 'program_level' ? (
                                  <select
                                    className="input text-xs py-1 w-full"
                                    value={editForm.program_level}
                                    onChange={e => setEditForm(p => ({...p, program_level: e.target.value}))}>
                                    <option value="Postgraduate">Postgraduate</option>
                                    <option value="Undergraduate">Undergraduate</option>
                                  </select>
                                ) : (
                                  <input
                                    className="input text-xs py-1 w-full"
                                    value={editForm[col.key] || ''}
                                    onChange={e => setEditForm(p => ({...p, [col.key]: e.target.value}))}/>
                                )}
                              </td>
                            ))}
                            <td className="p-1">
                              <button onClick={() => saveEdit(i)} className="btn-primary py-1 px-2 text-xs flex items-center gap-1">
                                <Save size={11}/> Save
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            {EDITABLE_COLS.map(col => (
                              <td key={col.key} className={`p-2 truncate max-w-0 ${
                                col.key === 'name'  ? 'text-slate-200 font-medium' :
                                col.key === 'group' && row[col.key] ? 'text-gold-400' :
                                'text-navy-400'
                              }`}>
                                {row[col.key] || <span className="text-navy-700">—</span>}
                              </td>
                            ))}
                            <td className="p-2">
                              <button onClick={() => startEdit(i)} className="btn-ghost p-1 rounded-lg">
                                <Edit2 size={12} className="text-navy-500"/>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.some(r => r.group) && (
                <p className="text-xs text-gold-400/80">
                  ✓ {[...new Set(rows.filter(r=>r.group).map(r=>r.group))].length} group{[...new Set(rows.filter(r=>r.group).map(r=>r.group))].length !== 1 ? 's' : ''} will be created automatically
                </p>
              )}
              <p className="text-xs text-navy-500">Supervisors will be created automatically if they don't exist yet.</p>
            </div>
          )}

          {/* ── Importing ── */}
          {step === 'importing' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 size={36} className="text-gold-400 animate-spin mx-auto"/>
              <p className="text-slate-200 font-medium">Importing students…</p>
              <div className="w-full bg-navy-800 rounded-full h-2">
                <div className="bg-gold-500 h-2 rounded-full transition-all duration-300" style={{width:`${progress}%`}}/>
              </div>
              <p className="text-navy-400 text-sm">{progress}% complete</p>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto"/>
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

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-5 border-t border-navy-700/50 shrink-0">
          <div>
            {step === 'preview' && (
              <p className="text-xs text-navy-500">{rows.length} rows · {rows.filter(r=>r.group).length} with groups</p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">{step === 'done' ? 'Close' : 'Cancel'}</button>
            {step === 'preview' && (
              <button onClick={runImport} className="btn-primary flex items-center gap-2">
                <Upload size={15}/> Import {rows.length} Students
              </button>
            )}
            {step === 'done' && (
              <button onClick={() => { onSuccess?.(); onClose() }} className="btn-primary flex items-center gap-2">
                <CheckCircle2 size={15}/> View Students
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
