import React, { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../components/AdminLayout'
import type {
  SurveyQuestion,
  ActionPlan,
  ActionPlanMilestone,
} from '../lib/surveyService'
import { surveyService } from '../lib/surveyService'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  RefreshCw,
  ListOrdered,
  X,
  Eye,
  ArrowUp,
  ArrowDown,
  Search,
  Target,
  BookOpen,
  Sliders,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react'

export const SurveyActionPlanAdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'questions' | 'plans'>('questions')
  const [questions, setQuestions] = useState<SurveyQuestion[]>(() => surveyService.getQuestions())
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>(() => surveyService.getActionPlans())

  useEffect(() => {
    let active = true
    Promise.all([
      surveyService.loadQuestionsFromDatabase(),
      surveyService.loadActionPlansFromDatabase(),
    ]).then(([savedQuestions, savedPlans]) => {
      if (!active) return
      setQuestions(savedQuestions)
      setActionPlans(savedPlans)
    }).catch((error) => console.error('Failed to load survey configuration:', error))
    return () => {
      active = false
    }
  }, [])

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Editing Question Modal State
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null)
  const [questionBaseline, setQuestionBaseline] = useState<SurveyQuestion | null>(null)
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)

  // Editing Plan Modal State
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null)
  const [planBaseline, setPlanBaseline] = useState<ActionPlan | null>(null)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)

  // Live Student Experience Preview State
  const [isStudentPreviewOpen, setIsStudentPreviewOpen] = useState(false)
  const [previewSimulatedScore, setPreviewSimulatedScore] = useState<number>(65)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({})
  const [previewSubmitted, setPreviewSubmitted] = useState(false)

  // In-app Delete / Reset Confirmation Modal State (replaces blocked window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'question' | 'plan' | 'reset-questions' | 'reset-plans'
    id?: string
    title: string
  } | null>(null)

  // Metrics computation
  const stats = useMemo(() => {
    const requiredQuestionsCount = questions.filter((q) => q.required).length
    const categoriesSet = new Set(questions.map((q) => q.category || 'general'))
    const totalMilestones = actionPlans.reduce(
      (acc, plan) => acc + (plan.milestones?.length || 0),
      0
    )
    return {
      totalQuestions: questions.length,
      requiredQuestions: requiredQuestionsCount,
      categoriesCount: categoriesSet.size,
      totalPlans: actionPlans.length,
      totalMilestones,
    }
  }, [questions, actionPlans])

  // Handlers for Questions
  const handleSaveQuestion = async (q: SurveyQuestion): Promise<boolean> => {
    let updated: SurveyQuestion[]
    if (questions.some((item) => item.id === q.id)) {
      updated = questions.map((item) => (item.id === q.id ? q : item))
    } else {
      updated = [...questions, { ...q, order_index: questions.length }]
    }
    setQuestions(updated)
    try {
      await surveyService.saveQuestions(updated)
    } catch (error) {
      alert(`Failed to save survey questions: ${String(error)}`)
      return false
    }
    setIsQuestionModalOpen(false)
    setEditingQuestion(null)
    setQuestionBaseline(null)
    markDraftClean()
    return true
  }

  const handleDeleteQuestion = (id: string) => {
    const target = questions.find((q) => q.id === id)
    setDeleteTarget({
      type: 'question',
      id,
      title: target ? target.prompt : 'this survey question',
    })
  }

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= questions.length) return
    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[targetIndex]
    newQuestions[targetIndex] = temp
    const reindexed = newQuestions.map((q, idx) => ({ ...q, order_index: idx }))
    setQuestions(reindexed)
    try {
      await surveyService.saveQuestions(reindexed)
    } catch (error) {
      alert(`Failed to save survey question order: ${String(error)}`)
    }
  }

  const handleResetQuestions = () => {
    setDeleteTarget({
      type: 'reset-questions',
      title: 'all survey questions to the default diagnostic template',
    })
  }

  // Handlers for Action Plans
  const handleSavePlan = async (plan: ActionPlan): Promise<boolean> => {
    let updated: ActionPlan[]
    if (actionPlans.some((p) => p.id === plan.id)) {
      updated = actionPlans.map((p) => (p.id === plan.id ? plan : p))
    } else {
      updated = [...actionPlans, plan]
    }
    // Sort plans by min_score ascending
    updated.sort((a, b) => (a.min_score ?? 0) - (b.min_score ?? 0))
    setActionPlans(updated)
    try {
      await surveyService.saveActionPlans(updated)
    } catch (error) {
      alert(`Failed to save action plans: ${String(error)}`)
      return false
    }
    setIsPlanModalOpen(false)
    setEditingPlan(null)
    setPlanBaseline(null)
    markDraftClean()
    return true
  }

  const handleDeletePlan = (id: string) => {
    const target = actionPlans.find((p) => p.id === id)
    setDeleteTarget({
      type: 'plan',
      id,
      title: target ? target.title : 'this action plan',
    })
  }

  const handleResetPlans = () => {
    setDeleteTarget({
      type: 'reset-plans',
      title: 'all action plans to the default templates',
    })
  }

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return

    if (deleteTarget.type === 'question' && deleteTarget.id) {
      const updated = questions
        .filter((q) => q.id !== deleteTarget.id)
        .map((q, idx) => ({ ...q, order_index: idx }))
      setQuestions(updated)
      await surveyService.saveQuestions(updated)
    } else if (deleteTarget.type === 'plan' && deleteTarget.id) {
      const updated = actionPlans.filter((p) => p.id !== deleteTarget.id)
      setActionPlans(updated)
      await surveyService.saveActionPlans(updated)
    } else if (deleteTarget.type === 'reset-questions') {
      const def = await surveyService.resetQuestions()
      setQuestions(def)
    } else if (deleteTarget.type === 'reset-plans') {
      const def = await surveyService.resetActionPlans()
      setActionPlans(def)
    }

    setDeleteTarget(null)
  }

  const handleOpenAddQuestion = () => {
    const draft: SurveyQuestion = {
      id: `q_${Date.now()}`,
      prompt: '',
      description: '',
      type: 'single_choice',
      required: true,
      order_index: questions.length,
      category: 'study_habits',
      options: [
        { id: `opt_${Date.now()}_1`, label: 'Option 1', value: 'opt_1' },
        { id: `opt_${Date.now()}_2`, label: 'Option 2', value: 'opt_2' },
      ],
    }
    setEditingQuestion(draft)
    setQuestionBaseline(draft)
    setIsQuestionModalOpen(true)
  }

  const closeQuestionEditor = () => {
    setIsQuestionModalOpen(false)
    setEditingQuestion(null)
    setQuestionBaseline(null)
  }

  const closePlanEditor = () => {
    setIsPlanModalOpen(false)
    setEditingPlan(null)
    setPlanBaseline(null)
  }

  const handleOpenAddPlan = () => {
    const draft: ActionPlan = {
      id: `plan_${Date.now()}`,
      title: 'New Custom Action Plan',
      tagline: 'Custom roadmap summary for score improvement',
      summary: 'Explanation of why this plan fits the student and their diagnostic test profile.',
      target_audience: 'Target score tier students',
      badge_color: 'blue',
      min_score: 50,
      max_score: 75,
      milestones: [
        {
          title: 'Phase 1: Diagnostic Audit & Foundation',
          timeframe: 'Weeks 1-2',
          description: 'Identify core curriculum gaps and establish baseline routines.',
          tasks: ['Review error log from diagnostic exam', 'Target 40 domain practice questions'],
        },
        {
          title: 'Phase 2: Timed Sprints & Strategy Polish',
          timeframe: 'Weeks 3-4',
          description: 'Strengthen pacing and reduce careless calculation slips.',
          tasks: ['Practice 20-minute timed modules', 'Master calculator shortcut techniques'],
        },
      ],
      weekly_routine: [
        { day_group: 'Monday & Wednesday', focus: 'Targeted Domain Problem Sets', suggested_hours: '2 Hours' },
        { day_group: 'Tuesday & Thursday', focus: 'Timed Mini-Sprints & Error Audit', suggested_hours: '1.5 Hours' },
        { day_group: 'Saturday', focus: 'Full Module Simulation & Review', suggested_hours: '2.5 Hours' },
      ],
      prescriptive_advice: [
        'Always read and underline the exact target variable asked in the problem.',
        'If an algebraic approach requires more than 5 lines, check for Desmos calculator shortcuts.',
      ],
      recommended_resources: [
        'Curriculum Question Bank with detailed step explanations',
        'Official Digital Diagnostic Module Practice Sets',
      ],
    }
    setEditingPlan(draft)
    setPlanBaseline(draft)
    setIsPlanModalOpen(true)
  }

  const questionDraftDirty = Boolean(
    isQuestionModalOpen && editingQuestion && questionBaseline &&
      JSON.stringify(editingQuestion) !== JSON.stringify(questionBaseline)
  )
  const planDraftDirty = Boolean(
    isPlanModalOpen && editingPlan && planBaseline &&
      JSON.stringify(editingPlan) !== JSON.stringify(planBaseline)
  )
  const saveActiveDraft = async () => {
    if (questionDraftDirty && editingQuestion) {
      if (!(await handleSaveQuestion(editingQuestion))) throw new Error('Survey question was not saved.')
    } else if (planDraftDirty && editingPlan) {
      if (!(await handleSavePlan(editingPlan))) throw new Error('Action plan was not saved.')
    }
  }
  const markDraftClean = useUnsavedChanges(questionDraftDirty || planDraftDirty, saveActiveDraft)

  // Filtered lists
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch =
        q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.description && q.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory =
        selectedCategory === 'all' || (q.category || 'general') === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [questions, searchQuery, selectedCategory])

  const filteredPlans = useMemo(() => {
    return actionPlans.filter((p) => {
      return (
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.target_audience.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [actionPlans, searchQuery])

  // Category helper
  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'timeline':
        return { label: 'Timeline & Deadlines', style: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'study_habits':
        return { label: 'Study Habits & Hours', style: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
      case 'challenges':
        return { label: 'Obstacles & Challenges', style: 'bg-amber-50 text-amber-800 border-amber-200' }
      case 'confidence':
        return { label: 'Confidence & Targets', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
      default:
        return { label: category || 'General', style: 'bg-slate-100 text-slate-700 border-slate-200' }
    }
  }

  // Score tier helper
  const getScoreTierBadge = (min?: number, max?: number) => {
    const minVal = min ?? 0
    if (minVal >= 85) {
      return { label: 'Elite Mastery Tier', style: 'bg-purple-50 text-purple-700 border-purple-200' }
    }
    if (minVal >= 70) {
      return { label: 'Advanced Polish Tier', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    }
    if (minVal >= 50) {
      return { label: 'Targeted Growth Tier', style: 'bg-blue-50 text-blue-700 border-blue-200' }
    }
    return { label: 'Foundation Tier', style: 'bg-amber-50 text-amber-800 border-amber-200' }
  }

  return (
    <AdminLayout
      title="Post-Assessment Surveys & Action Plans"
      subtitle="Configure dynamic reflection surveys and score-calibrated student growth roadmaps"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPreviewAnswers({})
              setPreviewSubmitted(false)
              setIsStudentPreviewOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span>Student Experience Preview</span>
          </button>
          {activeTab === 'questions' ? (
            <button
              type="button"
              onClick={handleOpenAddQuestion}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Survey Question</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddPlan}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Action Plan</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Summary KPI Banner Matching System Architecture */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Survey Questions
            </span>
            <p className="text-xl font-bold text-blue-950 mt-0.5">{stats.totalQuestions}</p>
            <p className="text-[11px] text-blue-600/80 mt-0.5">
              {stats.requiredQuestions} Required for calibration
            </p>
          </div>
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Survey Categories
            </span>
            <p className="text-xl font-bold text-indigo-950 mt-0.5">{stats.categoriesCount}</p>
            <p className="text-[11px] text-indigo-600/80 mt-0.5">Timeline, Habits, Obstacles</p>
          </div>
          <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
              Action Roadmaps
            </span>
            <p className="text-xl font-bold text-teal-950 mt-0.5">{stats.totalPlans}</p>
            <p className="text-[11px] text-teal-600/80 mt-0.5">0% – 100% Score Range Covered</p>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Phased Milestones
            </span>
            <p className="text-xl font-bold text-emerald-950 mt-0.5">{stats.totalMilestones}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Structured study phases</p>
          </div>
        </div>

        {/* Tab Switcher & Filter Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'questions'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                <span>Survey Questions</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeTab === 'questions'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {questions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'plans'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Action Roadmaps & Plans</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeTab === 'plans'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {actionPlans.length}
                </span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {activeTab === 'questions' ? (
                <button
                  type="button"
                  onClick={handleResetQuestions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  title="Reset questions to system defaults"
                >
                  <RefreshCw className="h-3 w-3 text-slate-500" />
                  <span>Reset Defaults</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetPlans}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  title="Reset action plans to system defaults"
                >
                  <RefreshCw className="h-3 w-3 text-slate-500" />
                  <span>Reset Defaults</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'questions'
                    ? 'Search questions by prompt or description...'
                    : 'Search action plans by title, audience, or summary...'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {activeTab === 'questions' && (
              <div className="w-full sm:w-auto flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  <option value="timeline">Timeline & Deadlines</option>
                  <option value="study_habits">Study Habits & Hours</option>
                  <option value="challenges">Obstacles & Challenges</option>
                  <option value="confidence">Confidence & Targets</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Survey Questions Content */}
        {activeTab === 'questions' && (
          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <ListOrdered className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No Survey Questions Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? 'No questions match your current search query. Try clearing filters.'
                    : 'No survey questions currently exist. Add a question or reset to defaults.'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedCategory('all')
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Clear Search
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenAddQuestion}
                    style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Add Question
                  </button>
                </div>
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const categoryInfo = getCategoryBadge(q.category)
                const isFirst = idx === 0
                const isLast = idx === filteredQuestions.length - 1

                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    {/* Left details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Order indicator & Up/Down buttons */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Move Question Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Move Question Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${categoryInfo.style}`}
                          >
                            {categoryInfo.label}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase tracking-wide">
                            {q.type.replace('_', ' ')}
                          </span>
                          {q.required ? (
                            <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              Required
                            </span>
                          ) : (
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Optional
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                          {q.prompt}
                        </h4>

                        {q.description && (
                          <p className="text-xs text-slate-500">{q.description}</p>
                        )}

                        {/* Options preview */}
                        {q.options && q.options.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1">
                            {q.options.map((opt) => (
                              <span
                                key={opt.id}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] text-slate-700"
                              >
                                {opt.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-start border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestion(q)
                          setQuestionBaseline(JSON.parse(JSON.stringify(q)))
                          setIsQuestionModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                        title="Edit question"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                        title="Delete question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Tab 2: Action Plans & Roadmaps Content */}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPlans.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No Action Plans Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? 'No action plans match your search query.'
                    : 'Create your first personalized student roadmap.'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAddPlan}
                    style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Create Action Plan
                  </button>
                </div>
              </div>
            ) : (
              filteredPlans.map((plan) => {
                const tierInfo = getScoreTierBadge(plan.min_score, plan.max_score)

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between min-w-0"
                  >
                    <div>
                      {/* Top Badges & Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tierInfo.style}`}
                          >
                            Score Band: {plan.min_score ?? 0}% – {plan.max_score ?? 100}%
                          </span>
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            Target: {plan.target_audience}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPlan(plan)
                              setPlanBaseline(JSON.parse(JSON.stringify(plan)))
                              setIsPlanModalOpen(true)
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                            title="Edit plan"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(plan.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                            title="Delete plan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Tagline */}
                      <h3 className="text-base font-bold text-slate-900 mt-2">{plan.title}</h3>
                      <p className="text-xs font-semibold text-blue-600 mt-0.5">{plan.tagline}</p>

                      {/* Summary */}
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {plan.summary}
                      </p>

                      {/* Milestones Preview */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          Phased Milestones ({plan.milestones?.length || 0})
                        </span>
                        <div className="space-y-1.5">
                          {plan.milestones?.slice(0, 3).map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="flex items-start gap-2 rounded-xl bg-slate-50 p-2 border border-slate-100 text-xs"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                {mIdx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-slate-800 text-[11px] truncate">
                                    {m.title}
                                  </span>
                                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded-md shrink-0">
                                    {m.timeframe}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {m.description}
                                </p>
                              </div>
                            </div>
                          ))}
                          {plan.milestones && plan.milestones.length > 3 && (
                            <p className="text-[10px] text-slate-400 text-center pt-0.5">
                              + {plan.milestones.length - 3} more phases configured
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Weekly Routine Preview */}
                      {plan.weekly_routine && plan.weekly_routine.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                            Weekly Routine Sample
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {plan.weekly_routine.map((block, bi) => (
                              <span
                                key={bi}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700"
                              >
                                <span className="font-semibold">{block.day_group}:</span>{' '}
                                <span>{block.suggested_hours}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prescriptive advice callout */}
                    {plan.prescriptive_advice && plan.prescriptive_advice.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700 flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="italic line-clamp-2">
                            "{plan.prescriptive_advice[0]}"
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Modal: Edit / Create Survey Question */}
        {isQuestionModalOpen && editingQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {questions.some((q) => q.id === editingQuestion.id)
                      ? 'Edit Survey Question'
                      : 'Add Survey Question'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure question prompt, response type, and option choices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeQuestionEditor}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Question Prompt *
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.prompt}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, prompt: e.target.value })
                    }
                    placeholder="e.g. When is your official test date?"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Description / Subtitle Guidance
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.description || ''}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, description: e.target.value })
                    }
                    placeholder="e.g. Helps us tailor your study roadmap and pacing."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Category</label>
                    <select
                      value={editingQuestion.category || 'study_habits'}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, category: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      <option value="timeline">Timeline & Deadlines</option>
                      <option value="study_habits">Study Habits & Hours</option>
                      <option value="challenges">Obstacles & Challenges</option>
                      <option value="confidence">Confidence & Targets</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Response Type</label>
                    <select
                      value={editingQuestion.type}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          type: e.target.value as any,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      <option value="single_choice">Single Choice (Radio)</option>
                      <option value="multiple_choice">Multiple Choice (Pills)</option>
                      <option value="scale">Rating Scale (1 to 5)</option>
                      <option value="text">Open Text Reflection</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingQuestion.required}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, required: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-semibold text-slate-700">
                      Required question (Student must answer before report completion)
                    </span>
                  </label>
                </div>

                {/* Options Manager (for choice questions) */}
                {(editingQuestion.type === 'single_choice' ||
                  editingQuestion.type === 'multiple_choice') && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-semibold text-slate-700">
                        Configured Options ({editingQuestion.options?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const opts = editingQuestion.options || []
                          const newId = `opt_${Date.now()}`
                          setEditingQuestion({
                            ...editingQuestion,
                            options: [
                              ...opts,
                              { id: newId, label: `Option ${opts.length + 1}`, value: newId },
                            ],
                          })
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        + Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {editingQuestion.options?.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const updated = [...(editingQuestion.options || [])]
                              updated[idx] = {
                                ...opt,
                                label: e.target.value,
                                value: opt.value || e.target.value,
                              }
                              setEditingQuestion({ ...editingQuestion, options: updated })
                            }}
                            placeholder="Option text..."
                            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingQuestion.options?.filter((_, i) => i !== idx)
                              setEditingQuestion({ ...editingQuestion, options: updated })
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove option"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeQuestionEditor}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editingQuestion.prompt.trim()}
                  onClick={() => handleSaveQuestion(editingQuestion)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Edit / Create Action Plan */}
        {isPlanModalOpen && editingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {actionPlans.some((p) => p.id === editingPlan.id)
                      ? 'Edit Action Plan'
                      : 'Create Action Plan'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define the score band, milestones, routine, and prescriptive advice.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePlanEditor}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Plan Title *</label>
                  <input
                    type="text"
                    value={editingPlan.title}
                    onChange={(e) => setEditingPlan({ ...editingPlan, title: e.target.value })}
                    placeholder="e.g. Strategic 3-Month Score Optimizer"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Catchy Tagline</label>
                  <input
                    type="text"
                    value={editingPlan.tagline}
                    onChange={(e) => setEditingPlan({ ...editingPlan, tagline: e.target.value })}
                    placeholder="Short one-line strategic headline"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Summary Explanation
                  </label>
                  <textarea
                    rows={3}
                    value={editingPlan.summary}
                    onChange={(e) => setEditingPlan({ ...editingPlan, summary: e.target.value })}
                    placeholder="Explain why this plan matches the student's test results and diagnostic baseline..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Min Diagnostic Score (%)
                    </label>
                    <input
                      type="number"
                      value={editingPlan.min_score ?? 0}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, min_score: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Max Diagnostic Score (%)
                    </label>
                    <input
                      type="number"
                      value={editingPlan.max_score ?? 100}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, max_score: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      value={editingPlan.target_audience}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, target_audience: e.target.value })
                      }
                      placeholder="e.g. Test in 2-3 months"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Milestones editor */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-slate-700">
                      Roadmap Milestones ({editingPlan.milestones.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newMilestone: ActionPlanMilestone = {
                          title: `Phase ${editingPlan.milestones.length + 1}`,
                          timeframe: 'Weeks 1-2',
                          description: 'Key goals for this phase',
                          tasks: ['Practice specific domain sets', 'Review error logs'],
                        }
                        setEditingPlan({
                          ...editingPlan,
                          milestones: [...editingPlan.milestones, newMilestone],
                        })
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      + Add Milestone Phase
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingPlan.milestones.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={m.title}
                            onChange={(e) => {
                              const updated = [...editingPlan.milestones]
                              updated[mIdx] = { ...m, title: e.target.value }
                              setEditingPlan({ ...editingPlan, milestones: updated })
                            }}
                            placeholder="Phase Title"
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                          />
                          <input
                            type="text"
                            value={m.timeframe}
                            onChange={(e) => {
                              const updated = [...editingPlan.milestones]
                              updated[mIdx] = { ...m, timeframe: e.target.value }
                              setEditingPlan({ ...editingPlan, milestones: updated })
                            }}
                            placeholder="Timeframe"
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingPlan.milestones.filter((_, i) => i !== mIdx)
                              setEditingPlan({ ...editingPlan, milestones: updated })
                            }}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove phase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={m.description}
                          onChange={(e) => {
                            const updated = [...editingPlan.milestones]
                            updated[mIdx] = { ...m, description: e.target.value }
                            setEditingPlan({ ...editingPlan, milestones: updated })
                          }}
                          placeholder="Phase Description / Focus"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prescriptive advice editor */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-slate-700">Key Rules of Advice</label>
                    <button
                      type="button"
                      onClick={() => {
                        const current = editingPlan.prescriptive_advice || []
                        setEditingPlan({
                          ...editingPlan,
                          prescriptive_advice: [...current, 'New advice rule...'],
                        })
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      + Add Rule
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editingPlan.prescriptive_advice?.map((adv, ai) => (
                      <div key={ai} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={adv}
                          onChange={(e) => {
                            const updated = [...(editingPlan.prescriptive_advice || [])]
                            updated[ai] = e.target.value
                            setEditingPlan({ ...editingPlan, prescriptive_advice: updated })
                          }}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editingPlan.prescriptive_advice?.filter(
                              (_, i) => i !== ai
                            )
                            setEditingPlan({ ...editingPlan, prescriptive_advice: updated })
                          }}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePlanEditor}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editingPlan.title.trim()}
                  onClick={() => handleSavePlan(editingPlan)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
                >
                  Save Action Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Student Experience Preview Simulator Modal */}
        {isStudentPreviewOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Student Live Experience: Post-Assessment Survey & Action Plan
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStudentPreviewOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Score Simulation Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Simulate Student Exam Score:</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {previewSimulatedScore}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={previewSimulatedScore}
                  onChange={(e) => {
                    setPreviewSimulatedScore(Number(e.target.value))
                    setPreviewSubmitted(false)
                  }}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSimulatedScore(35)
                      setPreviewSubmitted(false)
                    }}
                    className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                  >
                    Foundation Tier (35%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSimulatedScore(65)
                      setPreviewSubmitted(false)
                    }}
                    className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                  >
                    Growth Tier (65%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSimulatedScore(92)
                      setPreviewSubmitted(false)
                    }}
                    className="px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                  >
                    Mastery Tier (92%)
                  </button>
                </div>
              </div>

              {!previewSubmitted ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Post-Assessment Self-Reflection
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your answers calibrate your custom study roadmap and targeted practice schedule.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-blue-600 shrink-0">{idx + 1}.</span>
                          <div>
                            <p className="font-semibold text-slate-800">{q.prompt}</p>
                            {q.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{q.description}</p>
                            )}
                          </div>
                        </div>

                        {q.type === 'scale' && (
                          <div className="flex gap-2 pt-1 pl-4">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: val })}
                                className={`w-9 h-9 rounded-xl font-bold text-xs transition cursor-pointer select-none ${
                                  previewAnswers[q.id] === val
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        )}

                        {(q.type === 'single_choice' || q.type === 'multiple_choice') &&
                          q.options && (
                            <div className="flex flex-wrap gap-2 pt-1 pl-4">
                              {q.options.map((opt, oi) => {
                                const isChosen = previewAnswers[q.id] === opt.value || previewAnswers[q.id] === opt.label
                                return (
                                  <button
                                    key={oi}
                                    type="button"
                                    onClick={() =>
                                      setPreviewAnswers({ ...previewAnswers, [q.id]: opt.value })
                                    }
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer select-none ${
                                      isChosen
                                        ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                        {q.type === 'text' && (
                          <div className="pl-4">
                            <textarea
                              rows={2}
                              value={previewAnswers[q.id] || ''}
                              onChange={(e) =>
                                setPreviewAnswers({ ...previewAnswers, [q.id]: e.target.value })
                              }
                              placeholder="Type your reflection here..."
                              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPreviewSubmitted(true)}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs cursor-pointer"
                    >
                      <span>Generate & Preview Matched Action Plan</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Generated Personalized Action Roadmap
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewSubmitted(false)}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      &larr; Retake Reflection
                    </button>
                  </div>

                  {(() => {
                    const matched =
                      actionPlans.find(
                        (p) =>
                          previewSimulatedScore >= (p.min_score ?? 0) &&
                          previewSimulatedScore <= (p.max_score ?? 100)
                      ) || actionPlans[0]

                    if (!matched) return null

                    return (
                      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {matched.target_audience || 'Target Plan'} ({matched.min_score ?? 0}% -{' '}
                            {matched.max_score ?? 100}%)
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>{matched.tagline}</span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-slate-900">{matched.title}</h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {matched.summary}
                          </p>
                        </div>

                        {/* Phased Roadmap Milestones */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Action Roadmap Milestones:
                          </span>
                          {matched.milestones.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                            >
                              <div className="font-semibold text-slate-800 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                                    {mIdx + 1}
                                  </span>
                                  <span>{m.title}</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                  {m.timeframe}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                                {m.description}
                              </p>
                              {m.tasks && m.tasks.length > 0 && (
                                <ul className="list-disc list-inside text-[11px] text-slate-600 pl-6 space-y-0.5 mt-1">
                                  {m.tasks.map((task, ti) => (
                                    <li key={ti}>{task}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Weekly Routine */}
                        {matched.weekly_routine && matched.weekly_routine.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Suggested Weekly Routine:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {matched.weekly_routine.map((block, bi) => (
                                <div
                                  key={bi}
                                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                                >
                                  <span className="font-semibold text-slate-900 block">
                                    {block.day_group}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {block.focus} · {block.suggested_hours}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Prescriptive advice */}
                        {matched.prescriptive_advice && matched.prescriptive_advice.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="italic leading-relaxed">
                                "{matched.prescriptive_advice[0]}"
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete / Reset Confirmation Modal */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
            role="dialog"
          >
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">Confirm Removal</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to remove <strong className="text-slate-800">"{deleteTarget.title}"</strong>?
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-semibold text-white transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default SurveyActionPlanAdminPage
