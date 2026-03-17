import emailjs from '@emailjs/browser'
import { MILESTONES } from './supabase'

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

export async function sendStudentEmail({ student, milestoneId, subject, message }) {
  return send(STUDENT_TPL, {
    to_email:      student.email,
    to_name:       student.name,
    subject,
    message,
    milestone:     milestoneLabel(milestoneId),
    response_link: milestoneId ? responseLink(student.token, milestoneId) : '',
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
