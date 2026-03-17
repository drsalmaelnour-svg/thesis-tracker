import { useState, useEffect } from 'react'
import emailjs from '@emailjs/browser'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, GraduationCap, Send, Users, Calendar, Clock } from 'lucide-react'
import { MILESTONES } from '../lib/supabase'

// Milestones that use group selection
const GROUP_MILESTONES = ['proposal_defense', 'progress_1', 'progress_2']

// ORCID format helpers
function formatOrcid(v) {
  const d = v.replace(/[^0-9X]/gi, '').toUpperCase()
  return (d.match(/.{1,4}/g) || []).join('-').substring(0, 19)
}
function validateOrcid(v) {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v)
}

// Time slots 10am–3pm
const TIME_SLOTS = [
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM',
]

export default function Respond() {
  const [params] = useSearchParams()
  const token  = params.get('t')
  const milestoneId = params.get('m')

  const [stage, setStage]     = useState('loading')
  const [student, setStudent] = useState(null)
  const [groups, setGroups]   = useState([])
  const [enrollment, setEnrollment] = useState({}) // { A: 3, B: 7 }
  const [errorMsg, setErrorMsg]     = useState('')
  const [formData, setFormData]     = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupInfo, setGroupInfo] = useState(null)

  const milestone   = MILESTONES.find(m => m.id === milestoneId)
  const needsGroups = GROUP_MILESTONES.includes(milestoneId)

  useEffect(() => {
    if (!token || !milestoneId) {
      setErrorMsg('This link appears to be invalid. Please contact your thesis coordinator.')
      setStage('error')
      return
    }

    async function init() {
      try {
        const { supabase } = await import('../lib/supabase')

        // Validate token
        const { data: s, error } = await supabase
          .from('students').select('id, name, email').eq('token', token).single()
        if (error || !s) throw new Error('Invalid or expired link.')
        setStudent(s)

        // Check if already submitted
        const { data: existing } = await supabase
          .from('student_milestones')
          .select('status, group_name, response_data')
          .eq('student_id', s.id)
          .eq('milestone_id', milestoneId)
          .single()

        if (existing?.status === 'completed') {
          setFormData(existing.response_data || {})
          setSelectedGroup(existing.group_name)
          setStage('already_done')
          return
        }

        // Load groups if needed
        if (needsGroups) {
          const { data: grps } = await supabase
            .from('milestone_groups')
            .select('*')
            .eq('milestone_id', milestoneId)
            .order('group_name')

          setGroups(grps || [])

          // Get enrollment counts
          const counts = {}
          for (const g of (grps || [])) {
            const { count } = await supabase
              .from('student_milestones')
              .select('*', { count: 'exact', head: true })
              .eq('milestone_id', milestoneId)
              .eq('group_name', g.group_name)
            counts[g.group_name] = count || 0
          }
          setEnrollment(counts)
        }

        setStage('form')
      } catch (e) {
        setErrorMsg(e.message || 'Something went wrong.')
        setStage('error')
      }
    }

    init()
  }, [token, milestoneId])

  function setField(id, val) {
    setFormData(f => ({ ...f, [id]: val }))
    setFieldErrors(e => ({ ...e, [id]: '' }))
  }

  function validate() {
    const errors = {}

    if (milestoneId === 'orcid') {
      if (!formData.orcid_id?.trim()) errors.orcid_id = 'ORCID is required.'
      else if (!validateOrcid(formData.orcid_id)) errors.orcid_id = 'Please enter a valid ORCID.'
    }

    if (milestoneId === 'irb_approval') {
      if (!formData.proposal_title?.trim()) errors.proposal_title = 'Proposal title is required.'
      if (!formData.irb_number?.trim())     errors.irb_number     = 'IRB number is required.'
      if (!formData.approval_date?.trim())  errors.approval_date  = 'Approval date is required.'
    }

    if (milestoneId === 'defense_schedule') {
      if (!formData.defense_date?.trim()) errors.defense_date = 'Date is required.'
      if (!formData.defense_time?.trim()) errors.defense_time = 'Time is required.'
    }

    if (milestoneId === 'thesis_submission') {
      if (!formData.final_title?.trim())      errors.final_title      = 'Final title is required.'
      if (!formData.submission_date?.trim())  errors.submission_date  = 'Submission date is required.'
    }

    if (needsGroups && !selectedGroup) {
      errors.group = 'Please select a group.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setStage('submitting')
    try {
      const { supabase } = await import('../lib/supabase')
      const data = needsGroups ? { ...formData, group: selectedGroup } : formData
      const notes = Object.entries(data).filter(([,v]) => v)
        .map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`).join(' | ')

      // Save milestone completion
      await supabase.from('student_milestones').upsert({
        student_id:    student.id,
        milestone_id:  milestoneId,
        status:        'completed',
        group_name:    selectedGroup || null,
        response_data: data,
        notes,
        completed_at:  new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'student_id,milestone_id' })

      // Fetch group details if this is a group milestone
      let groupInfo = null
      if (selectedGroup) {
        const { data: grp } = await supabase
          .from('milestone_groups')
          .select('*')
          .eq('milestone_id', milestoneId)
          .eq('group_name', selectedGroup)
          .single()
        groupInfo = grp
      }

      // Build confirmation email content
      const milestoneName = MILESTONES.find(m => m.id === milestoneId)?.name || milestoneId
      const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

      let confirmationDetails = ''
      if (groupInfo) {
        confirmationDetails = [
          `Group: ${selectedGroup}`,
          groupInfo.date    ? `Date: ${formatDate(groupInfo.date)}`   : '',
          groupInfo.time_slot ? `Time: ${groupInfo.time_slot}`        : '',
          groupInfo.notes   ? `Location: ${groupInfo.notes}`          : '',
        ].filter(Boolean).join('\n')
      } else {
        // For non-group milestones show submitted fields
        confirmationDetails = Object.entries(data)
          .filter(([,v]) => v)
          .map(([k,v]) => `${k.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`)
          .join('\n')
      }

      // Send confirmation via EmailJS (static import)
      try {
        const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
        const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_STUDENT_TEMPLATE

        if (PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID) {
          emailjs.init(PUBLIC_KEY)
          await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
            to_email:      student.email,
            to_name:       student.name,
            subject:       `Confirmation: ${milestoneName} — Thesis Coordination`,
            message:       `Your submission for "${milestoneName}" has been confirmed.\n\n${confirmationDetails}\n\nIf you have any questions, please contact your thesis coordinator.`,
            response_link: '',
            milestone:     milestoneName,
          })
        }
      } catch(emailErr) {
        // Don't block success if email fails
        console.warn('Confirmation email failed:', emailErr)
      }

      setGroupInfo(groupInfo)
      setStage('success')
    } catch(e) {
      setErrorMsg('Failed to save. Please try again or contact your coordinator.')
      setStage('error')
    }
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const inputCls = (err) =>
    `w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none transition-all text-sm ${
      err ? 'border-red-400/60' : 'border-white/20 focus:border-amber-400/60'
    }`

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f1f36 0%, #1e3a5f 60%, #0f1f36 100%)' }}
    >
      <div className="w-full max-w-lg">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-b border-white/10 px-8 py-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
              <GraduationCap size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">Thesis Coordination</p>
              <h1 className="text-white font-bold text-lg leading-tight">{milestone?.name || 'Milestone Response'}</h1>
            </div>
          </div>

          <div className="px-8 py-8 space-y-5">

            {/* ── LOADING ── */}
            {stage === 'loading' && (
              <div className="text-center py-8">
                <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-300">Verifying your link…</p>
              </div>
            )}

            {/* ── ALREADY DONE ── */}
            {stage === 'already_done' && (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                <h2 className="text-xl font-bold text-white">Already Submitted</h2>
                <p className="text-slate-400 text-sm">You have already responded to this milestone.</p>
                {selectedGroup && (
                  <div className="bg-white/5 rounded-xl p-4 text-left">
                    <p className="text-xs text-slate-500 mb-1">Your group</p>
                    <p className="text-white font-bold text-lg">Group {selectedGroup}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── FORM ── */}
            {stage === 'form' && (
              <div className="space-y-5">

                {/* Student info */}
                {student && (
                  <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <p className="text-xs text-slate-500">Responding as</p>
                    <p className="text-white font-medium">{student.name}</p>
                    <p className="text-slate-400 text-xs">{student.email}</p>
                  </div>
                )}

                {/* ── ORCID ── */}
                {milestoneId === 'orcid' && (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Register at <a href="https://orcid.org/register" target="_blank" rel="noreferrer" className="text-amber-400 underline">orcid.org/register</a> then enter your ORCID iD below.</p>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">ORCID iD <span className="text-amber-400">*</span></label>
                      <input
                        className={inputCls(fieldErrors.orcid_id) + ' font-mono tracking-widest text-center text-xl'}
                        value={formData.orcid_id || ''}
                        onChange={e => setField('orcid_id', formatOrcid(e.target.value))}
                        placeholder="0000-0000-0000-0000"
                        maxLength={19}
                      />
                      {formData.orcid_id && !validateOrcid(formData.orcid_id) && (
                        <p className="text-xs text-amber-400 mt-1">⚠ Format: 0000-0000-0000-0000</p>
                      )}
                      {formData.orcid_id && validateOrcid(formData.orcid_id) && (
                        <p className="text-xs text-emerald-400 mt-1">✓ Valid ORCID format</p>
                      )}
                      {fieldErrors.orcid_id && <p className="text-xs text-red-400 mt-1">{fieldErrors.orcid_id}</p>}
                    </div>
                  </div>
                )}

                {/* ── GROUP SELECTION (Proposal Defense + Progress Reports) ── */}
                {needsGroups && (
                  <div className="space-y-3">
                    <p className="text-slate-400 text-sm">Select your group. Groups that are full are not available.</p>

                    {groups.length === 0 ? (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                        <p className="text-amber-300 text-sm">Groups have not been configured yet by your coordinator. Please check back later or contact your coordinator.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {groups.map(g => {
                          const enrolled = enrollment[g.group_name] || 0
                          const isFull   = enrolled >= g.capacity
                          const isSelected = selectedGroup === g.group_name
                          return (
                            <button
                              key={g.group_name}
                              onClick={() => !isFull && setSelectedGroup(g.group_name)}
                              disabled={isFull}
                              className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                                isFull
                                  ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-amber-400/60 bg-amber-500/15 cursor-pointer'
                                  : 'border-white/15 bg-white/5 hover:border-white/30 cursor-pointer'
                              }`}
                            >
                              {isSelected && (
                                <CheckCircle2 size={16} className="text-amber-400 absolute top-3 right-3" />
                              )}
                              {isFull && (
                                <span className="absolute top-2 right-2 text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-lg">Full</span>
                              )}
                              <p className="text-white font-bold text-lg mb-2">Group {g.group_name}</p>
                              {g.date && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                                  <Calendar size={11} />
                                  {new Date(g.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                              )}
                              {g.time_slot && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                                  <Clock size={11} /> {g.time_slot}
                                </div>
                              )}
                              {g.notes && <p className="text-xs text-slate-500 mt-1">{g.notes}</p>}
                              <div className="flex items-center gap-1.5 mt-2">
                                <Users size={11} className="text-slate-500" />
                                <span className={`text-xs ${isFull ? 'text-red-400' : 'text-slate-400'}`}>
                                  {enrolled}/{g.capacity} enrolled
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {fieldErrors.group && <p className="text-xs text-red-400">{fieldErrors.group}</p>}
                  </div>
                )}

                {/* ── IRB APPROVAL ── */}
                {milestoneId === 'irb_approval' && (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Please enter your IRB ethics approval details.</p>
                    {[
                      { id: 'proposal_title', label: 'Proposal Title', type: 'text',  placeholder: 'Enter the exact title of your research proposal', required: true },
                      { id: 'irb_number',     label: 'IRB Approval Number', type: 'text', placeholder: 'e.g. IRB-2025-001', required: true },
                      { id: 'approval_date',  label: 'Date of Approval', type: 'date', required: true },
                    ].map(f => (
                      <div key={f.id}>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label} {f.required && <span className="text-amber-400">*</span>}</label>
                        <input type={f.type} className={inputCls(fieldErrors[f.id])} placeholder={f.placeholder} value={formData[f.id] || ''} onChange={e => setField(f.id, e.target.value)} />
                        {fieldErrors[f.id] && <p className="text-xs text-red-400 mt-1">{fieldErrors[f.id]}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── DEFENSE SCHEDULING ── */}
                {milestoneId === 'defense_schedule' && (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Please select your preferred thesis defense date and time slot.</p>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Defense Date <span className="text-amber-400">*</span></label>
                      <input type="date" className={inputCls(fieldErrors.defense_date)} value={formData.defense_date || ''} onChange={e => setField('defense_date', e.target.value)} />
                      {fieldErrors.defense_date && <p className="text-xs text-red-400 mt-1">{fieldErrors.defense_date}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Preferred Time <span className="text-amber-400">*</span></label>
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_SLOTS.map(t => (
                          <button key={t} type="button"
                            onClick={() => setField('defense_time', t)}
                            className={`py-2 px-3 rounded-xl text-sm border transition-all ${
                              formData.defense_time === t
                                ? 'border-amber-400/60 bg-amber-500/15 text-amber-300 font-medium'
                                : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      {fieldErrors.defense_time && <p className="text-xs text-red-400 mt-1">{fieldErrors.defense_time}</p>}
                    </div>
                  </div>
                )}

                {/* ── THESIS SUBMISSION ── */}
                {milestoneId === 'thesis_submission' && (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Please confirm your final thesis submission details.</p>
                    {[
                      { id: 'final_title',      label: 'Final Thesis Title',    type: 'text',     placeholder: 'Exact title of your submitted thesis', required: true },
                      { id: 'submission_date',   label: 'Submission Date',       type: 'date',     required: true },
                      { id: 'submission_notes',  label: 'Notes (optional)',       type: 'textarea', placeholder: 'Any corrections made or additional notes…', required: false },
                    ].map(f => (
                      <div key={f.id}>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">{f.label} {f.required && <span className="text-amber-400">*</span>}</label>
                        {f.type === 'textarea'
                          ? <textarea className={inputCls(fieldErrors[f.id]) + ' resize-none h-20'} placeholder={f.placeholder} value={formData[f.id] || ''} onChange={e => setField(f.id, e.target.value)} />
                          : <input type={f.type} className={inputCls(fieldErrors[f.id])} placeholder={f.placeholder} value={formData[f.id] || ''} onChange={e => setField(f.id, e.target.value)} />
                        }
                        {fieldErrors[f.id] && <p className="text-xs text-red-400 mt-1">{fieldErrors[f.id]}</p>}
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={handleSubmit}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm mt-2">
                  <Send size={16} /> Submit Response
                </button>
              </div>
            )}

            {/* ── SUBMITTING ── */}
            {stage === 'submitting' && (
              <div className="text-center py-10">
                <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-300">Saving your response…</p>
              </div>
            )}

            {/* ── SUCCESS ── */}
            {stage === 'success' && (
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Submitted!</h2>
                  {student && <p className="text-slate-400 text-sm mt-1">Thank you, {student.name}</p>}
                </div>
                {milestone && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-4">
                    <p className="text-3xl mb-2">{milestone.icon}</p>
                    <p className="text-emerald-300 font-semibold">{milestone.name}</p>
                    {selectedGroup && <p className="text-emerald-400 text-sm mt-1">Assigned to Group {selectedGroup}</p>}
                  </div>
                )}

                {/* Group date/time confirmation */}
                {groupInfo && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-6 py-4 text-left space-y-2">
                    <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium mb-3">Your Scheduled Session</p>
                    {groupInfo.date && (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">📅</span>
                        <p className="text-white font-medium">
                          {new Date(groupInfo.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {groupInfo.time_slot && (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">🕐</span>
                        <p className="text-white font-medium">{groupInfo.time_slot}</p>
                      </div>
                    )}
                    {groupInfo.notes && (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">📍</span>
                        <p className="text-white font-medium">{groupInfo.notes}</p>
                      </div>
                    )}
                    <p className="text-amber-400/60 text-xs mt-3">A confirmation email has been sent to {student?.email}</p>
                  </div>
                )}
                {/* Summary of submitted data */}
                {Object.keys(formData).length > 0 && (
                  <div className="bg-white/5 rounded-xl px-5 py-4 text-left space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Your submission</p>
                    {Object.entries(formData).filter(([,v]) => v).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</p>
                        <p className="text-slate-200 text-sm font-medium">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-slate-500 text-xs">Your coordinator has been notified. You can close this page.</p>
              </div>
            )}

            {/* ── ERROR ── */}
            {stage === 'error' && (
              <div className="text-center space-y-4 py-4">
                <XCircle size={48} className="text-red-400 mx-auto" />
                <h2 className="text-xl font-bold text-white">Something went wrong</h2>
                <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
                <p className="text-slate-600 text-xs">Please contact your thesis coordinator for assistance.</p>
              </div>
            )}

          </div>
        </div>
        <p className="text-center text-slate-600 text-xs mt-5">Thesis Coordination System · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
