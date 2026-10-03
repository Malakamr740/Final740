import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ShareAssessmentModal from '../components/ShareAssessmentModal'
import {
  assessmentService,
  type Assessment,
} from '../lib/assessmentService'
import { computeAssessmentStatistics } from '../lib/assessmentStatistics'
import {
  Plus,
  FileText,
  ChevronRight,
  Clock,
  Users,
  Copy,
  Trash2,
  Share2,
  Download,
  Upload,
  Search,
  Layers,
  Sparkles,
  PlayCircle,
  BarChart3,
  AlertCircle,
  Calculator,
  Sliders,
  CheckCircle2,
} from 'lucide-react'

export const AssessmentsPage: React.FC = () => {
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [shareTarget, setShareTarget] = useState<Assessment | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJsonText, setImportJsonText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    loadAssessments()
  }, [])

  const loadAssessments = async () => {
    // 1. Instant local render
    const list = assessmentService.getAssessments()
    setAssessments(list)

    // 2. Fetch and merge latest records from database
    try {
      const dbList = await assessmentService.fetchAssessmentsFromDatabase()
      if (Array.isArray(dbList)) {
        setAssessments(dbList)
      }
    } catch (e) {
      console.warn('Notice: loading from local storage, database sync pending:', e)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This will also remove it from the database.`)) {
      assessmentService.deleteAssessment(id)
      await loadAssessments()
      setToastMessage(`Deleted "${title}" successfully.`)
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const cloned = assessmentService.duplicateAssessment(id)
      await loadAssessments()
      setToastMessage(`Duplicated as "${cloned.title}"!`)
      setTimeout(() => setToastMessage(null), 3500)
      navigate(`/admin/assessments/${cloned.id}`)
    } catch (err: any) {
      alert('Failed to duplicate assessment: ' + err.message)
    }
  }

  const handleExport = (a: Assessment) => {
    const json = assessmentService.exportAssessmentJSON(a.id)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${a.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_assessment.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setImportError(null)
    try {
      const imported = assessmentService.importAssessmentJSON(importJsonText)
      setShowImportModal(false)
      setImportJsonText('')
      loadAssessments()
      navigate(`/admin/assessments/${imported.id}`)
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON format')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const imported = assessmentService.importAssessmentJSON(text)
        setShowImportModal(false)
        setImportJsonText('')
        loadAssessments()
        navigate(`/admin/assessments/${imported.id}`)
      } catch (err: any) {
        setImportError(err.message || 'Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const filteredAssessments = assessments.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.grade.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getTotalQuestions = (a: Assessment): number => {
    return a.sections.reduce((sum, sec) => sum + (sec.questions?.length || 0), 0)
  }

  const getTotalTime = (a: Assessment): number => {
    if (a.settings.timerMode === 'per_assessment') {
      return a.settings.timerMinutes || 0
    }
    return a.sections.reduce((sum, sec) => sum + (sec.settings.timingEnabled ? sec.settings.timeLimitMinutes : 0), 0)
  }

  return (
    <AdminLayout
      title="Assessments"
      subtitle="Manage diagnostic assessments, multi-section architecture, and test delivery rules"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition shadow-2xs"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import JSON</span>
          </button>
          <Link
            to="/admin/assessments/new"
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Assessment</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments by title, level..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-medium bg-white focus:outline-none"
            >
              <option value="all">All Assessments</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Assessment grid */}
        {filteredAssessments.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No assessments found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create a new modular assessment or import an existing assessment JSON configuration.
            </p>
            <div className="pt-2">
              <Link
                to="/admin/assessments/new"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Assessment</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAssessments.map((a) => {
              const totalQ = getTotalQuestions(a)
              const totalTime = getTotalTime(a)
              const sectionCount = a.sections.length

              return (
                <div
                  key={a.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between min-w-0"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {a.grade}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            a.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : a.status === 'draft'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(a.id)}
                          title="Duplicate assessment"
                          className="p-1 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(a)}
                          title="Export JSON backup"
                          className="p-1 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, a.title)}
                          title="Delete assessment"
                          className="p-1 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-2.5 text-sm font-bold text-slate-900 leading-snug">{a.title}</h3>
                    {a.subtitle && (
                      <p className="text-xs text-slate-500 mt-0.5 font-normal line-clamp-1">{a.subtitle}</p>
                    )}

                    {/* Metadata chips */}
                    <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <Layers className="h-3.5 w-3.5 text-indigo-500" />
                        {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                        {totalQ} {totalQ === 1 ? 'question' : 'questions'}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        {totalTime > 0 ? `${totalTime} mins` : 'Untimed'}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="h-3.5 w-3.5 text-emerald-500" />
                        {a.attemptsCount || 0} completed
                      </span>
                    </div>

                    {/* Section preview preview */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.sections.slice(0, 3).map((sec, sIdx) => (
                        <span
                          key={sec.id}
                          className="text-[10px] bg-slate-100/80 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          <span className="font-semibold">{sIdx + 1}.</span>
                          <span className="truncate max-w-[140px]">{sec.title}</span>
                          {sec.settings.calculatorAllowed && (
                            <span title="Calculator Allowed">
                              <Calculator className="h-2.5 w-2.5 text-emerald-600 inline" />
                            </span>
                          )}
                        </span>
                      ))}
                      {a.sections.length > 3 && (
                        <span className="text-[10px] text-slate-400 px-1 py-0.5">
                          +{a.sections.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Submission Statistics Snapshot */}
                    {(() => {
                      const cardStats = computeAssessmentStatistics(a)
                      const weak = cardStats.topWeakDomains[0]
                      const strong = cardStats.topStrongDomains[0]
                      return (
                        <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <BarChart3 className="h-3 w-3 text-blue-600" />
                              <span>Submission Statistics:</span>
                            </span>
                            <Link
                              to={`/admin/assessments/${a.id}/results`}
                              className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              Detailed Analytics →
                            </Link>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                            <div className="bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                              <div className="text-slate-400 font-medium">Avg Score</div>
                              <div className="font-bold text-slate-900 text-xs mt-0.5">
                                {cardStats.averageScore}%
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-rose-100 shadow-2xs">
                              <div className="text-rose-600 font-medium truncate">Top Weak Area</div>
                              <div className="font-bold text-rose-700 truncate mt-0.5">
                                {weak ? `${weak.name.slice(0, 14)} (${weak.accuracy}%)` : 'None'}
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                              <div className="text-emerald-600 font-medium truncate">Top Strong Area</div>
                              <div className="font-bold text-emerald-700 truncate mt-0.5">
                                {strong ? `${strong.name.slice(0, 14)} (${strong.accuracy}%)` : 'Evaluating'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/take/${a.id}?mode=learning`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1.5 rounded-xl border border-indigo-200 transition"
                        title="Launch interactive practice with instant mathematical explanations"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Practice & Learn</span>
                      </Link>

                      <Link
                        to={`/assessment/${a.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition"
                        title="Experience this diagnostic test from the student viewpoint"
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Student Portal</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          setShareTarget({
                            ...a,
                            name: a.title,
                          } as any)
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"
                      >
                        <Share2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Share</span>
                      </button>

                      <Link
                        to={`/admin/assessments/${a.id}/results`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Analytics</span>
                      </Link>

                      <Link
                        to={`/admin/assessments/${a.id}/report-settings`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition"
                        title="Customize report format and rubrics for this assessment"
                      >
                        <Sliders className="h-3.5 w-3.5 text-slate-400" />
                        <span>Report Format</span>
                      </Link>
                    </div>

                    <Link
                      to={`/admin/assessments/${a.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition"
                    >
                      <span>Configure</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareTarget && (
        <ShareAssessmentModal
          assessmentId={shareTarget.id}
          assessmentName={shareTarget.title}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* Import JSON Modal */}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                <span>Import Assessment JSON</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload .json File
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="text-center text-xs text-slate-400 font-semibold">— OR PASTE JSON TEXT —</div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Raw JSON Content
                </label>
                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Paste assessment JSON export here..."
                  className="w-full p-3 rounded-xl border border-slate-200 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!importJsonText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                >
                  Import Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AssessmentsPage
