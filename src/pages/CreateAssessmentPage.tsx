import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import {
  assessmentService,
  defaultAssessmentSettings,
  defaultSectionSettings,
  type AssessmentSection,
} from '../lib/assessmentService'
import { questionBankService } from '../lib/questionBankService'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import {
  ArrowLeft,
  Save,
  Layers,
  Sparkles,
  Clock,
  Calculator,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'

export const CreateAssessmentPage: React.FC = () => {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<'standard' | 'sat' | 'est' | 'custom'>('standard')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [subject, setSubject] = useState('Mathematics')
  const [grade, setGrade] = useState('Grade 10')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState(
    'Please complete each question thoughtfully. Check your answers before moving forward.'
  )
  const [timerMode, setTimerMode] = useState<'per_section' | 'per_assessment' | 'untimed'>('per_section')
  const [attempts, setAttempts] = useState(1)
  const [customSectionCount, setCustomSectionCount] = useState(2)
  const [passcodeEnabled, setPasscodeEnabled] = useState(false)
  const [passcode, setPasscode] = useState('1234')
  const [isPersisting, setIsPersisting] = useState(false)

  const persistAssessment = () => {
    if (!title.trim()) throw new Error('Enter an assessment title before saving.')

    const bankQuestions = questionBankService.getStoredQuestions()
    const q1 = bankQuestions[0]
    const q2 = bankQuestions[1]
    const q3 = bankQuestions[2]
    const q4 = bankQuestions[3]

    let initialSections: AssessmentSection[] = []

    if (preset === 'sat') {
      initialSections = [
        {
          id: `sec_${Date.now().toString(36)}_m1`,
          title: 'Module 1: Math',
          description: '35 minutes • 22 standard questions • Calculator allowed',
          displayOrder: 0,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 35,
            calculatorAllowed: true,
            hasBreakAfter: true,
            breakDurationMinutes: 10,
            breakInstructions: '10-minute break before Module 2 begins.',
          },
          questions: [
            {
              id: `sq_${Date.now().toString(36)}_1`,
              questionId: q1?.id || 'default-1',
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q1,
            },
            {
              id: `sq_${Date.now().toString(36)}_2`,
              questionId: q2?.id || 'default-2',
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q2,
            },
          ],
        },
        {
          id: `sec_${Date.now().toString(36)}_m2`,
          title: 'Module 2: Math',
          description: '35 minutes • 22 adaptive questions • Calculator allowed',
          displayOrder: 1,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 35,
            calculatorAllowed: true,
            hasBreakAfter: false,
            breakDurationMinutes: 0,
          },
          questions: [
            {
              id: `sq_${Date.now().toString(36)}_3`,
              questionId: q3?.id || 'default-3',
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q3,
            },
            {
              id: `sq_${Date.now().toString(36)}_4`,
              questionId: q4?.id || 'default-4',
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q4,
            },
          ],
        },
      ]
    } else if (preset === 'est') {
      initialSections = [
        {
          id: `sec_${Date.now().toString(36)}_s1`,
          title: 'Section 1: Math (No Calculator)',
          description: '30 minutes • Non-calculator foundational algebra & geometry',
          displayOrder: 0,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 30,
            calculatorAllowed: false,
            hasBreakAfter: true,
            breakDurationMinutes: 5,
            breakInstructions: '5-minute break before Section 2 begins.',
          },
          questions: [
            {
              id: `sq_${Date.now().toString(36)}_1`,
              questionId: q1?.id || 'default-1',
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q1,
            },
          ],
        },
        {
          id: `sec_${Date.now().toString(36)}_s2`,
          title: 'Section 2: Math (Calculator Allowed)',
          description: '55 minutes • Advanced problem solving with calculator permitted',
          displayOrder: 1,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 55,
            calculatorAllowed: true,
            hasBreakAfter: false,
            breakDurationMinutes: 0,
          },
          questions: [
            {
              id: `sq_${Date.now().toString(36)}_2`,
              questionId: q2?.id || 'default-2',
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q2,
            },
          ],
        },
      ]
    } else if (preset === 'custom') {
      const count = Math.max(1, customSectionCount)
      initialSections = Array.from({ length: count }, (_, idx) => ({
        id: `sec_${Date.now().toString(36)}_${idx + 1}`,
        title: `Section ${idx + 1}`,
        description: `Section ${idx + 1} diagnostics`,
        displayOrder: idx,
        settings: {
          ...defaultSectionSettings,
          timeLimitMinutes: 30,
          calculatorAllowed: idx % 2 === 1,
          hasBreakAfter: idx < count - 1,
          breakDurationMinutes: 5,
        },
        questions: [
          {
            id: `sq_${Date.now().toString(36)}_${idx}_1`,
            questionId: bankQuestions[idx % bankQuestions.length]?.id || 'default-q',
            displayOrder: 0,
            pointsOverride: 1,
            required: true,
            questionSnapshot: bankQuestions[idx % bankQuestions.length],
          },
        ],
      }))
    } else {
      // Standard Single Section
      initialSections = [
        {
          id: `sec_${Date.now().toString(36)}_single`,
          title: 'Section 1: General Assessment',
          description: 'Comprehensive diagnostic evaluation',
          displayOrder: 0,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 45,
            calculatorAllowed: true,
          },
          questions: [
            {
              id: `sq_${Date.now().toString(36)}_1`,
              questionId: q1?.id || 'default-1',
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q1,
            },
            {
              id: `sq_${Date.now().toString(36)}_2`,
              questionId: q2?.id || 'default-2',
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q2,
            },
          ],
        },
      ]
    }

    const created = assessmentService.createAssessment({
      title: title.trim(),
      subtitle: subtitle.trim(),
      subject: subject.trim(),
      grade: grade.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      status: 'draft',
      settings: {
        ...defaultAssessmentSettings,
        timerMode,
        attempts,
        passcodeEnabled,
        passcode,
      },
      sections: initialSections,
    })

    return created
  }

  const saveBeforeNavigation = () => {
    setIsPersisting(true)
    persistAssessment()
    markClean()
  }

  const hasUnsavedChanges =
    !isPersisting && (
      title.trim() !== '' ||
      subtitle.trim() !== '' ||
      subject !== 'Mathematics' ||
      grade !== 'Grade 10' ||
      description.trim() !== '' ||
      instructions !== 'Please complete each question thoughtfully. Check your answers before moving forward.' ||
      timerMode !== 'per_section' ||
      attempts !== 1 ||
      customSectionCount !== 2 ||
      passcodeEnabled ||
      passcode !== '1234' ||
      preset !== 'standard'
    )
  const markClean = useUnsavedChanges(hasUnsavedChanges, saveBeforeNavigation)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setIsPersisting(true)
    const created = persistAssessment()
    markClean()
    navigate(`/admin/assessments/${created.id}`)
  }

  return (
    <AdminLayout
      title="Create New Assessment"
      subtitle="Configure diagnostic parameters, assessment settings, and initial modular sections"
      actions={
        <button
          type="button"
          onClick={() => navigate('/admin/assessments')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Step 1: Preset Selection */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Choose Section Structure & Template</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setPreset('standard')}
              className={`p-4 rounded-2xl border text-left transition ${
                preset === 'standard'
                  ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Single Section</span>
                {preset === 'standard' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Standard single-timed diagnostic. Best for quick benchmark evaluations.
              </p>
              <span className="inline-block mt-2 text-[10px] font-semibold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                1 Section (45 mins)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPreset('sat')}
              className={`p-4 rounded-2xl border text-left transition ${
                preset === 'sat'
                  ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Digital SAT Format</span>
                {preset === 'sat' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                2 Modules, 35m each with calculator permitted and scheduled break.
              </p>
              <span className="inline-block mt-2 text-[10px] font-semibold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                Module 1 & 2 • Calculator
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPreset('est')}
              className={`p-4 rounded-2xl border text-left transition ${
                preset === 'est'
                  ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">EST I Math Format</span>
                {preset === 'est' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Section 1 No Calculator (30m) followed by Section 2 Calculator (55m).
              </p>
              <span className="inline-block mt-2 text-[10px] font-semibold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md">
                No-Calc + Calc Active
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`p-4 rounded-2xl border text-left transition ${
                preset === 'custom'
                  ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Custom Multi-Section</span>
                {preset === 'custom' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Specify any number of sections with independent settings.
              </p>
              <span className="inline-block mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                Generic N Sections
              </span>
            </button>
          </div>

          {preset === 'custom' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-800">Initial Section Count</span>
                <p className="text-[11px] text-slate-500">You can add or remove sections anytime in the studio.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={customSectionCount}
                  onChange={(e) => setCustomSectionCount(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-center font-bold"
                />
                <span className="text-xs text-slate-500">sections</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Assessment Metadata */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Assessment Identity & Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assessment Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. High School Algebra I Diagnostic Benchmark Form A"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Tagline</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Linear Equations, Quadratics & Polynomial Functions"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Grade / Level</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. Grade 10"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize the purpose of this diagnostic and what student skills are evaluated..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">General Instructions</label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions presented to the student before starting the test..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 3: High-Level Assessment Settings */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">High-Level Assessment Settings</h2>
          <p className="text-xs text-slate-500">
            You can further customize granular behavioral, navigation, registration, and feedback settings inside the Assessment Studio.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Timer Mode</label>
              <select
                value={timerMode}
                onChange={(e) => setTimerMode(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 bg-white"
              >
                <option value="per_section">Per-Section Timers (Recommended)</option>
                <option value="per_assessment">Single Overall Assessment Timer</option>
                <option value="untimed">Untimed Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Allowed Attempts</label>
              <select
                value={attempts}
                onChange={(e) => setAttempts(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 bg-white"
              >
                <option value={1}>1 Attempt Only (Standard Exam)</option>
                <option value={2}>2 Attempts</option>
                <option value={3}>3 Attempts</option>
                <option value={0}>Unlimited Attempts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Passcode Protection</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="passcodeToggle"
                  checked={passcodeEnabled}
                  onChange={(e) => setPasscodeEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="passcodeToggle" className="text-xs text-slate-700 font-medium">
                  Require Access Code
                </label>
              </div>
              {passcodeEnabled && (
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="e.g. 1234"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                />
              )}
            </div>
          </div>
        </div>

        {/* Submit action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/admin/assessments')}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Create & Configure Sections →</span>
          </button>
        </div>
      </form>
    </AdminLayout>
  )
}

export default CreateAssessmentPage
