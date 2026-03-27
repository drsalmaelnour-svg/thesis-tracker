import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, GraduationCap, Send, Shield } from 'lucide-react'

// ── Rubric data ───────────────────────────────────────────────────────────────
const FORMS = {
  proposal_defense: {
    title: 'Proposal Defense — Evaluation Form',
    course: 'Thesis 1', type: 'scored', maxScore: 32,
    sections: [
      { title: 'Section A — Research content', criteria: [
        { name: 'Title, Background & Introduction', sub: 'Clarity of title, relevance of background, strength of contextual framing',
          descs: ['Title fully self-explanatory; outstanding background with strong contextual relevance and depth','Clear title; good background with adequate depth and relevance; minor gaps','Adequate title and background; could be more focused or detailed in parts','Title unclear or irrelevant; background weak, missing or lacks context'] },
        { name: 'Research Gap, Objectives & Questions', sub: 'Justification of gap, specificity of objectives, alignment with research problem',
          descs: ['Research gap thoroughly justified; objectives specific, measurable and fully aligned with problem','Clear gap identified; objectives clear but with minor alignment or specificity issues','Gap identified but lacks depth; objectives stated but not thoroughly developed','No clear research gap or objectives; poorly defined, missing or irrelevant'] },
        { name: 'Methodology, Sample & Study Design', sub: 'Appropriateness of design, sample size justification, inclusion/exclusion criteria, tool validity',
          descs: ['Rigorous, well-justified methodology; all design elements clearly defined and highly appropriate','Appropriate methodology with good justification; minor gaps in detail or description','Methodology present but lacks coherence, critical details or full justification','No methodology or clearly inappropriate approach; major gaps throughout'] },
        { name: 'Ethical Considerations, Significance & Feasibility', sub: 'IRB awareness, clinical relevance to MLS, innovation, realistic timeline and resources',
          descs: ['Full ethical plan; high clinical relevance and innovation for MLS; highly feasible timeline','Ethical considerations addressed; good relevance to MLS; mostly feasible plan','Some ethical awareness; limited relevance or innovation; feasibility unclear','Ethical considerations absent; no clear significance to MLS or feasibility plan'] },
      ]},
      { title: 'Section B — Presentation quality', criteria: [
        { name: 'Logical Structure & Organisation', sub: 'Flow from introduction to conclusion, cohesion of all sections, clarity of visual aids',
          descs: ['Excellent structure; all sections cohesive and logically connected; outstanding visual aids','Good structure with minor flow issues; visual aids clear and adequate','Adequate organisation but some sections poorly connected; visuals need improvement','Disorganised; difficult to follow; poor or absent visual aids throughout'] },
        { name: 'Clarity of Delivery & Communication', sub: 'Confidence, articulation, time management, ability to engage the audience',
          descs: ['Highly confident, articulate, excellent time management; fully engaged the audience','Good delivery with minor issues in confidence or time management; mostly engaging','Adequate delivery but lacks confidence or clarity in parts; some audience disengagement','Poor delivery; disorganised; unable to engage audience or manage time effectively'] },
        { name: 'Response to Examiner Questions', sub: 'Depth of understanding, confidence, accuracy and appropriateness of answers',
          descs: ['Confident and accurate responses demonstrating deep understanding and critical insight','Answers questions adequately but with some hesitation or minor knowledge gaps','Vague answers; lacks confidence; limited depth of understanding demonstrated','Unable to answer or provides irrelevant, inaccurate responses to questions'] },
      ]},
      { title: 'Section C — Academic standards', criteria: [
        { name: 'References, Citations & Academic Writing', sub: 'Completeness, correct formatting, relevance of sources, academic language quality',
          descs: ['All references properly formatted, relevant and complete; excellent academic writing throughout','References adequate with minor formatting or completeness issues; writing mostly strong','References incomplete or with formatting errors; academic writing needs improvement','No references or citations; academic writing significantly below expected standard'] },
      ]},
    ],
    recOptions: ['Pass','Pass with Minor Revisions','Pass with Major Revisions','Fail — Resubmit'],
  },
  progress_1: {
    title: 'First Progress Report — Evaluation Form',
    course: 'Thesis 2', type: 'scored', maxScore: 32,
    sections: [
      { title: 'Section A — Research progress', criteria: [
        { name: 'Introduction, Background & Research Gap', sub: 'Clarity of introduction, justification of research gap, contextual relevance to MLS',
          descs: ['Precise, clear and relevant introduction; research gap thoroughly justified with strong MLS context','Well-organised introduction; gap identified with good justification; minor gaps','Adequate introduction but could be more focused; gap present but lacks depth','Unclear or off-topic introduction; no clear research gap identified'] },
        { name: 'Objectives, Methodology & Study Design', sub: 'Clarity of objectives, appropriateness of methodology, sample size and tool validity',
          descs: ['Objectives specific and measurable; methodology rigorous, appropriate and fully justified','Objectives clear; methodology appropriate with minor gaps in detail or justification','Objectives stated but not fully developed; methodology lacks coherence or key details','No clear objectives; inappropriate, unclear or absent methodology'] },
        { name: 'Literature Review', sub: 'Depth and breadth of review, critical analysis of key sources, relevance to study objectives',
          descs: ['Excellent review; all key sources critically analysed and integrated; highly relevant to objectives','Good review with most key sources included; adequate critical analysis; mostly relevant','Basic review; some key sources included but lacking depth or critical analysis','No evidence of relevant literature search; key sources absent; no critical analysis'] },
        { name: 'Data Collection Progress & Timeline Adherence', sub: 'Status of data collection, adherence to planned timeline, justification of any deviations',
          descs: ['On track or ahead of schedule; any deviations clearly justified with a revised plan','Minor deviations from timeline with adequate explanation; largely on track','Behind schedule; limited justification for delays; no revised plan provided','Significant delays with no explanation; data collection not meaningfully progressed'] },
      ]},
      { title: 'Section B — Challenges & support needs', criteria: [
        { name: 'Identification of Challenges & Obstacles', sub: 'Clarity in articulating problems faced — academic, practical, ethical or logistical barriers',
          descs: ['Challenges clearly and specifically articulated; student demonstrates strong self-awareness of barriers','Challenges identified with adequate detail; most barriers articulated clearly','Challenges mentioned but vaguely; lacks specificity or clear identification of barriers','Unable to identify or articulate challenges clearly; no awareness of obstacles'] },
        { name: 'Support Needs & Proposed Solutions', sub: 'Awareness of support required, whether student has proposed solutions or sought guidance',
          descs: ['Clear understanding of support needed; concrete solutions proposed; proactively sought guidance','Support needs identified; some solutions proposed; guidance partially sought','Aware of needing support but no clear plan or solutions articulated','No awareness of support needs or any proposed course of action'] },
      ]},
      { title: 'Section C — Presentation', criteria: [
        { name: 'Quality of Presentation & Delivery', sub: 'Organisation, clarity, slide quality, time management and overall preparedness',
          descs: ['Exceptionally organised; all points clearly presented in logical sequence; outstanding slides','Organised and clear with adequate slides; minor missing elements or time issues','Partially organised; lacks clarity or key elements; slides need improvement','Disorganised; poorly prepared; major presentation and delivery deficiencies'] },
        { name: 'Response to Examiner Questions', sub: 'Depth of understanding, accuracy, confidence and appropriateness of responses',
          descs: ['Confident, accurate responses demonstrating deep understanding and insight','Answers questions adequately but with hesitation or minor knowledge gaps','Vague answers; lacks confidence or depth of understanding demonstrated','Unable to answer adequately or provides irrelevant, inaccurate responses'] },
      ]},
    ],
    recOptions: ['Pass','Pass with Minor Revisions','Pass with Major Revisions','Fail — Resubmit'],
  },
  progress_2: {
    title: 'Second Progress Report — Evaluation Form',
    course: 'Thesis 2', type: 'scored', maxScore: 36,
    sections: [
      { title: 'Section A — Research development', criteria: [
        { name: 'Follow-up on First Report Comments & Challenges', sub: 'Evidence first report feedback addressed; resolution of previously identified challenges',
          descs: ['Thorough follow-up; all first report feedback addressed; significant improvements clearly evident','Most feedback addressed; improvements made but some gaps or issues remain','Minimal follow-up; few revisions made; first report issues largely persist','No follow-up; no revisions made; first report feedback entirely ignored'] },
        { name: 'Data Analysis, Results & Statistical Rigour', sub: 'Appropriateness of analysis, accuracy of interpretation, clarity of results presentation',
          descs: ['Thorough statistical analysis; clear and appropriate interpretation; results presented with excellent clarity','Adequate statistical analysis and interpretation; minor issues with clarity or depth','Basic statistical analysis; interpretation lacks clarity, rigour or depth','No statistical analysis or data interpretation present; results absent or inaccurate'] },
        { name: 'Validity & Clinical Interpretation of Findings', sub: 'Reliability of findings, clinical significance, relevance to MLS practice and patient outcomes',
          descs: ['Findings highly reliable; outstanding clinical significance; directly relevant to MLS practice','Good reliability and clinical relevance to MLS; minor interpretive gaps or limitations','Some clinical relevance but limited depth in interpretation; reliability concerns','No clinical interpretation; findings unreliable, absent or irrelevant to MLS'] },
        { name: 'Discussion, Limitations & Future Directions', sub: 'Depth of discussion, acknowledgement of limitations, clinical implications and future research',
          descs: ['Detailed and insightful discussion; limitations clearly acknowledged; strong future directions proposed','Discussion relevant and adequate; limitations covered; future directions mentioned','Discussion superficial; limitations partially acknowledged; future directions vague','No meaningful discussion; limitations absent; no future directions or implications'] },
      ]},
      { title: 'Section B — Progress toward completion', criteria: [
        { name: 'Outstanding Work, Remaining Challenges & Support Needs', sub: 'Clear identification of what remains, current obstacles and what support is needed to complete',
          descs: ['Outstanding tasks clearly specified; challenges identified with concrete, realistic support plan','Most remaining work identified; challenges noted with some support plan proposed','Vague about remaining work; limited identification of challenges or support needs','Unable to articulate what remains to be done or what support is needed'] },
        { name: 'Proposed Submission Timeline — Realistic & Justified', sub: 'Student presents a credible completion plan with a proposed submission date and milestone breakdown',
          descs: ['Detailed, realistic timeline with milestone breakdown; submission date clearly justified','Reasonable timeline with adequate detail; minor justification or planning gaps','Timeline proposed but lacks detail, milestones or realistic justification','No timeline proposed or timeline is clearly unrealistic with no justification'] },
      ]},
      { title: 'Section C — Presentation', criteria: [
        { name: 'Quality of Presentation & Delivery', sub: 'Organisation, clarity, visual aids, time management and overall preparedness',
          descs: ['Highly organised; all points clearly presented in logical sequence; excellent visual aids','Organised with adequate clarity and visuals; minor gaps in presentation elements','Partially organised; lacks clarity or key elements; delivery needs improvement','Disorganised; poorly prepared; major presentation and delivery deficiencies'] },
        { name: 'Response to Examiner Questions', sub: 'Depth of understanding, accuracy, confidence and appropriateness of responses',
          descs: ['Confident, accurate responses demonstrating deep understanding and insight throughout','Answers adequately but with some hesitation or minor knowledge gaps','Vague answers; lacks confidence or sufficient depth of understanding','Unable to answer or provides irrelevant, inaccurate responses'] },
      ]},
      { title: 'Section D — Academic standards', criteria: [
        { name: 'References, Citations & Academic Writing', sub: 'Completeness, correct formatting, academic language. Note: similarity index ≤15% is a prerequisite condition',
          descs: ['All references properly formatted and complete; excellent academic writing throughout','References adequate with minor formatting issues; academic writing mostly strong','References incomplete or with formatting errors; writing needs improvement','Major referencing failures; writing significantly below academic standard'] },
      ]},
    ],
    hasProposedDate: true,
    recOptions: ['Pass','Pass with Minor Revisions','Pass with Major Revisions','Fail — Resubmit'],
  },
  defense_before: {
    title: 'Thesis Defense Before — Formative Evaluation',
    course: 'Thesis 2', type: 'formative',
    checklistItems: [
      'Title, Abstract & Introduction',
      'Literature Review & Theoretical Framework',
      'Methodology & Ethical Compliance',
      'Results & Data Presentation',
      'Discussion, Conclusion & Limitations',
      'References, Formatting & Similarity Index',
      'Overall Thesis Coherence & Originality',
    ],
    recOptions: ['Ready to proceed to oral defense','Proceed with minor corrections noted','Major revisions required before defense','Not ready — substantial rework needed'],
  },
  defense_after: {
    title: 'Thesis Defense After — Final Evaluation Form',
    course: 'Thesis 2', type: 'scored', maxScore: 40,
    sections: [
      { title: 'Section A — Written thesis quality', criteria: [
        { name: 'Introduction & Literature Review', sub: 'Depth, critical analysis, relevance, identification of research gap, theoretical framework',
          descs: ['Outstanding depth; all key literature critically analysed; exceptional theoretical framework','Good depth; most literature covered with adequate critical analysis; solid framework','Adequate but lacks depth; some key literature missing or not critically analysed','Superficial; major literature gaps; no meaningful theoretical framework present'] },
        { name: 'Methodology & Research Design', sub: 'Rigour, appropriateness, ethical compliance, sample justification, tool validity',
          descs: ['Highly rigorous; all design elements fully justified; complete ethical compliance throughout','Appropriate methodology with good justification; minor gaps in detail or ethics','Methodology present but lacks detail, rigour or some ethical compliance issues','Inappropriate or absent methodology; ethical compliance not adequately addressed'] },
        { name: 'Results, Analysis & Statistical Rigour', sub: 'Accuracy of results, appropriateness of statistical methods, clarity of data presentation',
          descs: ['Results highly accurate; statistical methods perfectly appropriate; outstanding data presentation','Accurate results; appropriate statistics; minor issues in presentation or clarity','Results present but analysis lacks rigour, accuracy or adequate clarity','Results inaccurate; inappropriate statistical analysis; data presentation inadequate'] },
        { name: 'Discussion, Conclusion & Clinical Implications', sub: 'Interpretation of findings, limitations, clinical relevance to MLS, future research directions',
          descs: ['Outstanding discussion; limitations fully acknowledged; strong clinical implications for MLS','Good discussion; most key points covered; adequate clinical relevance to MLS','Discussion present but superficial; clinical implications underdeveloped or vague','No meaningful discussion; limitations absent; no clinical implications stated'] },
        { name: 'Originality & Contribution to the Field', sub: 'Independent thinking, novelty of findings, significance to MLS practice and knowledge base',
          descs: ['Significant original contribution; findings advance MLS knowledge; exceptional independent thinking','Clear contribution with some original aspects; good independent thinking demonstrated','Some originality but limited contribution to the field; mostly derivative work','No original contribution; work largely derivative; no advancement of MLS knowledge'] },
        { name: 'Response to Prior Examiner Corrections', sub: 'Thoroughness and accuracy in addressing corrections from the formative (Before) evaluation',
          descs: ['All corrections thoroughly and accurately addressed; significant improvements clearly evident','Most corrections addressed; improvements visible but some gaps or omissions remain','Some corrections addressed; many first evaluation issues still persist','Corrections largely ignored; no meaningful improvements made to the thesis'] },
      ]},
      { title: 'Section B — Oral defense performance', criteria: [
        { name: 'Presentation Quality & Structure', sub: 'Organisation, clarity, effective use of visuals, time management and academic delivery',
          descs: ['Exceptional presentation; outstanding visual aids; perfect time management; highly professional','Good presentation with minor issues in visuals, clarity or time management','Adequate presentation; some organisational or delivery weaknesses evident','Poor presentation; disorganised; ineffective visual aids or time management'] },
        { name: 'Response to Examiner Questions', sub: 'Depth of understanding, accuracy, confidence and appropriateness of responses under examination',
          descs: ['Outstanding responses; demonstrates deep understanding; highly confident and accurate throughout','Good responses with minor hesitations or knowledge gaps during questioning','Vague or superficial responses; lacks confidence or sufficient depth','Unable to answer adequately; responses inaccurate, irrelevant or incomplete'] },
      ]},
      { title: 'Section C — Academic standards', criteria: [
        { name: 'References, Citations & Academic Writing Quality', sub: 'Completeness, correct formatting per GMU style guide, academic language and consistency',
          descs: ['All references complete and perfectly formatted; outstanding academic writing throughout','References adequate; academic writing mostly strong with minor issues','References incomplete or with errors; writing needs improvement in parts','Major referencing failures; writing significantly below academic standard'] },
        { name: 'Overall Thesis Coherence & Professional Presentation', sub: 'Logical flow as a whole, formatting compliance with GMU Thesis Manual, professional quality',
          descs: ['Thesis reads as a seamless whole; fully compliant with GMU Manual; exceptional professional quality','Good overall coherence; mostly compliant with GMU Manual; minor formatting issues','Some coherence; partial compliance with GMU Manual; presentation needs improvement','Poor coherence; major formatting non-compliance; not professionally presented'] },
      ]},
    ],
    recOptions: ['Pass','Pass with Minor Revisions','Pass with Major Revisions','Fail — Resubmit'],
  },
}

