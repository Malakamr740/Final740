import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ContentBlockRenderer, { type ContentBlock } from '../components/ContentBlockRenderer'
import { supabase } from '../lib/supabaseClient'
import { attemptService } from '../lib/attemptService'

interface StudentInfo {
  attempt_id: string
  assessment_name: string
  started_at: string
  completed_at: string | null
  total_time_seconds: number
  registration_responses: Record<string, string>
}

interface LevelInfo {
  id: string
  name: string
  description: string | null
  recommendation: string | null
}

interface OverallResult {
  total_questions: number
  correct_count: number
  incorrect_count: number
  points_earned: number
  points_possible: number
  percentage: number
  calculated_at: string
  avg_time_per_question: number
  level: LevelInfo | null
}

interface BreakdownRow {
  type: 'module' | 'category' | 'chapter' | 'lesson' | 'skill' | 'difficulty'
  id: string | null
  label: string
  total_questions: number
  correct_count: number
  points_earned: number
  points_possible: number
  percentage: number
  classification: 'strong' | 'weak' | 'average' | null
}

interface ChoiceOption {
  id: string
  content_blocks: ContentBlock[]
  is_correct: boolean
}

interface QuestionReviewItem {
  question_id: string
  content_blocks: ContentBlock[]
  explanation_blocks: ContentBlock[]
  difficulty: 'easy' | 'medium' | 'hard'
  answer_type_code: string
  points_possible: number
  points_earned: number
  is_correct: boolean
  time_spent_seconds: number
  student_answer: Record<string, unknown>
  category_name: string | null
  lesson_name: string | null
  skill_name: string | null
  choices: ChoiceOption[]
  correct_answer_data?: { value: unknown; tolerance?: number }
}

interface CourseItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  registration_url: string | null
  whatsapp_url: string | null
  phone: string | null
}

interface OrgSettings {
  org_name: string
  marketing_tagline: string | null
  contact_phone: string | null
  whatsapp_url: string | null
  website_url: string | null
}

interface ReportData {
  student_info: StudentInfo
  overall: OverallResult
  breakdowns: BreakdownRow[]
  questions: QuestionReviewItem[]
  courses: CourseItem[]
  org_settings: OrgSettings | null
}

type TabKey = 'overview' | 'skills' | 'questions' | 'action_plan'
type QuestionFilter = 'all' | 'incorrect' | 'hard' | 'slow'

