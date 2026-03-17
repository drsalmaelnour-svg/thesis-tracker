import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, CheckCircle2, Clock, AlertCircle, TrendingUp,
  ArrowRight, GraduationCap, RefreshCw
} from 'lucide-react'
import { getStudentsWithProgress, MILESTONES } from '../lib/supabase'
import { MilestoneBar } from '../components/MilestoneProgress'

function StatCard({ icon: Icon, label, value, sub, color = 'gold' }) {
  const colors = {
    gold:    'text-gold-400 bg-gold-500/10 border-gold-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    red:     'text-red-400 bg-red-500/10 border-red-500/20',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-navy-400 font-medium uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-display font-semibold text-slate-100">{value}</p>
          {sub && <p className="text-xs text-navy-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const data = await getStudentsWithProgress()
      setStudents(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Compute stats
  const totalMilestones = students.length * MILESTONES.length
  const completedAll    = students.flatMap(s => s.student_milestones || []).filter(m => m.status === 'completed').length
  const overdueAll      = students.flatMap(s => s.student_milestones || []).filter(m => m.status === 'overdue').length
  const nearComplete    = students.filter(s => {
    const done = (s.student_milestones || []).filter(m => m.status === 'completed').length
    return done >= MILESTONES.length - 1 && done < MILESTONES.length
  }).length

  // Recent activity
  const recentActivity = students
    .flatMap(s =>
      (s.student_milestones || [])
        .filter(sm => sm.completed_at)
        .map(sm => ({ student: s, sm }))
    )
    .sort((a, b) => new Date(b.sm.completed_at) - new Date(a.sm.completed_at))
    .slice(0, 5)

  // Students with overdue milestones
  const overdueStudents = students.filter(s =>
    (s.student_milestones || []).some(m => m.status === 'overdue')
  )

  return (
    <div className="p-8 space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-navy-400 mt-1">Overview of thesis coordination progress</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Total Students"      value={students.length}  color="gold" />
        <StatCard icon={CheckCircle2} label="Milestones Completed" value={completedAll}    sub={`of ${totalMilestones} total`} color="emerald" />
        <StatCard icon={AlertCircle} label="Overdue"              value={overdueAll}       color="red" />
        <StatCard icon={GraduationCap} label="Near Completion"   value={nearComplete}      sub="≥6/7 milestones done" color="blue" />
      </div>

      {/* Progress Overview + Alerts */}
      <div className="grid grid-cols-3 gap-6">
        {/* Student Progress */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-slate-100">Student Progress</h2>
            <Link to="/students" className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-navy-800/40 shimmer" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-navy-500">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No students yet. Add your first student to get started.</p>
              <Link to="/students" className="btn-primary mt-4 inline-flex">
                <Users size={14} /> Add Students
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {students.slice(0, 6).map(student => {
                const milestones = student.student_milestones || []
                const done = milestones.filter(m => m.status === 'completed').length
                return (
                  <Link key={student.id} to={`/students/${student.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-navy-800/40 transition-all group">
                    <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-semibold text-gold-400 shrink-0">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-slate-200 group-hover:text-gold-300 transition-colors truncate">
                          {student.name}
                        </p>
                        <span className="text-xs text-navy-400 shrink-0 ml-2">{done}/{MILESTONES.length}</span>
                      </div>
                      <MilestoneBar studentMilestones={milestones} />
                    </div>
                    <ArrowRight size={14} className="text-navy-500 group-hover:text-gold-400 transition-colors shrink-0" />
                  </Link>
                )
              })}
              {students.length > 6 && (
                <Link to="/students" className="block text-center text-xs text-navy-400 hover:text-gold-400 pt-2">
                  +{students.length - 6} more students →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Overdue Alerts */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400" /> Needs Attention
            </h2>
            {overdueStudents.length === 0 ? (
              <p className="text-sm text-navy-500">All students are on track 🎉</p>
            ) : (
              <div className="space-y-2">
                {overdueStudents.slice(0, 4).map(s => (
                  <Link key={s.id} to={`/students/${s.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-900/10 transition-all group">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-sm text-slate-300 group-hover:text-red-300 transition-colors truncate">{s.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-gold-400" /> Recent Activity
            </h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-navy-500">No recent completions.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(({ student, sm }, i) => {
                  const m = MILESTONES.find(x => x.id === sm.milestone_id)
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{m?.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">{student.name}</p>
                        <p className="text-xs text-navy-400 truncate">{m?.name}</p>
                        <p className="text-xs text-navy-500">
                          {new Date(sm.completed_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
