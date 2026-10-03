import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import {
  reportTemplateService,
  type ReportTemplateConfig,
  type RubricTier,
  type ReportSectionId,
  type ReportSectionRule,
  type DomainRubricCopy,
  REPORT_SECTION_DISPLAY_FIELDS,
  DEFAULT_REPORT_RUBRIC_TIERS,
} from '../lib/reportTemplateService'
import { assessmentService, type Assessment } from '../lib/assessmentService'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import {
  Sliders,
  CheckCircle2,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Eye,
  SlidersHorizontal,
  FileText,
  Layers,
  Sparkles,
  Award,
  Clock,
  HelpCircle,
  TrendingUp,
} from 'lucide-react'

export const ReportSettingsPage: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId?: string }>()

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(assessmentId || 'global')
  const [template, setTemplate] = useState<ReportTemplateConfig>(() =>
    reportTemplateService.getTemplateForAssessment(assessmentId)
  )
  const [savedTemplate, setSavedTemplate] = useState<ReportTemplateConfig>(() =>
    reportTemplateService.getTemplateForAssessment(assessmentId)
  )

  const [activeTab, setActiveTab] = useState<'sections' | 'rubric' | 'thresholds' | 'branding'>('sections')
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [newTier, setNewTier] = useState<Partial<RubricTier>>({
    name: '',
    minScore: 0,
    maxScore: 100,
    badgeColor: 'blue',
    description: '',
    recommendation: '',
  })
  const [showAddTierModal, setShowAddTierModal] = useState(false)

  useEffect(() => {
    const list = assessmentService.getAssessments()
    setAssessments(list)
  }, [])

  useEffect(() => {
    let active = true
    reportTemplateService
      .loadTemplateForAssessment(selectedAssessmentId === 'global' ? undefined : selectedAssessmentId)
      .then((loaded) => {
        if (active) {
          setTemplate(loaded)
          setSavedTemplate(loaded)
        }
      })
      .catch((error) => console.warn('Failed to load report settings:', error))
    return () => {
      active = false
    }
  }, [selectedAssessmentId])

  const handleAssessmentChange = (id: string) => {
    setSelectedAssessmentId(id)
  }

  const persistTemplate = async () => {
    await reportTemplateService.saveTemplateForAssessment(
      selectedAssessmentId === 'global' ? undefined : selectedAssessmentId,
      template
    )
    setSavedTemplate(template)
    markClean()
    setSaveSuccess(
      `Report format and rubrics successfully saved for ${
        selectedAssessmentId === 'global'
          ? 'all global assessments'
          : assessments.find((a) => a.id === selectedAssessmentId)?.title || 'selected assessment'
      }!`
    )
    setTimeout(() => setSaveSuccess(null), 3500)
  }

  const handleSave = async () => {
    try {
      await persistTemplate()
    } catch (err: any) {
      alert('Failed to save report configuration: ' + err.message)
    }
  }

  const markClean = useUnsavedChanges(
    JSON.stringify(template) !== JSON.stringify(savedTemplate),
    persistTemplate
  )

  const handleReset = async () => {
    if (confirm('Reset this assessment report layout and rubrics back to system defaults?')) {
      const resetConfig = await reportTemplateService.resetTemplate(
        selectedAssessmentId === 'global' ? undefined : selectedAssessmentId
      )
      setTemplate(resetConfig)
      setSavedTemplate(resetConfig)
      markClean()
      setSaveSuccess('Report format reset to default settings.')
      setTimeout(() => setSaveSuccess(null), 3000)
    }
  }

  const handleToggleSection = (key: ReportSectionId) => {
    setTemplate((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleUpdateSectionRule = (key: ReportSectionId, rule: ReportSectionRule | null) => {
    setTemplate((prev) => {
      const sectionRules = { ...prev.sectionRules }
      if (rule) sectionRules[key] = rule
      else delete sectionRules[key]
      return { ...prev, sectionRules }
    })
  }

  const handleUpdateSectionFields = (key: ReportSectionId, fields: string[]) => {
    setTemplate((prev) => ({
      ...prev,
      sectionFields: { ...prev.sectionFields, [key]: fields },
    }))
  }

  const handleUpdateDomainRubricCopy = (
    band: 'strong' | 'moderate' | 'weak',
    field: keyof DomainRubricCopy,
    value: string
  ) => {
    setTemplate((prev) => ({
      ...prev,
      domainRubricCopy: {
        ...prev.domainRubricCopy,
        [band]: { ...prev.domainRubricCopy[band], [field]: value },
      },
    }))
  }

  const handlePreviewReport = () => {
    try {
      localStorage.setItem('math_diag_report_preview', JSON.stringify(template))
      sessionStorage.setItem('math_diag_report_preview', JSON.stringify(template))
    } catch {}
  }

  const handleUpdateRubricTier = (index: number, updates: Partial<RubricTier>) => {
    const updated = [...template.rubricTiers]
    updated[index] = { ...updated[index], ...updates }
    setTemplate((prev) => ({ ...prev, rubricTiers: updated }))
  }

  const handleDeleteRubricTier = (index: number) => {
    if (template.rubricTiers.length <= 1) {
      alert('You must have at least one rubric tier defined.')
      return
    }
    const updated = template.rubricTiers.filter((_, i) => i !== index)
    setTemplate((prev) => ({ ...prev, rubricTiers: updated }))
  }

  const handleAddTier = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTier.name?.trim()) {
      alert('Please enter a tier name.')
      return
    }

    const tierItem: RubricTier = {
      id: `tier_${Date.now().toString(36)}`,
      name: newTier.name.trim(),
      minScore: Number(newTier.minScore) || 0,
      maxScore: Number(newTier.maxScore) || 100,
      badgeColor: newTier.badgeColor || 'blue',
      description: newTier.description?.trim() || '',
      recommendation: newTier.recommendation?.trim() || '',
    }

    setTemplate((prev) => ({
      ...prev,
      rubricTiers: [...prev.rubricTiers, tierItem].sort((a, b) => b.minScore - a.minScore),
    }))

    setShowAddTierModal(false)
    setNewTier({
      name: '',
      minScore: 0,
      maxScore: 100,
      badgeColor: 'blue',
      description: '',
      recommendation: '',
    })
  }

  const sectionToggles: Array<{
    key: ReportSectionId
    label: string
    description: string
    icon: React.ReactNode
    category: string
  }> = [
    {
      key: 'showHeroMetrics',
      label: 'Hero Banner & Overall Score Metric Cards',
      description: 'Display top banner with overall percentage, tier classification, total duration, and assessed question count.',
      icon: <Award className="h-4 w-4 text-blue-600" />,
      category: 'Header & Metrics',
    },
    {
      key: 'showThreeStateDonut',
      label: 'Three-State Donut Chart (Correct / Incorrect / Unanswered)',
      description: 'Display interactive chart and visual count of question statuses.',
      icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
      category: 'Charts & Performance',
    },
    {
      key: 'showStrongDomains',
      label: 'Strong Domains Mastery Cards',
      description: 'Display curricular areas where student achieved score at or above strong benchmark with 2-sentence rationale.',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      category: 'Domain Mastery',
    },
    {
      key: 'showWeakDomains',
      label: 'Weak Domains (Focus Areas) Cards',
      description: 'Highlight topic areas where student scored below moderate threshold with actionable remedial guidance.',
      icon: <HelpCircle className="h-4 w-4 text-rose-600" />,
      category: 'Domain Mastery',
    },
    {
      key: 'showTimeAnalysis',
      label: 'Behavioral Time Analysis & Pacing Metrics',
      description: 'Highlight average time per question, category speed differences, and fastest / slowest solved items.',
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      category: 'Behavior & Timing',
    },
    {
      key: 'showTaxonomyTree',
      label: 'Curricular Taxonomy Hierarchy Tree',
      description: 'Provide interactive Domain → Chapter → Lesson tree breakdown for filtering questions.',
      icon: <Layers className="h-4 w-4 text-purple-600" />,
      category: 'Curriculum',
    },
    {
      key: 'showErrorPatterns',
      label: 'Error Pattern Diagnosis (Conceptual vs Rushed vs Overthought)',
      description: 'Categorize missed questions by cognitive mistake type (under 25s rushed, over 100s timesink, conceptual).',
      icon: <SlidersHorizontal className="h-4 w-4 text-indigo-600" />,
      category: 'Behavior & Timing',
    },
    {
      key: 'showQuestionSolutions',
      label: 'Question Review & Step-by-Step Solutions',
      description: 'Full question review cards with choices, student selections, correct indicators, and LaTeX mathematical explanations.',
      icon: <FileText className="h-4 w-4 text-blue-600" />,
      category: 'Question Detail',
    },
    {
      key: 'showActionPlan',
      label: 'Personalized Post-Assessment Action Roadmap',
      description: 'Personalized study plan, phased milestones, and weekly study rhythm derived from student survey input.',
      icon: <Sparkles className="h-4 w-4 text-purple-600" />,
      category: 'Action Plans',
    },
    {
      key: 'showCourseRecommendations',
      label: 'Prescriptive Study Recommendations & Recommended Courses',
      description: 'Course remediation recommendations with contact links and enrollment CTAs.',
      icon: <Award className="h-4 w-4 text-teal-600" />,
      category: 'Recommendations',
    },
  ]

  const domainRubricBands = [
    { id: 'strong' as const, label: template.categoryLabels.strong, color: 'emerald' },
    { id: 'moderate' as const, label: template.categoryLabels.moderate, color: 'amber' },
    { id: 'weak' as const, label: template.categoryLabels.weak, color: 'rose' },
  ]

  return (
    <AdminLayout
      title="Report Format & Rubrics Customizer"
      subtitle="Customize generated student diagnostic score reports, visible sections, domain mastery criteria, and rubric performance tiers"
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/report/demo?preview=1"
            onClick={handlePreviewReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
          >
            <Eye className="h-3.5 w-3.5 text-blue-600" />
            <span>Preview Report</span>
          </Link>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Report Configuration</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-5xl">
        {/* Toast */}
        {saveSuccess && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* Assessment Scope Selector Banner */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                Configuration Target
              </span>
              <span className="text-xs text-slate-500">
                {selectedAssessmentId === 'global' ? 'Applies to all assessments unless overridden' : 'Assessment-specific override'}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              Select Assessment to Customize Report For
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              You can define a universal global report format or customize individual sections and rubric bands per assessment.
            </p>
          </div>

          <div className="flex items-center gap-2 min-w-[280px]">
            <select
              value={selectedAssessmentId}
              onChange={(e) => handleAssessmentChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="global">🌐 Universal Template (Default for All Assessments)</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  📄 {a.title} ({a.grade})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'sections'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Report Sections &amp; Visibility</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rubric')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'rubric'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Rubric Performance Tiers ({template.rubricTiers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('thresholds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'thresholds'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Mastery Thresholds &amp; Criteria</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Headers &amp; Custom Guidance</span>
          </button>
        </div>

        {/* TAB 1: Sections & Visibility */}
        {activeTab === 'sections' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Visible Sections on Generated Student Reports
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle which diagnostic modules, charts, and recommendations appear on the student score card and exported PDF.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {sectionToggles.map((item) => {
                const isEnabled = Boolean(template[item.key])
                const rule = template.sectionRules?.[item.key]
                const availableFields = REPORT_SECTION_DISPLAY_FIELDS[item.key]
                const visibleFields = template.sectionFields?.[item.key] ?? availableFields.map((field) => field.id)
                const includedFieldLabels = availableFields
                  .filter((field) => visibleFields.includes(field.id))
                  .map((field) => field.label)
                return (
                  <div
                    key={String(item.key)}
                    onClick={() => handleToggleSection(item.key)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start justify-between gap-4 cursor-pointer min-w-0 w-full ${
                      isEnabled
                        ? 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1 w-full">
                      <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 break-words">{item.label}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isEnabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isEnabled ? 'VISIBLE' : 'HIDDEN'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">
                          {item.description}
                        </p>
                        <div
                          className="mt-3 flex flex-wrap items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="text-[11px] font-semibold text-slate-600 shrink-0">Show when</span>
                          <select
                            value={rule?.metric || 'always'}
                            onChange={(event) => {
                              const metric = event.target.value
                              if (metric === 'always') {
                                handleUpdateSectionRule(item.key, null)
                                return
                              }
                              handleUpdateSectionRule(item.key, {
                                metric: metric as ReportSectionRule['metric'],
                                operator: metric === 'grade' ? 'contains' : 'gte',
                                value: rule?.value || '',
                              })
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 max-w-full"
                          >
                            <option value="always">Always</option>
                            <option value="grade">Student grade</option>
                            <option value="score">Overall score (%)</option>
                            <option value="totalTimeMinutes">Total time (minutes)</option>
                            <option value="avgTimeSeconds">Average time per question (seconds)</option>
                            <option value="questionCount">Question count</option>
                          </select>
                          {rule && (
                            <>
                              <select
                                value={rule.operator}
                                onChange={(event) =>
                                  handleUpdateSectionRule(item.key, {
                                    ...rule,
                                    operator: event.target.value as ReportSectionRule['operator'],
                                  })
                                }
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 max-w-full"
                              >
                                {rule.metric === 'grade' ? (
                                  <>
                                    <option value="contains">contains</option>
                                    <option value="equals">is exactly</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="gte">at least</option>
                                    <option value="lte">at most</option>
                                    <option value="equals">equals</option>
                                  </>
                                )}
                              </select>
                              <input
                                type={rule.metric === 'grade' ? 'text' : 'number'}
                                value={rule.value}
                                onChange={(event) =>
                                  handleUpdateSectionRule(item.key, { ...rule, value: event.target.value })
                                }
                                placeholder={rule.metric === 'grade' ? 'e.g. Grade 10' : 'Value'}
                                className="w-28 max-w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700"
                              />
                            </>
                          )}
                        </div>
                        <div
                          className="mt-3 border-t border-slate-200/70 pt-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-700">Data shown in report</span>
                            <span className="text-[10px] font-medium text-slate-500">
                              {includedFieldLabels.length} of {availableFields.length} fields included
                            </span>
                          </div>
                          <p className="mb-2 text-[10px] leading-relaxed text-slate-500 break-words">
                            {includedFieldLabels.length > 0
                              ? `Included: ${includedFieldLabels.join(' · ')}`
                              : 'No data fields included; this section will show its heading only.'}
                          </p>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {availableFields.map((field) => (
                              <div key={field.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/80 min-w-0">
                                <span className="text-[11px] text-slate-600 truncate mr-1" title={field.label}>{field.label}</span>
                                <div className="flex shrink-0 items-center gap-1.5 ml-auto">
                                  <span className={`text-[10px] font-semibold ${
                                    visibleFields.includes(field.id) ? 'text-blue-700' : 'text-slate-400'
                                  }`}>
                                    {visibleFields.includes(field.id) ? 'Included' : 'Hidden'}
                                  </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-label={field.label}
                                    aria-checked={visibleFields.includes(field.id)}
                                    onClick={() => {
                                      const isIncluded = visibleFields.includes(field.id)
                                      const nextFields = isIncluded
                                        ? visibleFields.filter((visibleField) => visibleField !== field.id)
                                        : [...visibleFields, field.id]
                                      handleUpdateSectionFields(item.key, nextFields)
                                    }}
                                    className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                                      visibleFields.includes(field.id) ? 'bg-blue-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                      visibleFields.includes(field.id) ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex shrink-0 sm:flex-col flex-row items-center justify-between sm:justify-start gap-1.5 self-end sm:self-start pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/70 w-full sm:w-auto"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="text-[10px] font-semibold text-slate-500 sm:hidden">Visibility:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          role="switch"
                          aria-label={`Show ${item.label}`}
                          aria-checked={isEnabled}
                          onClick={() => handleToggleSection(item.key)}
                          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                            isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                        <span className="text-[9px] font-semibold uppercase text-slate-500 min-w-[20px]">
                          {isEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Rubric Performance Tiers */}
        {activeTab === 'rubric' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Customizable Rubric &amp; Evaluation Tiers
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define score percentage ranges, classification badges, diagnostic descriptions, and prescriptive recommendations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTierModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition self-start sm:self-auto cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Rubric Tier</span>
              </button>
            </div>

            <div className="space-y-4">
              {template.rubricTiers.map((tier, idx) => (
                <div
                  key={tier.id || idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Tier {idx + 1}</span>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleUpdateRubricTier(idx, { name: e.target.value })}
                        className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
                        placeholder="Tier Title (e.g. Mastery Tier)"
                      />
                      <select
                        value={tier.badgeColor || 'blue'}
                        onChange={(e) => handleUpdateRubricTier(idx, { badgeColor: e.target.value })}
                        className="text-xs font-semibold bg-white border border-slate-200 px-2 py-1 rounded-xl text-slate-700"
                      >
                        <option value="emerald">Emerald (Mastery)</option>
                        <option value="blue">Blue (Proficient)</option>
                        <option value="amber">Amber (Developing)</option>
                        <option value="rose">Rose (Foundational)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="font-semibold">Score:</span>
                        <input
                          type="number"
                          value={tier.minScore}
                          onChange={(e) => handleUpdateRubricTier(idx, { minScore: Number(e.target.value) })}
                          className="w-14 bg-white border border-slate-200 px-2 py-1 rounded-lg text-center font-bold text-xs"
                          min="0"
                          max="100"
                        />
                        <span>% to</span>
                        <input
                          type="number"
                          value={tier.maxScore}
                          onChange={(e) => handleUpdateRubricTier(idx, { maxScore: Number(e.target.value) })}
                          className="w-14 bg-white border border-slate-200 px-2 py-1 rounded-lg text-center font-bold text-xs"
                          min="0"
                          max="100"
                        />
                        <span>%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRubricTier(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete this rubric tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Diagnostic Evaluation Summary
                      </label>
                      <textarea
                        value={tier.description}
                        onChange={(e) => handleUpdateRubricTier(idx, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Explanation displayed when student qualifies in this tier..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Prescriptive Next-Step Recommendation
                      </label>
                      <textarea
                        value={tier.recommendation}
                        onChange={(e) => handleUpdateRubricTier(idx, { recommendation: e.target.value })}
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Actionable study guidance for this score band..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Mastery Thresholds */}
        {activeTab === 'thresholds' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Diagnostic Mastery &amp; Pacing Thresholds
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set numerical parameters that classify domains as "Strong", "Moderate", or "Weak Focus Areas".
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/30 space-y-3">
                <div className="text-xs font-bold text-slate-900">Category Labels</div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={template.categoryLabels?.strong || 'Strong Domains'}
                    onChange={(e) =>
                      setTemplate((prev) => ({
                        ...prev,
                        categoryLabels: {
                          ...prev.categoryLabels,
                          strong: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Strong category label"
                  />
                  <input
                    type="text"
                    value={template.categoryLabels?.moderate || 'Developing Domains'}
                    onChange={(e) =>
                      setTemplate((prev) => ({
                        ...prev,
                        categoryLabels: {
                          ...prev.categoryLabels,
                          moderate: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Moderate category label"
                  />
                  <input
                    type="text"
                    value={template.categoryLabels?.weak || 'Focus Areas'}
                    onChange={(e) =>
                      setTemplate((prev) => ({
                        ...prev,
                        categoryLabels: {
                          ...prev.categoryLabels,
                          weak: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Weak category label"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Strong Domain Threshold</span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      ≥ {template.strongThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={template.strongThreshold}
                    onChange={(e) =>
                      setTemplate((prev) => ({ ...prev, strongThreshold: Number(e.target.value) }))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-emerald-800">
                    Curricular domains at or above this percentage are flagged as mastered strengths.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Moderate Band Threshold</span>
                    <span className="text-sm font-extrabold text-amber-700">
                      ≥ {template.moderateThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    step="5"
                    value={template.moderateThreshold}
                    onChange={(e) =>
                      setTemplate((prev) => ({ ...prev, moderateThreshold: Number(e.target.value) }))
                    }
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-amber-800">
                    Domains between this value and the strong threshold are marked Moderate.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-900">Pacing Delay Flag</span>
                    <span className="text-sm font-extrabold text-sky-700">
                      +{template.slowTimeThresholdPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={template.slowTimeThresholdPct}
                    onChange={(e) =>
                      setTemplate((prev) => ({ ...prev, slowTimeThresholdPct: Number(e.target.value) }))
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <p className="text-[11px] text-sky-800">
                    Questions taking this percentage above average pace are flagged as slow timesinks.
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Category Rubric Details</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Define the exact rule and teacher guidance shown for each domain classification.
                  Values in braces are replaced with the student&apos;s results.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {domainRubricBands.map((band) => {
                  const rubricCopy = template.domainRubricCopy[band.id]
                  const ruleSummary =
                    band.id === 'strong'
                      ? `Accuracy ≥ ${template.strongThreshold}%`
                      : band.id === 'moderate'
                      ? `Accuracy ≥ ${template.moderateThreshold}% and < ${template.strongThreshold}%`
                      : `Accuracy < ${template.moderateThreshold}%`

                  return (
                    <div key={band.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{band.label}</div>
                        <div className="mt-1 rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 border border-slate-200">
                          Applied rule: {ruleSummary}
                        </div>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Rule shown to student</span>
                        <textarea
                          value={rubricCopy.criterion}
                          onChange={(event) => handleUpdateDomainRubricCopy(band.id, 'criterion', event.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Performance explanation</span>
                        <textarea
                          value={rubricCopy.explanation}
                          onChange={(event) => handleUpdateDomainRubricCopy(band.id, 'explanation', event.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Recommended next step</span>
                        <textarea
                          value={rubricCopy.recommendation}
                          onChange={(event) => handleUpdateDomainRubricCopy(band.id, 'recommendation', event.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Available values: {'{category}'}, {'{accuracy}'}, {'{correct}'}, {'{total}'}, {'{avgTime}'}, {'{strongThreshold}'}, {'{moderateThreshold}'}.
                Timing classification remains controlled by the pacing threshold above.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Headers & Guidance */}
        {activeTab === 'branding' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Report Title, Header Banners &amp; Custom Instructions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Generic text displayed at the top and bottom of the diagnostic report and PDF exports.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Report Organization / Header Title
                </label>
                <input
                  type="text"
                  value={template.title}
                  onChange={(e) => setTemplate((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  placeholder="e.g. Scholar Academy Diagnostic Platform"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Report Subtitle / Evaluation Tagline
                </label>
                <input
                  type="text"
                  value={template.subtitle || ''}
                  onChange={(e) => setTemplate((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Standardized Diagnostic Performance Assessment"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Hero Banner Small Header Label
                </label>
                <input
                  type="text"
                  value={template.headerBannerText || ''}
                  onChange={(e) => setTemplate((prev) => ({ ...prev, headerBannerText: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Student Diagnostic Evaluation"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Custom Guidance Section Title
                  </label>
                  <input
                    type="text"
                    value={template.customNotesTitle || ''}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, customNotesTitle: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Diagnostic Overview &amp; Educator Guidance"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Footer Legal / System Disclaimer
                  </label>
                  <input
                    type="text"
                    value={template.footerDisclaimer || ''}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, footerDisclaimer: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Report automatically compiled by Scholar Academy Math Assessment System."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Custom Guidance Body / Administrative Notes
                </label>
                <textarea
                  value={template.customNotesBody || ''}
                  onChange={(e) => setTemplate((prev) => ({ ...prev, customNotesBody: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  placeholder="Add custom notes or educator instructions to be displayed on student reports..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Rubric Tier Modal */}
      {showAddTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Rubric Tier</h3>
              <button
                type="button"
                onClick={() => setShowAddTierModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTier} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tier Title / Name
                </label>
                <input
                  type="text"
                  required
                  value={newTier.name}
                  onChange={(e) => setNewTier((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Exceptional Mastery Tier"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Min Score (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newTier.minScore}
                    onChange={(e) =>
                      setNewTier((prev) => ({ ...prev, minScore: Number(e.target.value) }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Max Score (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newTier.maxScore}
                    onChange={(e) =>
                      setNewTier((prev) => ({ ...prev, maxScore: Number(e.target.value) }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Badge Color
                </label>
                <select
                  value={newTier.badgeColor}
                  onChange={(e) => setNewTier((prev) => ({ ...prev, badgeColor: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="emerald">Emerald (Advanced/Mastery)</option>
                  <option value="blue">Blue (Proficient)</option>
                  <option value="amber">Amber (Developing)</option>
                  <option value="rose">Rose (Foundational)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Diagnostic Evaluation Description
                </label>
                <textarea
                  value={newTier.description}
                  onChange={(e) => setNewTier((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Summary of student proficiency..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Prescriptive Study Advice
                </label>
                <textarea
                  value={newTier.recommendation}
                  onChange={(e) => setNewTier((prev) => ({ ...prev, recommendation: e.target.value }))}
                  rows={2}
                  placeholder="Recommended remedial pathway..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTierModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default ReportSettingsPage
