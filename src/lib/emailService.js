import emailjs from '@emailjs/browser'
import { MILESTONES } from './supabase'

const PUBLIC_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const SERVICE_ID      = import.meta.env.VITE_EMAILJS_SERVICE_ID
const STUDENT_TPL     = import.meta.env.VITE_EMAILJS_STUDENT_TEMPLATE
const SUPERVISOR_TPL  = import.meta.env.VITE_EMAILJS_SUPERVISOR_TEMPLATE
const REMINDER_TPL    = import.meta.env.VITE_EMAILJS_REMINDER_TEMPLATE
const APP_URL         = import.meta.env.VITE_APP_URL || window.location.origin + '/thesis-tracker'

let initialized = false
function init() {
  if (!initialized && PUBLIC_KEY) {
    emailjs.init(PUBLIC_KEY)
    initialized = true
  }
}

function milestoneLabel(id) {
  return MILESTONES.find(m => m.id === id)?.name || id
}

function responseLink(token, milestoneId) {
  return `${APP_URL}/#/respond?t=${encodeURIComponent(token)}&m=${encodeURIComponent(milestoneId)}`
}

// ── Core sender ───────────────────────────────────────────────────────────────
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendStudentEmail({ student, milestoneId, subject, message }) {
  return send(STUDENT_TPL, {
    to_email:      student.email,
    to_name:       student.name,
    subject,
    message,
    milestone:     milestoneLabel(milestoneId),
    response_link: milestoneId ? responseLink(student.token, milestoneId) : '',
    app_url:       APP_URL,
  })
}

export async function sendSupervisorEmail({ supervisor, student, milestoneId, subject, message }) {
  return send(SUPERVISOR_TPL, {
    to_email:     supervisor.email,
    to_name:      supervisor.name,
    student_name: student.name,
    subject,
    message,
    milestone:    milestoneLabel(milestoneId),
    app_url:      APP_URL,
  })
}

export async function sendReminder({ student, supervisor, milestoneId, dueDate }) {
  const milestone = milestoneLabel(milestoneId)
  const params = {
    to_email:      student.email,
    to_name:       student.name,
    supervisor_email: supervisor?.email || '',
    supervisor_name:  supervisor?.name  || '',
    milestone,
    due_date:      dueDate || 'as soon as possible',
    response_link: responseLink(student.token, milestoneId),
    app_url:       APP_URL,
  }
  return send(REMINDER_TPL, params)
}

export async function sendBulkReminders(students, milestoneId) {
  const results = []
  for (const s of students) {
    const r = await sendReminder({
      student: s,
      supervisor: s.supervisors,
      milestoneId,
    })
    results.push({ student: s.name, ...r })
    await new Promise(res => setTimeout(res, 300)) // rate-limit
  }
  return results
}
