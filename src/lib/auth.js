// ── Auth & Session ────────────────────────────────────────────────────────────
const SESSION_KEY = 'gmu_session'
const SESSION_TTL = 8 * 60 * 60 * 1000 // 8 hours

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (Date.now() > s.expires_at) { localStorage.removeItem(SESSION_KEY); return null }
    return s
  } catch { return null }
}

export function isLoggedIn()     { return getSession() !== null }
export function isAdmin()        { return getSession()?.role === 'admin' }
export function getDeptId()      { return getSession()?.department_id || null }
export function getRole()        { return getSession()?.role || null }
export function getCoordInfo()   { return getSession()?.coordinator || null }
export function getDeptInfo()    { return getSession()?.department || null }

export function setSession(data) {
  const s = { ...data, expires_at: Date.now() + SESSION_TTL }
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  return s
}

export function logout() { localStorage.removeItem(SESSION_KEY) }

export async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

export async function login(email, password) {
  const { supabase } = await import('./supabase')
  const hash = await hashPassword(password)
  const emailLower = email.trim().toLowerCase()

  // 1. Check admin
  const { data: config } = await supabase
    .from('system_config').select('*').single()

  if (config && config.admin_password_hash) {
    // Admin can log in with any email if password matches
    if (hash === config.admin_password_hash) {
      return setSession({
        role:        'admin',
        department_id: null,
        coordinator: { name: 'Admin', email: emailLower },
        department:  null,
        dean:        { name: config.dean_name, email: config.dean_email },
        institution: config.institution,
        college:     config.college,
      })
    }
  }

  // 2. Check department coordinator
  const { data: dept, error } = await supabase
    .from('departments')
    .select('*')
    .eq('coordinator_email', emailLower)
    .eq('active', true)
    .single()

  if (error || !dept) throw new Error('No account found for this email address.')
  if (!dept.coordinator_password_hash) throw new Error('Account not yet activated. Please contact the administrator.')
  if (hash !== dept.coordinator_password_hash) throw new Error('Email or password incorrect.')

  // Load dean info
  const { data: cfg } = await supabase.from('system_config').select('dean_name,dean_email,institution,college').single()

  return setSession({
    role:          'coordinator',
    department_id: dept.id,
    coordinator: {
      name:  dept.coordinator_name,
      title: dept.coordinator_title,
      email: dept.coordinator_email,
    },
    department: {
      id:      dept.id,
      name:    dept.name,
      program: dept.program,
      hod:     { name: dept.hod_name, email: dept.hod_email },
    },
    dean:        { name: cfg?.dean_name, email: cfg?.dean_email },
    institution: cfg?.institution || 'Gulf Medical University',
    college:     cfg?.college || 'College of Health Sciences',
  })
}
