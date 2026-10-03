import { questionBankService, type QuestionBankItem } from './questionBankService'
import { supabase, isSupabaseConfigured } from './supabaseClient'

export interface StudentFieldConfig {
  id: string
  label: string
  type: 'text' | 'email' | 'number' | 'select'
  required: boolean
  enabled: boolean
  options?: string[]
}

export interface AssessmentSettings {
  // Timing
  timerMode: 'per_section' | 'per_assessment' | 'untimed'
  timerMinutes: number
  timerEnabled: boolean

  // Navigation & Rules
  allowBack: boolean
  requireAnswer: boolean
  saveProgress: boolean
  shuffleQuestions: boolean
  shuffleChoices: boolean
  attempts: number

  // Results & Feedback
  showScore: boolean
  showCorrectAnswers: boolean
  showExplanations: boolean
  showAnalytics: boolean
  passingPercentage: number

  // Student Intake
  studentFields: StudentFieldConfig[]

  // Security
  passcodeEnabled: boolean
  passcode: string

  // Mastery Criteria
  mastery: {
    mastered: number
    proficient: number
    developing: number
    minEvidence: number
  }
}

export interface SectionSettings {
  timingEnabled: boolean
  timeLimitMinutes: number
  calculatorAllowed: boolean
  shuffleQuestions: boolean
  shuffleChoices: boolean
  allowBack: boolean
  requireAnswer: boolean
  hasBreakAfter: boolean
  breakDurationMinutes: number
  breakInstructions?: string
}

export interface SectionQuestionItem {
  id: string
  questionId: string
  displayOrder: number
  pointsOverride: number | null
  required: boolean
  questionSnapshot?: Partial<QuestionBankItem>
}

export interface AssessmentSection {
  id: string
  title: string
  description?: string
  displayOrder: number
  settings: SectionSettings
  questions: SectionQuestionItem[]
}

