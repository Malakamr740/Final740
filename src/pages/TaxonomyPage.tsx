import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import {
  FolderTree,
  Plus,
  BookOpen,
  Bookmark,
  Layers,
  HelpCircle,
  Edit2,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  X,
  RotateCcw,
  Database,
  RefreshCw,
  Info,
} from 'lucide-react'
import { questionBankService, type TaxonomyRegistry, type QuestionBankItem } from '../lib/questionBankService'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'

type ActiveTab = 'overview' | 'manage' | 'matrix'

interface TaxonomyItemToDelete {
  type: 'domain' | 'chapter' | 'lesson' | 'all'
  domainName: string
  chapterName?: string
  lessonName?: string
  unitLabel?: string
  code?: string
  chaptersCount?: number
  lessonsCount?: number
  linkedQuestionsCount: number
}

interface StandardDomainCode {
  code: string
  label: string
  suggestedName: string
  suggestedUnit: string
}

const STANDARD_DOMAIN_CODES: StandardDomainCode[] = [
  {
    code: 'ALG',
    label: 'ALG — Algebra & Functions',
    suggestedName: 'Algebra & Functions',
    suggestedUnit: 'Unit 1: Foundations of Algebraic Modeling',
  },
  {
    code: 'GEO',
    label: 'GEO — Geometry & Trigonometry',
    suggestedName: 'Geometry & Trigonometry',
    suggestedUnit: 'Unit 2: Geometric & Spatial Reasoning',
  },
  {
    code: 'STAT',
    label: 'STAT — Statistics & Probability',
    suggestedName: 'Statistics & Probability',
    suggestedUnit: 'Unit 3: Data Analysis & Statistical Inference',
  },
  {
    code: 'ADV',
    label: 'ADV — Advanced Math & Pre-Calculus',
    suggestedName: 'Advanced Math & Pre-Calculus',
    suggestedUnit: 'Unit 4: Advanced Functions & Transformations',
  },
  {
    code: 'CALC',
    label: 'CALC — Calculus & Mathematical Analysis',
    suggestedName: 'Calculus & Mathematical Analysis',
    suggestedUnit: 'Unit 5: Differential & Integral Calculus',
  },
  {
    code: 'NUM',
    label: 'NUM — Numbers & Operations',
    suggestedName: 'Numbers & Number Systems',
    suggestedUnit: 'Unit 0: Numerical Fluency & Operations',
  },
  {
    code: 'PSDA',
    label: 'PSDA — Problem Solving & Data Analysis',
    suggestedName: 'Problem Solving & Data Analysis',
    suggestedUnit: 'Unit: Quantitative Reasoning & Modeling',
  },
  {
    code: 'FND',
    label: 'FND — Foundations of Mathematics',
    suggestedName: 'Foundations of Mathematics',
    suggestedUnit: 'Unit: Fundamental Mathematical Concepts',
  },
  {
    code: 'UNIT-1',
    label: 'UNIT-1 — Unit 1 Curriculum Module',
    suggestedName: 'Unit 1 Core Curriculum',
    suggestedUnit: 'Unit 1',
  },
  {
    code: 'UNIT-2',
    label: 'UNIT-2 — Unit 2 Curriculum Module',
    suggestedName: 'Unit 2 Core Curriculum',
    suggestedUnit: 'Unit 2',
  },
  {
    code: 'UNIT-3',
    label: 'UNIT-3 — Unit 3 Curriculum Module',
    suggestedName: 'Unit 3 Core Curriculum',
    suggestedUnit: 'Unit 3',
  },
  {
    code: 'UNIT-4',
    label: 'UNIT-4 — Unit 4 Curriculum Module',
    suggestedName: 'Unit 4 Core Curriculum',
    suggestedUnit: 'Unit 4',
  },
  {
    code: 'UNIT-5',
    label: 'UNIT-5 — Unit 5 Curriculum Module',
    suggestedName: 'Unit 5 Core Curriculum',
    suggestedUnit: 'Unit 5',
  },
  {
    code: 'UNIT-6',
    label: 'UNIT-6 — Unit 6 Curriculum Module',
    suggestedName: 'Unit 6 Core Curriculum',
    suggestedUnit: 'Unit 6',
  },
  {
    code: 'UNIT-7',
    label: 'UNIT-7 — Unit 7 Curriculum Module',
    suggestedName: 'Unit 7 Core Curriculum',
    suggestedUnit: 'Unit 7',
  },
  {
    code: 'UNIT-8',
    label: 'UNIT-8 — Unit 8 Curriculum Module',
    suggestedName: 'Unit 8 Core Curriculum',
    suggestedUnit: 'Unit 8',
  },
]

