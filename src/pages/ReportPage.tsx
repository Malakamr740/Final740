import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { TaxonomyTree } from '../components/Reports/TaxonomyTree'
import QuestionReviewCard from '../components/Reports/QuestionReviewCard'
import DomainCard from '../components/Reports/DomainCard'
import TimeAnalysisSection from '../components/Reports/TimeAnalysisSection'
import ThreeStateDonutChart from '../components/Reports/ThreeStateDonutChart'
import { exportElementToPDF } from '../lib/pdfExport'
import {
  STRONG_DOMAIN_THRESHOLD,
  MODERATE_DOMAIN_THRESHOLD,
  TIME_SLOW_THRESHOLD_PCT,
  computeDomainPerformance,
  computeTimeAnalysis,
  computeThreeStateSummary,
} from '../lib/diagnosticAnalytics'
import type { CourseItem, QuestionReviewItem, ReportData, TaxonomyType } from '../components/Reports/Types'
import { surveyService, type ActionPlan } from '../lib/surveyService'
import { Sparkles, CheckCircle2, Lock, ArrowLeft } from 'lucide-react'
import { attemptService } from '../lib/attemptService'
import {
  reportTemplateService,
  type ReportSectionId,
  type ReportTemplateConfig,
} from '../lib/reportTemplateService'
import { useAuth } from '../contexts/AuthContext'

// Configurable thresholds for domain mastery classification
export const CONFIG_STRONG_THRESHOLD = STRONG_DOMAIN_THRESHOLD // 75%
export const CONFIG_MODERATE_THRESHOLD = MODERATE_DOMAIN_THRESHOLD // 50%
export const CONFIG_TIME_SLOW_THRESHOLD = TIME_SLOW_THRESHOLD_PCT // 25%

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

