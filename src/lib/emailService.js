import emailjs from '@emailjs/browser'
import { MILESTONES, getEmailTemplate } from './supabase'

const PUBLIC_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const SERVICE_ID      = import.meta.env.VITE_EMAILJS_SERVICE_ID
const STUDENT_TPL     = import.meta.env.VITE_EMAILJS_STUDENT_TEMPLATE
const SUPERVISOR_TPL  = import.meta.env.VITE_EMAILJS_SUPERVISOR_TEMPLATE
const REMINDER_TPL    = import.meta.env.VITE_EMAILJS_REMINDER_TEMPLATE

// Always derive the URL from the actual browser location — works on any host
function getBaseUrl() {
  const origin = window.location.origin
  const path = window.location.pathname.split('#')[0].replace(/\/$/, '')
  return origin + path
}

function responseLink(token, milestoneId) {
  const base = getBaseUrl()
  return `${base}/#/respond?t=${encodeURIComponent(token)}&m=${encodeURIComponent(milestoneId)}`
}

function milestoneLabel(id) {
  return MILESTONES.find(m => m.id === id)?.name || id
}

// Get template subject/body — checks DB override first, falls back to default
async function resolveTemplate(templateKey, defaults) {
  try {
    const override = await getEmailTemplate(templateKey)
    if (override) return { subject: override.subject, body: override.body }
  } catch(e) { /* fall through to defaults */ }
  return defaults
}

let initialized = false
function init() {
  if (!initialized && PUBLIC_KEY) {
    emailjs.init(PUBLIC_KEY)
    initialized = true
  }
}

async function send(templateId, params) {
  init()
  if (!PUBLIC_KEY || !SERVICE_ID) {
    console.warn('EmailJS not configured — email not sent.', params)
    return { ok: false, message: 'EmailJS not configured' }
  }
  try {
    await emailjs.send(SERVICE_ID, templateId, params)
    return { ok: true }
  } catch (err) {
    console.error('EmailJS error', err)
    return { ok: false, message: err?.text || String(err) }
  }
}

export async function sendStudentEmail({ student, milestoneId, subject, message, response_link: customLink = null }) {
  // Use custom link if provided (e.g. check-ins), otherwise build from milestoneId
  const link = customLink !== null
    ? customLink
    : milestoneId ? responseLink(student.token, milestoneId) : ''

  return send(STUDENT_TPL, {
    to_email:      student.email,
    to_name:       student.name,
    subject,
    message,
    milestone:     milestoneId ? milestoneLabel(milestoneId) : 'Check-in',
    response_link: link,
  })
}

export async function sendSupervisorEmail({ supervisor, student, milestoneId, subject, message, response_link = '' }) {
  return send(SUPERVISOR_TPL, {
    to_email:      supervisor.email,
    to_name:       supervisor.name,
    student_name:  student.name,
    student_id:    student.student_id || student.email || '',
    subject,
    message,
    milestone:     milestoneId ? milestoneLabel(milestoneId) : 'General Communication',
    response_link,
  })
}

export async function sendReminder({ student, supervisor, milestoneId, dueDate }) {
  return send(REMINDER_TPL, {
    to_email:        student.email,
    to_name:         student.name,
    supervisor_name: supervisor?.name || '',
    milestone:       milestoneLabel(milestoneId),
    due_date:        dueDate || 'as soon as possible',
    response_link:   responseLink(student.token, milestoneId),
  })
}

export async function sendBulkReminders(students, milestoneId) {
  const results = []
  for (const s of students) {
    const r = await sendReminder({ student: s, supervisor: s.supervisors, milestoneId })
    results.push({ student: s.name, ...r })
    await new Promise(res => setTimeout(res, 300))
  }
  return results
}

// ── Research Impact Survey Email ─────────────────────────────────────────────
export async function sendResearchImpactEmail(student, appUrl) {
  init()
  if (!PUBLIC_KEY || !SERVICE_ID || !STUDENT_TPL) {
    console.warn('EmailJS not configured')
    return { ok: false, message: 'EmailJS not configured' }
  }
  try {
    const surveyLink = `${appUrl}/#/research-impact?t=${student.impact_token}`
    await emailjs.send(SERVICE_ID, STUDENT_TPL, {
      to_email:   student.email,
      to_name:    student.name,
      subject:    'Research Impact Declaration — Action Required',
      message:    `As part of Gulf Medical University's research outcome reporting, we kindly ask you to complete a short Research Impact Declaration for your thesis:\n\n"${student.thesis_title || 'Your Thesis'}"\n\nThis takes approximately 5 minutes. If your research has resulted in publications, presentations, industry collaborations, or other impacts, you will be asked to upload supporting evidence.`,
      response_link: surveyLink,
      milestone:  'Research Impact Survey',
    })
    return { ok: true }
  } catch(e) {
    return { ok: false, message: e.text || e.message }
  }
}

// ── Supervisor Research Impact Email ─────────────────────────────────────────
export async function sendSupervisorImpactEmail(student, supervisor, appUrl) {
  init()
  if (!PUBLIC_KEY || !SERVICE_ID || !SUPERVISOR_TPL) {
    return { ok: false, message: 'EmailJS not configured' }
  }
  try {
    const surveyLink = `${appUrl}/#/supervisor-research-impact?t=${student.supervisor_impact_token}`
    await emailjs.send(SERVICE_ID, SUPERVISOR_TPL, {
      to_email:      supervisor.email,
      to_name:       supervisor.name,
      student_name:  student.name,
      subject:       `Research Impact Confirmation Request — ${student.name}`,
      message:       `We kindly ask you to confirm the research impact for the following student thesis under your supervision:\n\n"${student.thesis_title || 'Student Thesis'}"\n\nAs the supervising academic, your confirmation is required as part of Gulf Medical University's research outcome reporting (KPI 4.4). You will be able to review what the student has already declared and add any additional impact evidence.\n\nThis takes approximately 5 minutes.`,
      response_link: surveyLink,
      milestone:     'Research Impact Confirmation',
    })
    return { ok: true }
  } catch(e) {
    return { ok: false, message: e.text || e.message }
  }
}