export default function AdminAttemptDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>()

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all')

  useEffect(() => {
    async function fetchReport() {
      if (!attemptId) return
      setLoading(true)

      // 1. Try local attemptService first for local/preview mode attempts
      try {
        const localRecord = attemptService.getAttemptById(attemptId)
        if (localRecord && localRecord.report_data) {
          setReport(localRecord.report_data as ReportData)
          setLoading(false)
          return
        }
      } catch (err) {
        console.warn('Local attempt fetch error:', err)
      }

      // 2. Try direct Supabase attempts table
      try {
        const { data: attData } = await supabase
          .from('attempts')
          .select('report_data')
          .eq('id', attemptId)
          .maybeSingle()

        if (attData && attData.report_data) {
          setReport(attData.report_data as ReportData)
          setLoading(false)
          return
        }
      } catch {}

      // 3. Try Supabase rpc if configured
      try {
        const { data, error } = await supabase.rpc('get_admin_attempt_report', {
          p_attempt_id: attemptId,
        })

        if (!error && data) {
          setReport(data as ReportData)
          setLoading(false)
          return
        }
      } catch {}

      // 3. Fallback to sessionStorage
      try {
        const reportRaw = sessionStorage.getItem(`report_${attemptId}`)
        if (reportRaw) {
          const parsed = JSON.parse(reportRaw)
          if (parsed.fullReport) {
            setReport(parsed.fullReport as ReportData)
            setLoading(false)
            return
          }
        }
      } catch {}

      setErrorMessage('Could not load diagnostic results for this attempt.')
      setLoading(false)
    }

    fetchReport()
  }, [attemptId])

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading Student Diagnostic Report...</p>
        </div>
      </AdminLayout>
    )
  }

  if (errorMessage || !report) {
    return (
      <AdminLayout>
        <div className="max-w-md mx-auto my-12 bg-white border border-red-200 rounded-2xl p-6 text-center shadow-xs">
          <span className="text-3xl mb-2 block">⚠️</span>
          <h2 className="text-base font-bold text-slate-900 mb-1">Report Not Found</h2>
          <p className="text-xs text-red-600 mb-4">{errorMessage}</p>
          <Link
            to="/admin/assessments"
            className="inline-block text-xs bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg"
          >
            ← Back to Assessments
          </Link>
        </div>
      </AdminLayout>
    )
  }

  const { student_info, overall, breakdowns, questions, courses } = report

  const categoryBreakdowns = breakdowns.filter((b) => b.type === 'category')
  const skillBreakdowns = breakdowns.filter((b) => b.type === 'skill')
  const difficultyBreakdowns = breakdowns.filter((b) => b.type === 'difficulty')

  const studentName =
    student_info.registration_responses['full_name'] ||
    student_info.registration_responses['name'] ||
    'Student'

  const totalMinutes = Math.floor(student_info.total_time_seconds / 60)
  const totalSeconds = student_info.total_time_seconds % 60

  const filteredQuestions = questions.filter((q) => {
    if (questionFilter === 'incorrect') return !q.is_correct
    if (questionFilter === 'hard') return q.difficulty === 'hard'
    if (questionFilter === 'slow') return q.time_spent_seconds >= 120
    return true
  })

  return (
    <AdminLayout
      title={`Student Report: ${studentName}`}
      subtitle={`${student_info.assessment_name} • Score: ${overall.percentage}% (${overall.correct_count}/${overall.total_questions})`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-xs"
          >
            <span>🖨️</span> Print / Save PDF
          </button>
        </div>
      }
    >
      <div className="max-w-5xl space-y-6">
        {/* Section 1: Student Profile Snapshot */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-xs">
                {studentName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">{studentName}</h2>
                <p className="text-xs text-slate-500 font-medium">{student_info.assessment_name}</p>
              </div>
            </div>

            {/* Registration Metadata */}
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              {Object.entries(student_info.registration_responses).map(([key, val]) => (
                <span
                  key={key}
                  className="bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md"
                >
                  <strong className="capitalize text-slate-700">{key.replace('_', ' ')}:</strong>{' '}
                  {val}
                </span>
              ))}
            </div>
          </div>

          <div className="flex sm:grid sm:grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0">
            <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100 min-w-[90px]">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Test Date</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {student_info.completed_at
                  ? new Date(student_info.completed_at).toLocaleDateString()
                  : 'Today'}
              </p>
            </div>
            <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100 min-w-[90px]">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Duration</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {totalMinutes}m {totalSeconds}s
              </p>
            </div>
            <div className="text-center p-2 rounded-xl bg-blue-50 border border-blue-100 min-w-[90px]">
              <span className="text-[11px] font-bold text-blue-600 uppercase">Readiness</span>
              <p className="text-xs font-bold text-blue-900 mt-0.5">
                {overall.level?.name || 'Assessed'}
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Executive Scorecard & Level Evaluation */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Scorecard Hero */}
          <div className="md:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Diagnostic Accuracy
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-6xl font-black tracking-tight">{overall.percentage}%</span>
                <span className="text-sm text-slate-400 font-medium">overall score</span>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-700/60 mt-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Points Achieved:</span>
                <span className="font-bold text-slate-100">
                  {overall.points_earned} / {overall.points_possible} pts
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Accuracy Breakdown:</span>
                <span className="font-bold text-slate-100">
                  <span className="text-emerald-400">{overall.correct_count} Correct</span> &middot;{' '}
                  <span className="text-rose-400">{overall.incorrect_count} Incorrect</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Average Pacing:</span>
                <span className="font-bold text-slate-100">
                  ⏱ {overall.avg_time_per_question}s / question
                </span>
              </div>
            </div>
          </div>

          {/* Level Evaluation Card */}
          <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                  Assigned Tier: {overall.level?.name || 'Evaluated'}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                Performance Evaluation & Baseline
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {overall.level?.description ||
                  'The student performance has been calculated across all evaluated topics.'}
              </p>
            </div>

            {overall.level?.recommendation && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200/80">
                <span className="text-xs font-bold text-amber-900 block mb-1">
                  🎯 Targeted Prescription:
                </span>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  {overall.level.recommendation}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 flex gap-2 overflow-x-auto print:hidden">
          {(
            [
              { key: 'overview', label: '📊 Domains & Difficulty' },
              { key: 'skills', label: '🎯 Granular Skill Matrix' },
              { key: 'questions', label: `📝 Question Review (${questions.length})` },
              { key: 'action_plan', label: '🚀 Recommended Action Plan' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: DOMAINS & DIFFICULTY */}
        {/* ========================================================= */}
        {(activeTab === 'overview' || typeof window === 'undefined') && (
          <div className="space-y-6">
            {/* Domain Mastery Bars */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-1">Domain & Category Mastery</h3>
              <p className="text-xs text-slate-500 mb-5">
                Evaluation across all primary subject domains evaluated in this test.
              </p>

              <div className="space-y-4">
                {categoryBreakdowns.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No category taxonomy tags assigned.</p>
                ) : (
                  categoryBreakdowns.map((cat) => (
                    <div key={cat.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">
                            {cat.correct_count}/{cat.total_questions} correct
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md capitalize text-[11px] ${
                              cat.classification === 'strong'
                                ? 'bg-emerald-100 text-emerald-800'
                                : cat.classification === 'weak'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {cat.percentage}% &middot; {cat.classification || 'average'}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cat.classification === 'strong'
                              ? 'bg-emerald-500'
                              : cat.classification === 'weak'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.max(5, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cognitive Difficulty Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Cognitive Depth & Difficulty Analysis
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                Performance breakdown across Easy, Medium, and Hard diagnostic questions.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['easy', 'medium', 'hard'] as const).map((diff) => {
                  const data = difficultyBreakdowns.find(
                    (d) => d.label.toLowerCase() === diff.toLowerCase()
                  )
                  const count = data?.total_questions || 0
                  const correct = data?.correct_count || 0
                  const pct = data?.percentage || 0

                  return (
                    <div
                      key={diff}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-700 capitalize">
                            {diff} Questions
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              pct >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : pct <= 50
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 mt-2">
                          {correct} / {count}
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200">
                        {diff === 'easy' && 'Baseline knowledge & test hygiene items.'}
                        {diff === 'medium' && 'Standard multi-step diagnostic reasoning.'}
                        {diff === 'hard' && 'Advanced synthesis and differentiator traps.'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: GRANULAR SKILL MATRIX */}
        {/* ========================================================= */}
        {(activeTab === 'skills' || typeof window === 'undefined') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Granular Skill Mastery Matrix</h3>
              <p className="text-xs text-slate-500">
                Detailed breakdown by micro-skill tagged to every evaluated question.
              </p>
            </div>

            {skillBreakdowns.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No specific skill-level tags recorded on these questions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Evaluated Skill</th>
                      <th className="py-2.5 px-3 text-center">Questions</th>
                      <th className="py-2.5 px-3 text-center">Accuracy</th>
                      <th className="py-2.5 px-3 text-center">Mastery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {skillBreakdowns.map((sk) => (
                      <tr key={sk.label} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-semibold text-slate-800">{sk.label}</td>
                        <td className="py-3 px-3 text-center text-slate-600">
                          {sk.correct_count} / {sk.total_questions}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {sk.percentage}%
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] capitalize ${
                              sk.classification === 'strong'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sk.classification === 'weak'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sk.classification === 'strong'
                              ? '🟢 Mastered'
                              : sk.classification === 'weak'
                              ? '🔴 Critical Gap'
                              : '🟡 Developing'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: QUESTION-BY-QUESTION REVIEW & EXPLANATIONS */}
        {/* ========================================================= */}
        {(activeTab === 'questions' || typeof window === 'undefined') && (
          <div className="space-y-4">
            {/* Filter Buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: 'All Items' },
                    { key: 'incorrect', label: `❌ Incorrect (${overall.incorrect_count})` },
                    { key: 'hard', label: '🔥 Hard Questions' },
                    { key: 'slow', label: '⏱ Pacing > 2m' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setQuestionFilter(f.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                      questionFilter === f.key
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Showing {filteredQuestions.length} of {questions.length}
              </span>
            </div>

            {/* Questions List with Solutions */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                  <p className="text-xs font-semibold text-slate-500">
                    No questions matching the selected filter.
                  </p>
                </div>
              ) : (
                filteredQuestions.map((q, idx) => (
                  <div
                    key={q.question_id}
                    className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-xs space-y-4 transition ${
                      q.is_correct ? 'border-slate-200' : 'border-rose-200 bg-rose-50/10'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md capitalize ${
                            q.is_correct
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {q.is_correct ? '✓ Correct (+1 pt)' : '✕ Incorrect (0 pts)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {q.skill_name && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                            {q.skill_name}
                          </span>
                        )}
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium capitalize">
                          {q.difficulty}
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium font-mono">
                          ⏱ {q.time_spent_seconds}s
                        </span>
                      </div>
                    </div>

                    {/* Question Content with LaTeX */}
                    <div className="text-sm font-medium text-slate-900 leading-relaxed">
                      <ContentBlockRenderer blocks={q.content_blocks} />
                    </div>

                    {/* MCQ Review */}
                    {q.answer_type_code === 'MCQ' && (
                      <div className="space-y-2 pt-2">
                        {q.choices.map((ch, cIndex) => {
                          const isStudentSelected = q.student_answer?.choice_id === ch.id
                          const isChoiceCorrect = ch.is_correct

                          let choiceStyle = 'border-slate-200 bg-slate-50/60'
                          if (isChoiceCorrect) {
                            choiceStyle =
                              'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-semibold'
                          } else if (isStudentSelected && !isChoiceCorrect) {
                            choiceStyle = 'border-rose-400 bg-rose-50 text-rose-900 line-through'
                          }

                          return (
                            <div
                              key={ch.id}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${choiceStyle}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold w-4">
                                  {String.fromCharCode(65 + cIndex)}.
                                </span>
                                <div>
                                  <ContentBlockRenderer blocks={ch.content_blocks} />
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5 font-bold text-[11px]">
                                {isChoiceCorrect && (
                                  <span className="text-emerald-700">✓ Correct Answer</span>
                                )}
                                {isStudentSelected && !isChoiceCorrect && (
                                  <span className="text-rose-600">✕ Student Answer</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Grid-In / True-False Review */}
                    {q.answer_type_code !== 'MCQ' && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <p>
                          <strong className="text-slate-700">Student Answer:</strong>{' '}
                          <span
                            className={`font-bold ${
                              q.is_correct ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {String(q.student_answer?.value ?? 'None')}
                          </span>
                        </p>
                        {!q.is_correct && q.correct_answer_data && (
                          <p>
                            <strong className="text-slate-700">Correct Answer:</strong>{' '}
                            <span className="font-bold text-emerald-700">
                              {String(q.correct_answer_data.value)}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Step-by-Step Explanation */}
                    {q.explanation_blocks && q.explanation_blocks.length > 0 && (
                      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-800 space-y-1.5">
                        <span className="font-bold text-blue-900 block uppercase tracking-wider text-[10px]">
                          💡 Step-by-Step Solution
                        </span>
                        <div className="leading-relaxed">
                          <ContentBlockRenderer blocks={q.explanation_blocks} />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: RECOMMENDED ACTION PLAN & NEXT STEPS */}
        {/* ========================================================= */}
        {(activeTab === 'action_plan' || typeof window === 'undefined') && (
          <div className="space-y-6">
            {courses.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Recommended Learning Paths for {overall.level?.name || 'Assigned Tier'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Courses and practice tracks matched to the student's level.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {courses.map((c) => (
                    <div
                      key={c.id}
                      className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                        {c.description && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {c.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        {c.registration_url && (
                          <a
                            href={c.registration_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                          >
                            Enroll Now
                          </a>
                        )}
                        {c.whatsapp_url && (
                          <a
                            href={c.whatsapp_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                          >
                            <span>💬</span> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}