function createSamplePreviewReport(templateConfig?: ReportTemplateConfig): ReportData {
  const currentTemplate = templateConfig || reportTemplateService.getTemplateForAssessment()

  const sampleQuestions: QuestionReviewItem[] = [
    {
      question_id: 'sample-q1',
      content_blocks: [{ type: 'text', content: 'If $2x - 2 = 3x$, what is the value of $x + 2$?' }],
      explanation_blocks: [
        {
          type: 'text',
          content: 'Solve for $x$: $2x - 2 = 3x \\implies 3x - 2x = -2 \\implies x = -2$. Then substitute into $x + 2 = -2 + 2 = 0$. The correct choice is C.',
        },
      ],
      difficulty: 'easy',
      answer_type_code: 'MCQ',
      points_possible: 1,
      points_earned: 1,
      is_correct: true,
      status: 'correct',
      is_answered: true,
      time_spent_seconds: 45,
      student_answer: { choice_id: 'C' },
      category_name: 'Algebra & Functions',
      lesson_name: 'Single-Variable Linear Equations',
      skill_name: 'Linear Equation Solving',
      choices: [
        { id: 'A', content_blocks: [{ type: 'text', content: '-4' }], is_correct: false },
        { id: 'B', content_blocks: [{ type: 'text', content: '-2' }], is_correct: false },
        { id: 'C', content_blocks: [{ type: 'text', content: '0' }], is_correct: true },
        { id: 'D', content_blocks: [{ type: 'text', content: '2' }], is_correct: false },
      ],
    },
    {
      question_id: 'sample-q2',
      content_blocks: [{ type: 'text', content: 'Solve the system of equations: $2x + y = 7$ and $x - y = 2$. What is the value of $x$?' }],
      explanation_blocks: [
        {
          type: 'text',
          content: 'Add the two equations directly: $(2x + y) + (x - y) = 7 + 2 \\implies 3x = 9 \\implies x = 3$. Then $y = 1$. The correct choice is A.',
        },
      ],
      difficulty: 'medium',
      answer_type_code: 'MCQ',
      points_possible: 1,
      points_earned: 1,
      is_correct: true,
      status: 'correct',
      is_answered: true,
      time_spent_seconds: 70,
      student_answer: { choice_id: 'A' },
      category_name: 'Algebra & Functions',
      lesson_name: 'Linear Systems of Two Variables',
      skill_name: 'Elimination Method',
      choices: [
        { id: 'A', content_blocks: [{ type: 'text', content: '3' }], is_correct: true },
        { id: 'B', content_blocks: [{ type: 'text', content: '1' }], is_correct: false },
        { id: 'C', content_blocks: [{ type: 'text', content: '4' }], is_correct: false },
        { id: 'D', content_blocks: [{ type: 'text', content: '5' }], is_correct: false },
      ],
    },
    {
      question_id: 'sample-q3',
      content_blocks: [{ type: 'text', content: 'Find the vertex $(h, k)$ of the quadratic function $f(x) = x^2 - 6x + 5$.' }],
      explanation_blocks: [
        {
          type: 'text',
          content: 'For a parabola in standard form $y = ax^2 + bx + c$, the x-coordinate of vertex is $h = -b/(2a) = -(-6)/(2\\cdot 1) = 3$. Evaluating $f(3) = 3^2 - 6(3) + 5 = 9 - 18 + 5 = -4$. Vertex is $(3, -4)$. The correct choice is B.',
        },
      ],
      difficulty: 'medium',
      answer_type_code: 'MCQ',
      points_possible: 1,
      points_earned: 0,
      is_correct: false,
      status: 'incorrect',
      is_answered: true,
      time_spent_seconds: 140,
      student_answer: { choice_id: 'A' },
      category_name: 'Algebra & Functions',
      lesson_name: 'Quadratic Functions & Parabolas',
      skill_name: 'Vertex Form Calculation',
      choices: [
        { id: 'A', content_blocks: [{ type: 'text', content: '(-3, -4)' }], is_correct: false },
        { id: 'B', content_blocks: [{ type: 'text', content: '(3, -4)' }], is_correct: true },
        { id: 'C', content_blocks: [{ type: 'text', content: '(3, 4)' }], is_correct: false },
        { id: 'D', content_blocks: [{ type: 'text', content: '(0, 5)' }], is_correct: false },
      ],
    },
    {
      question_id: 'sample-q4',
      content_blocks: [{ type: 'text', content: 'In a right triangle $\\triangle ABC$ with right angle at $C$, if $\\sin(A) = \\frac{3}{5}$, what is $\\cos(A)$?' }],
      explanation_blocks: [
        {
          type: 'text',
          content: 'Using the fundamental Pythagorean trigonometric identity: $\\sin^2(A) + \\cos^2(A) = 1$. Thus $\\cos^2(A) = 1 - (3/5)^2 = 1 - 9/25 = 16/25$, so $\\cos(A) = \\frac{4}{5}$. The correct choice is C.',
        },
      ],
      difficulty: 'medium',
      answer_type_code: 'MCQ',
      points_possible: 1,
      points_earned: 1,
      is_correct: true,
      status: 'correct',
      is_answered: true,
      time_spent_seconds: 55,
      student_answer: { choice_id: 'C' },
      category_name: 'Trigonometry & Advanced Topics',
      lesson_name: 'Right Triangle Trigonometry',
      skill_name: 'Trigonometric Identities',
      choices: [
        { id: 'A', content_blocks: [{ type: 'text', content: '\\frac{3}{4}' }], is_correct: false },
        { id: 'B', content_blocks: [{ type: 'text', content: '\\frac{5}{4}' }], is_correct: false },
        { id: 'C', content_blocks: [{ type: 'text', content: '\\frac{4}{5}' }], is_correct: true },
        { id: 'D', content_blocks: [{ type: 'text', content: '\\frac{5}{3}' }], is_correct: false },
      ],
    },
    {
      question_id: 'sample-q5',
      content_blocks: [{ type: 'text', content: 'What is the surface area of a cylinder with radius $r = 3$ and height $h = 7$?' }],
      explanation_blocks: [
        {
          type: 'text',
          content: 'The total surface area is given by $A = 2\\pi r h + 2\\pi r^2 = 2\\pi(3)(7) + 2\\pi(3^2) = 42\\pi + 18\\pi = 60\\pi$. The correct choice is D.',
        },
      ],
      difficulty: 'hard',
      answer_type_code: 'MCQ',
      points_possible: 1,
      points_earned: 1,
      is_correct: true,
      status: 'correct',
      is_answered: true,
      time_spent_seconds: 95,
      student_answer: { choice_id: 'D' },
      category_name: 'Geometry & Measurement',
      lesson_name: 'Prisms, Pyramids, Cylinders & Cones',
      skill_name: 'Surface Area Calculations',
      choices: [
        { id: 'A', content_blocks: [{ type: 'text', content: '42\\pi' }], is_correct: false },
        { id: 'B', content_blocks: [{ type: 'text', content: '54\\pi' }], is_correct: false },
        { id: 'C', content_blocks: [{ type: 'text', content: '63\\pi' }], is_correct: false },
        { id: 'D', content_blocks: [{ type: 'text', content: '60\\pi' }], is_correct: true },
      ],
    },
    {
      question_id: 'sample-q6',
      content_blocks: [{ type: 'text', content: 'A data set has values: $\\{4, 7, 7, 8, 9, 10, 11, 14\\}$. What is the interquartile range (IQR)?' }],
      explanation_blocks: [
        {
          type: 'text',
          content: 'First find the median of lower half: $Q_1 = (7 + 7)/2 = 7$. Median of upper half: $Q_3 = (10 + 11)/2 = 10.5$. Therefore $IQR = Q_3 - Q_1 = 10.5 - 7 = 3.5$. The correct choice is B.',
        },
      ],
      difficulty: 'hard',
      answer_type_code: 'MCQ',
      points_possible: 1,
      points_earned: 0,
      is_correct: false,
      status: 'incorrect',
      is_answered: true,
      time_spent_seconds: 130,
      student_answer: { choice_id: 'C' },
      category_name: 'Statistics & Probability',
      lesson_name: 'Measures of Spread & Box Plots',
      skill_name: 'Interquartile Range Calculation',
      choices: [
        { id: 'A', content_blocks: [{ type: 'text', content: '3' }], is_correct: false },
        { id: 'B', content_blocks: [{ type: 'text', content: '3.5' }], is_correct: true },
        { id: 'C', content_blocks: [{ type: 'text', content: '4' }], is_correct: false },
        { id: 'D', content_blocks: [{ type: 'text', content: '5' }], is_correct: false },
      ],
    },
  ]

  const totalQuestions = sampleQuestions.length
  const correctCount = sampleQuestions.filter((q) => q.is_correct).length
  const pct = Math.round((correctCount / totalQuestions) * 100)

  const tiers = currentTemplate.rubricTiers || []
  const matchingTier =
    tiers.find((t) => pct >= t.minScore && pct <= t.maxScore) ||
    tiers[0] || {
      id: 'proficient',
      name: 'College Ready / Proficient Tier',
      description: 'Solid conceptual competency with minor computational speed errors under timed sections.',
      recommendation: 'Target timed review on multi-step rational functions and geometric coordinate proofs.',
    }

  return {
    student_info: {
      attempt_id: 'demo-preview',
      assessment_name: currentTemplate.title || 'Diagnostic Assessment Demo Preview',
      started_at: new Date(Date.now() - 1500000).toISOString(),
      completed_at: new Date().toISOString(),
      total_time_seconds: 1500,
      registration_responses: {
        full_name: 'Jordan Taylor',
        email: 'jordan.taylor@example.edu',
        grade: 'Grade 11 / College Prep',
        school: 'Academy High School',
      },
    },
    overall: {
      total_questions: totalQuestions,
      correct_count: correctCount,
      incorrect_count: totalQuestions - correctCount,
      unanswered_count: 0,
      points_earned: correctCount,
      points_possible: totalQuestions,
      percentage: pct,
      calculated_at: new Date().toISOString(),
      avg_time_per_question: Math.round(1500 / totalQuestions),
      avg_time_correct: 66,
      avg_time_incorrect: 135,
      rushed_mistakes_count: 0,
      timesink_mistakes_count: 1,
      level: {
        id: matchingTier.id,
        name: matchingTier.name,
        description: matchingTier.description,
        recommendation: matchingTier.recommendation,
      },
    },
    breakdowns: [
      {
        type: 'category',
        id: 'cat-alg',
        label: 'Algebra & Functions',
        total_questions: 3,
        correct_count: 2,
        points_earned: 2,
        points_possible: 3,
        percentage: 67,
        classification: 'average',
      },
      {
        type: 'category',
        id: 'cat-trig',
        label: 'Trigonometry & Advanced Topics',
        total_questions: 1,
        correct_count: 1,
        points_earned: 1,
        points_possible: 1,
        percentage: 100,
        classification: 'strong',
      },
      {
        type: 'category',
        id: 'cat-geo',
        label: 'Geometry & Measurement',
        total_questions: 1,
        correct_count: 1,
        points_earned: 1,
        points_possible: 1,
        percentage: 100,
        classification: 'strong',
      },
      {
        type: 'category',
        id: 'cat-stat',
        label: 'Statistics & Probability',
        total_questions: 1,
        correct_count: 0,
        points_earned: 0,
        points_possible: 1,
        percentage: 0,
        classification: 'weak',
      },
    ],
    questions: sampleQuestions,
    courses: [
      {
        id: 'crs-math-accelerator',
        name: 'Comprehensive Pre-College Math Accelerator',
        description: matchingTier.recommendation || 'Intensive remediation program targeting your identified focus topics.',
        image_url: null,
        registration_url: '#',
        whatsapp_url: '#',
        phone: null,
      },
    ],
    org_settings: {
      org_name: currentTemplate.title || 'Math Diagnostic Platform',
      marketing_tagline: currentTemplate.subtitle || 'Standardized Diagnostic Assessment System',
      contact_phone: null,
      whatsapp_url: null,
      website_url: null,
    },
    diagnostic_notes: [
      {
        type: 'strength',
        title: 'Strong Geometric & Trigonometric Precision',
        body: 'Jordan performed with 100% accuracy on right-triangle trigonometry and solid geometry measurement problems.',
      },
      {
        type: 'improvement',
        title: 'Review Measures of Spread & Box Plots',
        body: 'Additional focus recommended on Interquartile Range calculations and multi-step quadratic vertex determination.',
      },
    ],
  }
}

