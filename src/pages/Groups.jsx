import { useState, useEffect, useCallback } from 'react'
import { useDept } from '../context/DeptContext'
import { useRole } from '../context/RoleContext'
import { Users, Search, Edit2, Save, X, ChevronDown, ChevronUp, Loader2, Trash2, RefreshCw, Plus } from 'lucide-react'
import { getSupervisors } from '../lib/supabase'

async function getGroups(deptId) {
  const { supabase } = await import('../lib/supabase')
  let q = supabase
    .from('research_groups')
    .select(`
      id, name, department_id, academic_year, program_level,
      supervisor_id, co_supervisor_id,
      proposal_title, thesis_title, irb_number, irb_approval_date,
      research_area, notes, active, created_at, updated_at,
      departments(name, primary_color, accent_color),
      students(id, name, email, student_id, program, enrollment_year, program_level)
    `)
    .eq('program_level', 'Undergraduate')
    .order('academic_year', { ascending: false })
    .order('name')
  if (deptId) q = q.eq('department_id', deptId)
  const { data, error } = await q
  if (error) throw error

  // Fetch supervisor names separately to avoid FK naming issues
  const supIds = [...new Set([
    ...(data||[]).map(g=>g.supervisor_id).filter(Boolean),
    ...(data||[]).map(g=>g.co_supervisor_id).filter(Boolean),
  ])]
  let supMap = {}
  if (supIds.length > 0) {
    const { supabase: sb } = await import('../lib/supabase')
    const { data: sups } = await sb.from('supervisors').select('id,name,email,designation').in('id', supIds)
    ;(sups||[]).forEach(s => { supMap[s.id] = s })
  }

  return (data||[]).map(g => ({
    ...g,
    supervisor:    supMap[g.supervisor_id]    || null,
    co_supervisor: supMap[g.co_supervisor_id] || null,
  }))
}

async function updateGroup(id, updates) {
  const { supabase } = await import('../lib/supabase')
  // Clean empty strings to null
  const clean = Object.fromEntries(
    Object.entries(updates).map(([k,v]) => [k, v===''?null:v])
  )
  const { data, error } = await supabase
    .from('research_groups')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id').single()
  if (error) throw error
  return data
}

async function updateStudentRecord(studentId, updates) {
  const { supabase } = await import('../lib/supabase')
  const { error } = await supabase.from('students').update(updates).eq('id', studentId)
  if (error) throw error
}

async function removeStudentFromGroup(studentId) {
  const { supabase } = await import('../lib/supabase')
  const { error } = await supabase.from('students').update({ research_group_id: null }).eq('id', studentId)
  if (error) throw error
}

async function getUngroupedStudents(deptId) {
  const { supabase } = await import('../lib/supabase')
  let q = supabase.from('students').select('id,name,email,student_id,program,enrollment_year')
    .eq('program_level','Undergraduate').is('research_group_id',null)
  if (deptId) q = q.eq('department_id', deptId)
  const { data } = await q.order('name')
  return data || []
}

async function deleteStudents(ids) {
  const { supabase } = await import('../lib/supabase')
  const { error } = await supabase.from('students').delete().in('id', ids)
  if (error) throw error
}

async function createGroup(deptId, data) {
  const { supabase } = await import('../lib/supabase')
  const clean = Object.fromEntries(
    Object.entries(data).map(([k,v]) => [k, v===''?null:v])
  )
  const { data: group, error } = await supabase
    .from('research_groups')
    .insert({ ...clean, department_id: deptId, program_level: 'Undergraduate', active: true })
    .select('id').single()
  if (error) throw error
  return group
}

