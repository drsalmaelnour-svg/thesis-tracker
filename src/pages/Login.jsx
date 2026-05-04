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
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{background:'linear-gradient(135deg,#0a1628 0%,#1e3a5f 50%,#0a1628 100%)'}}>

      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage:'radial-gradient(circle at 2px 2px, #d4a843 1px, transparent 0)',
        backgroundSize:'40px 40px'
      }}/>

      <div className="relative w-full max-w-md">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-white/10"
            style={{background:'linear-gradient(180deg,rgba(212,168,67,0.08) 0%,transparent 100%)'}}>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={32} className="text-amber-400"/>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Thesis Coordination System</h1>
            <p className="text-sm text-slate-400">Gulf Medical University — College of Health Sciences</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                <input type="email" required autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none"
                  style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)'}}
                  placeholder="your.email@gmu.ac.ae"
                  value={email} onChange={e=>setEmail(e.target.value)}
                  onFocus={e=>e.target.style.borderColor='rgba(212,168,67,0.5)'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
                <input type={showPw?'text':'password'} required
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder-slate-600 outline-none"
                  style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)'}}
                  placeholder="••••••••"
                  value={password} onChange={e=>setPassword(e.target.value)}
                  onFocus={e=>e.target.style.borderColor='rgba(212,168,67,0.5)'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-900/20 border border-red-700/40">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading||!email||!password}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:'#d4a843',color:'#0f1f36'}}>
              {loading ? <><Loader2 size={14} className="animate-spin"/> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-slate-700">Thesis Coordination System · Gulf Medical University</p>
          </div>
        </div>
      </div>
    </div>
  )
}
