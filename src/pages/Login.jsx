import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { login } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch(err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'var(--bg-base)',
      backgroundImage:
        'radial-gradient(1100px 500px at 8% -8%, var(--bg-glow-1) 0%, transparent 55%),' +
        'radial-gradient(900px 460px at 100% 10%, var(--bg-glow-2) 0%, transparent 50%),' +
        'radial-gradient(1000px 600px at 60% 115%, var(--bg-glow-3) 0%, transparent 55%)'}}>

      <div className="relative w-full max-w-md fade-in">
        <div className="card overflow-hidden" style={{boxShadow:'0 40px 70px -30px rgba(0,0,0,0.5)'}}>

          <div className="px-8 pt-9 pb-7 text-center" style={{borderBottom:'1px solid var(--hair)'}}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:'var(--status-warn-bg)', border:'1px solid var(--status-warn-brd)',
                boxShadow:'0 8px 20px var(--status-warn-bg)'}}>
              <GraduationCap size={26} style={{color:'var(--gold-accent)'}}/>
            </div>
            <h1 className="font-display text-2xl font-medium mb-1.5" style={{color:'var(--ink)'}}>Thesis Coordination System</h1>
            <p className="text-sm" style={{color:'var(--ink-faint)'}}>Medical Laboratory Sciences · Gulf Medical University</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{color:'var(--ink-faint)'}}>Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--ink-faint)'}}/>
                <input type="email" required autoFocus
                  className="input pl-10"
                  placeholder="your.email@gmu.ac.ae"
                  value={email} onChange={e=>setEmail(e.target.value)}/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{color:'var(--ink-faint)'}}>Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--ink-faint)'}}/>
                <input type={showPw?'text':'password'} required
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password} onChange={e=>setPassword(e.target.value)}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{color:'var(--ink-faint)'}}>
                  {showPw?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl tone-badge-bad">
                <AlertCircle size={13} className="shrink-0 mt-0.5"/>
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading||!email||!password} className="btn-primary w-full justify-center py-3">
              {loading ? <><Loader2 size={14} className="animate-spin"/> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <div className="px-8 pb-7 text-center space-y-2">
            <a href="#/forgot-password" className="text-xs transition-colors" style={{color:'var(--gold-accent)'}}>
              Forgot your password?
            </a>
            <p className="text-xs" style={{color:'var(--ink-faint)'}}>Thesis Coordination System · Gulf Medical University</p>
          </div>
        </div>
      </div>
    </div>
  )
}
