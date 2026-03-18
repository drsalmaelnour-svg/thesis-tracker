import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase env vars missing. Copy .env.example to .env and fill in your keys.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

// ── Helpers ──────────────────────────────────────────────────────────────────

export const MILESTONES = [
  { id: 'orcid',            name: 'ORCID Registration',       order: 1, icon: '🔬' },
  { id: 'proposal_defense', name: 'Proposal Defense',         order: 2, icon: '🎤' },
  { id: 'irb_approval',     name: 'IRB Approval',             order: 3, icon: '✅' },
  { id: 'progress_1',       name: 'First Progress Report',    order: 4, icon: '📋' },
  { id: 'progress_2',       name: 'Second Progress Report',   order: 5, icon: '📋' },
  { id: 'defense_schedule', name: 'Defense Scheduling',       order: 6, icon: '📅' },
  { id: 'thesis_submission',name: 'Thesis Submission',        order: 7, icon: '🎓' },
]

export async function getStudentsWithProgress() {
  const { data: students, error } = await supabase
    .from('students')
    .select(`
      *,
      supervisors ( id, name, email ),
      student_milestones ( milestone_id, status, completed_at, due_date, notes, group_name, response_data )
    `)
    .order('name')

  if (error) throw error
  return students || []
}

export async function getStudent(id) {
  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      supervisors ( id, name, email ),
      student_milestones ( * )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateMilestoneStatus(studentId, milestoneId, status, notes = '') {
  const { error } = await supabase
    .from('student_milestones')
    .upsert({
      student_id: studentId,
      milestone_id: milestoneId,
      status,
      notes,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,milestone_id' })

  if (error) throw error
}

export async function respondViaToken(token, milestoneId) {
  // Find student by token
  const { data: student, error } = await supabase
    .from('students')
    .select('id, name, email')
    .eq('token', token)
    .single()

  if (error || !student) throw new Error('Invalid or expired response link.')

  // Mark milestone complete
  await updateMilestoneStatus(student.id, milestoneId, 'completed', 'Confirmed by student via email link')

  // Log it
  await supabase.from('email_log').insert({
    student_id: student.id,
    recipient_type: 'student',
    subject: `Milestone confirmed: ${milestoneId}`,
    template: 'response_link',
    milestone_id: milestoneId,
  })

  return student
}

export async function getSupervisors() {
  const { data, error } = await supabase.from('supervisors').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function getEmailLog() {
  const { data, error } = await supabase
    .from('email_log')
    .select(`*, students(name, email)`)
    .order('sent_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data || []
}

export async function logEmail({ studentId, recipientType, subject, template, milestoneId }) {
  await supabase.from('email_log').insert({
    student_id: studentId,
    recipient_type: recipientType,
    subject,
    template,
    milestone_id: milestoneId,
  })
}

// ── Group helpers ─────────────────────────────────────────────────────────────

export async function getGroups(milestoneId) {
  const { data, error } = await supabase
    .from('milestone_groups')
    .select('*')
    .eq('milestone_id', milestoneId)
    .order('group_name')
  if (error) throw error
  return data || []
}

export async function upsertGroup(milestoneId, groupName, fields) {
  const { error } = await supabase
    .from('milestone_groups')
    .upsert({ milestone_id: milestoneId, group_name: groupName, ...fields },
      { onConflict: 'milestone_id,group_name' })
  if (error) throw error
}

export async function getGroupEnrollment(milestoneId, groupName) {
  const { count, error } = await supabase
    .from('student_milestones')
    .select('*', { count: 'exact', head: true })
    .eq('milestone_id', milestoneId)
    .eq('group_name', groupName)
  if (error) throw error
  return count || 0
}

export async function assignStudentGroup(studentId, milestoneId, groupName, responseData = {}) {
  const notes = Object.entries(responseData)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' | ')

  const { error } = await supabase
    .from('student_milestones')
    .upsert({
      student_id: studentId,
      milestone_id: milestoneId,
      status: 'completed',
      group_name: groupName,
      response_data: responseData,
      notes,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,milestone_id' })
  if (error) throw error
}

// ── Supervisor check-in helpers ───────────────────────────────────────────────

export async function getSupervisorCheckins() {
  const { data, error } = await supabase
    .from('supervisor_checkins')
    .select(`
      *,
      supervisors ( id, name, email ),
      students ( id, name, student_id, program )
    `)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getCheckinLink(supervisorId, studentId) {
  const { data: sup } = await supabase
    .from('supervisors').select('token').eq('id', supervisorId).single()
  if (!sup?.token) return null
  const base = window.location.origin + window.location.pathname.split('#')[0].replace(/\/$/, '')
  return `${base}/#/supervisor-respond?t=${sup.token}&s=${studentId}`
}

// ── Student check-in helpers ──────────────────────────────────────────────────

export async function getStudentCheckins() {
  const { data, error } = await supabase
    .from('student_checkins')
    .select(`*, students ( id, name, student_id, program, enrollment_year, supervisors(name) )`)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function getStudentCheckinLink(studentToken) {
  const base = window.location.origin + window.location.pathname.split('#')[0].replace(/\/$/, '')
  return `${base}/#/student-checkin?t=${studentToken}`
}

// ── Deadline helpers ──────────────────────────────────────────────────────────

export async function getCohortDeadlines(cohortYear) {
  const { data, error } = await supabase
    .from('cohort_deadlines').select('*').eq('cohort_year', cohortYear).order('milestone_id')
  if (error) throw error
  return data || []
}

export async function upsertCohortDeadline(cohortYear, milestoneId, dueDate, notes = '') {
  const { error } = await supabase.from('cohort_deadlines').upsert(
    { cohort_year: cohortYear, milestone_id: milestoneId, due_date: dueDate, notes, updated_at: new Date().toISOString() },
    { onConflict: 'cohort_year,milestone_id' }
  )
  if (error) throw error
}

export async function getStudentDeadlineOverrides(studentId) {
  const { data, error } = await supabase
    .from('student_deadline_overrides').select('*').eq('student_id', studentId)
  if (error) throw error
  return data || []
}

export async function upsertStudentDeadlineOverride(studentId, milestoneId, dueDate, notes = '') {
  const { error } = await supabase.from('student_deadline_overrides').upsert(
    { student_id: studentId, milestone_id: milestoneId, due_date: dueDate, notes },
    { onConflict: 'student_id,milestone_id' }
  )
  if (error) throw error
}

// ── Notes helpers ─────────────────────────────────────────────────────────────

export async function getStudentNotes(studentId) {
  const { data, error } = await supabase
    .from('student_notes').select('*').eq('student_id', studentId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addStudentNote(studentId, content) {
  const { error } = await supabase.from('student_notes').insert({ student_id: studentId, content })
  if (error) throw error
  await logActivity(studentId, 'note', `Note added: ${content.slice(0, 60)}${content.length > 60 ? '…' : ''}`)
}

export async function deleteStudentNote(noteId) {
  const { error } = await supabase.from('student_notes').delete().eq('id', noteId)
  if (error) throw error
}

// ── Activity log helpers ──────────────────────────────────────────────────────

export async function logActivity(studentId, type, description, metadata = {}) {
  await supabase.from('activity_log').insert({ student_id: studentId, type, description, metadata })
}

export async function getStudentActivity(studentId) {
  const { data, error } = await supabase
    .from('activity_log').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data || []
}

export async function getRecentActivity(limit = 15) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, students(name, student_id)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

export async function getCalendarEvents(cohortYear) {
  const { data, error } = await supabase
    .from('academic_calendar').select('*').eq('cohort_year', cohortYear).order('event_date')
  if (error) throw error
  return data || []
}

export async function upsertCalendarEvent(event) {
  const { error } = await supabase.from('academic_calendar').upsert(
    { ...event, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
  if (error) throw error
}

export async function deleteCalendarEvent(id) {
  const { error } = await supabase.from('academic_calendar').delete().eq('id', id)
  if (error) throw error
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

export async function getCohortAnalytics(cohortYear, students) {
  const cohortStudents = cohortYear === 'all'
    ? students
    : students.filter(s => String(s.enrollment_year) === String(cohortYear))

  const total = cohortStudents.length
  if (!total) return null

  // Milestone completion rates
  const milestoneStats = MILESTONES.map(m => {
    const completed = cohortStudents.filter(s =>
      (s.student_milestones || []).find(sm => sm.milestone_id === m.id && sm.status === 'completed')
    ).length
    return { ...m, completed, rate: total ? Math.round((completed / total) * 100) : 0 }
  })

  // Overall completion
  const totalCompleted = cohortStudents.reduce((acc, s) => {
    return acc + (s.student_milestones || []).filter(sm => sm.status === 'completed').length
  }, 0)
  const maxPossible = total * MILESTONES.length
  const overallRate = maxPossible ? Math.round((totalCompleted / maxPossible) * 100) : 0

  // Status breakdown
  const overdue   = cohortStudents.filter(s => (s.student_milestones||[]).some(m=>m.status==='overdue')).length
  const onTrack   = cohortStudents.filter(s => {
    const ms = s.student_milestones || []
    return !ms.some(m=>m.status==='overdue') && ms.some(m=>m.status==='completed')
  }).length
  const notStarted = cohortStudents.filter(s =>
    !(s.student_milestones||[]).some(m=>m.status==='completed')
  ).length
  const complete = cohortStudents.filter(s =>
    (s.student_milestones||[]).filter(m=>m.status==='completed').length === MILESTONES.length
  ).length

  return { total, overallRate, milestoneStats, overdue, onTrack, notStarted, complete, cohortStudents }
}
