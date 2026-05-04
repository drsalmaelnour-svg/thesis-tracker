import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { requestPasswordReset } from '../lib/auth'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch(err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{background:'linear-gradient(135deg,#0a1628 0%,#1e3a5f 50%,#0a1628 100%)'}}>
      <div className="absolute inset-0 opacity-5" style={{backgroundImage:'radial-gradient(circle at 2px 2px, #d4a843 1px, transparent 0)',backgroundSize:'40px 40px'}}/>
      <div className="relative w-full max-w-md">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-8 pt-8 pb-6 text-center border-b border-white/10"
            style={{background:'linear-gradient(180deg,rgba(212,168,67,0.08) 0%,transparent 100%)'}}>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={28} className="text-amber-400"/>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">Reset Password</h1>
            <p className="text-sm text-slate-400">Enter your email to receive a reset link</p>
          </div>

          <div className="px-8 py-7">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} className="text-emerald-400"/>
                </div>
                <p className="text-white font-semibold">Reset link sent</p>
                <p className="text-sm text-slate-400">Check your email — the link expires in 1 hour.</p>
                <button onClick={()=>navigate('/login')}
                  className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mx-auto transition-colors">
                  <ArrowLeft size={14}/> Back to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
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
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-900/20 border border-red-700/40">
                    <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-red-300">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={loading||!email}
                  className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{background:'#d4a843',color:'#0f1f36'}}>
                  {loading?<><Loader2 size={14} className="animate-spin"/>Sending…</>:'Send Reset Link'}
                </button>
                <button type="button" onClick={()=>navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
                  <ArrowLeft size={13}/> Back to login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
