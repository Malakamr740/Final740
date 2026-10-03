import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import 'katex/dist/katex.min.css'
import { InlineMath, BlockMath } from 'react-katex'
import {
  Plus,
  Search,
  HelpCircle,
  Edit3,
  Trash2,
  Upload,
  Download,
  FileJson,
  Layers,
  Calculator,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Sparkles,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Eye,
  Check,
  RotateCcw,
  Maximize2,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'
import {
  questionBankService,
  QuestionBankItem,
  QuestionCollection,
  TaxonomyRegistry,
} from '../lib/questionBankService'

export const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([])
  const [collections, setCollections] = useState<QuestionCollection[]>([])
  const [taxonomy, setTaxonomy] = useState<TaxonomyRegistry>(() => questionBankService.getTaxonomy() || {})
  const [selectedCollection, setSelectedCollection] = useState<string>('all')

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [selectedChapter, setSelectedChapter] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Expandable preview cards
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null)
  const [previewZoomImage, setPreviewZoomImage] = useState<{ url: string; caption?: string } | null>(null)

  // Manual Collection Creation & Management state
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColDescription, setNewColDescription] = useState('')
  const [newColTargetExam, setNewColTargetExam] = useState('EST 1 / SAT Math')
  const [newColColorTag, setNewColColorTag] = useState('blue')
  const [newColOpenQuestionAfter, setNewColOpenQuestionAfter] = useState(false)
  const [createColError, setCreateColError] = useState<string | null>(null)

  // Edit Collection state
  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false)
  const [editingColOrigName, setEditingColOrigName] = useState('')
  const [editingColName, setEditingColName] = useState('')
  const [editingColDescription, setEditingColDescription] = useState('')
  const [editingColTargetExam, setEditingColTargetExam] = useState('EST 1 / SAT Math')
  const [editingColColorTag, setEditingColColorTag] = useState('blue')
  const [editColError, setEditColError] = useState<string | null>(null)

  // Delete Collection confirmation state
  const [isDeleteCollectionModalOpen, setIsDeleteCollectionModalOpen] = useState(false)
  const [deletingColName, setDeletingColName] = useState('')
  const [deletingColCount, setDeletingColCount] = useState(0)
  const [deleteColAction, setDeleteColAction] = useState<'keep' | 'delete'>('keep')

  // JSON Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importInputMode, setImportInputMode] = useState<'file' | 'text'>('file')
  const [jsonFileContent, setJsonFileContent] = useState<string>('')
  const [jsonFileName, setJsonFileName] = useState<string>('')
  const [parsedPreview, setParsedPreview] = useState<{
    collectionName: string
    questionCount: number
    questions: any[]
    error?: string
  } | null>(null)
  const [customCollectionOverride, setCustomCollectionOverride] = useState('')
  const [isExecutingImport, setIsExecutingImport] = useState(false)
  const [importStatusMessage, setImportStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [isDraggingImportFile, setIsDraggingImportFile] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  // Load questions and collections
  const reloadData = async () => {
    const list = questionBankService.getStoredQuestions()
    setQuestions(list)
    const cols = questionBankService.getCollectionsList()
    setCollections(cols)
    const tax = questionBankService.getTaxonomy()
    setTaxonomy(tax)

    try {
      const [dbList, freshTax] = await Promise.all([
        questionBankService.fetchQuestionsFromDatabase(),
        questionBankService.fetchTaxonomy().catch(() => tax),
      ])
      if (Array.isArray(dbList)) {
        setQuestions(dbList)
      }
      if (freshTax && typeof freshTax === 'object') {
        setTaxonomy(freshTax)
      }
      // Also ensure any unlinked Supabase questions are backfilled with taxonomy IDs
      questionBankService.backfillSupabaseQuestionsTaxonomy().catch(() => {})
    } catch (e) {
      console.warn('Notice loading questions and taxonomy from database:', e)
    }
  }

  useEffect(() => {
    reloadData()
    const unsubscribe = questionBankService.subscribeTaxonomy((latestTax) => {
      setTaxonomy(latestTax || {})
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Helper to render math text or LaTeX safely (supports both $$block$$ and $inline$)
  const renderMathSafe = (text: string) => {
    if (!text) return null

    // Split on block math ($$...$$) first
    const blockParts = text.split(/(\$\$[\s\S]+?\$\$)/g)

    return (
      <span>
        {blockParts.map((blockPart, bIdx) => {
          if (blockPart.startsWith('$$') && blockPart.endsWith('$$') && blockPart.length > 4) {
            const math = blockPart.slice(2, -2).trim()
            try {
              return (
                <span key={bIdx} className="block my-2 text-center overflow-x-auto py-1">
                  <BlockMath math={math} />
                </span>
              )
            } catch (err) {
              return (
                <code key={bIdx} className="block text-blue-700 bg-blue-50 p-1.5 rounded my-1 font-mono text-xs">
                  {blockPart}
                </code>
              )
            }
          }

          // Inside text between block math, split by inline math ($...$)
          const inlineParts = blockPart.split(/(\$[^$\n]+?\$)/g)
          return (
            <span key={bIdx}>
              {inlineParts.map((part, index) => {
                if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
                  const math = part.slice(1, -1)
                  try {
                    return <InlineMath key={index} math={math} />
                  } catch (err) {
                    return (
                      <code key={index} className="text-blue-700 bg-blue-50 px-1 rounded">
                        {part}
                      </code>
                    )
                  }
                }
                return <span key={index}>{part}</span>
              })}
            </span>
          )
        })}
      </span>
    )
  }

  // Handle JSON file selection for import
  const handleJsonFileSelected = (file: File) => {
    if (!file) return
    setJsonFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setJsonFileContent(content)
      parseAndValidateJson(content)
    }
    reader.readAsText(file)
  }

  const parseAndValidateJson = (content: string) => {
    try {
      if (!content.trim()) {
        setParsedPreview(null)
        return
      }
      const parsed = JSON.parse(content)
      let count = 0
      let collectionName = 'Imported Collection'
      let previewItems: any[] = []

      if (Array.isArray(parsed)) {
        count = parsed.length
        previewItems = parsed.slice(0, 5)
        collectionName = 'Imported Question Pool'
      } else if (parsed && typeof parsed === 'object') {
        collectionName =
          parsed.collection_name ||
          parsed.collectionName ||
          parsed.collection ||
          'Imported Collection'

        if (Array.isArray(parsed.questions)) {
          count = parsed.questions.length
          previewItems = parsed.questions.slice(0, 5)
        } else if (Array.isArray(parsed.items)) {
          count = parsed.items.length
          previewItems = parsed.items.slice(0, 5)
        } else {
          count = 1
          previewItems = [parsed]
        }
      }

      setCustomCollectionOverride(collectionName)
      setParsedPreview({
        collectionName,
        questionCount: count,
        questions: previewItems,
      })
    } catch (e: any) {
      setParsedPreview({
        collectionName: '',
        questionCount: 0,
        questions: [],
        error: `JSON Parse Error: ${e.message}`,
      })
    }
  }

  // Execute import into general bank
  const handleExecuteImport = async () => {
    if (!jsonFileContent.trim()) {
      alert('Please select or paste a valid JSON file.')
      return
    }

    setIsExecutingImport(true)
    try {
      const parsed = JSON.parse(jsonFileContent)
      const res = await questionBankService.importQuestionCollection(
        parsed,
        customCollectionOverride.trim() || undefined
      )

      if (res.success) {
        await reloadData()
        setIsImportModalOpen(false)
        setJsonFileContent('')
        setJsonFileName('')
        setParsedPreview(null)
        setCustomCollectionOverride('')
        setImportStatusMessage({
          type: 'success',
          text: `Successfully imported ${res.count} question(s) into collection "${res.collectionName}" and saved to database!`,
        })
        setSelectedCollection('all')
      } else {
        alert(`Import failed: ${res.errors?.join(', ') || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert(`Invalid JSON format: ${err.message}`)
    } finally {
      setIsExecutingImport(false)
    }
  }

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const template = questionBankService.getSampleCollectionTemplate()
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(template, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'question_collection_template.json')
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Export current collection or all questions
  const handleExportJson = () => {
    const jsonStr = questionBankService.exportCollectionAsJson(
      selectedCollection === 'all' ? undefined : selectedCollection
    )
    const fileName =
      selectedCollection === 'all'
        ? 'all_questions_bank_export.json'
        : `${selectedCollection.toLowerCase().replace(/[^a-z0-9]/g, '_')}_collection.json`

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonStr)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', fileName)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Handle manual collection creation
  const handleCreateCollection = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCreateColError(null)

    if (!newColName.trim()) {
      setCreateColError('Please provide a collection name.')
      return
    }

    const result = questionBankService.createCollection(
      newColName.trim(),
      newColDescription.trim(),
      newColTargetExam,
      newColColorTag
    )

    if (!result.success) {
      setCreateColError(result.error || 'Failed to create collection.')
      return
    }

    const createdName = result.collection!.name
    reloadData()
    setSelectedCollection(createdName)
    setIsCreateCollectionModalOpen(false)
    setNewColName('')
    setNewColDescription('')
    setCreateColError(null)

    setImportStatusMessage({
      type: 'success',
      text: `Collection "${createdName}" created successfully! You can now add questions to it.`,
    })

    if (newColOpenQuestionAfter) {
      window.location.href = `/admin/questions/new?collection=${encodeURIComponent(createdName)}`
    }
  }

  // Handle open edit collection
  const handleOpenEditCollection = (col: QuestionCollection) => {
    setEditingColOrigName(col.name)
    setEditingColName(col.name)
    setEditingColDescription(col.description || '')
    setEditingColTargetExam(col.targetExam || 'EST 1 / SAT Math')
    setEditingColColorTag(col.colorTag || 'blue')
    setEditColError(null)
    setIsEditCollectionModalOpen(true)
  }

  // Handle save edit collection
  const handleSaveEditCollection = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setEditColError(null)

    if (!editingColName.trim()) {
      setEditColError('Collection name cannot be empty.')
      return
    }

    const res = questionBankService.updateCollection(editingColOrigName, {
      name: editingColName.trim(),
      description: editingColDescription.trim(),
      targetExam: editingColTargetExam,
      colorTag: editingColColorTag,
    })

    if (!res.success) {
      setEditColError(res.error || 'Failed to update collection.')
      return
    }

    reloadData()
    if (selectedCollection === editingColOrigName) {
      setSelectedCollection(editingColName.trim())
    }
    setIsEditCollectionModalOpen(false)
    setImportStatusMessage({
      type: 'success',
      text: `Collection "${editingColName.trim()}" updated successfully!`,
    })
  }

  // Handle delete collection
  const handleOpenDeleteCollection = (colName: string, count: number) => {
    setDeletingColName(colName)
    setDeletingColCount(count)
    setDeleteColAction('keep')
    setIsDeleteCollectionModalOpen(true)
  }

  const handleConfirmDeleteCollection = () => {
    questionBankService.deleteCollection(deletingColName, deleteColAction === 'delete')
    reloadData()
    if (selectedCollection === deletingColName) {
      setSelectedCollection('all')
    }
    setIsDeleteCollectionModalOpen(false)
    setImportStatusMessage({
      type: 'success',
      text: `Collection "${deletingColName}" removed.`,
    })
  }

  // Delete question confirmation state
  const [questionToDelete, setQuestionToDelete] = useState<QuestionBankItem | null>(null)
  const [isDeletingSingle, setIsDeletingSingle] = useState(false)

  // Multi-select & Bulk Delete state
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isClearBankModalOpen, setIsClearBankModalOpen] = useState(false)
  const [isClearingBank, setIsClearingBank] = useState(false)

  const handleOpenDeleteQuestion = (question: QuestionBankItem) => {
    setQuestionToDelete(question)
  }

  const handleConfirmDeleteQuestion = async () => {
    if (!questionToDelete) return
    const id = questionToDelete.id
    setIsDeletingSingle(true)
    // Instant optimistic update
    setQuestions((prev) => prev.filter((item) => item.id !== id))
    setSelectedQuestionIds((prev) => prev.filter((item) => item !== id))
    try {
      await questionBankService.deleteQuestion(id)
      setQuestionToDelete(null)
      setImportStatusMessage({
        type: 'success',
        text: 'Question was permanently deleted from the bank.',
      })
      reloadData().catch(() => {})
    } catch (err: any) {
      console.error('Error deleting question:', err)
      setImportStatusMessage({
        type: 'error',
        text: `Failed to delete question: ${err?.message || 'Error occurred.'}`,
      })
      await reloadData()
    } finally {
      setIsDeletingSingle(false)
    }
  }

  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredQuestions.map((q) => q.id)
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedQuestionIds.includes(id))
    if (allSelected) {
      setSelectedQuestionIds((prev) => prev.filter((id) => !filteredIds.includes(id)))
    } else {
      setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...filteredIds])))
    }
  }

  const handleConfirmBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return
    const count = selectedQuestionIds.length
    const targetIds = [...selectedQuestionIds]
    setIsBulkDeleting(true)
    // Instant optimistic update
    const idSet = new Set(targetIds)
    setQuestions((prev) => prev.filter((q) => !idSet.has(q.id)))
    setSelectedQuestionIds([])
    try {
      await questionBankService.deleteQuestions(targetIds)
      setIsBulkDeleteModalOpen(false)
      setImportStatusMessage({
        type: 'success',
        text: `Successfully deleted ${count} question${count > 1 ? 's' : ''} permanently from the bank.`,
      })
      reloadData().catch(() => {})
    } catch (err: any) {
      console.error('Failed in bulk delete:', err)
      setImportStatusMessage({
        type: 'error',
        text: `Failed to delete questions: ${err?.message || 'Error occurred.'}`,
      })
      await reloadData()
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleConfirmClearBank = async () => {
    const count = questions.length
    setIsClearingBank(true)
    // Instant optimistic update
    setQuestions([])
    setSelectedQuestionIds([])
    try {
      await questionBankService.clearAllQuestions()
      setIsClearBankModalOpen(false)
      setImportStatusMessage({
        type: 'success',
        text: `Permanently deleted all ${count} question${count > 1 ? 's' : ''}. The question bank is now empty.`,
      })
      reloadData().catch(() => {})
    } catch (err: any) {
      console.error('Failed to clear question bank:', err)
      setImportStatusMessage({
        type: 'error',
        text: `Failed to clear question bank: ${err?.message || 'Error occurred.'}`,
      })
      await reloadData()
    } finally {
      setIsClearingBank(false)
    }
  }

  const handleRestoreDefaultSeed = async () => {
    await questionBankService.restoreDefaultSeedQuestions()
    await reloadData()
    setImportStatusMessage({
      type: 'success',
      text: 'Restored default specimen diagnostic questions successfully.',
    })
  }

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    // Collection filter
    if (selectedCollection !== 'all' && (q.collection || 'General Question Bank') !== selectedCollection) {
      return false
    }

    // Domain filter
    if (selectedDomain !== 'all' && q.domain !== selectedDomain) {
      return false
    }

    // Chapter filter
    if (selectedChapter !== 'all' && q.chapter !== selectedChapter) {
      return false
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
      return false
    }

    // Type filter
    if (selectedType !== 'all' && q.questionType !== selectedType) {
      return false
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchPrompt = q.prompt?.toLowerCase().includes(term)
      const matchDomain = q.domain?.toLowerCase().includes(term)
      const matchChapter = q.chapter?.toLowerCase().includes(term)
      const matchLesson = q.lesson?.toLowerCase().includes(term)
      const matchCollection = q.collection?.toLowerCase().includes(term)
      const matchExplanation = q.explanation?.toLowerCase().includes(term)
      if (!matchPrompt && !matchDomain && !matchChapter && !matchLesson && !matchCollection && !matchExplanation) {
        return false
      }
    }

    return true
  })

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCollection('all')
    setSelectedDomain('all')
    setSelectedChapter('all')
    setSelectedDifficulty('all')
    setSelectedType('all')
    setSearchTerm('')
  }

  const activeChaptersForFilter =
    selectedDomain !== 'all' ? taxonomy[selectedDomain]?.chapters || [] : []

  return (
    <AdminLayout
      title="Question Bank"
      subtitle="Curriculum-aligned diagnostic question bank with collection gathering and JSON import/export"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Collection Button */}
          <button
            type="button"
            onClick={() => {
              setNewColName('')
              setNewColDescription('')
              setNewColTargetExam('EST 1 / SAT Math')
              setNewColColorTag('blue')
              setNewColOpenQuestionAfter(false)
              setCreateColError(null)
              setIsCreateCollectionModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition shadow-xs"
            title="Create a new collection without JSON"
          >
            <FolderPlus className="h-3.5 w-3.5 text-indigo-600" />
            <span>New Collection</span>
          </button>

          {/* Export JSON Button */}
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-xs"
            title="Export questions as JSON collection"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export JSON</span>
          </button>

          {/* Import JSON Collection Button */}
          <button
            type="button"
            onClick={() => {
              setIsImportModalOpen(true)
              setImportStatusMessage(null)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition shadow-xs"
          >
            <Upload className="h-3.5 w-3.5 text-blue-600" />
            <span>Import JSON Collection</span>
          </button>

          {/* New Question Button */}
          <Link
            to="/admin/questions/new"
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Question</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Status notification banner */}
        {importStatusMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between transition ${
              importStatusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              {importStatusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{importStatusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Question Bank Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Questions
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">{questions.length}</span>
              <span className="text-xs text-slate-400">in general bank</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Collections
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-blue-600">{collections.length}</span>
              <span className="text-xs text-slate-400">gathered sets</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Curriculum Domains
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-indigo-600">
                {new Set(questions.map((q) => q.domain)).size}
              </span>
              <span className="text-xs text-slate-400">represented</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Calculator Allowed
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-600">
                {questions.filter((q) => q.calculatorAllowed).length}
              </span>
              <span className="text-xs text-slate-400">of {questions.length}</span>
            </div>
          </div>
        </div>

        {/* Collections Tab Filter Bar */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5 text-blue-600" />
              <span>Question Collections</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Showing {filteredQuestions.length} of {questions.length} total questions
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCollection('all')}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
                selectedCollection === 'all'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Questions ({questions.length})
            </button>

            {collections.map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => setSelectedCollection(col.name)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedCollection === col.name
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{col.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCollection === col.name
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {col.questionCount}
                </span>
              </button>
            ))}

            {/* Quick Add Collection Pill */}
            <button
              type="button"
              onClick={() => {
                setNewColName('')
                setNewColDescription('')
                setNewColTargetExam('EST 1 / SAT Math')
                setNewColColorTag('blue')
                setNewColOpenQuestionAfter(false)
                setCreateColError(null)
                setIsCreateCollectionModalOpen(true)
              }}
              className="px-2.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition flex items-center gap-1 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-dashed border-indigo-300 shadow-2xs shrink-0"
              title="Add a new question collection"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Collection</span>
            </button>
          </div>
        </div>

        {/* Selected Collection Spotlight / Management Bar */}
        {selectedCollection !== 'all' && (
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center flex-wrap gap-2">
                <Folder className="h-4 w-4 text-blue-600 shrink-0" />
                <h3 className="text-sm font-bold text-slate-800">{selectedCollection}</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {filteredQuestions.length} {filteredQuestions.length === 1 ? 'Question' : 'Questions'}
                </span>
                {collections.find((c) => c.name === selectedCollection)?.targetExam && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    {collections.find((c) => c.name === selectedCollection)?.targetExam}
                  </span>
                )}
              </div>
              {collections.find((c) => c.name === selectedCollection)?.description ? (
                <p className="text-xs text-slate-600 max-w-2xl">
                  {collections.find((c) => c.name === selectedCollection)?.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No description provided for this collection.</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/admin/questions/new?collection=${encodeURIComponent(selectedCollection)}`}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Question</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  const colObj = collections.find((c) => c.name === selectedCollection) || {
                    name: selectedCollection,
                    questionCount: filteredQuestions.length,
                  }
                  handleOpenEditCollection(colObj)
                }}
                className="p-2 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                title="Edit collection name & details"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {selectedCollection !== 'General Question Bank' && (
                <button
                  type="button"
                  onClick={() => handleOpenDeleteCollection(selectedCollection, filteredQuestions.length)}
                  className="p-2 text-slate-600 hover:text-rose-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                  title="Delete collection"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search & Multi-criteria Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search stem, equation, domain, chapter, lesson..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs text-slate-800 focus:outline-hidden bg-transparent"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Domain Dropdown Filter */}
            <div className="w-52">
              <select
                value={selectedDomain}
                onChange={(e) => {
                  setSelectedDomain(e.target.value)
                  setSelectedChapter('all')
                }}
                className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:border-blue-500 focus:outline-hidden focus:bg-white"
              >
                <option value="all">All Domains (Units)</option>
                {Object.keys(taxonomy).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter Dropdown Filter */}
            {selectedDomain !== 'all' && activeChaptersForFilter.length > 0 && (
              <div className="w-48">
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:border-blue-500 focus:outline-hidden focus:bg-white"
                >
                  <option value="all">All Chapters</option>
                  {activeChaptersForFilter.map((c: any) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Difficulty Filter */}
            <div className="w-36">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:border-blue-500 focus:outline-hidden focus:bg-white"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Format Filter */}
            <div className="w-36">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:border-blue-500 focus:outline-hidden focus:bg-white"
              >
                <option value="all">All Formats</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="multi_select">Multi-Select</option>
                <option value="grid_in">Grid-In</option>
              </select>
            </div>

            {/* Clear filters */}
            {(selectedDomain !== 'all' ||
              selectedChapter !== 'all' ||
              selectedDifficulty !== 'all' ||
              selectedType !== 'all' ||
              searchTerm ||
              selectedCollection !== 'all') && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-slate-500 hover:text-rose-600 font-medium inline-flex items-center gap-1 px-2.5 py-2 rounded-xl hover:bg-slate-100 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action & Catalog Management Bar */}
        {questions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition"
                title="Select or deselect all visible questions"
              >
                {filteredQuestions.length > 0 &&
                filteredQuestions.every((q) => selectedQuestionIds.includes(q.id)) ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400" />
                )}
                <span>Select All Visible ({filteredQuestions.length})</span>
              </button>

              <span className="text-slate-200">|</span>

              <span className="text-xs text-slate-500">
                Showing {filteredQuestions.length} of {questions.length} question{questions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedQuestionIds.length > 0 && (
                <>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                    {selectedQuestionIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleteModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition shadow-2xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Selected ({selectedQuestionIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionIds([])}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    Clear Selection
                  </button>
                </>
              )}

              {selectedQuestionIds.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearBankModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-xs font-semibold transition"
                  title="Permanently wipe all questions in the bank"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All Questions</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Questions Catalog List */}
        <div className="space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-bold text-slate-800">
                  {questions.length === 0
                    ? 'Question Bank is Empty'
                    : selectedCollection !== 'all'
                    ? `No questions in "${selectedCollection}" yet`
                    : 'No questions found'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {questions.length === 0
                    ? 'All questions have been permanently deleted from your repository. You can author a new question, import a collection from JSON, or restore the default specimen diagnostic questions.'
                    : selectedCollection !== 'all'
                    ? `This collection is empty. You can author a new question directly into it, or import existing questions.`
                    : `No questions match your current search and filter criteria. You can create a new question or import collections.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {questions.length === 0 ? (
                  <>
                    <Link
                      to="/admin/questions/new"
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add New Question</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Import JSON Collection</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreDefaultSeed}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                      <span>Restore Sample Questions</span>
                    </button>
                  </>
                ) : selectedCollection !== 'all' ? (
                  <>
                    <Link
                      to={`/admin/questions/new?collection=${encodeURIComponent(selectedCollection)}`}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Question to {selectedCollection}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCollectionOverride(selectedCollection)
                        setIsImportModalOpen(true)
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-xs"
                    >
                      Import JSON into Collection
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Import JSON Collection
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isExpanded = expandedQuestionId === q.id
              const isSelected = selectedQuestionIds.includes(q.id)

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl border ${
                    isSelected ? 'border-blue-400 ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'
                  } shadow-xs overflow-hidden transition`}
                >
                  {/* Card Header & Problem Summary */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Selection Checkbox & Categorization Breadcrumbs */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectQuestion(q.id)}
                          className="p-0.5 rounded text-slate-400 hover:text-blue-600 transition"
                          title={isSelected ? 'Deselect question' : 'Select question'}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-300" />
                          )}
                        </button>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {q.domain}
                        </span>
                        <span className="text-slate-300">›</span>
                        <span className="font-medium text-slate-600">{q.chapter}</span>
                        <span className="text-slate-300">›</span>
                        <span className="font-medium text-slate-500">{q.lesson}</span>
                      </div>

                      {/* Collection & Status Badges */}
                      <div className="flex items-center gap-2">
                        {q.collection && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Folder className="h-3 w-3 text-slate-400" />
                            <span>{q.collection}</span>
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            q.difficulty === 'easy'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : q.difficulty === 'medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {q.difficulty}
                        </span>

                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            q.calculatorAllowed
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Calculator className="h-3 w-3" />
                          <span>{q.calculatorAllowed ? 'Calc' : 'No Calc'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Problem Stem (with KaTeX formatting) */}
                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                      {renderMathSafe(q.prompt)}
                    </div>

                    {/* Stimulus / Diagram formatted fitting with question size */}
                    {q.imageUrl && (
                      <div className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 p-2.5 sm:p-3.5 text-center overflow-hidden">
                        <div className="relative group bg-white rounded-xl border border-slate-200/80 p-2 overflow-hidden flex items-center justify-center">
                          <img
                            src={q.imageUrl}
                            alt={q.imageCaption || 'Problem diagram'}
                            className="w-full max-h-72 sm:max-h-80 object-contain mx-auto rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewZoomImage({ url: q.imageUrl!, caption: q.imageCaption })
                            }}
                            className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-medium"
                            title="Click to expand diagram"
                          >
                            <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                            <span>Enlarge</span>
                          </button>
                        </div>
                        {q.imageCaption && (
                          <p className="text-[11px] text-slate-600 font-medium italic mt-2 flex items-center justify-center gap-1.5">
                            <ImageIcon className="h-3 w-3 text-blue-500 shrink-0" />
                            <span>Figure: {q.imageCaption}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-slate-400 text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{q.estimatedSeconds || 90}s</span>
                        </span>
                        <span>•</span>
                        <span className="capitalize">
                          {q.questionType === 'multiple_choice'
                            ? 'Single Choice (MCQ)'
                            : q.questionType === 'multi_select'
                            ? 'Multi-Select'
                            : 'Grid-in (Free Response)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{isExpanded ? 'Hide Details' : 'Quick Preview'}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <Link
                          to={`/admin/questions/${q.id}/edit`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
                          title="Edit question"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteQuestion(q)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Student Preview & Solution Drawer */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-200 p-5 space-y-4">
                      {/* Attached Diagram in full view - formatted bigger and fitting question size */}
                      {q.imageUrl && (
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 text-center w-full shadow-2xs space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pb-2 border-b border-slate-100">
                            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                              <ImageIcon className="h-4 w-4 text-blue-600" />
                              Stimulus / Problem Diagram
                            </span>
                            <span className="text-[11px] text-slate-400">Fitting Question Size</span>
                          </div>
                          <div className="relative group w-full overflow-hidden flex items-center justify-center p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                            <img
                              src={q.imageUrl}
                              alt={q.imageCaption || 'Problem diagram'}
                              className="w-full max-h-[460px] sm:max-h-[500px] object-contain mx-auto rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewZoomImage({ url: q.imageUrl!, caption: q.imageCaption })}
                              className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-medium"
                              title="Click to view full screen"
                            >
                              <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                              <span>Full Size</span>
                            </button>
                          </div>
                          {q.imageCaption && (
                            <p className="text-xs text-slate-600 font-medium italic pt-1 flex items-center justify-center gap-1">
                              <span>Figure: {q.imageCaption}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Choices / Answer Key */}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                          {q.questionType === 'grid_in'
                            ? 'Accepted Grid-In Answer Key:'
                            : 'Answer Choices & Distractor Rationales:'}
                        </span>

                        {q.questionType === 'grid_in' ? (
                          <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-800">
                              Numeric Key: {q.numericAnswer || 'None'}
                            </span>
                            {q.numericTolerance && q.numericTolerance !== '0' && (
                              <span className="text-[11px] text-slate-500">
                                (Tolerance: ±{q.numericTolerance})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {q.choices.map((c, cIdx) => {
                              const letter = String.fromCharCode(65 + cIdx)
                              return (
                                <div
                                  key={c.id || cIdx}
                                  className={`p-3 rounded-xl border text-xs transition ${
                                    c.isCorrect
                                      ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
                                      : 'border-slate-200 bg-white text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-medium">
                                      <span
                                        className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] ${
                                          c.isCorrect
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <span>{renderMathSafe(c.text)}</span>
                                    </div>

                                    {c.isCorrect && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Correct Answer
                                      </span>
                                    )}
                                  </div>

                                  {c.rationale && (
                                    <p className="mt-1 pl-7 text-[11px] text-slate-500">
                                      {c.rationale}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Explanation & Solution */}
                      {q.explanation && (
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                          <span className="text-[11px] font-bold text-slate-700 block">
                            Complete Solution & Derivation:
                          </span>
                          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                            {renderMathSafe(q.explanation)}
                          </div>
                        </div>
                      )}

                      {/* Common Misconception */}
                      {q.commonMisconception && (
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                          <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Student Misconception / Trap Analysis:</span>
                          </span>
                          <div className="text-amber-900/90 text-xs leading-relaxed pl-5 whitespace-pre-line">
                            {renderMathSafe(q.commonMisconception)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* JSON Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Import Question Collection from JSON
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Populate your question bank from a JSON file. All questions will appear in the general bank.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Input Mode Tabs & Template Download Link */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setImportInputMode('file')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    importInputMode === 'file'
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upload JSON File
                </button>
                <button
                  type="button"
                  onClick={() => setImportInputMode('text')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    importInputMode === 'text'
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Paste JSON Code
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* Upload Zone or Textarea */}
            {importInputMode === 'file' ? (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={importFileInputRef}
                  accept=".json,application/json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleJsonFileSelected(e.target.files[0])
                    }
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDraggingImportFile(true)
                  }}
                  onDragLeave={() => setIsDraggingImportFile(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDraggingImportFile(false)
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleJsonFileSelected(e.dataTransfer.files[0])
                    }
                  }}
                  onClick={() => importFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                    isDraggingImportFile
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {jsonFileName ? jsonFileName : 'Click to select or drag & drop JSON file'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Accepts structured questions collection files (.json)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paste JSON Array or Collection Object:
                </label>
                <textarea
                  rows={6}
                  value={jsonFileContent}
                  onChange={(e) => {
                    setJsonFileContent(e.target.value)
                    parseAndValidateJson(e.target.value)
                  }}
                  placeholder='{\n  "collection_name": "EST 1 Math Diagnostic",\n  "questions": [\n    {\n      "domain": "Algebra & Functions",\n      "chapter": "Quadratic & Polynomial Equations",\n      "lesson": "Quadratic Formula & Discriminant Analysis",\n      "prompt": "Solve $2x^2 - 4x = 0$...",\n      "choices": [...]\n    }\n  ]\n}'
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            )}

            {/* Validation & Detected Preview */}
            {parsedPreview && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                {parsedPreview.error ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-rose-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{parsedPreview.error}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-800">
                          Valid JSON: {parsedPreview.questionCount} question(s) detected
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        Ready to import
                      </span>
                    </div>

                    {/* Collection Name override / assignment */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Collection Name to Assign:
                      </label>
                      <input
                        type="text"
                        value={customCollectionOverride}
                        onChange={(e) => setCustomCollectionOverride(e.target.value)}
                        placeholder="e.g. EST 1 Math Diagnostic 2025"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium focus:border-blue-500 focus:outline-hidden"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        This collection name will tag all imported questions and group them together in the bank.
                      </p>
                    </div>

                    {/* Preview snippets */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Preview Questions:
                      </span>
                      {parsedPreview.questions.map((q, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between"
                        >
                          <span className="truncate flex-1 pr-2 font-medium">
                            {idx + 1}. {q.prompt || q.stem || q.title || 'Question item'}
                          </span>
                          <span className="text-[10px] text-blue-600 font-semibold shrink-0">
                            {q.domain || 'Algebra'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!parsedPreview || Boolean(parsedPreview.error) || parsedPreview.questionCount === 0 || isExecutingImport}
                onClick={handleExecuteImport}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <FolderPlus className={`h-4 w-4 ${isExecutingImport ? 'animate-spin' : ''}`} />
                <span>
                  {isExecutingImport
                    ? 'Saving to Database...'
                    : `Import ${parsedPreview?.questionCount || 0} Questions into Bank`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Collection Modal (Without JSON) */}
      {isCreateCollectionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCreateCollectionModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Collection</h3>
                  <p className="text-xs text-slate-500">
                    Add a named collection to gather and organize diagnostic questions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateCollectionModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error banner */}
            {createColError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{createColError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCollection} className="space-y-4">
              {/* Collection Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Collection Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Polynomial Functions Diagnostic, Calculus Mock Exam 1"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Target Exam */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Exam / Assessment Track
                </label>
                <select
                  value={newColTargetExam}
                  onChange={(e) => setNewColTargetExam(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="EST 1 / SAT Math">EST 1 / SAT Math</option>
                  <option value="EST 2 / SAT Subject">EST 2 / SAT Subject Math</option>
                  <option value="ACT Math">ACT Math</option>
                  <option value="AP Calculus AB/BC">AP Calculus AB/BC</option>
                  <option value="General Diagnostic">General Diagnostic / Classroom Review</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Description / Syllabus Focus (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newColDescription}
                  onChange={(e) => setNewColDescription(e.target.value)}
                  placeholder="e.g. Specially curated diagnostic collection testing circle theorems, sector area, and arc lengths..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Color Accent Tag */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Color Accent Theme
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { tag: 'blue', label: 'Blue', bg: 'bg-blue-500 ring-blue-300' },
                    { tag: 'indigo', label: 'Indigo', bg: 'bg-indigo-500 ring-indigo-300' },
                    { tag: 'emerald', label: 'Emerald', bg: 'bg-emerald-500 ring-emerald-300' },
                    { tag: 'purple', label: 'Purple', bg: 'bg-purple-500 ring-purple-300' },
                    { tag: 'amber', label: 'Amber', bg: 'bg-amber-500 ring-amber-300' },
                    { tag: 'rose', label: 'Rose', bg: 'bg-rose-500 ring-rose-300' },
                  ].map((color) => (
                    <button
                      key={color.tag}
                      type="button"
                      onClick={() => setNewColColorTag(color.tag)}
                      className={`w-6 h-6 rounded-full ${color.bg} transition ${
                        newColColorTag === color.tag ? 'ring-3 ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              {/* Checkbox: Open question creator after creation */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newColOpenQuestionAfter}
                    onChange={(e) => setNewColOpenQuestionAfter(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-600">
                    Open question authoring screen immediately with this collection pre-selected
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsCreateCollectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>Create Collection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Collection Modal */}
      {isEditCollectionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsEditCollectionModalOpen(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Collection</h3>
                  <p className="text-xs text-slate-500">Update collection details and metadata</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCollectionModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editColError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{editColError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Collection Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingColName}
                  onChange={(e) => setEditingColName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Exam Track
                </label>
                <select
                  value={editingColTargetExam}
                  onChange={(e) => setEditingColTargetExam(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden bg-white"
                >
                  <option value="EST 1 / SAT Math">EST 1 / SAT Math</option>
                  <option value="EST 2 / SAT Subject">EST 2 / SAT Subject Math</option>
                  <option value="ACT Math">ACT Math</option>
                  <option value="AP Calculus AB/BC">AP Calculus AB/BC</option>
                  <option value="General Diagnostic">General Diagnostic / Classroom Review</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingColDescription}
                  onChange={(e) => setEditingColDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditCollectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Collection Confirmation Modal */}
      {isDeleteCollectionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsDeleteCollectionModalOpen(false)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Collection</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove &quot;{deletingColName}&quot;?
                </p>
              </div>
            </div>

            {deletingColCount > 0 ? (
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-700 font-medium">
                  This collection contains <span className="font-bold text-slate-900">{deletingColCount}</span> questions. What would you like to do with them?
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteColOption"
                      checked={deleteColAction === 'keep'}
                      onChange={() => setDeleteColAction('keep')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800 block">Move questions to General Question Bank</span>
                      <span className="text-slate-500">Keep questions active, only remove this collection grouping.</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteColOption"
                      checked={deleteColAction === 'delete'}
                      onChange={() => setDeleteColAction('delete')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-rose-800 block">Permanently delete questions too</span>
                      <span className="text-slate-500">Delete all {deletingColCount} questions in this collection.</span>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                This collection has 0 questions and will be removed from your collections list.
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsDeleteCollectionModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCollection}
                style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs"
              >
                <Trash2 className="h-4 w-4" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Modal */}
      {questionToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setQuestionToDelete(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Question</h3>
                  <p className="text-xs text-slate-500">
                    Are you sure you want to permanently delete this question?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Question Details Preview */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {questionToDelete.domain}
                </span>
                <span className="text-slate-300">›</span>
                <span className="font-medium text-slate-600">{questionToDelete.chapter}</span>
                <span className="text-slate-300">›</span>
                <span className="font-medium text-slate-500">{questionToDelete.lesson}</span>

                {questionToDelete.collection && (
                  <span className="ml-auto text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Folder className="h-3 w-3 text-slate-400" />
                    <span>{questionToDelete.collection}</span>
                  </span>
                )}
              </div>

              {/* Stem / Prompt Preview */}
              <div className="text-xs text-slate-800 font-medium leading-relaxed max-h-32 overflow-y-auto bg-white p-3 rounded-xl border border-slate-200/80">
                {renderMathSafe(questionToDelete.prompt)}
              </div>

              {/* Extra Meta */}
              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                <span className="capitalize font-semibold text-slate-700">
                  {questionToDelete.questionType.replace('_', ' ')}
                </span>
                <span>•</span>
                <span className="capitalize text-slate-600">
                  {questionToDelete.difficulty} difficulty
                </span>
                {questionToDelete.imageUrl && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Has diagram
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Warning Message */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                This will delete the question stem, attached diagrams, and solution derivation from the question bank. This action cannot be undone.
              </span>
            </div>

            {/* Modal Actions: Cancel & Delete */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={handleConfirmDeleteQuestion}
                style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs disabled:opacity-50"
              >
                {isDeletingSingle ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting Question...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Question</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsBulkDeleteModalOpen(false)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete {selectedQuestionIds.length} Question{selectedQuestionIds.length > 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Are you sure you want to permanently delete these questions?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning Details */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                You have selected <strong>{selectedQuestionIds.length} questions</strong> to permanently remove from the question bank. Their problem prompts, diagrams, and derivations will be erased.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting {selectedQuestionIds.length} Questions...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete {selectedQuestionIds.length} Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Entire Bank Confirmation Modal */}
      {isClearBankModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsClearBankModalOpen(false)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Clear Entire Question Bank
                  </h3>
                  <p className="text-xs text-slate-500">
                    Permanently wipe all {questions.length} questions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearBankModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning Details */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>
                This will permanently delete <strong>all {questions.length} questions</strong> from your repository. After clearing, your bank will remain completely empty until you create or import new questions, or choose to restore sample questions.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isClearingBank}
                onClick={() => setIsClearBankModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingBank}
                onClick={handleConfirmClearBank}
                style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isClearingBank ? 'Deleting All Questions...' : 'Yes, Delete All Questions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Diagram Lightbox */}
      {previewZoomImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewZoomImage(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-blue-600" />
                {previewZoomImage.caption || 'Question Diagram (Full View)'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoomImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-auto flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-100">
              <img
                src={previewZoomImage.url}
                alt={previewZoomImage.caption || 'Diagram enlarged'}
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-lg shadow-xs"
              />
            </div>
            {previewZoomImage.caption && (
              <p className="text-xs text-center text-slate-500 italic">
                {previewZoomImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
      {/* Floating active deletion indicator badge */}
      {(isDeletingSingle || isBulkDeleting || isClearingBank) && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900/95 text-white rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-xs border border-slate-800 animate-in fade-in slide-in-from-bottom-2">
          <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
          <span>
            {isClearingBank
              ? 'Clearing entire question bank...'
              : isBulkDeleting
              ? 'Deleting selected questions...'
              : 'Deleting question...'}
          </span>
        </div>
      )}
    </AdminLayout>
  )
}

export default QuestionBankPage