export const TaxonomyPage: React.FC = () => {
  const navigate = useNavigate()
  const [taxonomy, setTaxonomy] = useState<TaxonomyRegistry>({})
  const [questions, setQuestions] = useState<QuestionBankItem[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // Selected item in the hierarchy
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)

  // Deletion confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyItemToDelete | null>(null)
  const [deleteLinkedQuestions, setDeleteLinkedQuestions] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal / Form state for Add/Edit
  const [modalMode, setModalMode] = useState<'addDomain' | 'editDomain' | 'addChapter' | 'editChapter' | 'addLesson' | 'editLesson' | null>(null)
  const [hasTaxonomyDraftChanges, setHasTaxonomyDraftChanges] = useState(false)
  const [formDomainName, setFormDomainName] = useState('')
  const [formDomainUnitLabel, setFormDomainUnitLabel] = useState('')
  const [formDomainCode, setFormDomainCode] = useState('')
  const [isCustomDomainCode, setIsCustomDomainCode] = useState(false)
  const [formChapterName, setFormChapterName] = useState('')
  const [formChapterCode, setFormChapterCode] = useState('')
  const [isCustomChapterCode, setIsCustomChapterCode] = useState(false)
  const [formLessonName, setFormLessonName] = useState('')
  const [targetDomain, setTargetDomain] = useState('')
  const [targetChapter, setTargetChapter] = useState('')
  const [originalParentDomain, setOriginalParentDomain] = useState('')
  const [originalParentChapter, setOriginalParentChapter] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [isLoadingTaxonomy, setIsLoadingTaxonomy] = useState(true)
  const [isSavingTaxonomy, setIsSavingTaxonomy] = useState(false)
  const [isSyncingToSupabase, setIsSyncingToSupabase] = useState(false)

  // Load from service on mount
  const refreshData = async () => {
    try {
      const freshTax = await questionBankService.fetchTaxonomy()
      setTaxonomy(freshTax)
      const qList = await questionBankService.fetchQuestionsFromDatabase().catch(() => questionBankService.getStoredQuestions())
      setQuestions(qList || [])

      const domains = Object.keys(freshTax)
      if (domains.length > 0 && (!selectedDomain || !freshTax[selectedDomain])) {
        setSelectedDomain(domains[0])
        if (freshTax[domains[0]].chapters.length > 0) {
          setSelectedChapter(freshTax[domains[0]].chapters[0].name)
          if (freshTax[domains[0]].chapters[0].lessons.length > 0) {
            setSelectedLesson(freshTax[domains[0]].chapters[0].lessons[0])
          }
        }
      }
    } catch (e) {
      console.warn('Error refreshing taxonomy:', e)
      const tax = questionBankService.getTaxonomy()
      setTaxonomy(tax)
    }
  }

  useEffect(() => {
    let isMounted = true
    setIsLoadingTaxonomy(true)

    // Subscribe to any taxonomy updates
    const unsubscribe = questionBankService.subscribeTaxonomy((latestTax: any) => {
      if (!isMounted) return
      setTaxonomy(latestTax)
      const domains = Object.keys(latestTax)
      setSelectedDomain((prev) => (prev && latestTax[prev] ? prev : domains[0] || null))
    })

    // Fetch fresh taxonomy and questions from the database
    Promise.all([
      questionBankService.fetchTaxonomy(),
      questionBankService.fetchQuestionsFromDatabase().catch(() => questionBankService.getStoredQuestions()),
    ]).then(([freshTax, qList]) => {
      if (!isMounted) return
      setTaxonomy(freshTax)
      setQuestions(qList || [])
      const domains = Object.keys(freshTax)
      setSelectedDomain((prev) => (prev && freshTax[prev] ? prev : domains[0] || null))
    }).catch((err) => {
      console.warn('Error on initial taxonomy mount:', err)
      const tax = questionBankService.getTaxonomy()
      setTaxonomy(tax)
    }).finally(() => {
      if (isMounted) setIsLoadingTaxonomy(false)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

    const domainNames = Object.keys(taxonomy)

  // Calculate statistics linking questions to taxonomy
  const taxonomyStats = useMemo(() => {
    let totalLessonsCount = 0
    let totalChaptersCount = 0
    const domainCounts: Record<string, number> = {}
    const chapterCounts: Record<string, number> = {}
    const lessonCounts: Record<string, number> = {}

    // Initialize counts
    domainNames.forEach((d) => {
      domainCounts[d] = 0
      taxonomy[d].chapters.forEach((c) => {
        totalChaptersCount++
        chapterCounts[`${d}::${c.name}`] = 0
        c.lessons.forEach((l) => {
          totalLessonsCount++
          lessonCounts[`${d}::${c.name}::${l}`] = 0
        })
      })
    })

    // Match questions
    questions.forEach((q) => {
      if (q.domain && domainCounts[q.domain] !== undefined) {
        domainCounts[q.domain]++
      }
      if (q.domain && q.chapter) {
        const cKey = `${q.domain}::${q.chapter}`
        if (chapterCounts[cKey] !== undefined) {
          chapterCounts[cKey]++
        }
      }
      if (q.domain && q.chapter && q.lesson) {
        const lKey = `${q.domain}::${q.chapter}::${q.lesson}`
        if (lessonCounts[lKey] !== undefined) {
          lessonCounts[lKey]++
        }
      }
    })

    return {
      domainsCount: domainNames.length,
      chaptersCount: totalChaptersCount,
      lessonsCount: totalLessonsCount,
      totalQuestions: questions.length,
      domainCounts,
      chapterCounts,
      lessonCounts,
    }
  }, [taxonomy, questions, domainNames])

  // Get current active chapters and lessons
  const currentChapters = selectedDomain && taxonomy[selectedDomain] ? taxonomy[selectedDomain].chapters : []
  const currentChapterObj = currentChapters.find((c) => c.name === selectedChapter)
  const currentLessons = currentChapterObj ? currentChapterObj.lessons : []

  // Linked questions for currently selected level
  const linkedQuestions = useMemo(() => {
    if (selectedLesson && selectedChapter && selectedDomain) {
      return questions.filter(
        (q) => q.domain === selectedDomain && q.chapter === selectedChapter && q.lesson === selectedLesson
      )
    }
    if (selectedChapter && selectedDomain) {
      return questions.filter((q) => q.domain === selectedDomain && q.chapter === selectedChapter)
    }
    if (selectedDomain) {
      return questions.filter((q) => q.domain === selectedDomain)
    }
    return questions
  }, [questions, selectedDomain, selectedChapter, selectedLesson])

  // Chapter code dropdown options grouped dynamically based on targetDomain
  const chapterCodeOptions = useMemo(() => {
    const parent = targetDomain ? taxonomy[targetDomain] : null
    const parentCode = parent?.code || 'CH'
    const list: { code: string; label: string; suggestedTitle: string; group: string }[] = []

    // Domain-specific curated clusters
    if (parentCode.includes('ALG') || targetDomain.toLowerCase().includes('algebra')) {
      const algChapters = [
        { code: `${parentCode}.1`, label: 'Linear Equations & Systems', title: 'Linear Equations, Inequalities & Systems' },
        { code: `${parentCode}.2`, label: 'Quadratic & Polynomial Equations', title: 'Quadratic & Polynomial Equations' },
        { code: `${parentCode}.3`, label: 'Functions & Transformations', title: 'Functions, Compositions & Graphical Transformations' },
        { code: `${parentCode}.4`, label: 'Exponential & Logarithmic Functions', title: 'Exponential & Logarithmic Functions' },
        { code: `${parentCode}.5`, label: 'Rational & Radical Expressions', title: 'Rational & Radical Expressions' },
        { code: `${parentCode}.6`, label: 'Inequalities & Absolute Value', title: 'Inequalities & Absolute Value Modeling' },
        { code: `${parentCode}.7`, label: 'Sequences & Series', title: 'Sequences, Series & Progression Patterns' },
      ]
      algChapters.forEach((c) => list.push({ ...c, suggestedTitle: c.title, group: `Curated ${parentCode} Curriculum Clusters` }))
    } else if (parentCode.includes('GEO') || targetDomain.toLowerCase().includes('geometry')) {
      const geoChapters = [
        { code: `${parentCode}.1`, label: 'Lines, Angles & Triangles', title: 'Lines, Angles & Triangle Properties' },
        { code: `${parentCode}.2`, label: 'Right Triangle Trigonometry', title: 'Right Triangle Trigonometry & SOH-CAH-TOA' },
        { code: `${parentCode}.3`, label: 'Circles, Radians & Arc Length', title: 'Circles, Radians, Sectors & Tangents' },
        { code: `${parentCode}.4`, label: 'Coordinate Geometry & Conics', title: 'Coordinate Geometry & Conic Sections' },
        { code: `${parentCode}.5`, label: '3D Geometry & Solid Volume', title: '3D Solids, Surface Area & Volume' },
      ]
      geoChapters.forEach((c) => list.push({ ...c, suggestedTitle: c.title, group: `Curated ${parentCode} Curriculum Clusters` }))
    } else if (parentCode.includes('STAT') || targetDomain.toLowerCase().includes('statistic')) {
      const statChapters = [
        { code: `${parentCode}.1`, label: 'Descriptive Statistics & Summary Metrics', title: 'Descriptive Statistics & Central Tendency' },
        { code: `${parentCode}.2`, label: 'Probability & Combinatorics', title: 'Probability, Combinations & Conditional Odds' },
        { code: `${parentCode}.3`, label: 'Normal Distributions & Empirical Rule', title: 'Normal Distributions & Standard Z-Scores' },
        { code: `${parentCode}.4`, label: 'Scatterplots & Linear Regression', title: 'Two-Variable Data, Scatterplots & Correlation' },
        { code: `${parentCode}.5`, label: 'Surveys, Sampling & Inferences', title: 'Sampling Methods & Statistical Inferences' },
      ]
      statChapters.forEach((c) => list.push({ ...c, suggestedTitle: c.title, group: `Curated ${parentCode} Curriculum Clusters` }))
    }

    // Numbered Sequence options based on parent code (1 to 8)
    for (let i = 1; i <= 8; i++) {
      const code = `${parentCode}.${i}`
      if (!list.some((o) => o.code === code)) {
        list.push({ code, label: `Chapter ${i}`, suggestedTitle: `Chapter ${i}`, group: `${parentCode} Numbered Sequence` })
      }
    }

    // General chapter codes CH.1 to CH.6
    for (let i = 1; i <= 6; i++) {
      const code = `CH.${i}`
      if (!list.some((o) => o.code === code)) {
        list.push({ code, label: `General Chapter ${i}`, suggestedTitle: `Chapter ${i}`, group: 'Standard Chapter Codes' })
      }
    }

    return list
  }, [targetDomain, taxonomy])

  // Handlers for Add/Edit actions
  const handleOpenAddDomain = () => {
    setFormDomainName('')
    setFormDomainUnitLabel(`Unit ${domainNames.length + 1}: `)
    const initialCode = STANDARD_DOMAIN_CODES[domainNames.length % STANDARD_DOMAIN_CODES.length]?.code || 'ALG'
    setFormDomainCode(initialCode)
    setIsCustomDomainCode(false)
    setModalMode('addDomain')
  }

  const handleOpenEditDomain = (domain: string) => {
    const data = taxonomy[domain]
    setOriginalName(domain)
    setFormDomainName(domain)
    setFormDomainUnitLabel(data?.unitLabel || '')
    const curCode = data?.code || ''
    setFormDomainCode(curCode)
    setIsCustomDomainCode(curCode ? !STANDARD_DOMAIN_CODES.some((c) => c.code === curCode) : false)
    setModalMode('editDomain')
  }

  const handleOpenAddChapter = (defaultDomain?: string) => {
    const domain = defaultDomain || selectedDomain || domainNames[0] || ''
    setTargetDomain(domain)
    setOriginalParentDomain(domain)
    setFormChapterName('')
    const pCode = taxonomy[domain]?.code || 'CH'
    const nextNum = (taxonomy[domain]?.chapters.length || 0) + 1
    const initialCode = `${pCode}.${nextNum}`
    setFormChapterCode(initialCode)
    setIsCustomChapterCode(false)
    setModalMode('addChapter')
  }

  const handleOpenEditChapter = (domain: string, chapter: { name: string; code?: string }) => {
    setTargetDomain(domain)
    setOriginalParentDomain(domain)
    setOriginalName(chapter.name)
    setFormChapterName(chapter.name)
    const curCode = chapter.code || ''
    setFormChapterCode(curCode)
    setIsCustomChapterCode(false)
    setModalMode('editChapter')
  }

  const handleOpenAddLesson = (defaultDomain?: string, defaultChapter?: string) => {
    const domain = defaultDomain || selectedDomain || domainNames[0] || ''
    const availableChaps = taxonomy[domain]?.chapters || []
    const chapter = defaultChapter || selectedChapter || availableChaps[0]?.name || ''
    setTargetDomain(domain)
    setTargetChapter(chapter)
    setOriginalParentDomain(domain)
    setOriginalParentChapter(chapter)
    setFormLessonName('')
    setModalMode('addLesson')
  }

  const handleOpenEditLesson = (domain: string, chapter: string, lesson: string) => {
    setTargetDomain(domain)
    setTargetChapter(chapter)
    setOriginalParentDomain(domain)
    setOriginalParentChapter(chapter)
    setOriginalName(lesson)
    setFormLessonName(lesson)
    setModalMode('editLesson')
  }

  const persistTaxonomyModal = async () => {
    if (!modalMode) return false

    const requiresDomainName = modalMode === 'addDomain' || modalMode === 'editDomain'
    const requiresChapterName = modalMode === 'addChapter' || modalMode === 'editChapter'
    const requiresLessonName = modalMode === 'addLesson' || modalMode === 'editLesson'

    if (
      (requiresDomainName && !formDomainName.trim()) ||
      (requiresChapterName && !formChapterName.trim()) ||
      (requiresLessonName && !formLessonName.trim())
    ) {
      return false
    }

    if (modalMode === 'addDomain' && formDomainName.trim()) {
      await questionBankService.addDomain(formDomainName.trim(), formDomainUnitLabel.trim(), formDomainCode.trim())
      setSelectedDomain(formDomainName.trim())
    } else if (modalMode === 'editDomain' && formDomainName.trim()) {
      await questionBankService.updateDomain(originalName, formDomainName.trim(), formDomainUnitLabel.trim(), formDomainCode.trim())
      if (selectedDomain === originalName) setSelectedDomain(formDomainName.trim())
    } else if (modalMode === 'addChapter' && formChapterName.trim()) {
      await questionBankService.addChapter(targetDomain, formChapterName.trim(), formChapterCode.trim())
      setSelectedDomain(targetDomain)
      setSelectedChapter(formChapterName.trim())
    } else if (modalMode === 'editChapter' && formChapterName.trim()) {
      if (originalParentDomain && originalParentDomain !== targetDomain) {
        await questionBankService.moveChapter(originalParentDomain, targetDomain, originalName, formChapterName.trim(), formChapterCode.trim())
      } else {
        await questionBankService.updateChapter(targetDomain, originalName, formChapterName.trim(), formChapterCode.trim())
      }
      setSelectedDomain(targetDomain)
      setSelectedChapter(formChapterName.trim())
    } else if (modalMode === 'addLesson' && formLessonName.trim()) {
      await questionBankService.addLesson(targetDomain, targetChapter, formLessonName.trim())
      setSelectedDomain(targetDomain)
      setSelectedChapter(targetChapter)
      setSelectedLesson(formLessonName.trim())
    } else if (modalMode === 'editLesson' && formLessonName.trim()) {
      if (
        (originalParentDomain && originalParentDomain !== targetDomain) ||
        (originalParentChapter && originalParentChapter !== targetChapter)
      ) {
        await questionBankService.moveLesson(
          originalParentDomain,
          originalParentChapter,
          targetDomain,
          targetChapter,
          originalName,
          formLessonName.trim()
        )
      } else {
        await questionBankService.updateLesson(targetDomain, targetChapter, originalName, formLessonName.trim())
      }
      setSelectedDomain(targetDomain)
      setSelectedChapter(targetChapter)
      setSelectedLesson(formLessonName.trim())
    }

    setModalMode(null)
    setHasTaxonomyDraftChanges(false)
    markTaxonomyClean()
    await refreshData()
    return true
  }

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingTaxonomy(true)
    try {
      const ok = await persistTaxonomyModal()
      if (ok) {
        setStatusMessage({ type: 'success', text: 'Taxonomy changes saved to database successfully.' })
      } else {
        setStatusMessage({ type: 'error', text: 'Enter a name before saving this taxonomy item.' })
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save to database.' })
    } finally {
      setIsSavingTaxonomy(false)
    }
  }

  const saveTaxonomyBeforeNavigation = () => {
    void persistTaxonomyModal()
  }
  const markTaxonomyClean = useUnsavedChanges(hasTaxonomyDraftChanges, saveTaxonomyBeforeNavigation)

  const closeTaxonomyModal = () => {
    setModalMode(null)
    setHasTaxonomyDraftChanges(false)
  }

  const handleOpenDeleteDomain = (domainName: string) => {
    const dData = taxonomy[domainName]
    const qCount = taxonomyStats.domainCounts[domainName] || 0
    let lessonsCount = 0
    if (dData?.chapters) {
      dData.chapters.forEach((c) => {
        lessonsCount += c.lessons.length
      })
    }
    setDeleteLinkedQuestions(false)
    setDeleteTarget({
      type: 'domain',
      domainName,
      unitLabel: dData?.unitLabel,
      code: dData?.code,
      chaptersCount: dData?.chapters.length || 0,
      lessonsCount,
      linkedQuestionsCount: qCount,
    })
  }

  const handleOpenDeleteChapter = (domainName: string, chapterName: string) => {
    const dData = taxonomy[domainName]
    const chap = dData?.chapters.find((c) => c.name === chapterName)
    const cKey = `${domainName}::${chapterName}`
    const qCount = taxonomyStats.chapterCounts[cKey] || 0
    setDeleteLinkedQuestions(false)
    setDeleteTarget({
      type: 'chapter',
      domainName,
      chapterName,
      code: chap?.code,
      lessonsCount: chap?.lessons.length || 0,
      linkedQuestionsCount: qCount,
    })
  }

  const handleOpenDeleteLesson = (domainName: string, chapterName: string, lessonName: string) => {
    const lKey = `${domainName}::${chapterName}::${lessonName}`
    const qCount = taxonomyStats.lessonCounts[lKey] || 0
    setDeleteLinkedQuestions(false)
    setDeleteTarget({
      type: 'lesson',
      domainName,
      chapterName,
      lessonName,
      linkedQuestionsCount: qCount,
    })
  }

  const handleOpenClearAllTaxonomy = () => {
    setDeleteLinkedQuestions(false)
    setDeleteTarget({
      type: 'all',
      domainName: '',
      chaptersCount: taxonomyStats.chaptersCount,
      lessonsCount: taxonomyStats.lessonsCount,
      linkedQuestionsCount: questions.length,
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsSavingTaxonomy(true)
    try {
      if (deleteTarget.type === 'domain') {
        await questionBankService.deleteDomain(deleteTarget.domainName, deleteLinkedQuestions)
        if (selectedDomain === deleteTarget.domainName) {
          setSelectedDomain(null)
          setSelectedChapter(null)
          setSelectedLesson(null)
        }
        setStatusMessage({
          type: 'success',
          text: `Domain "${deleteTarget.domainName}" was permanently deleted${
            deleteLinkedQuestions ? ` along with ${deleteTarget.linkedQuestionsCount} linked questions.` : '.'
          }`,
        })
      } else if (deleteTarget.type === 'chapter') {
        await questionBankService.deleteChapter(
          deleteTarget.domainName,
          deleteTarget.chapterName!,
          deleteLinkedQuestions
        )
        if (selectedChapter === deleteTarget.chapterName) {
          setSelectedChapter(null)
          setSelectedLesson(null)
        }
        setStatusMessage({
          type: 'success',
          text: `Chapter "${deleteTarget.chapterName}" was permanently deleted${
            deleteLinkedQuestions ? ` along with ${deleteTarget.linkedQuestionsCount} linked questions.` : '.'
          }`,
        })
      } else if (deleteTarget.type === 'lesson') {
        await questionBankService.deleteLesson(
          deleteTarget.domainName,
          deleteTarget.chapterName!,
          deleteTarget.lessonName!,
          deleteLinkedQuestions
        )
        if (selectedLesson === deleteTarget.lessonName) {
          setSelectedLesson(null)
        }
        setStatusMessage({
          type: 'success',
          text: `Lesson "${deleteTarget.lessonName}" was permanently deleted${
            deleteLinkedQuestions ? ` along with ${deleteTarget.linkedQuestionsCount} linked questions.` : '.'
          }`,
        })
      } else if (deleteTarget.type === 'all') {
        questionBankService.clearAllTaxonomy()
        if (deleteLinkedQuestions) {
          await questionBankService.clearAllQuestions()
        }
        setSelectedDomain(null)
        setSelectedChapter(null)
        setSelectedLesson(null)
        setStatusMessage({
          type: 'success',
          text: `All taxonomy nodes have been permanently deleted${
            deleteLinkedQuestions ? ' along with all questions.' : '.'
          }`,
        })
      }
      setDeleteTarget(null)
      await refreshData()
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error deleting taxonomy node from database.' })
    } finally {
      setIsSavingTaxonomy(false)
    }
  }

  const handleSyncToSupabase = async () => {
    setIsSyncingToSupabase(true)
    try {
      const res = await questionBankService.syncAllTaxonomyToSupabase()
      setStatusMessage({
        type: 'success',
        text: `Successfully synchronized ${res.domainsCount} domain(s), ${res.chaptersCount} chapter(s), and ${res.lessonsCount} lesson(s) to Supabase database.`,
      })
      await refreshData()
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to sync with Supabase: ${err.message}`,
      })
    } finally {
      setIsSyncingToSupabase(false)
    }
  }

  const handleReloadFromDatabase = async () => {
    setIsLoadingTaxonomy(true)
    try {
      const fresh = await questionBankService.fetchTaxonomy()
      setTaxonomy(fresh)
      setStatusMessage({
        type: 'success',
        text: `Refreshed taxonomy from database: ${Object.keys(fresh).length} domain(s) loaded.`,
      })
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to reload from database: ${err.message}`,
      })
    } finally {
      setIsLoadingTaxonomy(false)
    }
  }

    const handleRestoreDefaultTaxonomy = () => {
    questionBankService.restoreDefaultTaxonomy()
    refreshData()
    setStatusMessage({
      type: 'success',
      text: 'Restored default curriculum taxonomy architecture successfully.',
    })
  }

  return (
    <AdminLayout
      title="Curriculum Taxonomy Architecture"
      subtitle="Structured 3-tier hierarchy: Domain (Unit) → Chapter → Lesson directly linked to Question Bank"
      actions={
        <div className="flex items-center gap-2">
          {/* Supabase Sync and Reload Controls */}
          {isSupabaseConfigured && (
            <button
              type="button"
              disabled={isSyncingToSupabase || isLoadingTaxonomy}
              onClick={handleSyncToSupabase}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition shadow-2xs cursor-pointer"
              title="Push all domains and lessons directly to Supabase database"
            >
              <Database className={`h-3.5 w-3.5 ${isSyncingToSupabase ? 'animate-spin' : ''}`} />
              <span>{isSyncingToSupabase ? 'Syncing...' : 'Sync to Supabase'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={isLoadingTaxonomy}
            onClick={handleReloadFromDatabase}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs cursor-pointer"
            title="Reload latest taxonomy from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTaxonomy ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isLoadingTaxonomy ? 'Loading...' : 'Reload DB'}</span>
          </button>
          {taxonomyStats.domainsCount === 0 ? (
            <button
              type="button"
              onClick={handleRestoreDefaultTaxonomy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore Default Taxonomy</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenClearAllTaxonomy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition"
              title="Clear all taxonomy nodes"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/admin/questions/new')}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Question</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddDomain}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Domain</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status Message Notification */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-medium border shadow-2xs animate-in fade-in duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="p-1 hover:bg-black/5 rounded-lg transition text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Tier 1: Domains (Units)</span>
            <p className="text-xl font-bold text-blue-950 mt-0.5">{taxonomyStats.domainsCount}</p>
            <p className="text-[11px] text-blue-600/80 mt-0.5">Core curriculum areas</p>
          </div>
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Tier 2: Chapters</span>
            <p className="text-xl font-bold text-indigo-950 mt-0.5">{taxonomyStats.chaptersCount}</p>
            <p className="text-[11px] text-indigo-600/80 mt-0.5">Thematic clusters</p>
          </div>
          <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Tier 3: Lessons</span>
            <p className="text-xl font-bold text-teal-950 mt-0.5">{taxonomyStats.lessonsCount}</p>
            <p className="text-[11px] text-teal-600/80 mt-0.5">Granular competencies</p>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Linked Questions</span>
            <p className="text-xl font-bold text-emerald-950 mt-0.5">{taxonomyStats.totalQuestions}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">In Active Bank</p>
          </div>
        </div>

        {/* 3-Column Visual Hierarchy Browser (Domain(Unit) -> Chapter -> Lesson) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Curriculum Hierarchy Navigator: Domain (Unit) → Chapter → Lesson
                </h3>
                <p className="text-xs text-slate-500">
                  Select a tier below to view associated lessons, manage standards, or filter linked questions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter taxonomy..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-[440px]">
            {/* COLUMN 1: DOMAINS (UNITS) */}
            <div className="flex flex-col bg-slate-50/30">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Domain (Unit)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddDomain}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                  title="Add new Domain"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="p-3 space-y-1.5 flex-1 overflow-y-auto max-h-[500px]">
                {domainNames.length === 0 ? (
                  <div className="text-center py-10 px-4 space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                      <FolderTree className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">No Domains in Taxonomy</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        All curriculum domains have been deleted. You can add a new custom domain or restore default specimens.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleOpenAddDomain}
                        className="w-full py-2 text-xs text-blue-700 font-semibold bg-blue-50 hover:bg-blue-100 rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add First Domain (Unit)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRestoreDefaultTaxonomy}
                        className="w-full py-2 text-xs text-slate-700 font-medium hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restore Default Taxonomy</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  domainNames
                    .filter((d) => !searchQuery || d.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((domain) => {
                      const isSelected = selectedDomain === domain
                      const dData = taxonomy[domain]
                      const qCount = taxonomyStats.domainCounts[domain] || 0

                      return (
                        <div
                          key={domain}
                          onClick={() => {
                            setSelectedDomain(domain)
                            if (dData.chapters.length > 0) {
                              setSelectedChapter(dData.chapters[0].name)
                              if (dData.chapters[0].lessons.length > 0) {
                                setSelectedLesson(dData.chapters[0].lessons[0])
                              } else {
                                setSelectedLesson(null)
                              }
                            } else {
                              setSelectedChapter(null)
                              setSelectedLesson(null)
                            }
                          }}
                          className={`group p-3 rounded-2xl border transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {dData?.code && (
                                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded">
                                    {dData.code}
                                  </span>
                                )}
                                {dData?.unitLabel && (
                                  <span className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider truncate">
                                    {dData.unitLabel}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-xs text-slate-900 leading-snug mt-0.5">
                                {domain}
                              </h4>
                              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                                <span className="font-medium text-slate-600">
                                  {dData.chapters.length} Chapters
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                  {qCount} Questions
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenEditDomain(domain)
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded"
                                title="Edit Domain"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenDeleteDomain(domain)
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded"
                                title="Delete Domain"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <ChevronRight
                                className={`h-4 w-4 ${
                                  isSelected ? 'text-blue-600' : 'text-slate-300'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>

            {/* COLUMN 2: CHAPTERS */}
            <div className="flex flex-col bg-white">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Chapter
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddChapter(selectedDomain || domainNames[0] || '')}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                  title="Add new Chapter"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Available Domains Dropdown Selector for Chapters */}
              {domainNames.length > 0 && (
                <div className="p-2.5 border-b border-slate-200 bg-indigo-50/20">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                      Domain (Available Domains)
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">
                      {domainNames.length} total
                    </span>
                  </div>
                  <select
                    value={selectedDomain || ''}
                    onChange={(e) => {
                      const d = e.target.value
                      setSelectedDomain(d)
                      const chaps = taxonomy[d]?.chapters || []
                      if (chaps.length > 0) {
                        setSelectedChapter(chaps[0].name)
                        setSelectedLesson(chaps[0].lessons[0] || null)
                      } else {
                        setSelectedChapter(null)
                        setSelectedLesson(null)
                      }
                    }}
                    className="w-full text-xs font-semibold border border-indigo-200 rounded-xl px-2.5 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                  >
                    {domainNames.map((d) => {
                      const dData = taxonomy[d]
                      const codeBadge = dData?.code ? `[${dData.code}] ` : ''
                      return (
                        <option key={d} value={d}>
                          {codeBadge}{dData?.unitLabel ? `${dData.unitLabel} — ${d}` : d}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              <div className="p-3 space-y-1.5 flex-1 overflow-y-auto max-h-[500px]">
                {!selectedDomain ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">
                    Select a Domain on the left
                  </p>
                ) : currentChapters.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <p className="text-xs text-slate-400 italic">No chapters in this domain yet.</p>
                    <button
                      type="button"
                      onClick={() => handleOpenAddChapter(selectedDomain)}
                      className="mt-2 text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      + Add the first Chapter
                    </button>
                  </div>
                ) : (
                  currentChapters
                    .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((chap) => {
                      const isSelected = selectedChapter === chap.name
                      const cKey = `${selectedDomain}::${chap.name}`
                      const qCount = taxonomyStats.chapterCounts[cKey] || 0

                      return (
                        <div
                          key={chap.name}
                          onClick={() => {
                            setSelectedChapter(chap.name)
                            if (chap.lessons.length > 0) {
                              setSelectedLesson(chap.lessons[0])
                            } else {
                              setSelectedLesson(null)
                            }
                          }}
                          className={`group p-3 rounded-2xl border transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {chap.code && (
                                <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                                  {chap.code}
                                </span>
                              )}
                              <h4 className="font-bold text-xs text-slate-900 leading-snug mt-1">
                                {chap.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                                <span>{chap.lessons.length} Lessons</span>
                                <span>•</span>
                                <span className="font-semibold text-indigo-700">
                                  {qCount} Questions
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenEditChapter(selectedDomain, chap)
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded"
                                title="Edit Chapter"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenDeleteChapter(selectedDomain, chap.name)
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded"
                                title="Delete Chapter"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <ChevronRight
                                className={`h-4 w-4 ${
                                  isSelected ? 'text-indigo-600' : 'text-slate-300'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>

            {/* COLUMN 3: LESSONS */}
            <div className="flex flex-col bg-slate-50/20">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Lesson (Competency)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAddLesson(
                      selectedDomain || domainNames[0] || '',
                      selectedChapter || currentChapters[0]?.name || ''
                    )
                  }
                  className="p-1 text-teal-600 hover:bg-teal-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                  title="Add new Lesson"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Available Chapters Dropdown Selector for Lessons */}
              {selectedDomain && (
                <div className="p-2.5 border-b border-slate-200 bg-teal-50/20">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-teal-900">
                      Chapter (Available Chapters)
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">
                      {currentChapters.length} in domain
                    </span>
                  </div>
                  {currentChapters.length > 0 ? (
                    <select
                      value={selectedChapter || ''}
                      onChange={(e) => {
                        const cName = e.target.value
                        setSelectedChapter(cName)
                        const chap = currentChapters.find((c) => c.name === cName)
                        setSelectedLesson(chap?.lessons[0] || null)
                      }}
                      className="w-full text-xs font-semibold border border-teal-200 rounded-xl px-2.5 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:border-teal-500 shadow-2xs"
                    >
                      {currentChapters.map((chap) => {
                        const cCodeBadge = chap.code ? `[${chap.code}] ` : ''
                        return (
                          <option key={chap.name} value={chap.name}>
                            {cCodeBadge}{chap.name} ({chap.lessons.length} lessons)
                          </option>
                        )
                      })}
                    </select>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic py-1 px-1">
                      No chapters available in {selectedDomain}
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 space-y-1.5 flex-1 overflow-y-auto max-h-[500px]">
                {!selectedChapter ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">
                    Select a Chapter in column 2
                  </p>
                ) : currentLessons.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <p className="text-xs text-slate-400 italic">No lessons in this chapter yet.</p>
                    <button
                      type="button"
                      onClick={() => handleOpenAddLesson(selectedDomain!, selectedChapter)}
                      className="mt-2 text-xs text-teal-600 font-semibold hover:underline"
                    >
                      + Add the first Lesson
                    </button>
                  </div>
                ) : (
                  currentLessons
                    .filter((l) => !searchQuery || l.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((lesson) => {
                      const isSelected = selectedLesson === lesson
                      const lKey = `${selectedDomain}::${selectedChapter}::${lesson}`
                      const qCount = taxonomyStats.lessonCounts[lKey] || 0

                      return (
                        <div
                          key={lesson}
                          onClick={() => setSelectedLesson(lesson)}
                          className={`group p-3 rounded-2xl border transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-teal-50 border-teal-300 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-slate-900 leading-snug">
                                {lesson}
                              </h4>
                              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                                <span className="font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded">
                                  {qCount} Questions Linked
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenEditLesson(selectedDomain!, selectedChapter, lesson)
                                }}
                                className="p-1 text-slate-400 hover:text-teal-600 hover:bg-white rounded"
                                title="Edit Lesson"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenDeleteLesson(selectedDomain!, selectedChapter, lesson)
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded"
                                title="Delete Lesson"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Linked Questions Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Questions Linked to Selected Taxonomy Node ({linkedQuestions.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Active context: <strong className="text-slate-800">{selectedDomain || 'All Domains'}</strong>
                {selectedChapter && <span> → <strong className="text-slate-800">{selectedChapter}</strong></span>}
                {selectedLesson && <span> → <strong className="text-slate-800">{selectedLesson}</strong></span>}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/admin/questions?domain=${encodeURIComponent(selectedDomain || '')}&chapter=${encodeURIComponent(selectedChapter || '')}`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                <span>Open in Question Bank</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {linkedQuestions.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
              <p className="text-xs text-slate-400">
                No questions are currently mapped to this exact lesson.
              </p>
              <button
                type="button"
                onClick={() => navigate('/admin/questions/new')}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Question for this Lesson</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {linkedQuestions.map((q) => (
                <div key={q.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-slate-900 line-clamp-2">{q.prompt}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-blue-600">{q.collection || 'General Question Bank'}</span>
                      <span>•</span>
                      <span className="capitalize font-medium">{q.questionType.replace('_', ' ')}</span>
                      <span>•</span>
                      <span className="capitalize font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                        {q.difficulty}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/admin/questions/${q.id}/edit`}
                    className="p-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0"
                  >
                    Edit Question
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add or Edit Domain / Chapter / Lesson */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'addDomain' && 'Add Root Domain (Unit)'}
                {modalMode === 'editDomain' && `Edit Domain: ${originalName}`}
                {modalMode === 'addChapter' && `Add Chapter to ${targetDomain}`}
                {modalMode === 'editChapter' && `Edit Chapter: ${originalName}`}
                {modalMode === 'addLesson' && `Add Lesson to ${targetChapter}`}
                {modalMode === 'editLesson' && `Edit Lesson: ${originalName}`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Changes persist dynamically and synchronize automatically across question bank categorizations.
              </p>
            </div>

            <form
              onSubmit={handleSaveModal}
              onChangeCapture={() => setHasTaxonomyDraftChanges(true)}
              onClickCapture={() => setHasTaxonomyDraftChanges(true)}
              className="space-y-3.5"
            >
              {/* Domain inputs */}
              {(modalMode === 'addDomain' || modalMode === 'editDomain') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Domain Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Algebra & Functions"
                      value={formDomainName}
                      onChange={(e) => setFormDomainName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Unit Label / Header (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Unit 1: Foundations of Algebraic Modeling"
                      value={formDomainUnitLabel}
                      onChange={(e) => setFormDomainUnitLabel(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Code Identifier Option *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomDomainCode(!isCustomDomainCode)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        {isCustomDomainCode ? 'Select from options' : '+ Custom Code'}
                      </button>
                    </div>

                    {!isCustomDomainCode ? (
                      <select
                        value={formDomainCode}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === '__CUSTOM__') {
                            setIsCustomDomainCode(true)
                          } else {
                            setFormDomainCode(val)
                            const match = STANDARD_DOMAIN_CODES.find((c) => c.code === val)
                            if (match) {
                              if (
                                !formDomainName ||
                                formDomainName === originalName ||
                                STANDARD_DOMAIN_CODES.some((c) => c.suggestedName === formDomainName)
                              ) {
                                setFormDomainName(match.suggestedName)
                              }
                              if (
                                !formDomainUnitLabel ||
                                STANDARD_DOMAIN_CODES.some((c) => c.suggestedUnit === formDomainUnitLabel)
                              ) {
                                setFormDomainUnitLabel(match.suggestedUnit)
                              }
                            }
                          }
                        }}
                        className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:border-blue-500 focus:outline-hidden"
                      >
                        <optgroup label="Standard Curriculum Domains">
                          {STANDARD_DOMAIN_CODES.filter((c) => !c.code.startsWith('UNIT-')).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Unit Modules">
                          {STANDARD_DOMAIN_CODES.filter((c) => c.code.startsWith('UNIT-')).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                        <option value="__CUSTOM__">✨ Enter Custom Code Identifier...</option>
                      </select>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          placeholder="e.g. ALG, ADV.MATH, CALC"
                          value={formDomainCode}
                          onChange={(e) => setFormDomainCode(e.target.value.toUpperCase())}
                          className="w-full text-xs border border-blue-300 rounded-xl px-3 py-2 bg-blue-50/30 focus:border-blue-500 focus:outline-hidden font-mono"
                        />
                        <p className="text-[10px] text-slate-500">
                          Custom alphanumeric uppercase code identifier for this domain.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Chapter inputs */}
              {(modalMode === 'addChapter' || modalMode === 'editChapter') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Domain (Available Domains) *
                    </label>
                    <select
                      value={targetDomain}
                      onChange={(e) => {
                        const newD = e.target.value
                        setTargetDomain(newD)
                        const pCode = taxonomy[newD]?.code || 'CH'
                        const nextNum = (taxonomy[newD]?.chapters.length || 0) + 1
                        setFormChapterCode(`${pCode}.${nextNum}`)
                      }}
                      className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    >
                      {domainNames.map((d) => {
                        const dInfo = taxonomy[d]
                        const codeBadge = dInfo?.code ? `[${dInfo.code}] ` : ''
                        return (
                          <option key={d} value={d}>
                            {codeBadge}{dInfo?.unitLabel ? `${dInfo.unitLabel} — ${d}` : d}
                          </option>
                        )
                      })}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Select which curriculum domain this chapter belongs to.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chapter Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Linear Equations & Systems"
                      value={formChapterName}
                      onChange={(e) => setFormChapterName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Chapter Code Option *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomChapterCode(!isCustomChapterCode)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        {isCustomChapterCode ? 'Select from options' : '+ Custom Code'}
                      </button>
                    </div>

                    {!isCustomChapterCode ? (
                      <select
                        value={formChapterCode}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === '__CUSTOM__') {
                            setIsCustomChapterCode(true)
                          } else {
                            setFormChapterCode(val)
                            const matchedOpt = chapterCodeOptions.find((o) => o.code === val)
                            if (
                              matchedOpt?.suggestedTitle &&
                              (!formChapterName || chapterCodeOptions.some((o) => o.suggestedTitle === formChapterName))
                            ) {
                              setFormChapterName(matchedOpt.suggestedTitle)
                            }
                          }
                        }}
                        className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:border-indigo-500 focus:outline-hidden"
                      >
                        {Array.from(new Set(chapterCodeOptions.map((o) => o.group))).map((grp) => (
                          <optgroup key={grp} label={grp}>
                            {chapterCodeOptions
                              .filter((o) => o.group === grp)
                              .map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.code} — {opt.label}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                        <option value="__CUSTOM__">✨ Enter Custom Chapter Code...</option>
                      </select>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          placeholder="e.g. ALG.1, GEO.2, CH.3"
                          value={formChapterCode}
                          onChange={(e) => setFormChapterCode(e.target.value.toUpperCase())}
                          className="w-full text-xs border border-indigo-300 rounded-xl px-3 py-2 bg-indigo-50/30 focus:border-indigo-500 focus:outline-hidden font-mono"
                        />
                        <p className="text-[10px] text-slate-500">
                          Custom chapter code formatted e.g. DOMAIN.NUMBER.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Lesson inputs */}
              {(modalMode === 'addLesson' || modalMode === 'editLesson') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Domain (Available Domains) *
                    </label>
                    <select
                      value={targetDomain}
                      onChange={(e) => {
                        const newD = e.target.value
                        setTargetDomain(newD)
                        const availableChaps = taxonomy[newD]?.chapters || []
                        setTargetChapter(availableChaps[0]?.name || '')
                      }}
                      className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 focus:border-teal-500 focus:outline-hidden"
                    >
                      {domainNames.map((d) => {
                        const dInfo = taxonomy[d]
                        const codeBadge = dInfo?.code ? `[${dInfo.code}] ` : ''
                        return (
                          <option key={d} value={d}>
                            {codeBadge}{dInfo?.unitLabel ? `${dInfo.unitLabel} — ${d}` : d}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chapter (Available Chapters in Domain) *
                    </label>
                    {taxonomy[targetDomain]?.chapters && taxonomy[targetDomain]?.chapters.length > 0 ? (
                      <select
                        value={targetChapter}
                        onChange={(e) => setTargetChapter(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 focus:border-teal-500 focus:outline-hidden"
                      >
                        {taxonomy[targetDomain]?.chapters.map((chap) => {
                          const cCodeBadge = chap.code ? `[${chap.code}] ` : ''
                          return (
                            <option key={chap.name} value={chap.name}>
                              {cCodeBadge}{chap.name} ({chap.lessons.length} lessons)
                            </option>
                          )
                        })}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        No chapters exist in {targetDomain} yet. Please create a chapter in this domain first.
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">
                      Select which chapter this competency lesson belongs to.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lesson / Specific Competency Name *
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="e.g. Quadratic Formula & Discriminant Analysis"
                      value={formLessonName}
                      onChange={(e) => setFormLessonName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeTaxonomyModal}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Modal: Delete Domain / Chapter / Lesson / Clear All Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {deleteTarget.type === 'domain' && 'Confirm Domain Deletion'}
                    {deleteTarget.type === 'chapter' && 'Confirm Chapter Deletion'}
                    {deleteTarget.type === 'lesson' && 'Confirm Lesson Deletion'}
                    {deleteTarget.type === 'all' && 'Confirm Delete Entire Taxonomy'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Are you sure you want to permanently delete this taxonomy node?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Target Item Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    deleteTarget.type === 'domain'
                      ? 'bg-blue-100 text-blue-700'
                      : deleteTarget.type === 'chapter'
                      ? 'bg-indigo-100 text-indigo-700'
                      : deleteTarget.type === 'lesson'
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {deleteTarget.type === 'domain' && 'Domain (Unit)'}
                  {deleteTarget.type === 'chapter' && 'Chapter'}
                  {deleteTarget.type === 'lesson' && 'Lesson (Competency)'}
                  {deleteTarget.type === 'all' && 'All Taxonomy Architecture'}
                </span>
                {deleteTarget.code && (
                  <span className="font-mono text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    {deleteTarget.code}
                  </span>
                )}
              </div>

              {deleteTarget.type === 'all' ? (
                <div>
                  <h4 className="font-bold text-sm text-slate-900">All Curriculum Domains, Chapters & Lessons</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {deleteTarget.chaptersCount} Chapters • {deleteTarget.lessonsCount} Lessons across {taxonomyStats.domainsCount} Domains
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {deleteTarget.unitLabel && (
                    <span className="block text-[11px] font-semibold text-blue-600">
                      {deleteTarget.unitLabel}
                    </span>
                  )}
                  {deleteTarget.type === 'domain' && (
                    <h4 className="font-bold text-sm text-slate-900">{deleteTarget.domainName}</h4>
                  )}
                  {deleteTarget.type === 'chapter' && (
                    <div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span>{deleteTarget.domainName}</span>
                        <span>→</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-0.5">{deleteTarget.chapterName}</h4>
                    </div>
                  )}
                  {deleteTarget.type === 'lesson' && (
                    <div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span>{deleteTarget.domainName}</span>
                        <span>→</span>
                        <span>{deleteTarget.chapterName}</span>
                        <span>→</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-0.5">{deleteTarget.lessonName}</h4>
                    </div>
                  )}
                </div>
              )}

              {/* Counts breakdown */}
              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
                {deleteTarget.chaptersCount !== undefined && deleteTarget.type === 'domain' && (
                  <span>{deleteTarget.chaptersCount} Chapters</span>
                )}
                {deleteTarget.lessonsCount !== undefined && (deleteTarget.type === 'domain' || deleteTarget.type === 'chapter') && (
                  <span>• {deleteTarget.lessonsCount} Lessons</span>
                )}
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {deleteTarget.linkedQuestionsCount} Questions Linked
                </span>
              </div>
            </div>

            {/* Linked Questions Treatment Option */}
            {deleteTarget.linkedQuestionsCount > 0 ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  What would you like to do with the {deleteTarget.linkedQuestionsCount} linked question(s)?
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      !deleteLinkedQuestions
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="linkedQuestionsChoice"
                      checked={!deleteLinkedQuestions}
                      onChange={() => setDeleteLinkedQuestions(false)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-900">
                        Keep questions in Question Bank
                      </p>
                      <p className="text-slate-500 mt-0.5 leading-relaxed">
                        Questions will remain safely in the question bank. Their text, explanations, and metadata are preserved without taxonomy linking.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                      deleteLinkedQuestions
                        ? 'border-rose-500 bg-rose-50/60 text-rose-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="linkedQuestionsChoice"
                      checked={deleteLinkedQuestions}
                      onChange={() => setDeleteLinkedQuestions(true)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-rose-900">
                        Also permanently delete all {deleteTarget.linkedQuestionsCount} linked questions
                      </p>
                      <p className="text-rose-700/80 mt-0.5 leading-relaxed">
                        Destructive: The associated questions will be permanently removed from the question bank.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>No questions are mapped to this node. Deleting will not affect any Question Bank items.</span>
              </div>
            )}

            {/* Permanent Warning */}
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Warning:</strong> This deletion permanently updates your curriculum taxonomy. This action cannot be undone.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {deleteTarget.type === 'all'
                    ? 'Clear Entire Taxonomy'
                    : `Delete ${deleteTarget.type === 'domain' ? 'Domain' : deleteTarget.type === 'chapter' ? 'Chapter' : 'Lesson'}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default TaxonomyPage