const SCORE_LABELS = ['Exceptional','Meets Expectations','Needs Revision','Inadequate']
const SCORE_COLORS = {
  4: { bg:'#dcfce7', border:'#166534', text:'#166534', num:'#166534' },
  3: { bg:'#dbeafe', border:'#1e40af', text:'#1e40af', num:'#1e40af' },
  2: { bg:'#fef3c7', border:'#92400e', text:'#92400e', num:'#92400e' },
  1: { bg:'#fee2e2', border:'#991b1b', text:'#991b1b', num:'#991b1b' },
}

export default function ExaminerResponse() {
  const [params] = useSearchParams()
  const token    = params.get('t')

  const [stage,      setStage]      = useState('loading')
  const [assignment, setAssignment] = useState(null)
  const [student,    setStudent]    = useState(null)
  const [examiner,   setExaminer]   = useState(null)
  const [group,      setGroup]      = useState(null)
  const [errorMsg,   setErrorMsg]   = useState('')

  // Form state
  const [scores,      setScores]      = useState({})
  const [checks,      setChecks]      = useState({})
  const [checkNotes,  setCheckNotes]  = useState({})
  const [comments,    setComments]    = useState('')
  const [proposedDate,setProposedDate]= useState('')
  const [recommendation, setRec]     = useState('')

  useEffect(() => {
    if (!token) { setErrorMsg('Invalid link. Please contact your thesis coordinator.'); setStage('error'); return }
    async function init() {
      try {
        const { supabase } = await import('../lib/supabase')
        // Load assignment by token
        const { data: asgn, error } = await supabase
          .from('assessment_assignments')
          .select(`*, students ( id, name, email, student_id, program, enrollment_year, supervisors(id,name,email) ), external_examiners(id,name,email,designation,institution)`)
          .eq('token', token)
          .single()
        if (error || !asgn) throw new Error('Invalid or expired evaluation link.')

        // Check not already submitted
        const { data: existing } = await supabase
          .from('assessment_submissions')
          .select('id')
          .eq('assignment_id', asgn.id)
          .single()
        if (existing) { setAssignment(asgn); setStudent(asgn.students); setStage('already_submitted'); return }

        // Load examiner info
        let examinerData = null
        if (asgn.examiner_type === 'external') {
          examinerData = asgn.external_examiners
        } else {
          const { data: sup } = await supabase.from('supervisors').select('*').eq('id', asgn.examiner_id).single()
          examinerData = sup
        }

        // Load group info
        const { data: grp } = await supabase
          .from('milestone_groups')
          .select('*')
          .eq('milestone_id', asgn.assessment_type.replace('defense_','').replace('progress_','progress_'))
          .limit(1)
          .single()

        setAssignment(asgn)
        setStudent(asgn.students)
        setExaminer(examinerData)
        setGroup(grp)
        setStage('form')
      } catch(e) {
        setErrorMsg(e.message || 'Something went wrong.')
        setStage('error')
      }
    }
    init()
  }, [token])

  const formDef = assignment ? FORMS[assignment.assessment_type] : null
  const isFormative = formDef?.type === 'formative'

  // Calculate totals
  function calcTotals() {
    if (!formDef || isFormative) return { total: 0, max: 0, pct: 0, sections: {} }
    let total = 0
    const sections = {}
    formDef.sections.forEach(sec => {
      let st = 0
      sec.criteria.forEach(c => { if (scores[c.name]) { st += scores[c.name]; total += scores[c.name] } })
      sections[sec.title] = st
    })
    const max = formDef.maxScore
    return { total, max, pct: max ? Math.round(total/max*100) : 0, sections }
  }

  const totals = calcTotals()

  function validate() {
    if (!recommendation) return 'Please select a recommendation.'
    if (!isFormative) {
      if (!formDef) return 'Form not found.'
      for (const sec of formDef.sections) {
        for (const c of sec.criteria) {
          if (!scores[c.name]) return `Please score: ${c.name}`
        }
      }
    }
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { alert(err); return }
    setStage('submitting')
    try {
      const { supabase } = await import('../lib/supabase')
      const now = new Date()
      const submissionDate = now.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})

      await supabase.from('assessment_submissions').insert({
        assignment_id:   assignment.id,
        student_id:      student.id,
        assessment_type: assignment.assessment_type,
        scores:          scores,
        section_totals:  totals.sections,
        total_score:     totals.total,
        max_score:       totals.max,
        percentage:      totals.pct,
        comments,
        recommendation,
        checklist:       isFormative ? { checks, notes: checkNotes } : null,
        submission_date: submissionDate,
        submitted_at:    now.toISOString(),
      })

      // Mark submitted
      await supabase.from('assessment_assignments')
        .update({ email_sent_at: assignment.email_sent_at })
        .eq('id', assignment.id)

      setStage('success')
    } catch(e) {
      setErrorMsg(e.message || 'Submission failed.')
      setStage('error')
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  if (stage === 'loading') return (
    <Shell><div className="text-center py-16"><Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3"/><p className="text-slate-300">Verifying your link…</p></div></Shell>
  )
  if (stage === 'error') return (
    <Shell><div className="text-center py-16 space-y-4"><XCircle size={48} className="text-red-400 mx-auto"/><h2 className="text-xl font-bold text-white">Something went wrong</h2><p className="text-slate-400 text-sm">{errorMsg}</p><p className="text-slate-600 text-xs">Please contact Dr. Salma Elnour directly.</p></div></Shell>
  )
  if (stage === 'already_submitted') return (
    <Shell><div className="text-center py-16 space-y-4"><CheckCircle2 size={48} className="text-emerald-400 mx-auto"/><h2 className="text-xl font-bold text-white">Already Submitted</h2><p className="text-slate-400 text-sm">You have already submitted your evaluation for {student?.name}.</p><p className="text-slate-600 text-xs">Thank you for completing your assessment.</p></div></Shell>
  )
  if (stage === 'success') return (
    <Shell>
      <div className="text-center py-10 space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-emerald-400"/>
        </div>
        <h2 className="text-2xl font-bold text-white">Evaluation Submitted</h2>
        <p className="text-slate-400 text-sm">Thank you. Your evaluation for <strong className="text-white">{student?.name}</strong> has been recorded.</p>
        {!isFormative && (
          <div className="bg-navy-800/60 rounded-2xl px-6 py-4 text-left inline-block min-w-48">
            <p className="text-xs text-navy-400 mb-1">Your score</p>
            <p className="text-2xl font-bold text-gold-400">{totals.total} / {totals.max}</p>
            <p className="text-sm text-slate-300">{totals.pct}%</p>
          </div>
        )}
        <p className="text-slate-500 text-xs">Submitted: {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
      </div>
    </Shell>
  )
  if (stage === 'submitting') return (
    <Shell><div className="text-center py-16"><Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-3"/><p className="text-slate-300">Submitting your evaluation…</p></div></Shell>
  )

  if (!formDef) return null

  return (
    <div className="min-h-screen py-8 px-4" style={{background:'linear-gradient(135deg,#0f1f36 0%,#1e3a5f 60%,#0f1f36 100%)'}}>
      <div className="max-w-3xl mx-auto space-y-0">

        {/* Form header */}
        <div className="bg-white/5 border border-white/10 rounded-t-3xl overflow-hidden">
          <div className="px-8 py-6 border-b border-white/10" style={{background:'linear-gradient(135deg,#1e3a5f,#254474)'}}>
            <p className="text-xs text-amber-400/70 uppercase tracking-wider mb-1">Gulf Medical University · MSc Medical Laboratory Sciences</p>
            <h1 className="text-white font-bold text-xl">{formDef.title}</h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-lg border border-blue-400/30 bg-blue-500/10 text-blue-300">{formDef.course}</span>
              <span className={`text-xs px-2 py-0.5 rounded-lg border ${isFormative?'border-amber-400/30 bg-amber-500/10 text-amber-300':'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'}`}>
                {isFormative ? 'Formative — Not Scored' : 'Scored Assessment'}
              </span>
            </div>
          </div>

          {/* Pre-filled student + examiner info */}
          <div className="grid grid-cols-2 gap-0">
            {[
              ['Student', student?.name],
              ['Registration No.', student?.student_id],
              ['Supervisor', student?.supervisors?.name],
              ['Program', student?.program],
              ['Date of Assessment', group?.date ? new Date(group.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})],
              ['Group & Time', group ? `Group ${group.group_name} — ${group.time_slot||''}` : '—'],
            ].map(([label, val]) => (
              <div key={label} className="px-6 py-3 border-b border-r border-white/10">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm text-white font-medium">{val || '—'}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-0 border-b border-white/10">
            {[
              ['Examiner Name', examiner?.name],
              ['Designation', examiner?.designation],
              ['Role', assignment?.examiner_type === 'external' ? 'External Examiner' : 'Internal Examiner'],
            ].map(([label, val]) => (
              <div key={label} className="px-6 py-3 border-r border-white/10 last:border-r-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm text-white font-medium">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Confidentiality notice */}
          <div className="px-6 py-3 flex items-center gap-2.5 border-b border-white/10 bg-white/[0.02]">
            <Shield size={13} className="text-amber-400 shrink-0"/>
            <p className="text-xs text-slate-400">This evaluation is <strong className="text-slate-300">strictly confidential</strong>. Your responses will not be shared with other examiners or the student directly.</p>
          </div>
        </div>

        {/* Scoring scale (for scored forms) */}
        {!isFormative && (
          <div className="grid grid-cols-4 border-x border-white/10 bg-white/[0.02]">
            {[4,3,2,1].map((v,vi) => (
              <div key={v} className="px-4 py-3 border-r border-white/10 last:border-r-0 text-center">
                <p className="text-lg font-bold" style={{color:SCORE_COLORS[v].num}}>{v}</p>
                <p className="text-xs text-slate-400">{SCORE_LABELS[vi]}</p>
              </div>
            ))}
          </div>
        )}

        {/* Scored form sections */}
        {!isFormative && formDef.sections.map((sec, si) => (
          <div key={si} className="border-x border-b border-white/10">
            <div className="px-6 py-3 bg-white/[0.04] flex justify-between items-center border-b border-white/10">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">{sec.title}</p>
              <p className="text-xs font-bold text-blue-300">{totals.sections?.[sec.title]||0} / {sec.criteria.length*4}</p>
            </div>
            {sec.criteria.map((c, ci) => (
              <div key={ci} className="border-b border-white/10 last:border-b-0">
                <div className="px-6 py-3">
                  <p className="text-sm font-semibold text-white mb-0.5">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.sub}</p>
                </div>
                <div className="grid grid-cols-4 gap-3 px-6 pb-4">
                  {[4,3,2,1].map((v,vi) => {
                    const sel = scores[c.name] === v
                    const col = SCORE_COLORS[v]
                    return (
                      <button key={v} type="button"
                        onClick={() => setScores(s=>({...s,[c.name]:v}))}
                        className="text-left p-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: sel ? col.border : 'rgba(255,255,255,0.1)',
                          background:  sel ? col.bg : 'rgba(255,255,255,0.03)',
                        }}>
                        <p className="text-base font-bold mb-1" style={{color: sel?col.num:'rgba(255,255,255,0.6)'}}>{v}</p>
                        <p className="text-xs font-semibold mb-1.5" style={{color: sel?col.text:'rgba(148,163,184,1)'}}>{SCORE_LABELS[vi]}</p>
                        <p className="text-xs leading-relaxed" style={{color: sel?col.text:'rgba(100,116,139,1)'}}>{c.descs[vi]}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Formative checklist */}
        {isFormative && (
          <div className="border-x border-b border-white/10">
            <div className="px-6 py-3 bg-white/[0.04] border-b border-white/10">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Section A — Thesis Readiness Checklist</p>
            </div>
            {formDef.checklistItems.map((item, ii) => (
              <div key={ii} className="border-b border-white/10 last:border-b-0">
                <div className="px-6 py-3 flex items-center justify-between gap-4">
                  <p className="text-sm text-white">{ii+1}. {item}</p>
                  <div className="flex gap-2 shrink-0">
                    {[['ok','Satisfactory','#dcfce7','#166534'],['ni','Needs Improvement','#fee2e2','#991b1b']].map(([v,l,bg,col])=>(
                      <button key={v} type="button"
                        onClick={()=>setChecks(c=>({...c,[item]:v}))}
                        className="px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all"
                        style={{
                          borderColor: checks[item]===v ? col : 'rgba(255,255,255,0.15)',
                          background:  checks[item]===v ? bg  : 'transparent',
                          color:       checks[item]===v ? col : 'rgba(148,163,184,1)',
                        }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {checks[item]==='ni' && (
                  <div className="px-6 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-0.5 h-4 rounded bg-red-500"/>
                      <label className="text-xs font-semibold text-red-400 uppercase tracking-wider">Required corrections — include page numbers</label>
                    </div>
                    <textarea
                      className="w-full rounded-xl px-4 py-3 text-sm text-white resize-none leading-relaxed"
                      style={{background:'rgba(153,27,27,0.1)',border:'1.5px solid rgba(153,27,27,0.4)',minHeight:'80px'}}
                      placeholder="Describe exactly what needs to be improved, including page numbers and specific sections…"
                      value={checkNotes[item]||''}
                      onChange={e=>setCheckNotes(n=>({...n,[item]:e.target.value}))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Score total (scored forms) */}
        {!isFormative && (
          <div className="border-x border-b border-white/10 px-6 py-4 flex items-center justify-between bg-white/[0.03]">
            <p className="text-sm text-slate-300">Total Score</p>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold text-white">{totals.total} / {totals.max}</p>
              <span className="text-lg font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">{totals.pct}%</span>
            </div>
          </div>
        )}

        {/* Proposed submission date (progress 2 only) */}
        {formDef.hasProposedDate && (
          <div className="border-x border-b border-white/10 px-6 py-4 bg-white/[0.02]">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Proposed Thesis Submission Date</label>
            <input type="date" className="w-full max-w-xs rounded-xl px-4 py-2 text-sm text-white outline-none"
              style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)'}}
              value={proposedDate} onChange={e=>setProposedDate(e.target.value)}/>
          </div>
        )}

        {/* Overall comments */}
        <div className="border-x border-b border-white/10 px-6 py-4 bg-white/[0.02]">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {isFormative ? 'Detailed Comments & Required Corrections' : 'Overall Comments & Feedback'}
          </label>
          {isFormative && <p className="text-xs text-slate-500 mb-3">Mandatory for any section marked "Needs Improvement". Include page numbers where applicable.</p>}
          <textarea
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none leading-relaxed outline-none"
            style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.15)',minHeight:'120px'}}
            placeholder="Provide your overall assessment, key observations and constructive feedback…"
            value={comments} onChange={e=>setComments(e.target.value)}
          />
          {isFormative && (
            <>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Questions for the Oral Defense Examination</label>
              <textarea
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none leading-relaxed outline-none"
                style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.15)',minHeight:'80px'}}
                placeholder="List specific questions you wish the student to address during the oral defense…"
              />
            </>
          )}
        </div>

        {/* Recommendation */}
        <div className="border-x border-b border-white/10 px-6 py-4 bg-white/[0.02]">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Final Recommendation *</label>
          <div className="grid grid-cols-2 gap-3">
            {formDef.recOptions.map(r => (
              <button key={r} type="button" onClick={()=>setRec(r)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: recommendation===r ? '#d4a843' : 'rgba(255,255,255,0.1)',
                  background:  recommendation===r ? 'rgba(212,168,67,0.1)' : 'rgba(255,255,255,0.02)',
                }}>
                <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                  style={{borderColor: recommendation===r ? '#d4a843' : 'rgba(148,163,184,0.5)'}}>
                  {recommendation===r && <div className="w-2 h-2 rounded-full bg-amber-400"/>}
                </div>
                <span className="text-sm font-medium" style={{color: recommendation===r ? '#d4a843' : 'rgba(203,213,225,1)'}}>{r}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Signature + Submit */}
        <div className="border-x border-b border-white/10 rounded-b-3xl px-6 py-5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">Examiner</p>
              <p className="text-base font-bold text-white">{examiner?.name}</p>
              <p className="text-xs text-slate-400">{examiner?.designation}</p>
              <p className="text-xs text-slate-500 mt-1">Submission date will be recorded automatically on submit</p>
            </div>
            <button type="button" onClick={handleSubmit}
              className="px-8 py-3 rounded-xl font-bold text-sm transition-all"
              style={{background:'#d4a843',color:'#0f1f36'}}>
              <div className="flex items-center gap-2"><Send size={15}/> Submit Evaluation</div>
            </button>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs pt-4">Thesis Coordination System · Gulf Medical University · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'linear-gradient(135deg,#0f1f36 0%,#1e3a5f 60%,#0f1f36 100%)'}}>
      <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <GraduationCap size={20} className="text-amber-400"/>
          </div>
          <div>
            <p className="text-xs text-amber-400/70 uppercase tracking-wider">Gulf Medical University</p>
            <p className="text-white font-bold">Thesis Assessment System</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
