import { MILESTONES } from '../lib/supabase'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'

const STATUS_ICON = {
  completed: <CheckCircle2 size={14} className="text-emerald-400" />,
  in_progress: <Clock size={14} className="text-blue-400" />,
  overdue: <AlertCircle size={14} className="text-red-400" />,
  pending: <Circle size={14} className="text-navy-500" />,
}

const STATUS_COLOR = {
  completed:   'bg-emerald-500',
  in_progress: 'bg-blue-500',
  overdue:     'bg-red-500',
  pending:     'bg-navy-600',
}

export function MilestoneBar({ studentMilestones = [] }) {
  const map = Object.fromEntries(studentMilestones.map(sm => [sm.milestone_id, sm]))
  const completed = MILESTONES.filter(m => map[m.id]?.status === 'completed').length
  const pct = Math.round((completed / MILESTONES.length) * 100)

  return (
    <div className="space-y-1.5">
      <div className="flex gap-0.5">
        {MILESTONES.map((m, i) => {
          const sm = map[m.id]
          const status = sm?.status || 'pending'
          return (
            <div
              key={m.id}
              title={`${m.name}: ${status}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${STATUS_COLOR[status]} ${i === 0 ? 'rounded-l-full' : ''} ${i === MILESTONES.length - 1 ? 'rounded-r-full' : ''}`}
            />
          )
        })}
      </div>
      <p className="text-xs text-navy-400">{completed}/{MILESTONES.length} milestones · {pct}%</p>
    </div>
  )
}

export function MilestoneSteps({ studentMilestones = [], onUpdate }) {
  const map = Object.fromEntries(studentMilestones.map(sm => [sm.milestone_id, sm]))

  return (
    <div className="space-y-2">
      {MILESTONES.map((m, i) => {
        const sm = map[m.id]
        const status = sm?.status || 'pending'
        return (
          <div
            key={m.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all
              ${status === 'completed' ? 'border-emerald-700/30 bg-emerald-900/10' :
                status === 'overdue'   ? 'border-red-700/30 bg-red-900/10' :
                status === 'in_progress' ? 'border-blue-700/30 bg-blue-900/10' :
                'border-navy-700/40 bg-navy-800/20'
              }`}
          >
            <span className="text-navy-500 text-xs w-4 shrink-0">{i + 1}</span>
            <span className="text-base shrink-0">{m.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{m.name}</p>
              {sm?.completed_at && (
                <p className="text-xs text-navy-400">
                  Completed {new Date(sm.completed_at).toLocaleDateString()}
                </p>
              )}
              {sm?.due_date && status !== 'completed' && (
                <p className="text-xs text-navy-400">
                  Due {new Date(sm.due_date).toLocaleDateString()}
                </p>
              )}
              {sm?.notes && <p className="text-xs text-navy-400 truncate">{sm.notes}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {STATUS_ICON[status]}
              {onUpdate && (
                <select
                  value={status}
                  onChange={e => onUpdate(m.id, e.target.value)}
                  className="bg-navy-800 border border-navy-600/50 text-xs text-slate-300 rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
