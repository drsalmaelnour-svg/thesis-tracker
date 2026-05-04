// ── Auth & Session ────────────────────────────────────────────────────────────
const SESSION_KEY = 'gmu_session'
const SESSION_TTL = 8 * 60 * 60 * 1000 // 8 hours

export function getSession()     { try { const r=localStorage.getItem(SESSION_KEY); if(!r) return null; const s=JSON.parse(r); if(Date.now()>s.expires_at){localStorage.removeItem(SESSION_KEY);return null} return s } catch{return null} }
export function isLoggedIn()     { return getSession()!==null }
export function isAdmin()        { return getSession()?.role==='admin' }
export function isCoordinator()  { return getSession()?.role==='coordinator' }
export function isHOD()          { return getSession()?.role==='hod' }
export function isDean()         { return getSession()?.role==='dean' }
export function getRole()        { return getSession()?.role||null }
export function getDeptId()      { return getSession()?.department_id||null }
export function getDeptInfo()    { return getSession()?.department||null }
export function getUserInfo()    { return getSession()?.user||null }
export function logout()         { localStorage.removeItem(SESSION_KEY) }

export function setSession(data) {
  const s = { ...data, expires_at: Date.now()+SESSION_TTL }
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  return s
}

export async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

export async function switchRole(newRole) {
  const session = getSession()
  if (!session) return
  // Allow switching between admin and coordinator if user has dual_role flag
  if (!session.dual_role) return
  const updated = { ...session, role: newRole, expires_at: Date.now() + 8*60*60*1000 }
  localStorage.setItem('gmu_session', JSON.stringify(updated))
  return updated
}

export function getAvailableRoles() {
  const s = getSession()
  if (!s?.dual_role) return [s?.role].filter(Boolean)
  return s.dual_roles || [s.role]
}

export async function login(email, password) {
  const { supabase } = await import('./supabase')
  const emailLower = email.trim().toLowerCase()
  const hash = await hashPassword(password)

  // Find user
  const { data: user, error } = await supabase
    .from('users')
    .select('*, departments(id,name,program,primary_color,accent_color,bg_color,hod_name,hod_email,coordinator_name,coordinator_email)')
    .eq('email', emailLower)
    .eq('active', true)
    .single()

  if (error || !user) throw new Error('No account found for this email address.')
  if (!user.password_hash) throw new Error('Account not yet activated. Please check your invitation email.')
  if (hash !== user.password_hash) throw new Error('Email or password incorrect.')

  // Load dean + config
  const { data: cfg } = await supabase.from('system_config').select('*').single()
  const { data: dean } = await supabase.from('users').select('name,email').eq('role','dean').eq('active',true).single()

  // Update last login
  await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id)

  // Check if this user also has a coordinator record (dual role)
  // Admin with coordinator role in a department
  const isDualRole = user.role === 'admin' && user.department_id
  const availableRoles = isDualRole ? ['admin', 'coordinator'] : [user.role]

  const dept = user.departments
  return setSession({
    user_id:       user.id,
    role:          user.role,
    department_id: user.department_id,
    dual_role:     isDualRole,
    dual_roles:    availableRoles,
    user: { id:user.id, name:user.name, title:user.title, email:user.email },
    department: dept ? {
      id:            dept.id,
      name:          dept.name,
      program:       dept.program,
      hod:           { name: dept.hod_name, email: dept.hod_email },
      primary_color: dept.primary_color || '#1e3a5f',
      accent_color:  dept.accent_color  || '#d4a843',
      bg_color:      dept.bg_color      || '#f1f5f9',
    } : null,
    dean:        dean ? { name: dean.name, email: dean.email } : { name: cfg?.dean_name, email: cfg?.dean_email },
    institution: cfg?.institution || 'Gulf Medical University',
    college:     cfg?.college     || 'College of Health Sciences',
  })
}

export async function requestPasswordReset(email) {
  const { supabase } = await import('./supabase')
  const emailLower = email.trim().toLowerCase()

  const { data: user } = await supabase.from('users').select('id,name').eq('email',emailLower).eq('active',true).single()
  if (!user) throw new Error('No account found for this email address.')

  // Delete old tokens
  await supabase.from('password_resets').delete().eq('user_id', user.id)

  // Create new token
  const { data: reset } = await supabase.from('password_resets')
    .insert({ user_id: user.id }).select('token').single()

  const resetLink = `${window.location.origin}${window.location.pathname}#/reset-password?token=${reset.token}`

  // Send email via EmailJS
  const { sendStudentEmail } = await import('./emailService')
  await sendStudentEmail({
    student: { name: user.name, email: emailLower, token: '' },
    milestoneId: null,
    subject: 'Password Reset — Thesis Coordination System',
    message: `Dear ${user.name},\n\nA password reset was requested for your account.\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThesis Coordination System\nGulf Medical University`,
  })
}

export async function resetPassword(token, newPassword) {
  const { supabase } = await import('./supabase')
  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.')

  const { data: reset, error } = await supabase
    .from('password_resets')
    .select('*, users(id,email)')
    .eq('token', token)
    .eq('used', false)
    .single()

  if (error || !reset) throw new Error('Invalid or expired reset link.')
  if (new Date(reset.expires_at) < new Date()) throw new Error('This reset link has expired. Please request a new one.')

  const hash = await hashPassword(newPassword)
  await supabase.from('users').update({ password_hash: hash, is_temp_password: false }).eq('id', reset.user_id)
  await supabase.from('password_resets').update({ used: true }).eq('id', reset.id)
}

export async function inviteUser({ name, title, email, role, department_id }) {
  const { supabase } = await import('./supabase')

  // Generate temp password
  const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!'
  const hash = await hashPassword(tempPassword)

  const { data: user, error } = await supabase.from('users').upsert({
    email: email.trim().toLowerCase(),
    password_hash: hash,
    role, name, title,
    department_id: department_id || null,
    is_temp_password: true,
    active: true,
    invited_by: getUserInfo()?.email || 'admin',
  }, { onConflict: 'email' }).select().single()

  if (error) throw new Error(error.message)

  // Get department name
  let deptName = ''
  if (department_id) {
    const { data: dept } = await supabase.from('departments').select('name').eq('id', department_id).single()
    deptName = dept?.name || ''
  }

  const loginUrl = `${window.location.origin}${window.location.pathname}`
  const roleLabel = role === 'coordinator' ? 'Thesis Coordinator' : role === 'hod' ? 'Head of Department' : role === 'dean' ? 'Dean' : role

  // Send invitation email
  const { sendStudentEmail } = await import('./emailService')
  await sendStudentEmail({
    student: { name, email: email.trim().toLowerCase(), token: '' },
    milestoneId: null,
    subject: `You have been added to the Thesis Coordination System — ${deptName || 'Gulf Medical University'}`,
    message: `Dear ${title ? title + ' ' : ''}${name},\n\nYou have been added to the Thesis Coordination System at Gulf Medical University as ${roleLabel}${deptName ? ` for the Department of ${deptName}` : ''}.\n\nYour login credentials:\n\nURL:      ${loginUrl}\nEmail:    ${email.trim().toLowerCase()}\nPassword: ${tempPassword}\n\nPlease log in at your earliest convenience. You can change your password from Settings after logging in.\n\nBest regards,\nDr. Salma Elnour\nThesis Coordinator\nGulf Medical University`,
  })

  return user
}