export default function ReportPage() {
  const { attemptId } = useParams()
  const [searchParams] = useSearchParams()
  const { session, profile, loading: authLoading } = useAuth()
  const resumeToken = searchParams.get('token')
  const isPreview = attemptId === 'demo' || searchParams.get('preview') === '1'
  const role = profile?.role?.trim().toLowerCase()
  const isStaff = Boolean(session && (role === 'admin' || role === 'teacher'))

  const [report, setReport] = useState<ReportData | null>(null)
  const [reportAssessmentId, setReportAssessmentId] = useState<string | undefined>()
  const [persistedTemplate, setPersistedTemplate] = useState<ReportTemplateConfig>(() =>
    reportTemplateService.getTemplateForAssessment()
  )
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAccessDenied, setIsAccessDenied] = useState(false)
  const [filter, setFilter] = useState<{ type: TaxonomyType; label: string } | null>(null)

  // PDF & Email delivery states
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{
    state: 'idle' | 'sending' | 'success' | 'error'
    message?: string
  }>({ state: 'idle' })

  const questionsRef = useRef<HTMLDivElement>(null)
  const reportContainerRef = useRef<HTMLDivElement>(null)
  const hasAutoProcessedRef = useRef(false)

  useEffect(() => {
    async function load() {
      if (authLoading) return

      if (!attemptId) {
        setErrorMessage('No assessment attempt ID was specified.')
        setLoading(false)
        return
      }

      // 1. Preview Mode Authorization:
      // When previewing a report, only authorized staff (admin/teacher) can view it.
      if (isPreview) {
        if (!isStaff) {
          setIsAccessDenied(true)
          setErrorMessage("We're sorry, but you do not have access to this page. You must be signed in as an authorized teacher or administrator to view this report preview.")
          setLoading(false)
          return
        }

        // User is authorized staff: deliver the live preview report
        setIsAccessDenied(false)
        setReportAssessmentId('preview-assessment')
        setReport(createSamplePreviewReport(persistedTemplate))
        setLoading(false)
        return
      }

      // 2. Standard Attempt Report Authorization:
      // Try server database via attemptService
      try {
        const storedRec = await attemptService.loadAttemptById(attemptId)
        if (storedRec && storedRec.report_data) {
          setReportAssessmentId(storedRec.assessment_id)
          setReport(storedRec.report_data)
          setIsAccessDenied(false)
          setLoading(false)
          return
        }
      } catch (err) {
        console.warn('AttemptService load failed:', err)
      }

      // 3. Try direct Supabase attempts table if configured
      if (isSupabaseConfigured) {
        try {
          const { data: dbAtt } = await supabase
            .from('attempts')
            .select('report_data, assessment_id')
            .eq('id', attemptId)
            .maybeSingle()

          if (dbAtt?.assessment_id) setReportAssessmentId(dbAtt.assessment_id)
          if (dbAtt && dbAtt.report_data) {
            setReport(dbAtt.report_data as ReportData)
            setIsAccessDenied(false)
            setLoading(false)
            return
          }

          if (resumeToken) {
            const { data, error } = await supabase.rpc('get_attempt_report', {
              p_attempt_id: attemptId,
              p_resume_token: resumeToken,
            })

            if (!error && data) {
              setReport(data as ReportData)
              setIsAccessDenied(false)
              setLoading(false)
              return
            }
          }
        } catch (err) {
          console.warn('Supabase report query failed:', err)
        }
      }

      // 4. Report not found or unauthorized
      if (!isStaff && !resumeToken) {
        setIsAccessDenied(true)
        setErrorMessage("We're sorry, but you do not have access to this page.")
      } else {
        setIsAccessDenied(false)
        setErrorMessage('This assessment report was not found in the database. Please complete an assessment or select a valid attempt record.')
      }
      setLoading(false)
    }

    load()
  }, [attemptId, resumeToken, isStaff, isPreview, authLoading, persistedTemplate])

  useEffect(() => {
    let active = true
    const loadTemplate = resumeToken && attemptId
      ? reportTemplateService.loadTemplateForAttempt(attemptId, resumeToken)
      : reportTemplateService.loadTemplateForAssessment(reportAssessmentId)
    loadTemplate.then((template) => {
      if (active) setPersistedTemplate(template)
    })
    return () => {
      active = false
    }
  }, [reportAssessmentId, attemptId, resumeToken])

  // Analytics computations
  const templateConfig = useMemo<ReportTemplateConfig>(() => {
    const base = persistedTemplate
    if (searchParams.get('preview') !== '1') return base

    try {
      const rawPreview = sessionStorage.getItem('math_diag_report_preview')
      if (!rawPreview) return base
      const preview = JSON.parse(rawPreview) as Partial<ReportTemplateConfig>
      return {
        ...base,
        ...preview,
        categoryLabels: { ...base.categoryLabels, ...preview.categoryLabels },
        domainRubricCopy: {
          ...base.domainRubricCopy,
          ...preview.domainRubricCopy,
          strong: { ...base.domainRubricCopy.strong, ...preview.domainRubricCopy?.strong },
          moderate: { ...base.domainRubricCopy.moderate, ...preview.domainRubricCopy?.moderate },
          weak: { ...base.domainRubricCopy.weak, ...preview.domainRubricCopy?.weak },
        },
        sectionRules: { ...base.sectionRules, ...preview.sectionRules },
        sectionFields: { ...base.sectionFields, ...preview.sectionFields },
      }
    } catch (err) {
      console.warn('Failed to load report preview settings:', err)
      return base
    }
  }, [persistedTemplate, searchParams])

  const analytics = useMemo(() => {
    if (!report) return null

    const strongThresh = templateConfig.strongThreshold || CONFIG_STRONG_THRESHOLD
    const moderateThresh = templateConfig.moderateThreshold || CONFIG_MODERATE_THRESHOLD
    const slowThresh = templateConfig.slowTimeThresholdPct || CONFIG_TIME_SLOW_THRESHOLD

    const domainPerf = computeDomainPerformance(
      report,
      strongThresh,
      moderateThresh,
      templateConfig.domainRubricCopy
    )

    const timeAnalysis = computeTimeAnalysis(
      report.questions,
      report.overall.avg_time_per_question,
      slowThresh
    )

    const threeState = computeThreeStateSummary(report.questions)

    const studentInfo = report.student_info
    const reg = studentInfo.registration_responses || {}
    const studentName =
      (reg.full_name as string) ||
      (reg.name as string) ||
      (reg.student_name as string) ||
      'Student'

    const studentEmail =
      (reg.email as string) ||
      (reg.student_email as string) ||
      (reg.parent_email as string) ||
      null
    const gradeEntry = Object.entries(reg).find(
      ([key, value]) =>
        /grade|level|year/i.test(key) && value !== null && value !== undefined && String(value).trim()
    )
    const studentGrade = gradeEntry ? String(gradeEntry[1]) : ''

    // Evaluate Rubric Tier dynamically
    const rubricTier = reportTemplateService.resolveRubricLevel(report.overall.percentage, templateConfig)

    return {
      domainPerf,
      timeAnalysis,
      threeState,
      studentName,
      studentEmail,
      studentGrade,
      rubricTier,
      completedLabel: studentInfo.completed_at
        ? new Date(studentInfo.completed_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'Today',
      durationLabel: formatTime(studentInfo.total_time_seconds),
      avgTime: report.overall.avg_time_per_question,
      conceptualErrors: Math.max(
        0,
        report.overall.incorrect_count -
          report.overall.rushed_mistakes_count -
          report.overall.timesink_mistakes_count
      ),
    }
  }, [report, templateConfig])

  const matchedActionPlan = useMemo<ActionPlan | null>(() => {
    if (!report) return null
    const plans = surveyService.getActionPlans()
    if (!plans || plans.length === 0) return null
    if (attemptId) {
      const response = surveyService.getResponse(attemptId)
      if (response?.matched_plan_id) {
        const found = plans.find((p) => p.id === response.matched_plan_id)
        if (found) return found
      }
      const scorePct =
        report.overall.total_questions > 0
          ? (report.overall.correct_count / report.overall.total_questions) * 100
          : 50
      return surveyService.matchActionPlan(response?.answers || {}, scorePct, plans)
    }
    return plans[0]
  }, [report, attemptId])

  // Auto-download as PDF and trigger email delivery once report is ready
  useEffect(() => {
    if (!report || !analytics || attemptId === 'demo' || hasAutoProcessedRef.current) return

    // Small delay to ensure all KaTeX equations and fonts render completely before capture
    const timer = setTimeout(() => {
      if (hasAutoProcessedRef.current) return
      hasAutoProcessedRef.current = true
      handleExportAndEmail(false)
    }, 1200)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, analytics])

  async function handleExportAndEmail(isUserInitiated = true) {
    if (!reportContainerRef.current || !analytics || !report) return

    setPdfGenerating(true)
    const sanitizedStudentName = analytics.studentName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const sanitizedExamName = report.student_info.assessment_name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `Report_${sanitizedStudentName}_${sanitizedExamName}_${dateStr}.pdf`

    try {
      // Generate PDF (and auto-download to disk)
      const exportResult = await exportElementToPDF({
        element: reportContainerRef.current,
        filename,
        autoDownload: true,
      })

      // If student or parent email is provided, dispatch email via Supabase edge function
      if (analytics.studentEmail) {
        setEmailStatus({
          state: 'sending',
          message: `Sending diagnostic PDF report to ${analytics.studentEmail}...`,
        })

        try {
          const { error: fnError } = await supabase.functions.invoke('send-report-email', {
            body: {
              attemptId: report.student_info.attempt_id,
              recipientEmail: analytics.studentEmail,
              pdfBase64: exportResult.base64,
              studentName: analytics.studentName,
              assessmentName: report.student_info.assessment_name,
              scorePercentage: report.overall.percentage,
            },
          })

          if (fnError) {
            console.warn('Email dispatch notice:', fnError)
            setEmailStatus({
              state: 'error',
              message: `PDF saved locally. (Email delivery to ${analytics.studentEmail} could not be completed).`,
            })
          } else {
            setEmailStatus({
              state: 'success',
              message: `Report successfully downloaded and emailed to ${analytics.studentEmail}`,
            })
          }
        } catch (emailErr) {
          console.warn('Edge function invoke error:', emailErr)
          setEmailStatus({
            state: 'error',
            message: `PDF saved locally. (Email delivery could not be completed).`,
          })
        }
      } else if (isUserInitiated) {
        setEmailStatus({
          state: 'success',
          message: 'Diagnostic PDF report generated and downloaded.',
        })
      }
    } catch (err) {
      console.error('PDF export error:', err)
      if (isUserInitiated) {
        window.print()
      }
    } finally {
      setPdfGenerating(false)
    }
  }

  const visibleQuestions = useMemo(() => {
    if (!report) return []
    if (!filter) return report.questions
    return report.questions.filter((q: QuestionReviewItem) => {
      switch (filter.type) {
        case 'category':
          return q.category_name === filter.label
        case 'lesson':
          return q.lesson_name === filter.label
        case 'skill':
          return q.skill_name === filter.label
        case 'difficulty':
          return q.difficulty === filter.label.toLowerCase()
        default:
          return true
      }
    })
  }, [report, filter])

  function handleSelectTaxonomy(type: TaxonomyType, label: string) {
    setFilter((prev) => (prev && prev.type === type && prev.label === label ? null : { type, label }))
    questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-600 border-t-transparent" />
          <p className="text-sm font-medium">Generating comprehensive diagnostic report…</p>
        </div>
      </div>
    )
  }

  if (isAccessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Access Restricted</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {errorMessage || "We're sorry, but you do not have access to this page."}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              Sign In to Your Account
            </Link>
            <Link
              to="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 py-1"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage || !report || !analytics) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Diagnostic report unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Return to Assessments
          </Link>
        </div>
      </div>
    )
  }

  const { student_info, overall, breakdowns, questions, courses, org_settings } = report
  const { domainPerf, timeAnalysis, threeState, studentName, completedLabel, durationLabel, avgTime } =
    analytics

  const shouldShowSection = (sectionId: ReportSectionId) => {
    if (templateConfig[sectionId] === false) return false

    const rule = templateConfig.sectionRules?.[sectionId]
    if (!rule || !rule.value.trim()) return true

    if (rule.metric === 'grade') {
      const grade = analytics.studentGrade.toLocaleLowerCase()
      const expected = rule.value.trim().toLocaleLowerCase()
      if (!grade) return false
      return rule.operator === 'equals' ? grade === expected : grade.includes(expected)
    }

    const actualValue =
      rule.metric === 'score'
        ? overall.percentage
        : rule.metric === 'totalTimeMinutes'
        ? student_info.total_time_seconds / 60
        : rule.metric === 'avgTimeSeconds'
        ? overall.avg_time_per_question
        : questions.length
    const expectedValue = Number(rule.value)
    if (!Number.isFinite(expectedValue)) return true
    if (rule.operator === 'lte') return actualValue <= expectedValue
    if (rule.operator === 'equals') return actualValue === expectedValue
    return actualValue >= expectedValue
  }
  const isSectionFieldVisible = (sectionId: ReportSectionId, fieldId: string) =>
    templateConfig.sectionFields?.[sectionId]?.includes(fieldId) ?? true

  const displayedBreakdowns = breakdowns.filter((breakdown) => {
    if (breakdown.type === 'category') return isSectionFieldVisible('showTaxonomyTree', 'categories')
    if (breakdown.type === 'chapter' || breakdown.type === 'lesson') {
      return isSectionFieldVisible('showTaxonomyTree', 'lessons')
    }
    if (breakdown.type === 'skill') return isSectionFieldVisible('showTaxonomyTree', 'skills')
    return isSectionFieldVisible('showTaxonomyTree', 'otherTypes')
  })

  const categorySections = [
      {
        sectionId: 'showStrongDomains' as const,
        key: 'strong',
        tone: 'emerald',
        label: templateConfig.categoryLabels?.strong || 'Strong Domains',
        description: `Performance at or above the ${templateConfig.strongThreshold || CONFIG_STRONG_THRESHOLD}% benchmark`,
        items: domainPerf.strongDomains,
        emptyMessage: `No domains currently exceed the ${templateConfig.strongThreshold || CONFIG_STRONG_THRESHOLD}% threshold.`,
      },
      {
        sectionId: 'showWeakDomains' as const,
        key: 'weak',
        tone: 'rose',
        label: templateConfig.categoryLabels?.weak || 'Focus Areas',
        description: `Performance below the ${templateConfig.moderateThreshold || CONFIG_MODERATE_THRESHOLD}% benchmark`,
        items: domainPerf.weakDomains,
        emptyMessage: 'No domains require immediate reinforcement at this time.',
      },
    ]

  return (
    <div className="print-page min-h-screen bg-slate-50 text-slate-900">
      {/* Top Banner when in Preview Mode */}
      {isPreview && (
        <div className="no-print bg-slate-900 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between shadow-xs sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px]">
              Preview Mode
            </span>
            <span className="text-slate-200">
              Live Preview: Diagnostic Score Report Template with your active rubrics & sections
            </span>
          </div>
          <Link
            to="/admin/report-settings"
            className="inline-flex items-center gap-1.5 bg-white text-slate-900 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-600" />
            <span>Return to Report Settings</span>
          </Link>
        </div>
      )}

      {/* Sticky Header Toolbar (no-print) */}
      <div className={`no-print ${isPreview ? 'relative' : 'sticky top-0'} z-20 border-b border-slate-200 bg-white/95 backdrop-blur`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {templateConfig.title || org_settings?.org_name || 'Diagnostic Performance Assessment'}
            </div>
            <div className="text-xs text-slate-500">
              {templateConfig.subtitle || 'Student Diagnostic Evaluation'} · {student_info.assessment_name}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportAndEmail(true)}
              disabled={pdfGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {pdfGenerating ? 'Generating PDF...' : 'Download PDF'}
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
          </div>
        </div>

        {/* Email delivery & notification bar */}
        {emailStatus.state !== 'idle' && (
          <div
            className={`px-4 py-2 text-xs font-medium border-t ${
              emailStatus.state === 'sending'
                ? 'bg-blue-50 text-blue-800 border-blue-100'
                : emailStatus.state === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-100'
            }`}
          >
            <div className="mx-auto max-w-5xl flex items-center justify-between">
              <span>{emailStatus.message}</span>
              <button
                onClick={() => setEmailStatus({ state: 'idle' })}
                className="text-xs opacity-70 hover:opacity-100 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Printable Content Container */}
      <div ref={reportContainerRef} className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Custom Educator Guidance / Top Instructions (if configured) */}
        {templateConfig.customNotesBody && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 shadow-2xs">
            <h4 className="font-bold uppercase tracking-wider text-blue-950 mb-1 flex items-center gap-1.5">
              <span>📌</span> {templateConfig.customNotesTitle || 'Assessment Guidance'}
            </h4>
            <p className="leading-relaxed text-blue-800">{templateConfig.customNotesBody}</p>
          </div>
        )}

        {/* Hero Section */}
        {shouldShowSection('showHeroMetrics') && (
          <section className="rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-6 sm:p-8 text-white shadow-floating">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isSectionFieldVisible('showHeroMetrics', 'banner') && <div className="text-xs font-medium uppercase tracking-wider text-white/80">
                {templateConfig.headerBannerText || 'Student Diagnostic Evaluation'}
              </div>}
              {isSectionFieldVisible('showHeroMetrics', 'classification') && (analytics.rubricTier?.name || overall.level?.name) && (
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                  Tier: {analytics.rubricTier?.name || overall.level?.name}
                </span>
              )}
            </div>

            {isSectionFieldVisible('showHeroMetrics', 'studentName') && (
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">{studentName}</h1>
            )}
            {(isSectionFieldVisible('showHeroMetrics', 'assessmentName') ||
              isSectionFieldVisible('showHeroMetrics', 'completedDate')) && (
              <p className="mt-1 text-sm sm:text-base text-white/85">
                {isSectionFieldVisible('showHeroMetrics', 'assessmentName') && student_info.assessment_name}
                {isSectionFieldVisible('showHeroMetrics', 'assessmentName') &&
                  isSectionFieldVisible('showHeroMetrics', 'completedDate') && ' · '}
                {isSectionFieldVisible('showHeroMetrics', 'completedDate') && `Completed ${completedLabel}`}
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {isSectionFieldVisible('showHeroMetrics', 'score') && (
                <HeroMetric label="Overall Score" value={`${overall.percentage}%`} />
              )}
              {isSectionFieldVisible('showHeroMetrics', 'classification') && (
                <HeroMetric
                  label="Classification"
                  value={analytics.rubricTier?.name || overall.level?.name || 'Assessed'}
                />
              )}
              {isSectionFieldVisible('showHeroMetrics', 'duration') && (
                <HeroMetric label="Total Duration" value={durationLabel} />
              )}
              {isSectionFieldVisible('showHeroMetrics', 'questionCount') && (
                <HeroMetric label="Questions Assessed" value={`${questions.length}`} />
              )}
            </div>
          </section>
        )}

        {/* Three-State Question Classification Donut & Breakdown */}
        {shouldShowSection('showThreeStateDonut') && (
          <section>
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-slate-900">Scoring & Response Status</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Breakdown of questions answered correctly, incorrectly, or left unanswered
              </p>
            </div>
            <ThreeStateDonutChart
              correctCount={threeState.correctCount}
              incorrectCount={threeState.incorrectCount}
              unansweredCount={threeState.unansweredCount}
              total={threeState.total}
              visibleFields={templateConfig.sectionFields?.showThreeStateDonut}
            />
          </section>
        )}

        {categorySections.map((section) => {
          if (!shouldShowSection(section.sectionId)) return null

          const badgeTone =
            section.tone === 'emerald'
              ? 'bg-emerald-100 text-emerald-800'
              : section.tone === 'amber'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'

          const icon =
            section.tone === 'emerald' ? '✓' : section.tone === 'amber' ? '•' : '!'

          return (
            <section key={section.key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        section.tone === 'emerald'
                          ? 'bg-emerald-100 text-emerald-700'
                          : section.tone === 'amber'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {icon}
                    </span>
                    <h2 className="text-lg font-semibold text-slate-900">{section.label}</h2>
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-500">{section.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeTone}`}>
                  {section.items.length} {section.items.length === 1 ? 'Area' : 'Areas'}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {section.items.length === 0 ? (
                  <div className="col-span-2 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    {section.emptyMessage}
                  </div>
                ) : (
                  section.items.map((domain) => (
                    <DomainCard
                      key={domain.domainId}
                      domain={domain}
                      type={section.tone === 'rose' ? 'weak' : section.tone === 'amber' ? 'moderate' : 'strong'}
                      visibleFields={templateConfig.sectionFields?.[section.sectionId]}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}

        {/* Time Analysis Section */}
        {shouldShowSection('showTimeAnalysis') && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <TimeAnalysisSection
              timeAnalysis={timeAnalysis}
              visibleFields={templateConfig.sectionFields?.showTimeAnalysis}
            />
          </section>
        )}

        {/* Taxonomy Hierarchy Tree */}
        {shouldShowSection('showTaxonomyTree') && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Taxonomy & Curriculum Breakdown"
              subtitle="Explore your curriculum hierarchy — tap any category or skill to filter corresponding questions"
            />
            <div className="mt-4">
              <TaxonomyTree
                breakdowns={displayedBreakdowns}
                visibleFields={templateConfig.sectionFields?.showTaxonomyTree}
                onSelect={handleSelectTaxonomy}
                activeFilter={filter}
              />
            </div>
          </section>
        )}

        {/* Diagnostic Behavior & Mistake Types */}
        {shouldShowSection('showErrorPatterns') && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Error Pattern Diagnosis"
              subtitle="Distinguishing conceptual gaps from pacing and careless errors"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              {isSectionFieldVisible('showErrorPatterns', 'conceptual') && <ErrorChip
                label="Conceptual Gaps"
                count={analytics.conceptualErrors}
                tone="bg-rose-100 text-rose-700"
              />}
              {isSectionFieldVisible('showErrorPatterns', 'rushed') && <ErrorChip
                label="Rushed Mistakes (<25s)"
                count={overall.rushed_mistakes_count}
                tone="bg-amber-100 text-amber-700"
              />}
              {isSectionFieldVisible('showErrorPatterns', 'timesink') && <ErrorChip
                label="Timesink Mistakes (>100s)"
                count={overall.timesink_mistakes_count}
                tone="bg-sky-100 text-sky-700"
              />}
            </div>
            {isSectionFieldVisible('showErrorPatterns', 'summary') && <p className="mt-3 text-sm text-slate-600">
              Of {overall.incorrect_count} incorrect answers, {analytics.conceptualErrors} reflect
              conceptual difficulty, {overall.rushed_mistakes_count} were rushed carelessly, and{' '}
              {overall.timesink_mistakes_count} were lost to overthinking past 100 seconds.
            </p>}
          </section>
        )}

        {/* Question-by-Question Detailed Review */}
        {shouldShowSection('showQuestionSolutions') && (
          <section
            ref={questionsRef}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <SectionTitle
                title="Question Review & Solutions"
                subtitle={
                  filter
                    ? `Filtered by ${filter.type}: ${filter.label}`
                    : 'Detailed step-by-step diagnostic solutions for each question'
                }
              />
              {filter && (
                <button
                  onClick={() => setFilter(null)}
                  className="no-print rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {visibleQuestions.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No questions match this filter criteria.
                </p>
              ) : (
                visibleQuestions.map((q: QuestionReviewItem) => (
                  <QuestionReviewCard
                    key={q.question_id}
                    question={q}
                    index={questions.indexOf(q)}
                    avgTime={avgTime}
                    highlight={!!filter}
                    visibleFields={templateConfig.sectionFields?.showQuestionSolutions}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {/* Personalized Student Action Roadmap Section */}
        {shouldShowSection('showActionPlan') && matchedActionPlan && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-lg font-semibold text-slate-900">Personalized Action Roadmap</h2>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                  Phased improvement roadmap calibrated to your diagnostic test score and reflection
                </p>
              </div>
              {isSectionFieldVisible('showActionPlan', 'audience') && <span className="self-start sm:self-auto rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">
                {matchedActionPlan.target_audience || 'Personalized Track'}
              </span>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              {isSectionFieldVisible('showActionPlan', 'title') && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-base font-bold text-slate-900">{matchedActionPlan.title}</h3>
                  <span className="text-xs font-semibold text-blue-600">{matchedActionPlan.tagline}</span>
                </div>
              )}
              {isSectionFieldVisible('showActionPlan', 'summary') && <p className="text-xs text-slate-600 leading-relaxed">
                {matchedActionPlan.summary}
              </p>}

              {/* Milestones */}
              {isSectionFieldVisible('showActionPlan', 'milestones') && matchedActionPlan.milestones?.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Phased Milestone Progression
                  </span>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {matchedActionPlan.milestones.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-1 font-semibold text-slate-900">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                              {mIdx + 1}
                            </span>
                            <span className="truncate">{m.title}</span>
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shrink-0">
                            {m.timeframe}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                          {m.description}
                        </p>
                        {m.tasks && m.tasks.length > 0 && (
                          <ul className="list-disc list-inside text-[10px] text-slate-600 pl-6 space-y-0.5 pt-1">
                            {m.tasks.map((task, ti) => (
                              <li key={ti}>{task}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly Routine */}
              {isSectionFieldVisible('showActionPlan', 'routine') && matchedActionPlan.weekly_routine?.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Recommended Study Rhythm
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {matchedActionPlan.weekly_routine.map((block, bi) => (
                      <div
                        key={bi}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      >
                        <span className="font-semibold text-slate-800">{block.day_group}:</span>{' '}
                        <span className="text-slate-600">{block.focus}</span>{' '}
                        <span className="text-slate-400">({block.suggested_hours})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Advice */}
              {isSectionFieldVisible('showActionPlan', 'advice') && matchedActionPlan.prescriptive_advice?.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-slate-700 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-emerald-950 block text-[11px] uppercase tracking-wider">
                        Key Rule of Success
                      </span>
                      <p className="italic text-slate-700 mt-0.5">
                        "{matchedActionPlan.prescriptive_advice[0]}"
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Actionable Recommendations & Courses */}
        {shouldShowSection('showCourseRecommendations') && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              title="Prescriptive Study Recommendations"
              subtitle="Tailored next steps based on your diagnostic results"
            />
            {isSectionFieldVisible('showCourseRecommendations', 'recommendation') && <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {analytics.rubricTier?.recommendation ||
                overall.level?.recommendation ||
                'Continue with the structured curriculum pathway, focusing primarily on the identified weak domains.'}
            </p>}
            {courses.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {courses.map((c: CourseItem) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                    {isSectionFieldVisible('showCourseRecommendations', 'courseName') && (
                      <div className="font-semibold text-slate-900">{c.name}</div>
                    )}
                    {isSectionFieldVisible('showCourseRecommendations', 'description') && <p className="mt-1 text-sm text-slate-600">
                      {c.description || 'Recommended remediation and practice course.'}
                    </p>}
                    {isSectionFieldVisible('showCourseRecommendations', 'enrollmentLink') && c.registration_url && (
                      <a
                        href={c.registration_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-xs font-semibold text-primary-600 hover:underline"
                      >
                        Enroll in Course &rarr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Footer Disclaimer */}
        {templateConfig.footerDisclaimer && (
          <div className="pt-4 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 italic">
              {templateConfig.footerDisclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur-xs">
      <div className="text-xs font-medium uppercase tracking-wide text-white/70">{label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
  )
}

function ErrorChip({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${tone}`}>
      {label}: {count}
    </span>
  )
}
