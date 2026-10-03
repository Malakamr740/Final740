import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'
import { questionBankService } from '../lib/questionBankService'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'

// Validation Schemas
const levelFormSchema = z
  .object({
    name: z.string().min(1, 'Level name is required').max(100, 'Name too long'),
    description: z.string().max(500, 'Description too long').optional().default(''),
    recommendation: z.string().max(500, 'Recommendation too long').optional().default(''),
    min_percentage: z.coerce.number().min(0, 'Min must be >= 0').max(100, 'Min must be <= 100'),
    max_percentage: z.coerce.number().min(0, 'Max must be >= 0').max(100, 'Max must be <= 100'),
    category_ids: z.array(z.string()).default([]),
  })
  .refine((data: any) => data.min_percentage <= data.max_percentage, {
    message: 'Min percentage must be ≤ Max percentage',
    path: ['max_percentage'],
  })

type LevelFormData = z.infer<typeof levelFormSchema>

interface LevelRow {
  id: string
  organization_id: string
  name: string
  min_percentage: number
  max_percentage: number
  description: string | null
  recommendation: string | null
  display_order: number
  is_active: boolean
}

interface CategoryOption {
  id: string
  name: string
}

interface CourseRow {
  id: string
  name: string
  description: string | null
  registration_url: string | null
  whatsapp_url: string | null
  is_active: boolean
}

interface ToastMessage {
  id: string
  type: 'success' | 'error'
  text: string
}