async function deleteGroup(id) {
  const { supabase } = await import('../lib/supabase')
  // Unlink students first
  await supabase.from('students').update({ research_group_id: null }).eq('research_group_id', id)
  const { error } = await supabase.from('research_groups').delete().eq('id', id)
  if (error) throw error
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
  const [editing,     setEditing]     = useState(null)
  const [editForm,    setEditForm]    = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const [editingStudent,setEditingStudent] = useState(null)
  const [studentForm,   setStudentForm]    = useState({})
  const [selected,    setSelected]    = useState(new Set())
  const [deleting,    setDeleting]    = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [createForm,  setCreateForm]  = useState({
    name: '', academic_year: new Date().getFullYear(), research_area: '',
    proposal_title: '', supervisor_id: '', notes: ''
  })
  const [creating,    setCreating]    = useState(false)
  const [createMsg,   setCreateMsg]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, s, u] = await Promise.all([
        getGroups(effectiveDeptId),
        getSupervisors(),
        getUngroupedStudents(effectiveDeptId),
      ])
      setGroups(g); setSupervisors(s); setUngrouped(u)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [effectiveDeptId, viewingDept, viewingLevel])

  useEffect(() => { load() }, [load])

  const years = [...new Set(groups.map(g=>g.academic_year).filter(Boolean))].sort((a,b)=>b-a)

  const filtered = groups.filter(g => {
    const matchSearch = !search ||
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.thesis_title?.toLowerCase().includes(search.toLowerCase()) ||
      g.research_area?.toLowerCase().includes(search.toLowerCase()) ||
      g.students?.some(s=>s.name.toLowerCase().includes(search.toLowerCase()))
    const matchYear = yearFilter==='all' || String(g.academic_year)===String(yearFilter)
    return matchSearch && matchYear
  })

  // All students across filtered groups
  const allStudentsInFiltered = filtered.flatMap(g=>g.students||[])

  function toggleSelect(id) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selected.size === allStudentsInFiltered.length) setSelected(new Set())
    else setSelected(new Set(allStudentsInFiltered.map(s=>s.id)))
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} student${selected.size>1?'s':''}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteStudents([...selected])
      setSelected(new Set())
      await load()
    } catch(e) { alert('Delete failed: ' + e.message) }
    setDeleting(false)
  }

  async function handleCreateGroup() {
    if (!createForm.name.trim()) { setCreateMsg('Group name is required.'); return }
    setCreating(true); setCreateMsg('')
    try {
      await createGroup(effectiveDeptId, createForm)
      setShowCreate(false)
      setCreateForm({ name:'', academic_year:new Date().getFullYear(), research_area:'', proposal_title:'', supervisor_id:'', notes:'' })
      await load()
    } catch(e) { setCreateMsg('Error: ' + e.message) }
    setCreating(false)
  }

  async function handleDeleteGroup(group) {
    const memberCount = group.students?.length || 0
    const msg = memberCount > 0
      ? `Delete group "${group.name}"? This will unlink ${memberCount} student${memberCount>1?'s':''} from the group (students will not be deleted). This cannot be undone.`
      : `Delete group "${group.name}"? This cannot be undone.`
    if (!confirm(msg)) return
    try {
      await deleteGroup(group.id)
      await load()
    } catch(e) { alert('Delete failed: ' + e.message) }
  }

  function startEdit(group) {
    setEditing(group.id)
    setEditForm({
      name:              group.name||'',
      thesis_title:      group.thesis_title||'',
      proposal_title:    group.proposal_title||'',
      irb_number:        group.irb_number||'',
      irb_approval_date: group.irb_approval_date||'',
      research_area:     group.research_area||'',
      supervisor_id:     group.supervisor_id||'',
      co_supervisor_id:  group.co_supervisor_id||'',
      notes:             group.notes||'',
    })
    setExpanded(prev=>({...prev,[group.id]:true}))
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
      setTimeout(()=>setSaveMsg(''),3000)
    } catch(e) { setSaveMsg('Error: '+ e.message) }
    setSaving(false)
  }

  function startEditStudent(student) {
    setEditingStudent(student.id)
    setStudentForm({ name:student.name||'', email:student.email||'', student_id:student.student_id||'', program:student.program||'' })
  }

  async function saveStudent(studentId) {
    try {
      await updateStudentRecord(studentId, studentForm)
      setEditingStudent(null)
      await load()
    } catch(e) { alert('Save failed: '+e.message) }
  }

  const totalStudents = groups.reduce((sum,g)=>sum+(g.students?.length||0),0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users size={20} className="text-gold-400"/> Research Groups
          </h1>
          <p className="text-xs text-navy-400 mt-0.5">
            {groups.length} groups · {totalStudents} students
            {ungrouped.length>0 && <span className="text-amber-400 ml-2">· {ungrouped.length} ungrouped</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size>0 && canEdit && (
            <button onClick={handleBulkDelete} disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50">
              {deleting?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}
              Delete {selected.size} student{selected.size>1?'s':''}
            </button>
          )}
          {canEdit && (
            <button onClick={()=>setShowCreate(v=>!v)}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14}/> New Group
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={loading?'animate-spin':''}/> Refresh
          </button>
        </div>
      </div>

      {/* Create group form */}
      {showCreate && (
        <div className="card p-5 space-y-4 border border-gold-500/30">
          <p className="text-sm font-semibold text-slate-100">New Research Group</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Group Name <span className="text-red-400">*</span></label>
              <input className="input w-full text-sm" placeholder="e.g. 2024 Group 1"
                value={createForm.name} onChange={e=>setCreateForm(p=>({...p,name:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Cohort Year</label>
              <input className="input w-full text-sm" type="number" placeholder={new Date().getFullYear()}
                value={createForm.academic_year} onChange={e=>setCreateForm(p=>({...p,academic_year:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Research Area</label>
              <input className="input w-full text-sm" placeholder="e.g. Microbiology"
                value={createForm.research_area} onChange={e=>setCreateForm(p=>({...p,research_area:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Supervisor</label>
              <select className="input w-full text-sm" value={createForm.supervisor_id}
                onChange={e=>setCreateForm(p=>({...p,supervisor_id:e.target.value}))}>
                <option value="">— Select Supervisor —</option>
                {supervisors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-navy-400 mb-1">Proposal Title (optional)</label>
              <input className="input w-full text-sm" placeholder="Initial proposal title"
                value={createForm.proposal_title} onChange={e=>setCreateForm(p=>({...p,proposal_title:e.target.value}))}/>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-navy-400 mb-1">Notes (optional)</label>
              <textarea className="input w-full text-sm resize-none" rows={2}
                value={createForm.notes} onChange={e=>setCreateForm(p=>({...p,notes:e.target.value}))}/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateGroup} disabled={creating}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
              {creating?<><Loader2 size={13} className="animate-spin"/>Creating…</>:<><Plus size={13}/>Create Group</>}
            </button>
            <button onClick={()=>{setShowCreate(false);setCreateMsg('')}} className="btn-ghost text-sm">
              <X size={13}/> Cancel
            </button>
            {createMsg && <p className="text-xs text-red-400">{createMsg}</p>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"/>
          <input className="input pl-9 w-full text-sm" placeholder="Search groups, titles, students…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input text-sm" value={yearFilter} onChange={e=>setYearFilter(e.target.value)}>
          <option value="all">All Cohorts</option>
          {years.map(y=><option key={y} value={y}>{y} Cohort</option>)}
        </select>
      </div>

      {/* Bulk select bar */}
      {allStudentsInFiltered.length>0 && canEdit && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-navy-800/30 border border-navy-700/30">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-navy-400 hover:text-navy-200 transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              selected.size===allStudentsInFiltered.length&&allStudentsInFiltered.length>0
                ?'bg-gold-400 border-gold-400':'border-navy-500'}`}>
              {selected.size===allStudentsInFiltered.length&&allStudentsInFiltered.length>0&&
                <span className="text-navy-900 text-xs font-bold">✓</span>}
            </div>
            {selected.size===allStudentsInFiltered.length&&allStudentsInFiltered.length>0?'Deselect All':'Select All Students'}
          </button>
          {selected.size>0 && (
            <span className="text-xs text-gold-400">{selected.size} selected</span>
          )}
        </div>
      )}

      {/* Ungrouped warning */}
      {ungrouped.length>0 && (
        <div className="card p-4 border border-amber-500/20 bg-amber-900/5">
          <p className="text-xs font-semibold text-amber-400 mb-2">⚠ {ungrouped.length} undergraduate student{ungrouped.length>1?'s':''} not in a group</p>
          <div className="flex flex-wrap gap-2">
            {ungrouped.map(s=>(
              <span key={s.id} className="px-2 py-1 rounded-lg text-xs bg-navy-800/40 text-navy-300">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading?(
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-navy-500"/></div>
      ):filtered.length===0?(
        <div className="card p-10 text-center">
          <Users size={32} className="mx-auto mb-3 text-navy-600"/>
          <p className="text-navy-400 text-sm">No groups found</p>
        </div>
      ):(
        <div className="space-y-3">
          {filtered.map(group => {
            const isExpanded = expanded[group.id]
            const isEditing  = editing===group.id
            const accent     = group.departments?.accent_color||'#d4a843'

            return (
              <div key={group.id} className="card overflow-hidden">

                {/* Group header row */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{background:`${accent}20`,color:accent}}>
                    {group.students?.length||0}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-200 text-sm">{group.name}</p>
                      <span className="px-2 py-0.5 rounded-lg text-xs bg-navy-700/50 text-navy-300">{group.academic_year} Cohort</span>
                      {group.irb_number&&(
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          IRB: {group.irb_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-400 mt-0.5 truncate">{group.thesis_title||group.proposal_title||'No thesis title set'}</p>
                    <p className="text-xs text-navy-500 mt-0.5">
                      {group.supervisor?.name||'No supervisor'}
                      {group.research_area&&` · ${group.research_area}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit&&!isEditing&&(
                      <>
                        <button onClick={()=>startEdit(group)} className="btn-ghost p-2 rounded-xl" title="Edit group">
                          <Edit2 size={14} className="text-navy-400"/>
                        </button>
                        <button onClick={()=>handleDeleteGroup(group)} className="btn-ghost p-2 rounded-xl" title="Delete group">
                          <Trash2 size={14} className="text-red-400/50 hover:text-red-400"/>
                        </button>
                      </>
                    )}
                    <button onClick={()=>setExpanded(prev=>({...prev,[group.id]:!prev[group.id]}))} className="btn-ghost p-2 rounded-xl">
                      {isExpanded?<ChevronUp size={16} className="text-navy-400"/>:<ChevronDown size={16} className="text-navy-400"/>}
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded&&(
                  <div className="border-t border-navy-700/40 p-4 space-y-4">

                    {/* Edit form */}
                    {isEditing?(
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Edit Group Details</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Group Name</label>
                            <input className="input w-full text-sm" value={editForm.name}
                              onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}/>
                          </div>
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Research Area</label>
                            <input className="input w-full text-sm" value={editForm.research_area}
                              onChange={e=>setEditForm(p=>({...p,research_area:e.target.value}))}
                              placeholder="e.g. Microbiology"/>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-navy-400 mb-1">Proposal Title</label>
                          <input className="input w-full text-sm" value={editForm.proposal_title}
                            onChange={e=>setEditForm(p=>({...p,proposal_title:e.target.value}))}
                            placeholder="Initial proposal title"/>
                        </div>
                        <div>
                          <label className="block text-xs text-navy-400 mb-1">Thesis Title</label>
                          <input className="input w-full text-sm" value={editForm.thesis_title}
                            onChange={e=>setEditForm(p=>({...p,thesis_title:e.target.value}))}
                            placeholder="Final thesis title"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">IRB Number</label>
                            <input className="input w-full text-sm" value={editForm.irb_number}
                              onChange={e=>setEditForm(p=>({...p,irb_number:e.target.value}))}
                              placeholder="e.g. GMU-IRB-2024-001"/>
                          </div>
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">IRB Approval Date</label>
                            <input type="date" className="input w-full text-sm" value={editForm.irb_approval_date}
                              onChange={e=>setEditForm(p=>({...p,irb_approval_date:e.target.value}))}/>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Supervisor</label>
                            <select className="input w-full text-sm" value={editForm.supervisor_id}
                              onChange={e=>setEditForm(p=>({...p,supervisor_id:e.target.value}))}>
                              <option value="">— Select Supervisor —</option>
                              {supervisors.map(s=><option key={s.id} value={s.id}>{s.name}{s.designation?` (${s.designation})`:''}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-navy-400 mb-1">Co-Supervisor (optional)</label>
                            <select className="input w-full text-sm" value={editForm.co_supervisor_id}
                              onChange={e=>setEditForm(p=>({...p,co_supervisor_id:e.target.value}))}>
                              <option value="">— None —</option>
                              {supervisors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-navy-400 mb-1">Notes</label>
                          <textarea className="input w-full text-sm resize-none" rows={2}
                            value={editForm.notes}
                            onChange={e=>setEditForm(p=>({...p,notes:e.target.value}))}
                            placeholder="Coordinator notes…"/>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={saveGroup} disabled={saving}
                            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                            {saving?<><Loader2 size={13} className="animate-spin"/>Saving…</>:<><Save size={13}/>Save Changes</>}
                          </button>
                          <button onClick={cancelEdit} className="btn-ghost text-sm flex items-center gap-2">
                            <X size={13}/> Cancel
                          </button>
                          {saveMsg&&<p className={`text-xs ${saveMsg.startsWith('✓')?'text-emerald-400':'text-red-400'}`}>{saveMsg}</p>}
                        </div>
                      </div>
                    ):(
                      /* Read-only group details */
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        {group.proposal_title&&<div className="col-span-2"><span className="text-navy-500">Proposal Title</span><p className="text-navy-300 mt-0.5">{group.proposal_title}</p></div>}
                        {group.thesis_title&&<div className="col-span-2"><span className="text-navy-500">Thesis Title</span><p className="text-navy-300 mt-0.5">{group.thesis_title}</p></div>}
                        {group.irb_number&&<div><span className="text-navy-500">IRB Number</span><p className="text-navy-300">{group.irb_number}</p></div>}
                        {group.irb_approval_date&&<div><span className="text-navy-500">IRB Approval</span><p className="text-navy-300">{new Date(group.irb_approval_date).toLocaleDateString('en-GB')}</p></div>}
                        {group.co_supervisor&&<div><span className="text-navy-500">Co-Supervisor</span><p className="text-navy-300">{group.co_supervisor.name}</p></div>}
                        {group.notes&&<div className="col-span-2"><span className="text-navy-500">Notes</span><p className="text-navy-300 mt-0.5">{group.notes}</p></div>}
                      </div>
                    )}

                    {/* Students */}
                    <div>
                      <p className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-2">
                        Group Members ({group.students?.length||0})
                      </p>
                      <div className="space-y-2">
                        {(group.students||[]).map(student=>(
                          <div key={student.id} className={`rounded-xl border overflow-hidden transition-all ${
                            selected.has(student.id)?'border-red-500/40 bg-red-900/10':'border-navy-700/30 bg-navy-800/30'
                          }`}>
                            {editingStudent===student.id?(
                              <div className="p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div><label className="block text-xs text-navy-500 mb-1">Name</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.name}
                                      onChange={e=>setStudentForm(p=>({...p,name:e.target.value}))}/></div>
                                  <div><label className="block text-xs text-navy-500 mb-1">Student ID</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.student_id}
                                      onChange={e=>setStudentForm(p=>({...p,student_id:e.target.value}))}/></div>
                                  <div><label className="block text-xs text-navy-500 mb-1">Email</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.email}
                                      onChange={e=>setStudentForm(p=>({...p,email:e.target.value}))}/></div>
                                  <div><label className="block text-xs text-navy-500 mb-1">Program</label>
                                    <input className="input w-full text-xs py-1.5" value={studentForm.program}
                                      onChange={e=>setStudentForm(p=>({...p,program:e.target.value}))}/></div>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <button onClick={()=>saveStudent(student.id)}
                                    className="btn-primary text-xs py-1 px-3 flex items-center gap-1"><Save size={11}/>Save</button>
                                  <button onClick={()=>setEditingStudent(null)}
                                    className="btn-ghost text-xs py-1 px-3"><X size={11}/></button>
                                  {canEdit&&(
                                    <button onClick={async()=>{
                                      if(!confirm(`Remove ${student.name} from this group?`)) return
                                      await removeStudentFromGroup(student.id); setEditingStudent(null); load()
                                    }} className="text-xs text-red-400/60 hover:text-red-400 ml-auto flex items-center gap-1">
                                      <Trash2 size={11}/> Remove from group
                                    </button>
                                  )}
                                </div>
                              </div>
                            ):(
                              <div className="flex items-center gap-3 px-3 py-2.5">
                                {/* Checkbox */}
                                {canEdit&&(
                                  <button onClick={()=>toggleSelect(student.id)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                      selected.has(student.id)?'bg-red-500 border-red-500':'border-navy-600 hover:border-navy-400'}`}>
                                    {selected.has(student.id)&&<span className="text-white text-xs font-bold leading-none">✓</span>}
                                  </button>
                                )}
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                                  style={{background:`${accent}20`,color:accent}}>
                                  {student.name?.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-300 truncate">{student.name}</p>
                                  <p className="text-xs text-navy-500">{student.student_id} · {student.email}</p>
                                </div>
                                {canEdit&&(
                                  <button onClick={()=>startEditStudent(student)} className="btn-ghost p-1.5 rounded-lg shrink-0">
                                    <Edit2 size={12} className="text-navy-500"/>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {(!group.students||group.students.length===0)&&(
                          <p className="text-xs text-navy-600 py-2 text-center">No students in this group</p>
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
