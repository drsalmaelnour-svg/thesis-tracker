import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, GraduationCap } from 'lucide-react'
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
      setMessage('Invalid link. Please check your email and try again.')
      return
    }

    respondViaToken(token, milestoneId)
      .then(s => {
        setStudent(s)
        setStatus('success')
      })
      .catch(err => {
        setStatus('error')
        setMessage(err.message || 'Something went wrong. Please contact the coordinator.')
      })
  }, [token, milestoneId])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-10 text-center fade-in shadow-2xl border-navy-600/60">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gold-500/20 border border-gold-500/40 flex items-center justify-center mx-auto mb-6">
          <GraduationCap size={26} className="text-gold-400" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={36} className="text-gold-400 animate-spin mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-slate-100 mb-2">Confirming…</h2>
            <p className="text-navy-400 text-sm">Processing your milestone confirmation.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold text-slate-100 mb-2">Confirmed!</h2>
            {student && <p className="text-navy-400 text-sm mb-4">Hi {student.name},</p>}
            <p className="text-slate-300 mb-2">
              Your milestone has been marked as complete:
            </p>
            {milestone && (
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3 mt-3 mb-6">
                <span className="text-2xl">{milestone.icon}</span>
                <p className="text-emerald-300 font-medium mt-1">{milestone.name}</p>
              </div>
            )}
            <p className="text-navy-400 text-xs leading-relaxed">
              Your thesis coordinator has been notified. You can close this page.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold text-slate-100 mb-2">Link Error</h2>
            <p className="text-navy-400 text-sm mb-6 leading-relaxed">{message}</p>
            <p className="text-navy-500 text-xs">
              Please contact your thesis coordinator for assistance.
            </p>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-navy-700/50">
          <p className="text-xs text-navy-500">Thesis Coordination System</p>
        </div>
      </div>
    </div>
  )
}