export default function LevelsCoursesPage() {
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [levelCategoryMap, setLevelCategoryMap] = useState<Record<string, string[]>>({})
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [levelCourseMap, setLevelCourseMap] = useState<Record<string, string[]>>({})

  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Modal states for Levels
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false)
  const [editingLevel, setEditingLevel] = useState<LevelRow | null>(null)
  const [isSubmittingLevel, setIsSubmittingLevel] = useState(false)

  // Course modal states
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [courseRegUrl, setCourseRegUrl] = useState('')
  const [courseWhatsappUrl, setCourseWhatsappUrl] = useState('')
  const [courseBaseline, setCourseBaseline] = useState({ name: '', description: '', registrationUrl: '', whatsappUrl: '' })
  const [savingCourse, setSavingCourse] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors, isDirty: isLevelFormDirty },
  } = useForm<LevelFormData>({
    resolver: zodResolver(levelFormSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      recommendation: '',
      min_percentage: 0,
      max_percentage: 100,
      category_ids: [],
    },
  })

  const selectedCategoryIds = watch('category_ids') || []
  const courseDraftDirty = Boolean(
    showCourseModal &&
      (courseName !== courseBaseline.name ||
        courseDescription !== courseBaseline.description ||
        courseRegUrl !== courseBaseline.registrationUrl ||
        courseWhatsappUrl !== courseBaseline.whatsappUrl)
  )

  const savePendingChanges = async () => {
    if (isLevelModalOpen && isLevelFormDirty) {
      const parsed = levelFormSchema.safeParse(getValues())
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Check the level fields.')
      if (!(await onSubmitLevel(parsed.data))) throw new Error('The level could not be saved.')
    } else if (courseDraftDirty && !(await persistCourse())) {
      throw new Error(courseError || 'The course could not be saved.')
    }
  }

  const markClean = useUnsavedChanges(
    (isLevelModalOpen && isLevelFormDirty) || courseDraftDirty,
    savePendingChanges
  )

  function addToast(type: 'success' | 'error', text: string) {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    try {
      const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single()
      const resolvedOrgId = orgData?.id || null
      if (resolvedOrgId) setOrgId(resolvedOrgId)

      // 1. Resolve Curriculum Taxonomy Domains as the authoritative categories list
      const tax = questionBankService.getTaxonomy()
      const unifiedCategories: CategoryOption[] = Object.keys(tax).map((domainName) => {
        const dInfo = tax[domainName]
        const norm = domainName.trim().toLowerCase()
        const codePrefix = dInfo?.code ? `[${dInfo.code}] ` : ''
        return {
          id: `cat-${norm.replace(/[^a-z0-9]/g, '-')}`,
          name: `${codePrefix}${domainName.trim()}`,
        }
      })
      setCategories(unifiedCategories)

      const [levelsRes, catRes, levelCatRes, coursesRes, linksRes] = await Promise.all([
        supabase
          .from('levels')
          .select('*')
          .order('display_order', { ascending: true })
          .order('min_percentage', { ascending: true }),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('level_categories').select('level_id, category_id'),
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('level_courses').select('level_id, course_id'),
      ])

      // 2. Levels with local fallback
      const loadedLevels = levelsRes.data && levelsRes.data.length > 0 ? levelsRes.data : [
        {
          id: 'lvl-1',
          organization_id: resolvedOrgId || 'org-default',
          name: 'Foundation',
          min_percentage: 0,
          max_percentage: 49.99,
          description: 'Developing initial conceptual understanding.',
          recommendation: 'We recommend reviewing core fundamentals and starting with foundational practice sets.',
          display_order: 1,
          is_active: true,
        },
        {
          id: 'lvl-2',
          organization_id: resolvedOrgId || 'org-default',
          name: 'Developing',
          min_percentage: 50,
          max_percentage: 69.99,
          description: 'Solid conceptual baseline with procedural fluency gaps.',
          recommendation: 'Focus on multi-step algebraic manipulation and targeted error pattern analysis.',
          display_order: 2,
          is_active: true,
        },
        {
          id: 'lvl-3',
          organization_id: resolvedOrgId || 'org-default',
          name: 'Proficient',
          min_percentage: 70,
          max_percentage: 84.99,
          description: 'Strong domain competency with occasional pacing hesitation.',
          recommendation: 'Practice timed section simulations and advanced problem-solving heuristics.',
          display_order: 3,
          is_active: true,
        },
        {
          id: 'lvl-4',
          organization_id: resolvedOrgId || 'org-default',
          name: 'Mastery Tier',
          min_percentage: 85,
          max_percentage: 100,
          description: 'Exemplary performance across all diagnostic mathematical domains.',
          recommendation: 'Maintain competitive readiness with advanced challenge sets and competition math.',
          display_order: 4,
          is_active: true,
        },
      ]
      setLevels(loadedLevels)

      // 3. Category mapping with localStorage persistence
      const savedCatMapRaw = localStorage.getItem('math_diag_level_categories')
      const catMap: Record<string, string[]> = savedCatMapRaw ? JSON.parse(savedCatMapRaw) : {}
      levelCatRes.data?.forEach((link: any) => {
        if (!catMap[link.level_id]) catMap[link.level_id] = []
        if (!catMap[link.level_id].includes(link.category_id)) {
          catMap[link.level_id].push(link.category_id)
        }
      })
      setLevelCategoryMap(catMap)

      // 4. Courses with local fallback
      const loadedCourses = coursesRes.data && coursesRes.data.length > 0 ? coursesRes.data : [
        {
          id: 'crs-1',
          name: 'Math Basics Course',
          description: 'Foundational review of integers, fractions, and single-variable linear equations.',
          registration_url: 'https://example.com/register/math-basics',
          whatsapp_url: 'https://wa.me/15550192834',
          is_active: true,
        },
        {
          id: 'crs-2',
          name: 'Math Fundamentals & Core Diagnostics Camp',
          description: 'Intensive 4-week workshop addressing core algebraic and geometric fundamentals.',
          registration_url: 'https://example.com/register/camp',
          whatsapp_url: 'https://wa.me/15550192834',
          is_active: true,
        },
        {
          id: 'crs-3',
          name: 'Targeted Problem Solving & Pacing Mastery',
          description: 'Master time management, speed heuristics, and multi-step word problems.',
          registration_url: 'https://example.com/register/pacing',
          whatsapp_url: 'https://wa.me/15550192834',
          is_active: true,
        },
        {
          id: 'crs-4',
          name: 'Advanced Math Diagnostic Elite Workshop',
          description: 'High-difficulty challenge sets for 750+ / 800 scorers in SAT & EST Math.',
          registration_url: 'https://example.com/register/elite',
          whatsapp_url: 'https://wa.me/15550192834',
          is_active: true,
        },
      ]
      setCourses(loadedCourses)

      // Map level_id -> course_ids[]
      const savedCourseMapRaw = localStorage.getItem('math_diag_level_courses')
      const courseMap: Record<string, string[]> = savedCourseMapRaw ? JSON.parse(savedCourseMapRaw) : {}
      linksRes.data?.forEach((link: any) => {
        if (!courseMap[link.level_id]) courseMap[link.level_id] = []
        if (!courseMap[link.level_id].includes(link.course_id)) {
          courseMap[link.level_id].push(link.course_id)
        }
      })
      setLevelCourseMap(courseMap)
    } catch (err: any) {
      console.error('Fetch data error:', err)
      addToast('error', 'Failed to load levels and taxonomy.')
    } finally {
      setLoading(false)
    }
  }

  // Open Create Level Modal
  function openCreateLevelModal() {
    setEditingLevel(null)
    reset({
      name: '',
      description: '',
      recommendation: '',
      min_percentage: 0,
      max_percentage: 100,
      category_ids: [],
    })
    setIsLevelModalOpen(true)
  }

  // Open Edit Level Modal
  function openEditLevelModal(lvl: LevelRow) {
    setEditingLevel(lvl)
    reset({
      name: lvl.name,
      description: lvl.description || '',
      recommendation: lvl.recommendation || '',
      min_percentage: Number(lvl.min_percentage),
      max_percentage: Number(lvl.max_percentage),
      category_ids: levelCategoryMap[lvl.id] || [],
    })
    setIsLevelModalOpen(true)
  }

  // Save Level (Create or Edit) with Zod validation
  async function onSubmitLevel(formData: LevelFormData): Promise<boolean> {
    if (!orgId) {
      addToast('error', 'Organization could not be determined.')
      return false
    }

    setIsSubmittingLevel(true)

    try {
      if (editingLevel) {
        // 1. Update level metadata
        const { error: updateError } = await supabase
          .from('levels')
          .update({
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            recommendation: formData.recommendation?.trim() || null,
            min_percentage: formData.min_percentage,
            max_percentage: formData.max_percentage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLevel.id)

        if (updateError) throw updateError

        // 2. Sync associated categories in level_categories
        const currentCatIds = levelCategoryMap[editingLevel.id] || []
        const newCatIds = formData.category_ids

        const toAdd = newCatIds.filter((id: string) => !currentCatIds.includes(id))
        const toRemove = currentCatIds.filter((id: string) => !newCatIds.includes(id))

        if (toRemove.length > 0) {
          const { error: delError } = await supabase
            .from('level_categories')
            .delete()
            .eq('level_id', editingLevel.id)
            .in('category_id', toRemove)
          if (delError) throw delError
        }

        if (toAdd.length > 0) {
          const rows = toAdd.map((cid: string) => ({ level_id: editingLevel.id, category_id: cid }))
          const { error: insError } = await supabase.from('level_categories').insert(rows)
          if (insError) throw insError
        }

        // Optimistic State Update
        setLevels((prev) =>
          prev.map((l) =>
            l.id === editingLevel.id
              ? {
                  ...l,
                  name: formData.name.trim(),
                  description: formData.description?.trim() || null,
                  recommendation: formData.recommendation?.trim() || null,
                  min_percentage: formData.min_percentage,
                  max_percentage: formData.max_percentage,
                }
              : l
          )
        )
        setLevelCategoryMap((prev) => ({ ...prev, [editingLevel.id]: newCatIds }))

        addToast('success', `Level "${formData.name}" successfully updated.`)
      } else {
        // Create new Level
        const nextOrder =
          levels.length > 0 ? Math.max(...levels.map((l) => l.display_order || 0)) + 1 : 1

        const { data: newLevel, error: insertError } = await supabase
          .from('levels')
          .insert({
            organization_id: orgId,
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            recommendation: formData.recommendation?.trim() || null,
            min_percentage: formData.min_percentage,
            max_percentage: formData.max_percentage,
            display_order: nextOrder,
            is_active: true,
          })
          .select('*')
          .single()

        if (insertError || !newLevel) throw insertError || new Error('Failed to create level')

        // Link categories if selected
        if (formData.category_ids.length > 0) {
          const rows = formData.category_ids.map((cid: string) => ({
            level_id: newLevel.id,
            category_id: cid,
          }))
          const { error: catError } = await supabase.from('level_categories').insert(rows)
          if (catError) console.warn('Category link error:', catError)
        }

        setLevels((prev) => [...prev, newLevel])
        setLevelCategoryMap((prev) => ({
          ...prev,
          [newLevel.id]: formData.category_ids,
        }))

        addToast('success', `New performance tier "${formData.name}" created.`)
      }

      setIsLevelModalOpen(false)
      markClean()
      return true
    } catch (err: any) {
      console.error('Save level error:', err)
      addToast('error', err?.message || 'Error saving performance tier.')
      return false
    } finally {
      setIsSubmittingLevel(false)
    }
  }

  // Soft-delete level (deactivate)
  async function handleDeleteLevel(lvl: LevelRow) {
    // Optimistic UI update
    const previousLevels = [...levels]
    const updated = levels.map((l) => (l.id === lvl.id ? { ...l, is_active: false } : l))
    setLevels(updated)
    addToast('success', `Level "${lvl.name}" deactivated.`)

    try {
      await supabase
        .from('levels')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', lvl.id)
    } catch {}
  }

  // Restore archived level
  async function handleRestoreLevel(lvl: LevelRow) {
    const previousLevels = [...levels]
    setLevels((prev) => prev.map((l) => (l.id === lvl.id ? { ...l, is_active: true } : l)))

    try {
      const { error } = await supabase
        .from('levels')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', lvl.id)

      if (error) {
        setLevels(previousLevels)
        throw error
      }

      addToast('success', `Level "${lvl.name}" restored.`)
    } catch (err: any) {
      console.error('Restore level error:', err)
      addToast('error', 'Failed to restore level.')
    }
  }

  // Reorder Levels via Up/Down arrow buttons
  async function handleMoveLevel(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= levels.length) return

    const newLevels = [...levels]
    const current = newLevels[index]
    const target = newLevels[targetIndex]

    // Swap positions
    newLevels[index] = target
    newLevels[targetIndex] = current

    // Reassign sequential display_order
    const updatedWithOrder = newLevels.map((l, i) => ({
      ...l,
      display_order: i + 1,
    }))

    const previousLevels = [...levels]
    setLevels(updatedWithOrder)

    try {
      // Persist new order for swapped items
      await Promise.all([
        supabase
          .from('levels')
          .update({ display_order: targetIndex + 1, updated_at: new Date().toISOString() })
          .eq('id', current.id),
        supabase
          .from('levels')
          .update({ display_order: index + 1, updated_at: new Date().toISOString() })
          .eq('id', target.id),
      ])

      addToast('success', 'Order updated.')
    } catch (err) {
      console.error('Reorder error:', err)
      setLevels(previousLevels)
      addToast('error', 'Failed to save new order.')
    }
  }

  // Toggle Category Tag on a Level with local persistence
  async function handleToggleCategory(levelId: string, categoryId: string) {
    const currentCats = levelCategoryMap[levelId] || []
    const isAssigned = currentCats.includes(categoryId)
    const nextCats = isAssigned
      ? currentCats.filter((id) => id !== categoryId)
      : [...currentCats, categoryId]

    const nextMap = { ...levelCategoryMap, [levelId]: nextCats }
    setLevelCategoryMap(nextMap)
    localStorage.setItem('math_diag_level_categories', JSON.stringify(nextMap))

    try {
      if (isAssigned) {
        await supabase
          .from('level_categories')
          .delete()
          .eq('level_id', levelId)
          .eq('category_id', categoryId)
      } else {
        await supabase
          .from('level_categories')
          .insert({ level_id: levelId, category_id: categoryId })
      }
    } catch {}
  }

  // Toggle Course link for Level
  async function toggleCourseForLevel(levelId: string, courseId: string, assigned: boolean) {
    let nextList: string[] = []
    if (assigned) {
      nextList = (levelCourseMap[levelId] || []).filter((id) => id !== courseId)
      try {
        await supabase
          .from('level_courses')
          .delete()
          .eq('level_id', levelId)
          .eq('course_id', courseId)
      } catch {}
    } else {
      nextList = [...(levelCourseMap[levelId] || []), courseId]
      try {
        await supabase.from('level_courses').insert({ level_id: levelId, course_id: courseId })
      } catch {}
    }
    const nextCourseMap = {
      ...levelCourseMap,
      [levelId]: nextList,
    }
    setLevelCourseMap(nextCourseMap)
    localStorage.setItem('math_diag_level_courses', JSON.stringify(nextCourseMap))
  }

  // Course Catalog functions
  function openCreateCourseModal() {
    setEditingCourse(null)
    setCourseName('')
    setCourseDescription('')
    setCourseRegUrl('')
    setCourseWhatsappUrl('')
    setCourseBaseline({ name: '', description: '', registrationUrl: '', whatsappUrl: '' })
    setCourseError(null)
    setShowCourseModal(true)
  }

  function openEditCourseModal(c: CourseRow) {
    setEditingCourse(c)
    setCourseName(c.name)
    setCourseDescription(c.description || '')
    setCourseRegUrl(c.registration_url || '')
    setCourseWhatsappUrl(c.whatsapp_url || '')
    setCourseBaseline({
      name: c.name,
      description: c.description || '',
      registrationUrl: c.registration_url || '',
      whatsappUrl: c.whatsapp_url || '',
    })
    setCourseError(null)
    setShowCourseModal(true)
  }

  async function persistCourse(): Promise<boolean> {
    if (!courseName.trim()) {
      setCourseError('Course name is required.')
      return false
    }
    if (!orgId) {
      setCourseError('Organization not resolved.')
      return false
    }

    setSavingCourse(true)
    setCourseError(null)

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update({
            name: courseName.trim(),
            description: courseDescription.trim() || null,
            registration_url: courseRegUrl.trim() || null,
            whatsapp_url: courseWhatsappUrl.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCourse.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('courses').insert({
          organization_id: orgId,
          name: courseName.trim(),
          description: courseDescription.trim() || null,
          registration_url: courseRegUrl.trim() || null,
          whatsapp_url: courseWhatsappUrl.trim() || null,
          is_active: true,
        })

        if (error) throw error
      }

      setShowCourseModal(false)
      fetchData()
      addToast('success', 'Course saved successfully.')
      markClean()
      return true
    } catch (err: any) {
      setCourseError(err.message)
      return false
    } finally {
      setSavingCourse(false)
    }
  }

  async function handleSaveCourse(e: React.FormEvent) {
    e.preventDefault()
    await persistCourse()
  }

  async function deleteCourse(courseId: string) {
    const updated = courses.filter((c) => c.id !== courseId)
    setCourses(updated)
    addToast('success', 'Course removed.')
    try {
      await supabase.from('courses').delete().eq('id', courseId)
    } catch {}
  }

  const activeLevels = levels.filter((l) => showArchived || l.is_active)

  return (
    <AdminLayout
      title="Performance Tiers & Taxonomy Categories"
      subtitle="Manage score bands, attach curriculum categories, and assign course recommendations"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateLevelModal}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            + Add Performance Level
          </button>
          <button
            onClick={openCreateCourseModal}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            + Add Course Offering
          </button>
        </div>
      }
    >
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>

      <div className="space-y-8 max-w-5xl">
        {/* Section 1: Levels & Category Linkage */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Performance Tiers & Category Linkage
              </h2>
              <p className="text-xs text-slate-500">
                Configure evaluation thresholds, associate curriculum categories via{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">
                  level_categories
                </code>
                , and arrange display order.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              Show deactivated tiers
            </label>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              Loading tiers and taxonomy associations…
            </div>
          ) : activeLevels.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
              <p className="text-sm font-semibold">No performance levels found.</p>
              <p className="mt-1 text-xs text-slate-400">
                Click "+ Add Performance Level" above to set up your first readiness band.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {activeLevels.map((lvl, index) => {
                const assignedCategoryIds = levelCategoryMap[lvl.id] || []
                const assignedCourseIds = levelCourseMap[lvl.id] || []

                return (
                  <div
                    key={lvl.id}
                    className={`rounded-2xl border bg-white p-5 shadow-xs transition ${
                      lvl.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-60'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        {/* Up / Down Reorder buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveLevel(index, 'up')}
                            disabled={index === 0}
                            title="Move up"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveLevel(index, 'down')}
                            disabled={index === activeLevels.length - 1}
                            title="Move down"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          >
                            ▼
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{lvl.name}</h3>
                            {!lvl.is_active && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                Deactivated
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {lvl.description || 'No evaluation description provided.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-700">
                          {lvl.min_percentage}% – {lvl.max_percentage}%
                        </span>

                        <button
                          onClick={() => openEditLevelModal(lvl)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        {lvl.is_active ? (
                          <button
                            onClick={() => handleDeleteLevel(lvl)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestoreLevel(lvl)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Recommendation note */}
                    {lvl.recommendation && (
                      <div className="mt-3 rounded-xl bg-slate-50/70 p-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Prescription: </span>
                        {lvl.recommendation}
                      </div>
                    )}

                    {/* Linked Taxonomy Categories (level_categories join table) */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Associated Curriculum Categories ({assignedCategoryIds.length} Linked)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Click any tag to toggle taxonomy linkage
                        </span>
                      </div>

                      {categories.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No taxonomy categories available.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {categories.map((cat) => {
                            const isSelected = assignedCategoryIds.includes(cat.id)
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleToggleCategory(lvl.id, cat.id)}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-blue-50 border border-blue-300 text-blue-800 font-semibold shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                                }`}
                              >
                                <span>{isSelected ? '✓' : '+'}</span>
                                <span>{cat.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Course Checkboxes for this Level */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Recommended Courses for this Tier ({assignedCourseIds.length} Linked):
                      </span>
                      {courses.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No courses created yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {courses.map((c) => {
                            const isAssigned = assignedCourseIds.includes(c.id)
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleCourseForLevel(lvl.id, c.id, isAssigned)}
                                className={`rounded-lg border px-3 py-1.5 text-xs transition flex items-center gap-1.5 ${
                                  isAssigned
                                    ? 'border-blue-300 bg-blue-50 font-bold text-blue-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span>{isAssigned ? '✓' : '+'}</span>
                                <span>{c.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Section 2: Manage Course Inventory */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Course & Prep Program Catalog</h2>
            <p className="text-xs text-slate-500">
              Manage your offerings, enrollment links, and contact channels.
            </p>
          </div>

          {courses.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
              No courses in your catalog yet. Click "+ Add Course Offering" above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3 min-w-0"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 break-words">{c.name}</h4>
                    {c.description && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 break-words">{c.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-500">
                      {c.registration_url && (
                        <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-full">
                          🔗 {c.registration_url}
                        </span>
                      )}
                      {c.whatsapp_url && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                          💬 WhatsApp
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => openEditCourseModal(c)}
                      className="text-xs bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCourse(c.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal: Create or Edit Level (react-hook-form + zod) */}
      {isLevelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {editingLevel ? 'Edit Performance Tier' : 'Add Performance Tier'}
              </h3>
              <p className="text-xs text-slate-500">
                Define readiness boundaries and optionally assign curriculum category tags.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmitLevel)} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tier Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advanced Mastery, Foundation"
                  {...register('name')}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                />
                {errors.name && (
                  <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Min & Max Percentage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Score (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    {...register('min_percentage')}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.min_percentage && (
                    <p className="text-xs text-rose-600 mt-1">{errors.min_percentage.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Score (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    {...register('max_percentage')}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.max_percentage && (
                    <p className="text-xs text-rose-600 mt-1">{errors.max_percentage.message}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evaluation Description
                </label>
                <input
                  type="text"
                  placeholder="Short explanation displayed on the student report..."
                  {...register('description')}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                />
                {errors.description && (
                  <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
                )}
              </div>

              {/* Recommendation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prescriptive Recommendation
                </label>
                <textarea
                  rows={2}
                  placeholder="Guidance or curriculum recommendations for students reaching this tier..."
                  {...register('recommendation')}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                />
                {errors.recommendation && (
                  <p className="text-xs text-rose-600 mt-1">{errors.recommendation.message}</p>
                )}
              </div>

              {/* Category Multi-select Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Linked Curriculum Categories ({selectedCategoryIds.length} selected)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Select taxonomy categories relevant to this performance tier:
                </p>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2.5 bg-slate-50/50 flex flex-wrap gap-1.5">
                  {categories.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No categories found.</span>
                  ) : (
                    categories.map((c) => {
                      const isChecked = selectedCategoryIds.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const next = isChecked
                              ? selectedCategoryIds.filter((id: string) => id !== c.id)
                              : [...selectedCategoryIds, c.id]
                            setValue('category_ids', next, { shouldValidate: true })
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 ${
                            isChecked
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{isChecked ? '✓' : '+'}</span>
                          <span>{c.name}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLevelModalOpen(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLevel}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
                >
                  {isSubmittingLevel ? 'Saving...' : editingLevel ? 'Update Tier' : 'Create Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              {editingCourse ? 'Edit Course Offering' : 'New Prep Course'}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SAT Math Advanced Bootcamp"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of what the student will learn..."
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration / Checkout URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={courseRegUrl}
                  onChange={(e) => setCourseRegUrl(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Direct Contact Link
                </label>
                <input
                  type="text"
                  placeholder="https://wa.me/..."
                  value={courseWhatsappUrl}
                  onChange={(e) => setCourseWhatsappUrl(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              {courseError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded">{courseError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {savingCourse ? 'Saving...' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
