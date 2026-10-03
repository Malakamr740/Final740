import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { assessmentService, type Assessment, type AssessmentSection } from '../lib/assessmentService'
import { questionBankService, type QuestionBankItem } from '../lib/questionBankService'
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Calculator,
  Search,
  Check,
  Sliders,
  AlertCircle,
} from 'lucide-react'

export const ModuleQuestionsPage: React.FC = () => {
  const { assessmentId, moduleId } = useParams<{ assessmentId: string; moduleId: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [section, setSection] = useState<AssessmentSection | null>(null)
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [selectedQIds, setSelectedQIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (assessmentId) {
      const a = assessmentService.getAssessmentById(assessmentId)
      if (a) {
        setAssessment(a)
        const sec = a.sections.find((s) => s.id === moduleId) || a.sections[0] || null
        setSection(sec)
      }
    }
    questionBankService.fetchQuestionsFromDatabase()
      .then((qList) => setBankQuestions(qList))
      .catch(() => setBankQuestions(questionBankService.getStoredQuestions()))
  }, [assessmentId, moduleId])

  if (!assessment || !section) {
    return (
      <AdminLayout title="Section Not Found">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <h2 className="text-sm font-bold text-slate-800">Section not found</h2>
          <Link
            to={`/admin/assessments/${assessmentId || ''}`}
            className="inline-block text-xs font-semibold text-blue-600 hover:underline"
          >
            Back to Assessment Studio
          </Link>
        </div>
      </AdminLayout>
    )
  }

  const handleRemoveQuestion = (qItemId: string) => {
    if (section.questions.length <= 1) {
      alert('Each section must have at least 1 question. You cannot delete the only question.')
      return
    }
    try {
      const updated = assessmentService.removeQuestionFromSection(assessment.id, section.id, qItemId)
      setAssessment(updated)
      setSection(updated.sections.find((s) => s.id === section.id) || null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleMoveQuestion = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= section.questions.length) return

    const newQuestions = [...section.questions]
    const temp = newQuestions[idx]
    newQuestions[idx] = newQuestions[targetIdx]
    newQuestions[targetIdx] = temp

    try {
      const updated = assessmentService.reorderSectionQuestions(
        assessment.id,
        section.id,
        newQuestions.map((q) => q.id)
      )
      setAssessment(updated)
      setSection(updated.sections.find((s) => s.id === section.id) || null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleAddSelectedQuestions = () => {
    if (selectedQIds.length === 0) return
    try {
      const updated = assessmentService.addQuestionsToSection(assessment.id, section.id, selectedQIds)
      setAssessment(updated)
      setSection(updated.sections.find((s) => s.id === section.id) || null)
      setShowPicker(false)
      setSelectedQIds([])
    } catch (err: any) {
      alert(err.message)
    }
  }

  const assignedQIds = new Set(section.questions.map((q) => q.questionId))
  const availableQuestions = bankQuestions.filter((q) => {
    if (assignedQIds.has(q.id)) return false
    if (!searchQuery.trim()) return true
    return (
      q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.domain.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <AdminLayout
      title={`${section.title} - Questions`}
      subtitle={`Manage questions and points for this section in ${assessment.title}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/assessments/${assessment.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Assessment Studio</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowPicker(true)}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Questions</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Section Policy Ribbon */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800">{section.title}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {section.settings.timingEnabled ? `${section.settings.timeLimitMinutes} mins` : 'Untimed'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 flex items-center gap-1">
              <Calculator className="h-3.5 w-3.5 text-emerald-500" />
              {section.settings.calculatorAllowed ? 'Calculator Allowed' : 'No Calculator'}
            </span>
          </div>

          <span className="text-slate-500 font-semibold">{section.questions.length} questions</span>
        </div>

        {/* Question Cards */}
        <div className="space-y-3">
          {section.questions.map((qItem, idx) => {
            const bankMatch = bankQuestions.find((q) => q.id === qItem.questionId)
            const prompt = qItem.questionSnapshot?.prompt || bankMatch?.prompt || 'Question Prompt'
            const diff = qItem.questionSnapshot?.difficulty || bankMatch?.difficulty || 'medium'

            return (
              <div
                key={qItem.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700">
                        {diff}
                      </span>
                      {bankMatch?.domain && (
                        <span className="text-[10px] text-slate-400">{bankMatch.domain}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-medium mt-1 line-clamp-1">{prompt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveQuestion(idx, -1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === section.questions.length - 1}
                    onClick={() => handleMoveQuestion(idx, 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={section.questions.length <= 1}
                    onClick={() => handleRemoveQuestion(qItem.id)}
                    title={
                      section.questions.length <= 1
                        ? 'A section must have at least 1 question'
                        : 'Remove question'
                    }
                    className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 disabled:opacity-30 ml-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Picker Modal */}
      {showPicker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Add Questions to Section</h3>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {availableQuestions.map((q) => {
                const isSelected = selectedQIds.includes(q.id)
                return (
                  <div
                    key={q.id}
                    onClick={() =>
                      setSelectedQIds((prev) =>
                        prev.includes(q.id) ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                      )
                    }
                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 line-clamp-1">{q.prompt}</span>
                      <span className="text-[10px] text-slate-400">{q.domain} • {q.difficulty}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedQIds.length === 0}
                onClick={handleAddSelectedQuestions}
                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                Add {selectedQIds.length} Question(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default ModuleQuestionsPage