export interface Assessment {
  id: string
  title: string
  subtitle?: string
  description?: string
  subject: string
  grade: string
  instructions?: string
  status: 'draft' | 'published' | 'archived'
  attemptsCount?: number
  settings: AssessmentSettings
  sections: AssessmentSection[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'math_diag_assessments_v2'
const INITIALIZED_FLAG = 'math_diag_assessments_initialized_v2'

export const defaultAssessmentSettings: AssessmentSettings = {
  timerMode: 'per_section',
  timerMinutes: 60,
  timerEnabled: true,
  allowBack: true,
  requireAnswer: false,
  saveProgress: true,
  shuffleQuestions: false,
  shuffleChoices: false,
  attempts: 1,
  showScore: true,
  showCorrectAnswers: true,
  showExplanations: true,
  showAnalytics: true,
  passingPercentage: 70,
  studentFields: [
    { id: 'name', label: 'Student Full Name', type: 'text', required: true, enabled: true },
    { id: 'email', label: 'Student Email', type: 'email', required: false, enabled: true },
    { id: 'grade', label: 'Grade / Level', type: 'text', required: true, enabled: true },
    { id: 'studentId', label: 'Student ID Number', type: 'text', required: false, enabled: false },
  ],
  passcodeEnabled: false,
  passcode: '1234',
  mastery: {
    mastered: 85,
    proficient: 70,
    developing: 55,
    minEvidence: 2,
  },
}

export const defaultSectionSettings: SectionSettings = {
  timingEnabled: true,
  timeLimitMinutes: 30,
  calculatorAllowed: true,
  shuffleQuestions: false,
  shuffleChoices: false,
  allowBack: true,
  requireAnswer: false,
  hasBreakAfter: false,
  breakDurationMinutes: 10,
  breakInstructions: 'Take a short break before starting the next section.',
}

function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function getInitialSeedAssessments(): Assessment[] {
  const bankQuestions = questionBankService.getStoredQuestions()

  const q1 = bankQuestions[0] || {
    id: 'qb-seed-01',
    prompt: 'If $2x - 2 = 3x$, what is the value of $x + 2$?',
    difficulty: 'easy',
    choices: [
      { id: 'A', text: '-4', isCorrect: false },
      { id: 'B', text: '-2', isCorrect: false },
      { id: 'C', text: '0', isCorrect: true },
      { id: 'D', text: '2', isCorrect: false },
    ],
  }

  const q2 = bankQuestions[1] || {
    id: 'qb-seed-02',
    prompt: 'Solve the system: $2x + y = 7$ and $x - y = 2$.',
    difficulty: 'medium',
    choices: [
      { id: 'A', text: '(3, 1)', isCorrect: true },
      { id: 'B', text: '(1, 3)', isCorrect: false },
      { id: 'C', text: '(2, 0)', isCorrect: false },
      { id: 'D', text: '(4, -1)', isCorrect: false },
    ],
  }

  const q3 = bankQuestions[2] || {
    id: 'qb-seed-03',
    prompt: 'Find the vertex of the parabola $y = x^2 - 6x + 5$.',
    difficulty: 'medium',
    choices: [
      { id: 'A', text: '(3, -4)', isCorrect: true },
      { id: 'B', text: '(-3, 4)', isCorrect: false },
      { id: 'C', text: '(0, 5)', isCorrect: false },
      { id: 'D', text: '(6, 5)', isCorrect: false },
    ],
  }

  const q4 = bankQuestions[3] || {
    id: 'qb-seed-04',
    prompt: 'What are the roots of $x^2 - 5x + 6 = 0$?',
    difficulty: 'easy',
    choices: [
      { id: 'A', text: 'x = 2, 3', isCorrect: true },
      { id: 'B', text: 'x = -2, -3', isCorrect: false },
      { id: 'C', text: 'x = 1, 6', isCorrect: false },
      { id: 'D', text: 'x = -1, -6', isCorrect: false },
    ],
  }

  return [
    {
      id: 'diagnostic-algebra-1',
      title: 'High School Algebra I Benchmark Diagnostic',
      subtitle: 'Linear Equations, Systems & Quadratics Diagnostic',
      description:
        'Comprehensive 2-section evaluation covering foundational algebraic manipulations without calculator, followed by applied modeling with calculator permitted.',
      subject: 'Mathematics',
      grade: 'Grade 9-10',
      instructions:
        'Please read all directions carefully. Section 1 prohibits calculator use. Section 2 allows an approved calculator.',
      status: 'published',
      attemptsCount: 142,
      settings: {
        ...defaultAssessmentSettings,
        timerMode: 'per_section',
        attempts: 2,
        passingPercentage: 75,
      },
      sections: [
        {
          id: 'sec-alg-1',
          title: 'Section 1: Foundations & Systems (No Calculator)',
          description: 'Mental math, single-variable equations, and linear systems without calculator assistance.',
          displayOrder: 0,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 25,
            calculatorAllowed: false,
            hasBreakAfter: true,
            breakDurationMinutes: 5,
            breakInstructions: 'You have completed Section 1. Take a 5-minute break before proceeding to Section 2.',
          },
          questions: [
            {
              id: uid('sq'),
              questionId: q1.id,
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q1,
            },
            {
              id: uid('sq'),
              questionId: q2.id,
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q2,
            },
          ],
        },
        {
          id: 'sec-alg-2',
          title: 'Section 2: Quadratics & Functions (Calculator Active)',
          description: 'Parabolas, root optimization, and applied polynomials with on-screen calculator allowed.',
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
              id: uid('sq'),
              questionId: q3.id,
              displayOrder: 0,
              pointsOverride: 2,
              required: true,
              questionSnapshot: q3,
            },
            {
              id: uid('sq'),
              questionId: q4.id,
              displayOrder: 1,
              pointsOverride: 2,
              required: true,
              questionSnapshot: q4,
            },
          ],
        },
      ],
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'digital-sat-math-1',
      title: 'Digital SAT Math Diagnostic Practice Test 1',
      subtitle: 'Module 1 & Module 2 • Official Timed Format',
      description:
        'Standard 2-Module Digital SAT format with adaptive sectioning, embedded calculator support, and automated domain analytics.',
      subject: 'Mathematics',
      grade: 'SAT Prep / Grade 11-12',
      instructions:
        'You may use the built-in Desmos graphing calculator for both modules. Check all calculations and pacing carefully.',
      status: 'published',
      attemptsCount: 89,
      settings: {
        ...defaultAssessmentSettings,
        timerMode: 'per_section',
        attempts: 1,
        showScore: true,
        showCorrectAnswers: true,
        showExplanations: true,
        showAnalytics: true,
      },
      sections: [
        {
          id: 'sec-sat-mod1',
          title: 'Module 1: Math (35 Minutes)',
          description: 'Covers Algebra, Advanced Math, Problem Solving, and Geometry.',
          displayOrder: 0,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 35,
            calculatorAllowed: true,
            hasBreakAfter: true,
            breakDurationMinutes: 10,
            breakInstructions: '10-minute scheduled intermission between Module 1 and Module 2.',
          },
          questions: [
            {
              id: uid('sq'),
              questionId: q1.id,
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q1,
            },
            {
              id: uid('sq'),
              questionId: q3.id,
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q3,
            },
          ],
        },
        {
          id: 'sec-sat-mod2',
          title: 'Module 2: Math (35 Minutes)',
          description: 'Higher difficulty problem sets and multi-step data interpretation.',
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
              id: uid('sq'),
              questionId: q2.id,
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q2,
            },
            {
              id: uid('sq'),
              questionId: q4.id,
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q4,
            },
          ],
        },
      ],
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'pre-calculus-readiness',
      title: 'Pre-Calculus Readiness & Trigonometry Evaluation',
      subtitle: 'Functions, Unit Circle & Trigonometric Modeling',
      description:
        'Evaluates foundational competence in polynomial functions, exponential models, and trigonometry readiness.',
      subject: 'Mathematics',
      grade: 'Grade 11-12',
      instructions: 'Answer all questions to identify priority review concepts before advancing to Pre-Calculus.',
      status: 'published',
      attemptsCount: 56,
      settings: {
        ...defaultAssessmentSettings,
        timerMode: 'per_section',
        attempts: 1,
      },
      sections: [
        {
          id: 'sec-precalc-1',
          title: 'Section 1: General Trigonometry & Radian Measure',
          description: 'Unit circle coordinates, special angles, and trigonometric identities.',
          displayOrder: 0,
          settings: {
            ...defaultSectionSettings,
            timeLimitMinutes: 40,
            calculatorAllowed: false,
            hasBreakAfter: false,
            breakDurationMinutes: 0,
          },
          questions: [
            {
              id: uid('sq'),
              questionId: q2.id,
              displayOrder: 0,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q2,
            },
            {
              id: uid('sq'),
              questionId: q3.id,
              displayOrder: 1,
              pointsOverride: 1,
              required: true,
              questionSnapshot: q3,
            },
          ],
        },
      ],
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ]
}

