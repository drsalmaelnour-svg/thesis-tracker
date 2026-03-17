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
