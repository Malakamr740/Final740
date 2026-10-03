import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import StudentPostAssessmentSurveyModal from '../components/StudentPostAssessmentSurveyModal'
import MathRenderer from '../components/MathRenderer'
import {
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  Maximize2,
  X,
  Clock,
  Calculator as CalcIcon,
  Layers,
  Coffee,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  Lightbulb,
  RotateCcw,
  Check,
} from 'lucide-react'
import {
  assessmentService,
  type Assessment,
  type AssessmentSection,
  type SectionQuestionItem,
} from '../lib/assessmentService'
import { questionBankService, type QuestionBankItem } from '../lib/questionBankService'
import { attemptService } from '../lib/attemptService'

export const TakeAssessmentPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Mode: Learning / Practice Mode (interactive explanations & instant feedback) vs Exam Mode
  const [isLearningMode, setIsLearningMode] = useState<boolean>(() => {
    const m = searchParams.get('mode')
    if (m === 'exam') return false
    return true // Default to rich interactive Learning Mode
  })

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [isSurveyOpen, setIsSurveyOpen] = useState(false)
  const [previewZoomImage, setPreviewZoomImage] = useState<{ url: string; caption?: string } | null>(null)

  // Break / Intermission State
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0)

  // Section Timer State
  const [sectionSecondsLeft, setSectionSecondsLeft] = useState(1800)
  const [isTimeExpired, setIsTimeExpired] = useState(false)

  // On-screen calculator modal toggle
  const [showCalculator, setShowCalculator] = useState(false)
  const [calcInput, setCalcInput] = useState('')

  // Load Attempt & Assessment from database
  useEffect(() => {
    async function loadTargetAssessment() {
      let targetAssessment: Assessment | null = null

      if (attemptId) {
        const attempt = await attemptService.loadAttemptById(attemptId)
        if (attempt && attempt.assessment_id) {
          targetAssessment = assessmentService.getAssessmentById(attempt.assessment_id)
          if (!targetAssessment) {
            const dbList = await assessmentService.fetchAssessmentsFromDatabase()
            targetAssessment = dbList.find((a) => a.id === attempt.assessment_id) || null
          }
        } else {
          // If attempt not found yet, check assessments directly if attemptId is an assessment id
          const directAss = assessmentService.getAssessmentById(attemptId)
          if (directAss) {
            targetAssessment = directAss
          } else {
            const dbList = await assessmentService.fetchAssessmentsFromDatabase()
            targetAssessment = dbList.find((a) => a.id === attemptId) || null
          }
        }
      }

      if (!targetAssessment) {
        setLoadError('The assessment for this link is unavailable in the database. Please request a new shared link.')
        return
      }

      if (targetAssessment) {
        setAssessment(targetAssessment)
        const firstSec = targetAssessment.sections[0]
        if (firstSec && firstSec.settings.timingEnabled) {
          setSectionSecondsLeft(firstSec.settings.timeLimitMinutes * 60)
        }
      }
    }

    loadTargetAssessment()
  }, [attemptId])

  // Active Section Timer (runs in Exam Mode, relaxed/untimed pace in Learning Mode)
  useEffect(() => {
    if (!assessment || isOnBreak || isLearningMode) return
    const activeSec = assessment.sections[currentSectionIdx]
    if (!activeSec || !activeSec.settings.timingEnabled) return

    const timer = setInterval(() => {
      setSectionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeExpired()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [assessment, currentSectionIdx, isOnBreak, isLearningMode])

  // Break Timer
  useEffect(() => {
    if (!isOnBreak || breakSecondsLeft <= 0) return

    const timer = setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOnBreak, breakSecondsLeft])

  const handleTimeExpired = () => {
    setIsTimeExpired(true)
    // Advance to next section or submit
    setTimeout(() => {
      setIsTimeExpired(false)
      handleSectionComplete()
    }, 2000)
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-700">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!assessment || assessment.sections.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-xs font-medium text-slate-500">Preparing assessment session...</div>
      </div>
    )
  }

  const currentSection = assessment.sections[currentSectionIdx] || assessment.sections[0]
  const sectionQuestions = currentSection.questions || []
  const currentQuestionItem = sectionQuestions[currentQuestionIdx] || sectionQuestions[0]

  // Retrieve question details from snapshot or questionBankService
  const bankQuestions = questionBankService.getStoredQuestions()
  const resolvedQuestion =
    (currentQuestionItem?.questionSnapshot as QuestionBankItem) ||
    bankQuestions.find((q) => q.id === currentQuestionItem?.questionId) || {
      id: currentQuestionItem?.questionId || 'q1',
      prompt: 'If 2x - 2 = 3x, what is the value of x + 2?',
      choices: [
        { id: 'A', text: '-4', isCorrect: false },
        { id: 'B', text: '-2', isCorrect: false },
        { id: 'C', text: '0', isCorrect: true },
        { id: 'D', text: '2', isCorrect: false },
      ],
      questionType: 'multiple_choice',
      difficulty: 'easy',
    }

  const currentAnswer = answers[currentQuestionItem?.id]

  const handleSelectAnswer = (idx: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestionItem.id]: idx }))
  }

  const handleNext = () => {
    // Check if require answer policy is enforced
    if (currentSection.settings.requireAnswer && currentAnswer === undefined) {
      alert('An answer is required before advancing to the next question.')
      return
    }

    if (currentQuestionIdx < sectionQuestions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1)
    } else {
      // Last question in this section
      handleSectionComplete()
    }
  }

  const handlePrev = () => {
    if (currentQuestionIdx > 0 && currentSection.settings.allowBack) {
      setCurrentQuestionIdx(currentQuestionIdx - 1)
    }
  }

  const handleSectionComplete = () => {
    if (currentSectionIdx < assessment.sections.length - 1) {
      // Move to next section
      if (currentSection.settings.hasBreakAfter) {
        // Start intermission break
        setIsOnBreak(true)
        setBreakSecondsLeft((currentSection.settings.breakDurationMinutes || 5) * 60)
      } else {
        advanceToNextSection()
      }
    } else {
      // Completed all sections!
      finishAssessment()
    }
  }

  const advanceToNextSection = () => {
    setIsOnBreak(false)
    const nextIdx = currentSectionIdx + 1
    setCurrentSectionIdx(nextIdx)
    setCurrentQuestionIdx(0)
    const nextSec = assessment.sections[nextIdx]
    if (nextSec && nextSec.settings.timingEnabled) {
      setSectionSecondsLeft(nextSec.settings.timeLimitMinutes * 60)
    }
  }

  const finishAssessment = () => {
    // Compute total score and store results for ReportPage
    let totalPoints = 0
    let earnedPoints = 0

    assessment.sections.forEach((sec) => {
      sec.questions.forEach((qItem) => {
        const pts = qItem.pointsOverride || 1
        totalPoints += pts

        const studentAns = answers[qItem.id]
        const qDetail =
          (qItem.questionSnapshot as QuestionBankItem) ||
          bankQuestions.find((q) => q.id === qItem.questionId)

        const correctIdx = qDetail?.choices?.findIndex((c) => c.isCorrect)
        if (studentAns !== undefined && studentAns === correctIdx) {
          earnedPoints += pts
        }
      })
    })

    const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    // Retrieve student metadata from attempt record in database
    let studentData: Record<string, any> = {}
    let startedAt = new Date().toISOString()
    if (attemptId) {
      const existingAttempt = attemptService.getAttemptById(attemptId)
      if (existingAttempt) {
        studentData = existingAttempt.registration_responses || {}
        if (existingAttempt.started_at) startedAt = existingAttempt.started_at
      }
    }

    // Save permanently to database via attemptService
    try {
      attemptService.saveCompletedAttempt({
        attemptId: attemptId || `att_${Date.now()}`,
        assessment,
        studentData,
        answers,
        startedAt,
        totalTimeSeconds: 1200,
      })
    } catch (e) {
      console.warn('Failed to record completed attempt via attemptService:', e)
    }

    setIsSurveyOpen(true)
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculator button handling
  const handleCalcPress = (val: string) => {
    if (val === 'C') setCalcInput('')
    else if (val === '=') {
      try {
        // Safe basic arithmetic evaluator
        const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, '')
        // eslint-disable-next-line no-eval
        const res = Function(`'use strict'; return (${sanitized})`)()
        setCalcInput(String(res))
      } catch {
        setCalcInput('Error')
      }
    } else {
      setCalcInput((prev) => prev + val)
    }
  }

  // Intermission Break Screen
  if (isOnBreak) {
    const nextSection = assessment.sections[currentSectionIdx + 1]

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-purple-50 border border-purple-100 flex items-center justify-center mx-auto text-purple-600">
            <Coffee className="h-8 w-8" />
          </div>

          <div>
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
              Scheduled Intermission
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Section {currentSectionIdx + 1} Completed!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {currentSection.settings.breakInstructions || 'Take a moment to relax and stretch before the next section begins.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-100 flex flex-col items-center justify-center">
            <span className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Break Timer</span>
            <span className="text-4xl font-black font-mono text-purple-900 mt-1">
              {formatTimer(breakSecondsLeft)}
            </span>
          </div>

          {nextSection && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1">
              <span className="font-bold text-slate-700">Up Next: Section {currentSectionIdx + 2}</span>
              <p className="text-slate-500">{nextSection.title}</p>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600 font-medium">
                <span>{nextSection.questions.length} questions</span>
                <span>•</span>
                <span>{nextSection.settings.timingEnabled ? `${nextSection.settings.timeLimitMinutes} mins` : 'Untimed'}</span>
                <span>•</span>
                <span>{nextSection.settings.calculatorAllowed ? 'Calculator Allowed' : 'No Calculator'}</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={advanceToNextSection}
              style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <span>Resume & Begin Section {currentSectionIdx + 2}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-6">
        {/* Top Header: Section Info, Question Count, Countdown Timer & Calculator */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100">
              {currentSection.title}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Question {currentQuestionIdx + 1} of {sectionQuestions.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Interactive Learning Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setIsLearningMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border ${
                isLearningMode
                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
              title="Click to toggle between Learning Mode (instant solutions & step-by-step guidance) and Standard Timed Exam"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isLearningMode ? '🎓 Learning Mode Active' : '⏱️ Switch to Learning Mode'}</span>
            </button>

            {/* Calculator Button (only if calculator is allowed in this section) */}
            {currentSection.settings.calculatorAllowed ? (
              <button
                type="button"
                onClick={() => setShowCalculator((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200 transition"
                title="Open on-screen calculator"
              >
                <CalcIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden xs:inline">Calculator</span>
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-xl cursor-not-allowed"
                title="Calculator is not allowed in this section"
              >
                <CalcIcon className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden xs:inline">No Calc</span>
              </span>
            )}

            {/* Section Timer (runs in Exam Mode, untimed in Learning Mode) */}
            {currentSection.settings.timingEnabled && (
              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                  isLearningMode
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : sectionSecondsLeft < 300
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                }`}
                title={isLearningMode ? 'Learning Mode: Untimed Practice Pace' : 'Exam Countdown'}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{isLearningMode ? 'Untimed Practice' : formatTimer(sectionSecondsLeft)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Section Policy & Mode Notice Banner */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex-wrap gap-2">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Layers className="h-3 w-3 text-indigo-500" />
            Section {currentSectionIdx + 1} of {assessment.sections.length}
          </span>
          <span className="flex items-center gap-2">
            <span>
              {currentSection.settings.calculatorAllowed ? 'Calculator Allowed' : 'No Calculator Permitted'}
            </span>
            {isLearningMode && (
              <span className="font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                🎓 Instant Explanations Enabled
              </span>
            )}
          </span>
        </div>

        {/* Question Prompt */}
        <div className="space-y-2">
          <div className="text-base font-semibold text-slate-900 leading-relaxed">
            <MathRenderer text={resolvedQuestion.prompt} />
          </div>
        </div>

        {/* Question Diagram */}
        {resolvedQuestion.imageUrl && (
          <div className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 text-center space-y-2 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium pb-1.5 border-b border-slate-200/70">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                Problem Diagram
              </span>
              <span className="text-[11px] text-slate-400">Figure</span>
            </div>
            <div className="relative group bg-white rounded-xl border border-slate-200/80 p-2 sm:p-3 overflow-hidden flex items-center justify-center">
              <img
                src={resolvedQuestion.imageUrl}
                alt={resolvedQuestion.imageCaption || 'Problem diagram'}
                className="w-full max-h-[350px] object-contain mx-auto rounded-lg"
              />
              <button
                type="button"
                onClick={() =>
                  setPreviewZoomImage({
                    url: resolvedQuestion.imageUrl!,
                    caption: resolvedQuestion.imageCaption,
                  })
                }
                className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-medium"
              >
                <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Enlarge</span>
              </button>
            </div>
            {resolvedQuestion.imageCaption && (
              <p className="text-xs text-slate-600 font-medium italic pt-1">
                Figure: <MathRenderer text={resolvedQuestion.imageCaption} />
              </p>
            )}
          </div>
        )}

        {/* Multiple Choice Options with Learning Feedback */}
        {resolvedQuestion.choices && resolvedQuestion.choices.length > 0 && (
          <div className="space-y-2.5">
            {resolvedQuestion.choices.map((opt, i) => {
              const isSelected = currentAnswer === i
              const isCorrectChoice = opt.isCorrect
              const hasAnswered = currentAnswer !== undefined

              let btnClasses = 'border-slate-200 hover:bg-slate-50 text-slate-700'
              let badgeClasses = 'bg-slate-100 text-slate-600'

              if (isLearningMode && hasAnswered) {
                if (isSelected && isCorrectChoice) {
                  btnClasses = 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30'
                  badgeClasses = 'bg-emerald-600 text-white'
                } else if (isSelected && !isCorrectChoice) {
                  btnClasses = 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30'
                  badgeClasses = 'bg-rose-600 text-white'
                } else if (isCorrectChoice) {
                  btnClasses = 'border-emerald-500/70 bg-emerald-50/40 text-emerald-900 border-dashed'
                  badgeClasses = 'bg-emerald-100 text-emerald-800'
                }
              } else if (isSelected) {
                btnClasses = 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                badgeClasses = 'bg-blue-600 text-white'
              }

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectAnswer(i)}
                  className={`w-full text-left p-3.5 rounded-2xl border text-xs font-medium transition cursor-pointer flex items-center gap-3 ${btnClasses}`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${badgeClasses}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">
                    <MathRenderer text={opt.text} />
                  </span>
                  {isLearningMode && hasAnswered && isCorrectChoice && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1">
                      <Check className="h-3 w-3 stroke-[3]" />
                      Correct Answer
                    </span>
                  )}
                  {isLearningMode && hasAnswered && isSelected && !isCorrectChoice && (
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1">
                      <X className="h-3 w-3 stroke-[3]" />
                      Incorrect Choice
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Interactive Step-by-Step Learning & Solution Card */}
        {isLearningMode && currentAnswer !== undefined && (
          <div className="rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-3.5 bg-gradient-to-b from-white to-slate-50 shadow-xs">
            {/* Header: Feedback Banner & Taxonomy Badges */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {resolvedQuestion.choices[currentAnswer as number]?.isCorrect ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Correct! Outstanding work!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    Not quite – Study the solution below or try again
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {resolvedQuestion.domain && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    {resolvedQuestion.domain}
                  </span>
                )}
                {resolvedQuestion.lesson && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {resolvedQuestion.lesson}
                  </span>
                )}
              </div>
            </div>

            {/* Selected Option Rationale */}
            {resolvedQuestion.choices[currentAnswer as number]?.rationale && (
              <div className="text-xs text-slate-700 bg-slate-100/80 p-3 rounded-xl border border-slate-200/80 space-y-0.5">
                <span className="font-bold text-slate-900">Selection Analysis: </span>
                <MathRenderer text={resolvedQuestion.choices[currentAnswer as number].rationale!} />
              </div>
            )}

            {/* Step-by-Step Derivation */}
            {resolvedQuestion.explanation && (
              <div className="space-y-1.5 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Step-by-Step Mathematical Solution</span>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed pt-1">
                  <MathRenderer text={resolvedQuestion.explanation} />
                </div>
              </div>
            )}

            {/* Common Misconception Callout */}
            {resolvedQuestion.commonMisconception && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900">
                <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Common Misconception & Trap: </span>
                  <MathRenderer text={resolvedQuestion.commonMisconception} />
                </div>
              </div>
            )}

            {/* Interactive Actions: Try Again & Continue */}
            <div className="flex items-center justify-between pt-1">
              {!resolvedQuestion.choices[currentAnswer as number]?.isCorrect ? (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers((prev) => {
                      const next = { ...prev }
                      delete next[currentQuestionItem.id]
                      return next
                    })
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Try Another Choice</span>
                </button>
              ) : (
                <span className="text-[11px] text-emerald-700 font-medium">
                  Concept mastered! Click next when ready.
                </span>
              )}

              <span className="text-[11px] text-slate-400 italic ml-auto">
                Learning & Practice Mode Active
              </span>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            disabled={currentQuestionIdx === 0 || !currentSection.settings.allowBack}
            onClick={handlePrev}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
          >
            <span>
              {currentQuestionIdx < sectionQuestions.length - 1
                ? 'Next Question'
                : currentSectionIdx < assessment.sections.length - 1
                ? 'Complete Section →'
                : 'Submit Assessment'}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Floating On-Screen Calculator (if calculator allowed) */}
      {showCalculator && currentSection.settings.calculatorAllowed && (
        <div className="fixed bottom-6 right-6 z-40 bg-white rounded-3xl p-4 border border-slate-300 shadow-2xl w-64 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <CalcIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>Standard Calculator</span>
            </span>
            <button
              type="button"
              onClick={() => setShowCalculator(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-2.5 text-right font-mono font-bold text-sm text-slate-900 border border-slate-200 min-h-[40px] flex items-center justify-end overflow-x-auto">
            {calcInput || '0'}
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
            {['7', '8', '9', '/'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleCalcPress(btn)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 transition"
              >
                {btn}
              </button>
            ))}
            {['4', '5', '6', '*'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleCalcPress(btn)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 transition"
              >
                {btn}
              </button>
            ))}
            {['1', '2', '3', '-'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleCalcPress(btn)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 transition"
              >
                {btn}
              </button>
            ))}
            {['0', '.', 'C', '+'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleCalcPress(btn)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 transition"
              >
                {btn}
              </button>
            ))}
            <button
              onClick={() => handleCalcPress('=')}
              className="col-span-4 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
            >
              =
            </button>
          </div>
        </div>
      )}

      {/* Post-Assessment Survey Modal */}
      <StudentPostAssessmentSurveyModal
        attemptId={attemptId || 'sample-attempt'}
        isOpen={isSurveyOpen}
        onComplete={() => navigate(`/report/${attemptId || 'sample-attempt'}`)}
        onSkip={() => navigate(`/report/${attemptId || 'sample-attempt'}`)}
      />

      {/* Lightbox Zoom Modal */}
      {previewZoomImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewZoomImage(null)}
        >
          <div
            className="max-w-4xl w-full bg-white rounded-3xl p-5 border border-slate-200 shadow-2xl relative space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">Diagram View</span>
              <button
                type="button"
                onClick={() => setPreviewZoomImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 font-bold"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewZoomImage.url}
              alt={previewZoomImage.caption || 'Zoomed diagram'}
              className="w-full max-h-[70vh] object-contain rounded-xl"
            />
            {previewZoomImage.caption && (
              <p className="text-xs text-slate-600 italic text-center font-medium">
                {previewZoomImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TakeAssessmentPage