let _assessmentsCache: Assessment[] = []
let _hasLoadedFromDatabase = false

// Clear any old local storage seeds
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(INITIALIZED_FLAG)
  } catch {}
}

export const assessmentService = {
  getStoredAssessments(): Assessment[] {
    if (!_hasLoadedFromDatabase && typeof window !== 'undefined') {
      this.fetchAssessmentsFromDatabase().catch(() => {})
    }
    return _assessmentsCache
  },

  saveStoredAssessments(assessments: Assessment[]): void {
    _assessmentsCache = assessments
  },

  /**
   * Sync a single assessment to database
   */
  async syncAssessmentToDatabase(assessment: Assessment): Promise<void> {
    try {
      await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessment),
      })
    } catch (err) {
      console.warn('Failed to save assessment to server database:', err)
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('assessments').upsert({
          id: assessment.id,
          title: assessment.title,
          description: assessment.description || '',
          subject: assessment.subject || 'Mathematics',
          grade: assessment.grade || 'Grade 10',
          duration_minutes: assessment.settings?.timerMinutes || 60,
          sections: assessment.sections || [],
          is_published: assessment.status === 'published',
          created_at: assessment.createdAt || new Date().toISOString(),
          updated_at: assessment.updatedAt || new Date().toISOString(),
        })
      } catch (err) {
        console.warn('Failed to upsert assessment to Supabase:', err)
      }
    }
  },

  /**
   * Delete an assessment from database
   */
  async deleteAssessmentFromDatabase(id: string): Promise<void> {
    try {
      await fetch(`/api/assessments/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.warn('Failed to delete assessment from server database:', err)
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('assessments').delete().eq('id', id)
      } catch (err) {
        console.warn('Failed to delete assessment from Supabase:', err)
      }
    }
  },

  /**
   * Fetch all assessments from database without any programmatic seeding
   */
  async fetchAssessmentsFromDatabase(): Promise<Assessment[]> {
    _hasLoadedFromDatabase = true

    // 1. Fetch from server SQLite database API
    try {
      const res = await fetch('/api/assessments')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          _assessmentsCache = data
          return _assessmentsCache
        }
      }
    } catch (err) {
      console.warn('Failed to fetch assessments from database API:', err)
    }

    // 2. Fallback to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          const mapped: Assessment[] = data.map((row: any) => ({
            id: String(row.id),
            title: row.title || 'Untitled Assessment',
            subtitle: '',
            description: row.description || '',
            subject: row.subject || 'Mathematics',
            grade: row.grade || 'Grade 10',
            instructions: 'Please complete all sections to the best of your ability.',
            status: (row.is_published ? 'published' : 'draft') as Assessment['status'],
            attemptsCount: 0,
            settings: {
              ...defaultAssessmentSettings,
              timerMinutes: row.duration_minutes || 60,
            },
            sections: Array.isArray(row.sections) ? row.sections : [],
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          }))
          _assessmentsCache = mapped
          return _assessmentsCache
        }
      } catch (e) {
        console.warn('Error reading assessments from Supabase:', e)
      }
    }

    return _assessmentsCache
  },

  /**
   * Sync all assessments to database
   */
  async syncAllToDatabase(list?: Assessment[]): Promise<void> {
    const assessmentsToSync = list || this.getStoredAssessments()
    for (const a of assessmentsToSync) {
      await this.syncAssessmentToDatabase(a)
    }
  },

  getAssessments(): Assessment[] {
    return this.getStoredAssessments()
  },

  getAssessmentById(id: string): Assessment | null {
    const list = this.getStoredAssessments()
    return list.find((a) => a.id === id) || null
  },

  createAssessment(payload: Partial<Assessment>): Assessment {
    const list = this.getStoredAssessments()

    const newId = payload.id || `assessment-${Date.now().toString(36)}`
    const bankQuestions = questionBankService.getStoredQuestions()
    const firstQuestion = bankQuestions[0]

    // Default section with at least 1 question
    const defaultInitialSection: AssessmentSection = {
      id: uid('sec'),
      title: 'Section 1: General',
      description: 'Primary assessment section',
      displayOrder: 0,
      settings: { ...defaultSectionSettings },
      questions: [
        {
          id: uid('sq'),
          questionId: firstQuestion?.id || 'default-q1',
          displayOrder: 0,
          pointsOverride: 1,
          required: true,
          questionSnapshot: firstQuestion || undefined,
        },
      ],
    }

    const newAssessment: Assessment = {
      id: newId,
      title: payload.title || 'Untitled Diagnostic Assessment',
      subtitle: payload.subtitle || '',
      description: payload.description || '',
      subject: payload.subject || 'Mathematics',
      grade: payload.grade || 'Grade 10',
      instructions: payload.instructions || 'Please complete all sections to the best of your ability.',
      status: payload.status || 'draft',
      attemptsCount: 0,
      settings: {
        ...defaultAssessmentSettings,
        ...(payload.settings || {}),
      },
      sections:
        payload.sections && payload.sections.length > 0
          ? payload.sections.map((sec, idx) => ({
              ...sec,
              displayOrder: idx,
              questions:
                sec.questions && sec.questions.length > 0
                  ? sec.questions
                  : [
                      {
                        id: uid('sq'),
                        questionId: firstQuestion?.id || 'default-q1',
                        displayOrder: 0,
                        pointsOverride: 1,
                        required: true,
                        questionSnapshot: firstQuestion || undefined,
                      },
                    ],
            }))
          : [defaultInitialSection],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    list.unshift(newAssessment)
    this.saveStoredAssessments(list)

    // Sync to database in background
    this.syncAssessmentToDatabase(newAssessment)

    return newAssessment
  },

  updateAssessment(id: string, updates: Partial<Assessment>): Assessment {
    const list = this.getStoredAssessments()
    const idx = list.findIndex((a) => a.id === id)
    if (idx === -1) {
      throw new Error(`Assessment with ID "${id}" not found.`)
    }

    const current = list[idx]
    const updated: Assessment = {
      ...current,
      ...updates,
      settings: {
        ...current.settings,
        ...(updates.settings || {}),
      },
      sections: updates.sections ? updates.sections : current.sections,
      updatedAt: new Date().toISOString(),
    }

    // Ensure at least 1 section exists
    if (!updated.sections || updated.sections.length === 0) {
      throw new Error('An assessment must have at least one section.')
    }

    // Ensure each section has at least 1 question
    for (const sec of updated.sections) {
      if (!sec.questions || sec.questions.length === 0) {
        throw new Error(`Section "${sec.title}" must have at least one question.`)
      }
    }

    list[idx] = updated
    this.saveStoredAssessments(list)

    // Sync to database in background
    this.syncAssessmentToDatabase(updated)

    return updated
  },

  deleteAssessment(id: string): void {
    const list = this.getStoredAssessments()
    const filtered = list.filter((a) => a.id !== id)
    this.saveStoredAssessments(filtered)

    // Delete from database in background
    this.deleteAssessmentFromDatabase(id)
  },

  duplicateAssessment(id: string): Assessment {
    const orig = this.getAssessmentById(id)
    if (!orig) {
      throw new Error(`Assessment with ID "${id}" not found.`)
    }

    // Smart duplicate title: avoids runaway "Title (Copy) (Copy)"
    let baseTitle = orig.title.trim()
    const copyMatch = baseTitle.match(/^(.*?)\s*\(Copy(?:\s+(\d+))?\)$/i)
    if (copyMatch) {
      baseTitle = copyMatch[1].trim()
    }

    const all = this.getStoredAssessments()
    const existingTitles = new Set(all.map((a) => a.title.toLowerCase()))

    let newTitle = `${baseTitle} (Copy)`
    if (existingTitles.has(newTitle.toLowerCase())) {
      let counter = 2
      while (existingTitles.has(`${baseTitle} (Copy ${counter})`.toLowerCase())) {
        counter++
      }
      newTitle = `${baseTitle} (Copy ${counter})`
    }

    const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
    const cloned: Assessment = {
      ...JSON.parse(JSON.stringify(orig)),
      id: `assessment_${uniqueSuffix}`,
      title: newTitle,
      status: 'draft',
      attemptsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Re-generate section and question item IDs to guarantee 100% uniqueness
    cloned.sections = (cloned.sections || []).map((sec, sIdx) => {
      const secId = `sec_${uniqueSuffix}_${sIdx}`
      return {
        ...sec,
        id: secId,
        displayOrder: sIdx,
        questions: (sec.questions || []).map((q, qIdx) => ({
          ...q,
          id: `sq_${uniqueSuffix}_${sIdx}_${qIdx}`,
          displayOrder: qIdx,
        })),
      }
    })

    const list = this.getStoredAssessments()
    list.unshift(cloned)
    this.saveStoredAssessments(list)

    // Persist to database immediately
    this.syncAssessmentToDatabase(cloned)

    return cloned
  },

  duplicateSection(assessmentId: string, sectionId: string): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const secIdx = assessment.sections.findIndex((s) => s.id === sectionId)
    if (secIdx === -1) throw new Error('Section not found.')

    const origSec = assessment.sections[secIdx]
    const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`

    const clonedSec: AssessmentSection = {
      ...JSON.parse(JSON.stringify(origSec)),
      id: `sec_${uniqueSuffix}`,
      title: `${origSec.title} (Copy)`,
      displayOrder: secIdx + 1,
      questions: (origSec.questions || []).map((q, qIdx) => ({
        ...q,
        id: `sq_${uniqueSuffix}_${qIdx}`,
        displayOrder: qIdx,
      })),
    }

    const updatedSections = [...assessment.sections]
    updatedSections.splice(secIdx + 1, 0, clonedSec)
    updatedSections.forEach((s, idx) => {
      s.displayOrder = idx
    })

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  duplicateQuestion(assessmentId: string, sectionId: string, questionItemId: string): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const secIdx = assessment.sections.findIndex((s) => s.id === sectionId)
    if (secIdx === -1) throw new Error('Section not found.')

    const sec = assessment.sections[secIdx]
    const qIdx = sec.questions.findIndex((q) => q.id === questionItemId)
    if (qIdx === -1) throw new Error('Question not found in section.')

    const origQ = sec.questions[qIdx]
    const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`

    const clonedQ: SectionQuestionItem = {
      ...JSON.parse(JSON.stringify(origQ)),
      id: `sq_${uniqueSuffix}`,
      displayOrder: qIdx + 1,
    }

    const updatedQuestions = [...sec.questions]
    updatedQuestions.splice(qIdx + 1, 0, clonedQ)
    updatedQuestions.forEach((q, idx) => {
      q.displayOrder = idx
    })

    const updatedSections = [...assessment.sections]
    updatedSections[secIdx] = {
      ...sec,
      questions: updatedQuestions,
    }

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  // Section Management
  addSection(assessmentId: string, sectionPayload?: Partial<AssessmentSection>): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const bankQuestions = questionBankService.getStoredQuestions()
    const sampleQuestion = bankQuestions[0]

    const newSection: AssessmentSection = {
      id: uid('sec'),
      title: sectionPayload?.title || `Section ${assessment.sections.length + 1}`,
      description: sectionPayload?.description || '',
      displayOrder: assessment.sections.length,
      settings: {
        ...defaultSectionSettings,
        ...(sectionPayload?.settings || {}),
      },
      questions:
        sectionPayload?.questions && sectionPayload.questions.length > 0
          ? sectionPayload.questions
          : [
              {
                id: uid('sq'),
                questionId: sampleQuestion?.id || 'sample-q',
                displayOrder: 0,
                pointsOverride: 1,
                required: true,
                questionSnapshot: sampleQuestion || undefined,
              },
            ],
    }

    const updatedSections = [...assessment.sections, newSection]
    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  updateSection(
    assessmentId: string,
    sectionId: string,
    updates: Partial<AssessmentSection>
  ): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const updatedSections = assessment.sections.map((sec) => {
      if (sec.id !== sectionId) return sec

      return {
        ...sec,
        ...updates,
        settings: {
          ...sec.settings,
          ...(updates.settings || {}),
        },
      }
    })

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  deleteSection(assessmentId: string, sectionId: string): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    if (assessment.sections.length <= 1) {
      throw new Error('An assessment must have at least one section.')
    }

    const updatedSections = assessment.sections
      .filter((sec) => sec.id !== sectionId)
      .map((sec, idx) => ({ ...sec, displayOrder: idx }))

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  reorderSections(assessmentId: string, sectionIds: string[]): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const map = new Map(assessment.sections.map((s) => [s.id, s]))
    const reordered: AssessmentSection[] = []

    sectionIds.forEach((id, idx) => {
      const sec = map.get(id)
      if (sec) {
        reordered.push({ ...sec, displayOrder: idx })
      }
    })

    // Add any missing sections
    assessment.sections.forEach((sec) => {
      if (!reordered.find((s) => s.id === sec.id)) {
        reordered.push({ ...sec, displayOrder: reordered.length })
      }
    })

    return this.updateAssessment(assessmentId, { sections: reordered })
  },

  // Questions within Section Management
  addQuestionsToSection(
    assessmentId: string,
    sectionId: string,
    questionIds: string[]
  ): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const bank = questionBankService.getStoredQuestions()
    const questionMap = new Map(bank.map((q) => [q.id, q]))

    const updatedSections = assessment.sections.map((sec) => {
      if (sec.id !== sectionId) return sec

      const existingIds = new Set(sec.questions.map((q) => q.questionId))
      const newItems: SectionQuestionItem[] = []

      questionIds.forEach((qId) => {
        if (!existingIds.has(qId)) {
          const bankQ = questionMap.get(qId)
          newItems.push({
            id: uid('sq'),
            questionId: qId,
            displayOrder: sec.questions.length + newItems.length,
            pointsOverride: 1,
            required: true,
            questionSnapshot: bankQ || undefined,
          })
        }
      })

      return {
        ...sec,
        questions: [...sec.questions, ...newItems],
      }
    })

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  removeQuestionFromSection(
    assessmentId: string,
    sectionId: string,
    sectionQuestionId: string
  ): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const targetSection = assessment.sections.find((s) => s.id === sectionId)
    if (!targetSection) throw new Error('Section not found.')

    if (targetSection.questions.length <= 1) {
      throw new Error('Each section must have at least 1 question.')
    }

    const updatedSections = assessment.sections.map((sec) => {
      if (sec.id !== sectionId) return sec

      const filteredQuestions = sec.questions
        .filter((q) => q.id !== sectionQuestionId && q.questionId !== sectionQuestionId)
        .map((q, idx) => ({ ...q, displayOrder: idx }))

      return {
        ...sec,
        questions: filteredQuestions,
      }
    })

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  reorderSectionQuestions(
    assessmentId: string,
    sectionId: string,
    questionItemIds: string[]
  ): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const updatedSections = assessment.sections.map((sec) => {
      if (sec.id !== sectionId) return sec

      const qMap = new Map(sec.questions.map((q) => [q.id, q]))
      const reordered: SectionQuestionItem[] = []

      questionItemIds.forEach((id, idx) => {
        const q = qMap.get(id)
        if (q) {
          reordered.push({ ...q, displayOrder: idx })
        }
      })

      return {
        ...sec,
        questions: reordered,
      }
    })

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  updateSectionQuestion(
    assessmentId: string,
    sectionId: string,
    questionItemId: string,
    updates: Partial<SectionQuestionItem>
  ): Assessment {
    const assessment = this.getAssessmentById(assessmentId)
    if (!assessment) throw new Error('Assessment not found.')

    const updatedSections = assessment.sections.map((sec) => {
      if (sec.id !== sectionId) return sec

      const updatedQuestions = sec.questions.map((q) => {
        if (q.id !== questionItemId) return q
        return { ...q, ...updates }
      })

      return {
        ...sec,
        questions: updatedQuestions,
      }
    })

    return this.updateAssessment(assessmentId, { sections: updatedSections })
  },

  exportAssessmentJSON(id: string): string {
    const a = this.getAssessmentById(id)
    if (!a) throw new Error('Assessment not found.')
    return JSON.stringify(a, null, 2)
  },

  importAssessmentJSON(jsonString: string): Assessment {
    const parsed = JSON.parse(jsonString)
    if (!parsed || !parsed.title || !Array.isArray(parsed.sections)) {
      throw new Error('Invalid assessment JSON format.')
    }

    const imported: Partial<Assessment> = {
      ...parsed,
      id: `imported-${Date.now().toString(36)}`,
      title: `${parsed.title} (Imported)`,
      status: 'draft',
      attemptsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return this.createAssessment(imported)
  },
}
