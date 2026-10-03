import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ShareAssessmentModal from '../components/ShareAssessmentModal'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import ContentBlockRenderer from '../components/ContentBlockRenderer'
import {
  assessmentService,
  defaultSectionSettings,
  type Assessment,
  type AssessmentSection,
  type SectionSettings,
  type SectionQuestionItem,
  type StudentFieldConfig,
} from '../lib/assessmentService'
import { questionBankService, type QuestionBankItem } from '../lib/questionBankService'
import AssessmentSubmissionStatistics from '../components/AssessmentSubmissionStatistics'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Clock,
  Calculator,
  Sliders,
  FileText,
  PlayCircle,
  Share2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Check,
  X,
  Shuffle,
  Shield,
  Layers,
  GraduationCap,
  Sparkles,
  Coffee,
  Award,
  HelpCircle,
} from 'lucide-react'

export const AssessmentDetailPage: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [activeTab, setActiveTab] = useState<'settings' | 'sections' | 'preview'>('sections')
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Section Settings Modal
  const [editingSection, setEditingSection] = useState<AssessmentSection | null>(null)
  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionDesc, setSectionDesc] = useState('')
  const [sectionSettings, setSectionSettings] = useState<SectionSettings>({ ...defaultSectionSettings })
  const sectionSettingsDirty = Boolean(
    editingSection &&
    (sectionTitle !== editingSection.title ||
      sectionDesc !== (editingSection.description || '') ||
      JSON.stringify(sectionSettings) !== JSON.stringify(editingSection.settings))
  )
  const markSectionSettingsClean = useUnsavedChanges(sectionSettingsDirty, persistSectionSettings)

  // Question Bank Picker Modal
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null)
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerDomainFilter, setPickerDomainFilter] = useState('all')
  const [pickerDifficultyFilter, setPickerDifficultyFilter] = useState('all')
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    if (assessmentId) {
      loadAssessment(assessmentId)
    }
    questionBankService.fetchQuestionsFromDatabase()
      .then((qList) => setBankQuestions(qList))
      .catch(() => setBankQuestions(questionBankService.getStoredQuestions()))
  }, [assessmentId])

  const loadAssessment = async (id: string) => {
    let data = assessmentService.getAssessmentById(id)
    if (!data) {
      const dbList = await assessmentService.fetchAssessmentsFromDatabase()
      data = dbList.find((a) => a.id === id) || null
    }
    if (!data) {
      setErrorMessage(`Assessment "${id}" not found.`)
      return
    }
    setAssessment(data)
  }

  const showNotification = (msg: string) => {
    setSaveSuccessMessage(msg)
    setTimeout(() => setSaveSuccessMessage(null), 3000)
  }

  const handleDuplicateAssessment = () => {
    if (!assessment) return
    try {
      const cloned = assessmentService.duplicateAssessment(assessment.id)
      showNotification(`Duplicated as "${cloned.title}"!`)
      navigate(`/admin/assessments/${cloned.id}`)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to duplicate assessment.')
    }
  }

  const handleDuplicateSection = (secId: string) => {
    if (!assessment) return
    try {
      const updated = assessmentService.duplicateSection(assessment.id, secId)
      setAssessment(updated)
      showNotification('Section duplicated with new question instances.')
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to duplicate section.')
    }
  }

  const handleDuplicateQuestion = (secId: string, qItemId: string) => {
    if (!assessment) return
    try {
      const updated = assessmentService.duplicateQuestion(assessment.id, secId, qItemId)
      setAssessment(updated)
      showNotification('Question duplicated in section.')
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to duplicate question.')
    }
  }

  // Update Assessment field
  const handleUpdateAssessment = (updates: Partial<Assessment>) => {
    if (!assessment) return
    try {
      const updated = assessmentService.updateAssessment(assessment.id, updates)
      setAssessment(updated)
      showNotification('Assessment settings updated successfully!')
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update assessment.')
    }
  }

  // Update nested settings
  const handleUpdateSettings = (updates: Partial<Assessment['settings']>) => {
    if (!assessment) return
    handleUpdateAssessment({
      settings: {
        ...assessment.settings,
        ...updates,
      },
    })
  }

  // Section Actions
  const handleAddSection = () => {
    if (!assessment) return
    try {
      const updated = assessmentService.addSection(assessment.id, {
        title: `Section ${assessment.sections.length + 1}`,
        description: '',
      })
      setAssessment(updated)
      showNotification('New section added with default question.')
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  const handleDeleteSection = (secId: string, secTitle: string) => {
    if (!assessment) return
    if (assessment.sections.length <= 1) {
      alert('An assessment must have at least one section.')
      return
    }
    if (confirm(`Are you sure you want to delete "${secTitle}"? This will remove all questions in this section.`)) {
      try {
        const updated = assessmentService.deleteSection(assessment.id, secId)
        setAssessment(updated)
        showNotification('Section removed.')
      } catch (err: any) {
        setErrorMessage(err.message)
      }
    }
  }

  const handleMoveSection = (index: number, direction: -1 | 1) => {
    if (!assessment) return
    const newIdx = index + direction
    if (newIdx < 0 || newIdx >= assessment.sections.length) return

    const newSections = [...assessment.sections]
    const temp = newSections[index]
    newSections[index] = newSections[newIdx]
    newSections[newIdx] = temp

    try {
      const updated = assessmentService.reorderSections(
        assessment.id,
        newSections.map((s) => s.id)
      )
      setAssessment(updated)
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  // Section Settings Modal Handlers
  const openEditSectionModal = (sec: AssessmentSection) => {
    setEditingSection(sec)
    setSectionTitle(sec.title)
    setSectionDesc(sec.description || '')
    setSectionSettings({ ...sec.settings })
  }

  function persistSectionSettings() {
    if (!assessment || !editingSection) return

    const updated = assessmentService.updateSection(assessment.id, editingSection.id, {
      title: sectionTitle.trim() || editingSection.title,
      description: sectionDesc.trim(),
      settings: sectionSettings,
    })
    setAssessment(updated)
    setEditingSection(null)
    showNotification('Section settings saved!')
  }

  const handleSaveSectionSettings = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      persistSectionSettings()
      markSectionSettingsClean()
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  // Question Management within Sections
  const handleRemoveQuestion = (secId: string, qItemId: string) => {
    if (!assessment) return
    const sec = assessment.sections.find((s) => s.id === secId)
    if (sec && sec.questions.length <= 1) {
      alert('Each section must have at least 1 question. You cannot remove the only question.')
      return
    }

    try {
      const updated = assessmentService.removeQuestionFromSection(assessment.id, secId, qItemId)
      setAssessment(updated)
      showNotification('Question removed from section.')
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  const handleMoveQuestion = (secId: string, qIndex: number, direction: -1 | 1) => {
    if (!assessment) return
    const sec = assessment.sections.find((s) => s.id === secId)
    if (!sec) return

    const targetIdx = qIndex + direction
    if (targetIdx < 0 || targetIdx >= sec.questions.length) return

    const newQuestions = [...sec.questions]
    const temp = newQuestions[qIndex]
    newQuestions[qIndex] = newQuestions[targetIdx]
    newQuestions[targetIdx] = temp

    try {
      const updated = assessmentService.reorderSectionQuestions(
        assessment.id,
        secId,
        newQuestions.map((q) => q.id)
      )
      setAssessment(updated)
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  const handleUpdatePoints = (secId: string, qItemId: string, points: number) => {
    if (!assessment) return
    try {
      const updated = assessmentService.updateSectionQuestion(assessment.id, secId, qItemId, {
        pointsOverride: points,
      })
      setAssessment(updated)
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  // Question Picker Handlers
  const openQuestionPicker = (secId: string) => {
    setPickerSectionId(secId)
    setSelectedQuestionIds([])
    setPickerSearch('')
    setPickerDomainFilter('all')
    setPickerDifficultyFilter('all')
  }

  const handleTogglePickQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    )
  }

  const handleConfirmAddQuestions = () => {
    if (!assessment || !pickerSectionId || selectedQuestionIds.length === 0) return

    try {
      const updated = assessmentService.addQuestionsToSection(
        assessment.id,
        pickerSectionId,
        selectedQuestionIds
      )
      setAssessment(updated)
      showNotification(`Added ${selectedQuestionIds.length} question(s) to section!`)
      setPickerSectionId(null)
      setSelectedQuestionIds([])
    } catch (err: any) {
      setErrorMessage(err.message)
    }
  }

  // Student field toggling
  const handleToggleStudentField = (fId: string, key: 'enabled' | 'required') => {
    if (!assessment) return
    const currentFields = assessment.settings.studentFields || []
    const updatedFields = currentFields.map((f) => {
      if (f.id !== fId) return f
      return {
        ...f,
        [key]: !f[key],
      }
    })
    handleUpdateSettings({ studentFields: updatedFields })
  }

  if (errorMessage && !assessment) {
    return (
      <AdminLayout title="Assessment Not Found">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">{errorMessage}</h2>
          <Link
            to="/admin/assessments"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
          >
            Return to Assessments
          </Link>
        </div>
      </AdminLayout>
    )
  }

  if (!assessment) {
    return (
      <AdminLayout title="Loading Assessment...">
        <div className="p-8 text-center text-xs text-slate-500">Loading diagnostic details...</div>
      </AdminLayout>
    )
  }

  const totalQuestions = assessment.sections.reduce((acc, s) => acc + s.questions.length, 0)
  const totalDuration =
    assessment.settings.timerMode === 'per_assessment'
      ? assessment.settings.timerMinutes
      : assessment.sections.reduce(
          (acc, s) => acc + (s.settings.timingEnabled ? s.settings.timeLimitMinutes : 0),
          0
        )

  // Filtered available questions in modal
  const assignedInPickerSection = new Set(
    assessment.sections.find((s) => s.id === pickerSectionId)?.questions.map((q) => q.questionId) || []
  )

  const filteredPickerQuestions = bankQuestions.filter((q) => {
    if (assignedInPickerSection.has(q.id)) return false // exclude already in section
    const matchSearch =
      !pickerSearch.trim() ||
      q.prompt.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      q.domain.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      q.lesson.toLowerCase().includes(pickerSearch.toLowerCase())
    const matchDomain = pickerDomainFilter === 'all' || q.domain === pickerDomainFilter
    const matchDifficulty = pickerDifficultyFilter === 'all' || q.difficulty === pickerDifficultyFilter
    return matchSearch && matchDomain && matchDifficulty
  })

  const uniqueDomains = Array.from(new Set(bankQuestions.map((q) => q.domain)))

  return (
    <AdminLayout
      title={assessment.title}
      subtitle={`Configure individual assessment settings, generic multi-section architecture & rules`}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/admin/assessments"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Assessments</span>
          </Link>

          <Link
            to={`/assessment/${assessment.id}`}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-2xs"
            title="Experience assessment as a student"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Student Preview</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <Share2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Share</span>
          </button>

          <Link
            to={`/admin/assessments/${assessment.id}/results`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition shadow-2xs"
          >
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
            <span>All Submissions &amp; Analytics</span>
          </Link>
        </div>
      }
    >
      {/* Toast Notification */}
      {saveSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Statistical Part at the Top for All Submissions */}
      <AssessmentSubmissionStatistics assessment={assessment} className="mb-6" />

      {/* Overview Stats Header Banner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {assessment.grade} • {assessment.subject}
              </span>
              <select
                value={assessment.status}
                onChange={(e) => handleUpdateAssessment({ status: e.target.value as any })}
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border focus:outline-none cursor-pointer ${
                  assessment.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : assessment.status === 'draft'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            {assessment.subtitle && (
              <p className="text-xs text-slate-500 mt-1">{assessment.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1 font-semibold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              {assessment.sections.length} {assessment.sections.length === 1 ? 'Section' : 'Sections'}
            </span>
            <span className="flex items-center gap-1 font-semibold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              {totalQuestions} {totalQuestions === 1 ? 'Question' : 'Questions'}
            </span>
            <span className="flex items-center gap-1 font-semibold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {totalDuration > 0 ? `${totalDuration} mins` : 'Untimed'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'sections'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Sections & Questions ({assessment.sections.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Assessment Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Live Student Simulator</span>
          </button>

          <button
            type="button"
            onClick={handleDuplicateAssessment}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer ml-auto"
            title="Duplicate this assessment into a new copy"
          >
            <Copy className="h-3.5 w-3.5 text-blue-600" />
            <span>Duplicate Assessment</span>
          </button>

          <Link
            to={`/admin/assessments/${assessment.id}/report-settings`}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5 border border-slate-200"
          >
            <Award className="h-3.5 w-3.5 text-blue-600" />
            <span>Customize Report Format &amp; Rubrics</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SECTIONS & QUESTIONS (Generic Multi-Section Architecture) */}
      {/* ========================================================================= */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Modular Assessment Sections</h2>
              <p className="text-xs text-slate-500">
                This assessment is generic: it can contain any number of sections ($N \ge 1$), each with independent timing, calculator access, and rules.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddSection}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-2xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Section</span>
            </button>
          </div>

          {/* List of Sections */}
          <div className="space-y-5">
            {assessment.sections.map((section, sIdx) => {
              const hasMinQuestions = section.questions.length <= 1

              return (
                <div
                  key={section.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden transition"
                >
                  {/* Section Top Header */}
                  <div className="bg-slate-50/80 p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {sIdx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                          {section.settings.calculatorAllowed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Calculator className="h-3 w-3" />
                              Calculator Allowed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              No Calculator
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock className="h-3 w-3" />
                            {section.settings.timingEnabled
                              ? `${section.settings.timeLimitMinutes} mins`
                              : 'Untimed'}
                          </span>

                          {section.settings.hasBreakAfter && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              <Coffee className="h-3 w-3" />
                              {section.settings.breakDurationMinutes}m Break After
                            </span>
                          )}
                        </div>
                        {section.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Section Management Toolbar */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        disabled={sIdx === 0}
                        onClick={() => handleMoveSection(sIdx, -1)}
                        title="Move Section Up"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={sIdx === assessment.sections.length - 1}
                        onClick={() => handleMoveSection(sIdx, 1)}
                        title="Move Section Down"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditSectionModal(section)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                      >
                        <Sliders className="h-3.5 w-3.5 text-blue-600" />
                        <span>Section Settings</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSection(section.id)}
                        title="Duplicate Section"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={assessment.sections.length <= 1}
                        onClick={() => handleDeleteSection(section.id, section.title)}
                        title={
                          assessment.sections.length <= 1
                            ? 'An assessment must have at least 1 section'
                            : 'Delete section'
                        }
                        className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-30 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section Questions Sub-list */}
                  <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-700">
                        Section Questions ({section.questions.length})
                        <span className="text-slate-400 font-normal ml-2">
                          (Minimum of 1 question required)
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => openQuestionPicker(section.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add from Question Bank</span>
                      </button>
                    </div>

                    {/* Question items */}
                    <div className="space-y-3">
                      {section.questions.map((qItem, qIdx) => {
                        const bankMatch = bankQuestions.find((bq) => bq.id === qItem.questionId)
                        const promptText =
                          qItem.questionSnapshot?.prompt ||
                          bankMatch?.prompt ||
                          'Question Prompt Preview'
                        const diff =
                          qItem.questionSnapshot?.difficulty || bankMatch?.difficulty || 'medium'
                        const qType =
                          qItem.questionSnapshot?.questionType ||
                          bankMatch?.questionType ||
                          'multiple_choice'

                        return (
                          <div
                            key={qItem.id}
                            className="bg-slate-50/70 hover:bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {qIdx + 1}
                              </span>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {qType.replace('_', ' ')}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                      diff === 'easy'
                                        ? 'bg-emerald-100/70 text-emerald-800'
                                        : diff === 'hard'
                                        ? 'bg-rose-100/70 text-rose-800'
                                        : 'bg-amber-100/70 text-amber-800'
                                    }`}
                                  >
                                    {diff}
                                  </span>
                                  {bankMatch?.domain && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                      • {bankMatch.domain}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-800 font-medium mt-1 line-clamp-1">
                                  {promptText}
                                </p>
                              </div>
                            </div>

                            {/* Question Actions */}
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <div className="flex items-center gap-1">
                                <label className="text-[11px] text-slate-500 font-medium">Points:</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={qItem.pointsOverride ?? 1}
                                  onChange={(e) =>
                                    handleUpdatePoints(section.id, qItem.id, Number(e.target.value))
                                  }
                                  className="w-14 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs text-center font-semibold"
                                />
                              </div>

                              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                                <button
                                  type="button"
                                  disabled={qIdx === 0}
                                  onClick={() => handleMoveQuestion(section.id, qIdx, -1)}
                                  className="p-1 rounded-lg hover:bg-white text-slate-500 disabled:opacity-30"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={qIdx === section.questions.length - 1}
                                  onClick={() => handleMoveQuestion(section.id, qIdx, 1)}
                                  className="p-1 rounded-lg hover:bg-white text-slate-500 disabled:opacity-30"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateQuestion(section.id, qItem.id)}
                                  title="Duplicate question in section"
                                  className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600 transition"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={hasMinQuestions}
                                  onClick={() => handleRemoveQuestion(section.id, qItem.id)}
                                  title={
                                    hasMinQuestions
                                      ? 'Each section must have at least 1 question'
                                      : 'Remove question from section'
                                  }
                                  className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 disabled:opacity-30 ml-1 transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ASSESSMENT SETTINGS ("as the previous project") */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Card A: General & Identity */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              <span>Assessment Overview & Identity</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assessment Title</label>
                <input
                  type="text"
                  value={assessment.title}
                  onChange={(e) => handleUpdateAssessment({ title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Sub-header</label>
                <input
                  type="text"
                  value={assessment.subtitle || ''}
                  onChange={(e) => handleUpdateAssessment({ subtitle: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={assessment.subject}
                    onChange={(e) => handleUpdateAssessment({ subject: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Grade / Level</label>
                  <input
                    type="text"
                    value={assessment.grade}
                    onChange={(e) => handleUpdateAssessment({ grade: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assessment Description</label>
                <textarea
                  rows={2}
                  value={assessment.description || ''}
                  onChange={(e) => handleUpdateAssessment({ description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  General Directions / Instructions
                </label>
                <textarea
                  rows={2}
                  value={assessment.instructions || ''}
                  onChange={(e) => handleUpdateAssessment({ instructions: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Card B: Timing & Delivery Mode */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>Timing & Delivery Modes</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Timer Mode</label>
                <select
                  value={assessment.settings.timerMode}
                  onChange={(e) => handleUpdateSettings({ timerMode: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 bg-white"
                >
                  <option value="per_section">Per-Section Timers (Independent)</option>
                  <option value="per_assessment">Single Overall Assessment Timer</option>
                  <option value="untimed">Untimed Mode</option>
                </select>
              </div>

              {assessment.settings.timerMode === 'per_assessment' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Overall Minutes Allowed
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={assessment.settings.timerMinutes}
                    onChange={(e) => handleUpdateSettings({ timerMinutes: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Allowed Attempts</label>
                <select
                  value={assessment.settings.attempts}
                  onChange={(e) => handleUpdateSettings({ attempts: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 bg-white"
                >
                  <option value={1}>1 Attempt Only</option>
                  <option value={2}>2 Attempts</option>
                  <option value={3}>3 Attempts</option>
                  <option value={0}>Unlimited Attempts</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card C: Navigation & Behavior */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-blue-600" />
              <span>Navigation & Delivery Rules</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Allow Backtracking</div>
                  <div className="text-[11px] text-slate-500">Students may revisit previous questions.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.allowBack}
                  onChange={(e) => handleUpdateSettings({ allowBack: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Require Answer</div>
                  <div className="text-[11px] text-slate-500">Must select an answer before advancing.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.requireAnswer}
                  onChange={(e) => handleUpdateSettings({ requireAnswer: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Auto-Save Progress</div>
                  <div className="text-[11px] text-slate-500">Persist student responses in real time.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.saveProgress}
                  onChange={(e) => handleUpdateSettings({ saveProgress: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Shuffle Answer Choices</div>
                  <div className="text-[11px] text-slate-500">Randomize multiple-choice option order.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.shuffleChoices}
                  onChange={(e) => handleUpdateSettings({ shuffleChoices: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>
            </div>
          </div>

          {/* Card D: Results & Feedback */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span>After Submission & Feedback</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Show Final Score</div>
                  <div className="text-[11px] text-slate-500">Show student score percentage upon submission.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.showScore}
                  onChange={(e) => handleUpdateSettings({ showScore: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Show Correct Answers</div>
                  <div className="text-[11px] text-slate-500">Reveal correct answers in diagnostic review.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.showCorrectAnswers}
                  onChange={(e) => handleUpdateSettings({ showCorrectAnswers: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Show Step-by-Step Explanations</div>
                  <div className="text-[11px] text-slate-500">Provide detailed rationales for each problem.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.showExplanations}
                  onChange={(e) => handleUpdateSettings({ showExplanations: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Show Diagnostic Analytics</div>
                  <div className="text-[11px] text-slate-500">Display domain mastery radar and time analysis.</div>
                </div>
                <input
                  type="checkbox"
                  checked={assessment.settings.showAnalytics}
                  onChange={(e) => handleUpdateSettings({ showAnalytics: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
              </label>
            </div>
          </div>

          {/* Card E: Student Registration Fields */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Student Registration / Intake Fields</span>
            </h3>
            <p className="text-xs text-slate-500">
              Select which fields students must fill out prior to beginning this assessment.
            </p>

            <div className="space-y-2">
              {(assessment.settings.studentFields || []).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/60"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-800">{f.label}</span>
                    <span className="text-[10px] text-slate-400 ml-2 uppercase">({f.type})</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() => handleToggleStudentField(f.id, 'enabled')}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>Enabled</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!f.enabled}
                        checked={f.required}
                        onChange={() => handleToggleStudentField(f.id, 'required')}
                        className="rounded border-slate-300 text-blue-600 disabled:opacity-40"
                      />
                      <span>Required</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card F: Security & Passcode */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>Security & Access Control</span>
            </h3>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
              <div>
                <div className="text-xs font-semibold text-slate-800">Passcode Protection</div>
                <div className="text-[11px] text-slate-500">
                  Students must enter this passcode to launch the diagnostic.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={assessment.settings.passcodeEnabled}
                  onChange={(e) => handleUpdateSettings({ passcodeEnabled: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                {assessment.settings.passcodeEnabled && (
                  <input
                    type="text"
                    value={assessment.settings.passcode}
                    onChange={(e) => handleUpdateSettings({ passcode: e.target.value })}
                    placeholder="Enter passcode"
                    className="w-28 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white font-mono text-center font-bold"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LIVE STUDENT SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === 'preview' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4 max-w-2xl mx-auto shadow-2xs">
          <PlayCircle className="h-12 w-12 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Student Live Preview</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            Experience the complete multi-section examination flow including section transitions, scheduled breaks, individual countdown timers, and calculator visibility policy.
          </p>
          <div className="pt-2">
            <Link
              to={`/assessment/${assessment.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <PlayCircle className="h-4 w-4" />
              <span>Launch Live Preview Mode</span>
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SECTION SETTINGS */}
      {/* ========================================================================= */}
      {editingSection && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-600" />
                <span>Configure Section Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSectionSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="e.g. Module 1: Math or Section 1 (No Calculator)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Description / Specific Instructions
                </label>
                <textarea
                  rows={2}
                  value={sectionDesc}
                  onChange={(e) => setSectionDesc(e.target.value)}
                  placeholder="e.g. For questions in this section, calculators are strictly prohibited..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              {/* Section Timing */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">Timed Section</label>
                  <input
                    type="checkbox"
                    checked={sectionSettings.timingEnabled}
                    onChange={(e) =>
                      setSectionSettings((prev) => ({ ...prev, timingEnabled: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                </div>
                {sectionSettings.timingEnabled && (
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <span className="text-xs text-slate-600">Time Limit:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={sectionSettings.timeLimitMinutes}
                        onChange={(e) =>
                          setSectionSettings((prev) => ({
                            ...prev,
                            timeLimitMinutes: Number(e.target.value),
                          }))
                        }
                        className="w-20 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-center font-bold"
                      />
                      <span className="text-xs text-slate-500">minutes</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tools & Policies */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Calculator Allowed</div>
                    <div className="text-[11px] text-slate-500">
                      Show on-screen calculator during this section.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sectionSettings.calculatorAllowed}
                    onChange={(e) =>
                      setSectionSettings((prev) => ({
                        ...prev,
                        calculatorAllowed: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <span className="text-xs font-medium text-slate-700">Allow Backtracking in Section</span>
                  <input
                    type="checkbox"
                    checked={sectionSettings.allowBack}
                    onChange={(e) =>
                      setSectionSettings((prev) => ({ ...prev, allowBack: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <span className="text-xs font-medium text-slate-700">Require Answer Before Next</span>
                  <input
                    type="checkbox"
                    checked={sectionSettings.requireAnswer}
                    onChange={(e) =>
                      setSectionSettings((prev) => ({ ...prev, requireAnswer: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                </div>
              </div>

              {/* Break Intermission */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Scheduled Break After Section</div>
                    <div className="text-[11px] text-slate-500">
                      Present intermission screen before next section begins.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sectionSettings.hasBreakAfter}
                    onChange={(e) =>
                      setSectionSettings((prev) => ({ ...prev, hasBreakAfter: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600"
                  />
                </div>

                {sectionSettings.hasBreakAfter && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Break Duration:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={sectionSettings.breakDurationMinutes}
                          onChange={(e) =>
                            setSectionSettings((prev) => ({
                              ...prev,
                              breakDurationMinutes: Number(e.target.value),
                            }))
                          }
                          className="w-20 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-center font-bold"
                        />
                        <span className="text-xs text-slate-500">minutes</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 font-medium mb-1">
                        Break Message:
                      </label>
                      <input
                        type="text"
                        value={sectionSettings.breakInstructions || ''}
                        onChange={(e) =>
                          setSectionSettings((prev) => ({
                            ...prev,
                            breakInstructions: e.target.value,
                          }))
                        }
                        placeholder="e.g. Take a 10-minute break before Module 2."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-xs"
                >
                  Save Section Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD QUESTIONS FROM QUESTION BANK */}
      {/* ========================================================================= */}
      {pickerSectionId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-slate-200 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Questions from Question Bank</h3>
                <p className="text-xs text-slate-500">
                  Select questions to add to this section. (Minimum 1 question per section is preserved).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerSectionId(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search prompt or lesson..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <select
                value={pickerDomainFilter}
                onChange={(e) => setPickerDomainFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="all">All Domains</option>
                {uniqueDomains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={pickerDifficultyFilter}
                onChange={(e) => setPickerDifficultyFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredPickerQuestions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No matching questions found or all are already added to this section.
                </div>
              ) : (
                filteredPickerQuestions.map((q) => {
                  const isSelected = selectedQuestionIds.includes(q.id)

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleTogglePickQuestion(q.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">{q.domain}</span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700">
                            {q.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-slate-900 font-medium mt-1 line-clamp-2">{q.prompt}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-600 font-medium">
                {selectedQuestionIds.length} question(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickerSectionId(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedQuestionIds.length === 0}
                  onClick={handleConfirmAddQuestions}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 shadow-xs cursor-pointer"
                >
                  Add Selected to Section
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareAssessmentModal
          assessmentId={assessment.id}
          assessmentName={assessment.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </AdminLayout>
  )
}

export default AssessmentDetailPage
