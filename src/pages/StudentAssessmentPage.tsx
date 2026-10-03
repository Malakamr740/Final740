import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { assessmentService, type Assessment } from '../lib/assessmentService'
import { attemptService } from '../lib/attemptService'
import {
  Clock,
  Layers,
  FileText,
  Calculator,
  Lock,
  ArrowRight,
  AlertCircle,
  Coffee,
  CheckCircle2,
  GraduationCap,
  Sparkles,
} from 'lucide-react'

export const StudentAssessmentPage: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [selectedMode, setSelectedMode] = useState<'learning' | 'exam'>('learning')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [intakeFields, setIntakeFields] = useState<
    Array<{
      id: string
      label: string
      field_key: string
      type: string
      required: boolean
      options?: string[] | null
    }>
  >([])
  const [passcode, setPasscode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      if (!assessmentId) return
      let targetId = assessmentId
      let data = assessmentService.getAssessmentById(targetId)
      if (!data) {
        const list = await assessmentService.fetchAssessmentsFromDatabase()
        data = list.find((a) => a.id === targetId) || null
        if (!data && (targetId === 'standard' || targetId === 'sample' || targetId === 'demo')) {
          data = list[0] || null
        }
      }

      if (data) {
        setAssessment(data)

        // Check for customized global registration fields from Settings & Fields in database
        let resolvedFields: Array<{
          id: string
          label: string
          field_key: string
          type: string
          required: boolean
          options?: string[] | null
        }> = []

        try {
          const res = await fetch('/api/settings/registration_fields')
          if (res.ok) {
            const parsed = await res.json()
            if (Array.isArray(parsed) && parsed.length > 0) {
              resolvedFields = parsed
                .filter((f: any) => f.is_active !== false)
                .map((f: any) => ({
                  id: f.id || f.field_key,
                  label: f.label,
                  field_key: f.field_key,
                  type: f.field_type || 'text',
                  required: Boolean(f.is_required),
                  options: f.options,
                }))
            }
          }
        } catch {}

        if (resolvedFields.length === 0) {
          resolvedFields = (data.settings.studentFields || [])
            .filter((f) => f.enabled)
            .map((f) => ({
              id: f.id,
              label: f.label,
              field_key: f.id,
              type: f.type,
              required: f.required,
              options: f.options,
            }))
        }

        setIntakeFields(resolvedFields)
        const initialForm: Record<string, string> = {}
        resolvedFields.forEach((f) => {
          initialForm[f.field_key] = ''
        })
        setFormData(initialForm)
      } else {
        setErrorMessage(`Assessment "${assessmentId}" not found.`)
      }
    }

    loadData()
  }, [assessmentId])

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assessment) return

    // Validate required fields
    for (const f of intakeFields) {
      if (f.required && !formData[f.field_key]?.trim()) {
        setErrorMessage(`Please fill in required field: ${f.label}`)
        return
      }
    }

    // Validate passcode if enabled
    if (assessment.settings.passcodeEnabled) {
      if (passcode.trim() !== assessment.settings.passcode.trim()) {
        setErrorMessage('Invalid assessment access passcode. Please check with your instructor.')
        return
      }
    }

    setSubmitting(true)
    const attemptId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

    const studentName =
      formData['full_name'] ||
      formData['name'] ||
      formData['student_name'] ||
      Object.values(formData)[0] ||
      'Student Participant'
    const studentEmail = formData['email'] || formData['student_email'] || ''

    // Save active attempt to server database
    await attemptService.saveActiveAttempt({
      id: attemptId,
      assessment_id: assessment.id,
      assessment_name: assessment.title,
      student_name: studentName,
      student_email: studentEmail,
      registration_responses: formData,
      started_at: new Date().toISOString(),
    })

    navigate(`/take/${attemptId}?mode=${selectedMode}`)
  }

  if (errorMessage && !assessment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Diagnostic Not Available</h2>
          <p className="text-xs text-slate-500">{errorMessage}</p>
          <Link
            to="/admin/assessments"
            className="inline-block text-xs font-semibold text-blue-600 hover:underline"
          >
            Return to Assessments
          </Link>
        </div>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-xs font-medium text-slate-500">Loading diagnostic assessment...</div>
      </div>
    )
  }

  const totalQuestions = assessment.sections.reduce((sum, sec) => sum + sec.questions.length, 0)
  const totalDuration =
    assessment.settings.timerMode === 'per_assessment'
      ? assessment.settings.timerMinutes
      : assessment.sections.reduce(
          (sum, sec) => sum + (sec.settings.timingEnabled ? sec.settings.timeLimitMinutes : 0),
          0
        )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {assessment.grade} • {assessment.subject}
            </span>
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {totalDuration > 0 ? `${totalDuration} mins total` : 'Untimed'}
            </span>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {assessment.title}
            </h1>
            {assessment.subtitle && (
              <p className="text-xs text-slate-500 mt-1 font-medium">{assessment.subtitle}</p>
            )}
          </div>

          {assessment.description && (
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {assessment.description}
            </p>
          )}

          {/* Test Structure Preview */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span>Assessment Modular Structure ({assessment.sections.length} Sections)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assessment.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {idx + 1}. {sec.title}
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {sec.questions.length} Qs
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {sec.settings.timingEnabled ? `${sec.settings.timeLimitMinutes} mins` : 'Untimed'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calculator className="h-3 w-3 text-slate-400" />
                      {sec.settings.calculatorAllowed ? 'Calculator Allowed' : 'No Calculator'}
                    </span>
                  </div>

                  {sec.settings.hasBreakAfter && (
                    <div className="text-[10px] text-purple-700 bg-purple-50 px-2 py-1 rounded-lg flex items-center gap-1">
                      <Coffee className="h-3 w-3" />
                      <span>{sec.settings.breakDurationMinutes}-minute intermission after section</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* General Directions */}
          {assessment.instructions && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                Directions & Rules
              </span>
              <p className="text-[11px] leading-relaxed text-amber-800">{assessment.instructions}</p>
            </div>
          )}
        </div>

        {/* Student Intake Form & Passcode */}
        <form
          onSubmit={handleStart}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              <span>Student Identification</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please enter your details before initiating the assessment.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {intakeFields.map((f) => (
              <div
                key={f.id}
                className={
                  f.field_key === 'full_name' || f.field_key === 'name' ? 'sm:col-span-2' : ''
                }
              >
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                </label>
                {f.type === 'dropdown' && f.options && f.options.length > 0 ? (
                  <select
                    required={f.required}
                    value={formData[f.field_key] || ''}
                    onChange={(e) => handleInputChange(f.field_key, e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select {f.label}</option>
                    {f.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'phone' ? 'tel' : f.type || 'text'}
                    required={f.required}
                    value={formData[f.field_key] || ''}
                    onChange={(e) => handleInputChange(f.field_key, e.target.value)}
                    placeholder={`Enter your ${f.label.toLowerCase()}`}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>
            ))}

            {/* Passcode Field */}
            {assessment.settings.passcodeEnabled && (
              <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Assessment Access Passcode <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter access code provided by proctor"
                  className="w-full sm:w-64 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono font-bold tracking-widest text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Experience Mode Selector: Interactive Learning Mode vs Timed Exam */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <label className="block text-xs font-bold text-slate-800">
              Select Your Assessment Experience
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMode('learning')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedMode === 'learning'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    🎓 Interactive Learning Mode
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Instant step-by-step LaTeX math solutions, choice rationales, error-trap advice, and untimed practice.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('exam')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedMode === 'exam'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    ⏱️ Timed Proctored Exam
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Formal
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Real examination conditions with countdown timer, silent answers, and comprehensive score report upon completion.
                </p>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: selectedMode === 'learning' ? '#059669' : '#2563eb',
                color: '#ffffff',
              }}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-xs font-bold transition shadow-xs cursor-pointer ${
                selectedMode === 'learning'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              <span>
                {selectedMode === 'learning' ? 'Start Interactive Learning' : 'Begin Timed Assessment'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      <footer className="mt-8 text-center text-[11px] text-slate-400">
        Diagnostic Assessment Platform • Secure Proctored Examination Mode
      </footer>
    </div>
  )
}

export default StudentAssessmentPage
