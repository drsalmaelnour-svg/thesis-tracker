import { useState, useEffect } from 'react'
import { useDept } from '../context/DeptContext'
import { useRole } from '../context/RoleContext'
import { Users, Search, Edit2, Save, X, ChevronDown, ChevronUp, Loader2, Plus, Trash2, RefreshCw } from 'lucide-react'
import { getSupervisors } from '../lib/supabase'

async function getGroups(deptId) {
  const { supabase } = await import('../lib/supabase')
  let q = supabase
    .from('research_groups')
    .select(`
      *,
      departments(name, primary_color, accent_color),
      supervisor:supervisors!research_groups_supervisor_id_fkey(id, name, email, designation),
      co_supervisor:supervisors!research_groups_co_supervisor_id_fkey(id, name, email, designation),
      students(id, name, email, student_id, program, enrollment_year, program_level)
    `)
    .eq('program_level', 'Undergraduate')
    .order('academic_year', { ascending: false })
    .order('name')
  if (deptId) q = q.eq('department_id', deptId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

async function updateGroup(id, updates) {
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase
    .from('research_groups')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

async function updateStudentGroup(studentId, updates) {
  const { supabase } = await import('../lib/supabase')
  const { error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
  if (error) throw error
}

async function removeStudentFromGroup(studentId) {
  const { supabase } = await import('../lib/supabase')
  await supabase.from('students').update({ research_group_id: null }).eq('id', studentId)
}

async function getUngroupedStudents(deptId) {
  const { supabase } = await import('../lib/supabase')
  let q = supabase
    .from('students')
    .select('id, name, email, student_id, program, enrollment_year')
    .eq('program_level', 'Undergraduate')
    .is('research_group_id', null)
  if (deptId) q = q.eq('department_id', deptId)
  const { data } = await q.order('name')
  return data || []
}

export default function Groups() {
  const { effectiveDeptId, viewingDept, viewingLevel } = useDept() || {}
  const { can }      = useRole() || {}
  const canEdit      = can?.editStudents

  const [groups,      setGroups]      = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [ungrouped,   setUngrouped]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [yearFilter,  setYearFilter]  = useState('all')
  const [expanded,    setExpanded]    = useState({})
  const [editing,     setEditing]     = useState(null)   // group id being edited
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const [editingStudent, setEditingStudent] = useState(null)
  const [studentForm,    setStudentForm]    = useState({})

  async function load() {
    setLoading(true)
    try {
      const [g, s, u] = await Promise.all([
        getGroups(effectiveDeptId),
        getSupervisors(),
        getUngroupedStudents(effectiveDeptId),
      ])
      setGroups(g)
      setSupervisors(s)
      setUngrouped(u)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [effectiveDeptId, viewingDept, viewingLevel])

  // Years available
  const years = [...new Set(groups.map(g => g.academic_year).filter(Boolean))].sort((a,b) => b-a)

  const filtered = groups.filter(g => {
    const matchSearch = !search ||
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.thesis_title?.toLowerCase().includes(search.toLowerCase()) ||
      g.research_area?.toLowerCase().includes(search.toLowerCase()) ||
      g.students?.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
    const matchYear = yearFilter === 'all' || String(g.academic_year) === String(yearFilter)
    return matchSearch && matchYear
  })

  function startEdit(group) {
    setEditing(group.id)
    setEditForm({
      name:              group.name || '',
      thesis_title:      group.thesis_title || '',
      proposal_title:    group.proposal_title || '',
      irb_number:        group.irb_number || '',
      irb_approval_date: group.irb_approval_date || '',
      research_area:     group.research_area || '',
      supervisor_id:     group.supervisor_id || '',
      co_supervisor_id:  group.co_supervisor_id || '',
      notes:             group.notes || '',
    })
    setExpanded(prev => ({ ...prev, [group.id]: true }))
    setSaveMsg('')
  }

  function cancelEdit() { setEditing(null); setEditForm({}); setSaveMsg('') }

  async function saveGroup() {
    setSaving(true); setSaveMsg('')
    try {
      await updateGroup(editing, editForm)
      await load()
      setEditing(null)
      setSaveMsg('✓ Saved')
    } catch(e) { setSaveMsg('Error: ' + e.message) }
    setSaving(false)
  }

  function startEditStudent(student) {
    setEditingStudent(student.id)
    setStudentForm({
      name:           student.name || '',
      email:          student.email || '',
      student_id:     student.student_id || '',
      program:        student.program || '',
      enrollment_year:student.enrollment_year || '',
    })
  }

  async function saveStudent(studentId, groupId) {
    try {
      await updateStudentGroup(studentId, studentForm)
      setEditingStudent(null)
      await load()
    } catch(e) { console.error(e) }
  }

  const totalStudents = groups.reduce((sum, g) => sum + (g.students?.length || 0), 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users size={20} className="text-gold-400"/> Research Groups
          </h1>
          <p className="text-xs text-navy-400 mt-0.5">
            {groups.length} groups · {totalStudents} undergraduate students
            {ungrouped.length > 0 && <span className="text-amber-400 ml-2">· {ungrouped.length} ungrouped</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"/>
          <input className="input pl-9 w-full text-sm"
            placeholder="Search groups, titles, students…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input text-sm"
          value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="all">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Ungrouped warning */}
      {ungrouped.length > 0 && (
        <div className="card p-4 border border-amber-500/20 bg-amber-900/5">
          <p className="text-xs font-semibold text-amber-400 mb-2">⚠ {ungrouped.length} undergraduate student{ungrouped.length > 1 ? 's' : ''} not assigned to a group</p>
          <div className="flex flex-wrap gap-2">
            {ungrouped.map(s => (
              <span key={s.id} className="px-2 py-1 rounded-lg text-xs bg-navy-800/40 text-navy-300">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-navy-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Users size={32} className="mx-auto mb-3 text-navy-600"/>
          <p className="text-navy-400 text-sm">No groups found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const isExpanded = expanded[group.id]
            const isEditing  = editing === group.id
            const accent     = group.departments?.accent_color || '#d4a843'
            const primary    = group.departments?.primary_color || '#1e3a5f'

            return (
              <div key={group.id} className="card overflow-hidden">

                {/* Group header */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{background:`${accent}20`, color:accent}}>
                    {(group.students?.length || 0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-200 text-sm">{group.name}</p>
                      <span className="px-2 py-0.5 rounded-lg text-xs bg-navy-700/50 text-navy-300">{group.academic_year}</span>
                      {group.irb_number && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          IRB: {group.irb_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-400 mt-0.5 truncate">
                      {group.thesis_title || group.proposal_title || 'No thesis title set'}
                    </p>
                    <p className="text-xs text-navy-500 mt-0.5">
                      {group.supervisor?.name || 'No supervisor assigned'}
                      {group.research_area && ` · ${group.research_area}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && !isEditing && (
                      <button onClick={() => startEdit(group)}
                        className="btn-ghost p-2 rounded-xl" title="Edit group">
                        <Edit2 size={14} className="text-navy-400"/>
                      </button>
                    )}
                    <button onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                      className="btn-ghost p-2 rounded-xl">
                      {isExpanded ? <ChevronUp size={16} className="text-navy-400"/> : <ChevronDown size={16} className="text-navy-400"/>}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-navy-700/40 p-4 space-y-4">

                    {/* Edit form */}
                    {isEditing ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Edit Group Details</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Group Name</label>
                            <input className="input w-full text-sm" value={editForm.name}
                              onChange={e => setEditForm(p => ({...p, name: e.target.value}))}/>
                          </div>
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Research Area</label>
                            <input className="input w-full text-sm" value={editForm.research_area}
                              onChange={e => setEditForm(p => ({...p, research_area: e.target.value}))}
                              placeholder="e.g. Microbiology"/>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-navy-400 mb-1">Proposal Title</label>
                          <input className="input w-full text-sm" value={editForm.proposal_title}
                            onChange={e => setEditForm(p => ({...p, proposal_title: e.target.value}))}
                            placeholder="Initial proposal title"/>
                        </div>

                        <div>
                          <label className="block text-xs text-navy-400 mb-1">Thesis Title</label>
                          <input className="input w-full text-sm" value={editForm.thesis_title}
                            onChange={e => setEditForm(p => ({...p, thesis_title: e.target.value}))}
                            placeholder="Final thesis title"/>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">IRB Number</label>
                            <input className="input w-full text-sm" value={editForm.irb_number}
                              onChange={e => setEditForm(p => ({...p, irb_number: e.target.value}))}
                              placeholder="e.g. GMU-IRB-2024-001"/>
                          </div>
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">IRB Approval Date</label>
                            <input type="date" className="input w-full text-sm" value={editForm.irb_approval_date}
                              onChange={e => setEditForm(p => ({...p, irb_approval_date: e.target.value}))}/>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Supervisor</label>
                            <select className="input w-full text-sm" value={editForm.supervisor_id}
                              onChange={e => setEditForm(p => ({...p, supervisor_id: e.target.value}))}>
                              <option value="">— Select Supervisor —</option>
                              {supervisors.map(s => (
                                <option key={s.id} value={s.id}>{s.name} {s.designation ? `(${s.designation})` : ''}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Co-Supervisor (optional)</label>
                            <select className="input w-full text-sm" value={editForm.co_supervisor_id}
                              onChange={e => setEditForm(p => ({...p, co_supervisor_id: e.target.value}))}>
                              <option value="">— None —</option>
                              {supervisors.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-navy-400 mb-1">Notes</label>
                          <textarea className="input w-full text-sm resize-none" rows={2}
                            value={editForm.notes}
                            onChange={e => setEditForm(p => ({...p, notes: e.target.value}))}
                            placeholder="Coordinator notes…"/>
                        </div>

                        <div className="flex items-center gap-2">
                          <button onClick={saveGroup} disabled={saving}
                            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                            {saving ? <><Loader2 size={13} className="animate-spin"/>Saving…</> : <><Save size={13}/>Save Changes</>}
                          </button>
                          <button onClick={cancelEdit} className="btn-ghost text-sm flex items-center gap-2">
                            <X size={13}/> Cancel
                          </button>
                          {saveMsg && <p className={`text-xs ${saveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg}</p>}
                        </div>
                      </div>
                    ) : (
                      /* Read-only group details */
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        {group.proposal_title && (
                          <div className="col-span-2">
                            <span className="text-navy-500">Proposal Title</span>
                            <p className="text-navy-300 mt-0.5">{group.proposal_title}</p>
                          </div>
                        )}
                        {group.thesis_title && (
                          <div className="col-span-2">
                            <span className="text-navy-500">Thesis Title</span>
                            <p className="text-navy-300 mt-0.5">{group.thesis_title}</p>
                          </div>
                        )}
                        {group.irb_number && <div><span className="text-navy-500">IRB Number</span><p className="text-navy-300">{group.irb_number}</p></div>}
                        {group.irb_approval_date && <div><span className="text-navy-500">IRB Approval</span><p className="text-navy-300">{new Date(group.irb_approval_date).toLocaleDateString('en-GB')}</p></div>}
                        {group.co_supervisor && <div><span className="text-navy-500">Co-Supervisor</span><p className="text-navy-300">{group.co_supervisor.name}</p></div>}
                        {group.notes && <div className="col-span-2"><span className="text-navy-500">Notes</span><p className="text-navy-300 mt-0.5">{group.notes}</p></div>}
                      </div>
                    )}

                    {/* Students in group */}
                    <div>
                      <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-2">
                        Group Members ({group.students?.length || 0})
                      </p>
                      <div className="space-y-2">
                        {(group.students || []).map(student => (
                          <div key={student.id} className="rounded-xl bg-navy-800/30 border border-navy-700/30 overflow-hidden">
                            {editingStudent === student.id ? (
                              <div className="p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs text-navy-500 mb-1">Name</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.name}
                                      onChange={e => setStudentForm(p => ({...p, name: e.target.value}))}/>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-navy-500 mb-1">Student ID</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.student_id}
                                      onChange={e => setStudentForm(p => ({...p, student_id: e.target.value}))}/>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-navy-500 mb-1">Email</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.email}
                                      onChange={e => setStudentForm(p => ({...p, email: e.target.value}))}/>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-navy-500 mb-1">Program</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.program}
                                      onChange={e => setStudentForm(p => ({...p, program: e.target.value}))}/>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveStudent(student.id, group.id)}
                                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                                    <Save size={11}/> Save
                                  </button>
                                  <button onClick={() => setEditingStudent(null)}
                                    className="btn-ghost text-xs py-1 px-3">
                                    <X size={11}/>
                                  </button>
                                  {canEdit && (
                                    <button onClick={async () => {
                                      if (!confirm(`Remove ${student.name} from this group?`)) return
                                      await removeStudentFromGroup(student.id)
                                      setEditingStudent(null)
                                      load()
                                    }} className="text-xs text-red-400/60 hover:text-red-400 ml-auto flex items-center gap-1">
                                      <Trash2 size={11}/> Remove from group
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 px-3 py-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                                  style={{background:`${accent}20`, color:accent}}>
                                  {student.name?.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-300 truncate">{student.name}</p>
                                  <p className="text-xs text-navy-500">{student.student_id} · {student.email}</p>
                                </div>
                                {canEdit && (
                                  <button onClick={() => startEditStudent(student)}
                                    className="btn-ghost p-1.5 rounded-lg shrink-0">
                                    <Edit2 size={12} className="text-navy-500"/>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {(!group.students || group.students.length === 0) && (
                          <p className="text-xs text-navy-600 py-2 text-center">No students assigned to this group</p>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
