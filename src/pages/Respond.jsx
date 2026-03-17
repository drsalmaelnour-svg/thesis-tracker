import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, GraduationCap, ArrowRight } from 'lucide-react'
import { respondViaToken, MILESTONES } from '../lib/supabase'

export default function Respond() {
  const [params] = useSearchParams()
  const token = params.get('t')
  const milestoneId = params.get('m')

  const [status, setStatus] = useState('loading') // loading | success | error
  const [student, setStudent] = useState(null)
  const [message, setMessage] = useState('')

  const milestone = MILESTONES.find(m => m.id === milestoneId)

  useEffect(() => {
    if (!token || !milestoneId) {
      setStatus('error')
      setMessage('This link appears to be invalid or incomplete. Please contact your thesis coordinator.')
      return
    }

    respondViaToken(token, milestoneId)
      .then(s => {
        setStudent(s)
        setStatus('success')
      })
      .catch(err => {
        setStatus('error')
        setMessage(err.message || 'Something went wrong. Please contact your thesis coordinator.')
      })
  }, [token, milestoneId])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #0f1f36 0%, #1e3a5f 50%, #0f1f36 100%)'
      }}
    >
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-10 text-center shadow-2xl">

          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-8">
            <GraduationCap size={30} className="text-amber-400" />
          </div>

          {/* LOADING */}
          {status === 'loading' && (
            <div className="space-y-4">
              <Loader2 size={40} className="text-amber-400 animate-spin mx-auto" />
              <p className="text-slate-300 text-lg font-medium">Confirming your milestone…</p>
              <p className="text-slate-500 text-sm">This will only take a moment.</p>
            </div>
          )}

          {/* SUCCESS */}
          {status === 'success' && (
            <div className="space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  Confirmed!
                </h1>
                {student && (
                  <p className="text-slate-400 text-sm">Thank you, {student.name}</p>
                )}
              </div>

              {milestone && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-4 mt-2">
                  <p className="text-3xl mb-2">{milestone.icon}</p>
                  <p className="text-emerald-300 font-semibold text-lg">{milestone.name}</p>
                  <p className="text-emerald-500 text-sm mt-1">Marked as complete</p>
                </div>
              )}

              <div className="bg-white/5 rounded-2xl px-5 py-4 mt-4">
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your thesis coordinator has been notified of your progress. 
                  You can now close this page.
                </p>
              </div>
            </div>
          )}

          {/* ERROR */}
          {status === 'error' && (
            <div className="space-y-5">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center mx-auto">
                <XCircle size={32} className="text-red-400" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Link Error</h1>
                <p className="text-slate-400 text-sm leading-relaxed mt-3">{message}</p>
              </div>

              <div className="bg-white/5 rounded-2xl px-5 py-4">
                <p className="text-slate-500 text-sm">
                  If you think this is a mistake, please reply to the email you received 
                  or contact your thesis coordinator directly.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          Thesis Coordination System · {new Date().getFullYear()}
        </p>

      </div>
    </div>
  )
}
