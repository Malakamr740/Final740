/**
 * Unit of Work Pattern for Application Data Mutations
 *
 * Coordinates atomic transactional operations across multiple aggregates/entities:
 * - Questions, Taxonomy (Domains, Chapters, Lessons), Collections, Assessments, and Attempts.
 *
 * Guarantees ACID atomicity: operations are staged, validated, and committed
 * together in a single database transaction. If any operation fails, all
 * changes are completely rolled back to maintain perfect database integrity.
 */

import { questionBankService, QuestionBankItem, QuestionCollection } from './questionBankService'
import { assessmentService, Assessment } from './assessmentService'

export type UnitOfWorkActionType =
  | 'save_domain'
  | 'save_chapter'
  | 'save_lesson'
  | 'save_question'
  | 'save_questions'
  | 'delete_question'
  | 'save_collection'
  | 'delete_collection'
  | 'save_assessment'
  | 'delete_assessment'
  | 'save_attempt'
  | 'delete_attempt'
  | 'delete_taxonomy'

export interface UnitOfWorkAction {
  id: string
  type: UnitOfWorkActionType
  payload: any
  timestamp: string
}

export interface UnitOfWorkCommitResult {
  success: boolean
  committedCount: number
  error?: string
  results?: any[]
}

export class UnitOfWork {
  private actions: UnitOfWorkAction[] = []
  private isCommitted: boolean = false
  private isRolledBack: boolean = false

  /**
   * Stage a new or updated Domain in the Unit of Work
   */
  registerNewDomain(name: string, unitLabel?: string, code?: string): this {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Domain name cannot be empty in Unit of Work')
    this.actions.push({
      id: `act-dom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'save_domain',
      payload: { name: trimmed, unitLabel, code },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a new or updated Chapter in the Unit of Work
   */
  registerNewChapter(domain: string, name: string, code?: string): this {
    const dTrim = domain.trim()
    const cTrim = name.trim()
    if (!dTrim || !cTrim) throw new Error('Domain and chapter name cannot be empty in Unit of Work')
    this.actions.push({
      id: `act-chap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'save_chapter',
      payload: { domain: dTrim, name: cTrim, code },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a new or updated Lesson in the Unit of Work
   */
  registerNewLesson(domain: string, chapter: string, name: string): this {
    const dTrim = domain.trim()
    const cTrim = chapter.trim()
    const lTrim = name.trim()
    if (!dTrim || !cTrim || !lTrim) {
      throw new Error('Domain, chapter, and lesson name cannot be empty in Unit of Work')
    }
    this.actions.push({
      id: `act-les-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'save_lesson',
      payload: { domain: dTrim, chapter: cTrim, name: lTrim },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a Question to be saved (inserted or updated) in the Unit of Work
   */
  registerQuestion(question: QuestionBankItem): this {
    if (!question || !question.prompt?.trim()) {
      throw new Error('Question must have a valid prompt stem in Unit of Work')
    }
    this.actions.push({
      id: `act-q-${question.id || Date.now()}`,
      type: 'save_question',
      payload: question,
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a Question to be deleted in the Unit of Work
   */
  registerDeleteQuestion(questionId: string): this {
    const qId = String(questionId).trim()
    if (!qId) throw new Error('Question ID is required for delete in Unit of Work')
    this.actions.push({
      id: `act-del-q-${qId}`,
      type: 'delete_question',
      payload: { id: qId },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a Collection to be saved in the Unit of Work
   */
  registerCollection(collection: QuestionCollection): this {
    if (!collection || !collection.name?.trim()) {
      throw new Error('Collection must have a valid name in Unit of Work')
    }
    this.actions.push({
      id: `act-col-${collection.id || collection.name}`,
      type: 'save_collection',
      payload: collection,
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage an Assessment to be saved in the Unit of Work
   */
  registerAssessment(assessment: Assessment): this {
    if (!assessment || !assessment.id) {
      throw new Error('Assessment must have an ID in Unit of Work')
    }
    this.actions.push({
      id: `act-ass-${assessment.id}`,
      type: 'save_assessment',
      payload: assessment,
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage multiple Questions to be saved in batch in the Unit of Work
   */
  registerQuestions(questions: QuestionBankItem[]): this {
    if (!Array.isArray(questions) || questions.length === 0) return this
    for (const q of questions) {
      if (!q.prompt?.trim()) {
        throw new Error('All questions in Unit of Work must have a valid prompt stem')
      }
    }
    this.actions.push({
      id: `act-qs-${Date.now()}`,
      type: 'save_questions',
      payload: questions,
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a Collection to be deleted in the Unit of Work
   */
  registerDeleteCollection(collectionId: string): this {
    const cId = String(collectionId).trim()
    if (!cId) throw new Error('Collection ID/name is required for delete in Unit of Work')
    this.actions.push({
      id: `act-del-col-${cId}`,
      type: 'delete_collection',
      payload: { id: cId, name: cId },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage an Attempt to be saved in the Unit of Work
   */
  registerAttempt(attempt: any): this {
    if (!attempt || !attempt.id) throw new Error('Attempt must have an ID in Unit of Work')
    this.actions.push({
      id: `act-att-${attempt.id}`,
      type: 'save_attempt',
      payload: attempt,
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage an Attempt to be deleted in the Unit of Work
   */
  registerDeleteAttempt(attemptId: string): this {
    const aId = String(attemptId).trim()
    if (!aId) throw new Error('Attempt ID is required for delete in Unit of Work')
    this.actions.push({
      id: `act-del-att-${aId}`,
      type: 'delete_attempt',
      payload: { id: aId },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage a Taxonomy item (domain, chapter, lesson) to be deleted in the Unit of Work
   */
  registerDeleteTaxonomy(payload: {
    type: 'domain' | 'chapter' | 'lesson' | 'all'
    domain?: string
    chapter?: string
    lesson?: string
    deleteQuestions?: boolean
  }): this {
    this.actions.push({
      id: `act-del-tax-${Date.now()}`,
      type: 'delete_taxonomy',
      payload,
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Stage an Assessment and all its dependent entities to be deleted
   */
  registerDeleteAssessment(assessmentId: string): this {
    const aId = String(assessmentId).trim()
    if (!aId) throw new Error('Assessment ID is required for delete in Unit of Work')
    this.actions.push({
      id: `act-del-ass-${aId}`,
      type: 'delete_assessment',
      payload: { id: aId },
      timestamp: new Date().toISOString(),
    })
    return this
  }

  /**
   * Get all currently staged actions
   */
  getActions(): ReadonlyArray<UnitOfWorkAction> {
    return [...this.actions]
  }

  /**
   * Check if there are any pending operations staged
   */
  get hasPendingOperations(): boolean {
    return this.actions.length > 0 && !this.isCommitted && !this.isRolledBack
  }

  /**
   * Clear all staged operations without committing
   */
  rollback(): void {
    this.actions = []
    this.isRolledBack = true
  }

  /**
   * Commit all staged operations atomically to the backend SQLite database.
   * If any operation fails, the entire transaction is rolled back on the server.
   */
  async commit(): Promise<UnitOfWorkCommitResult> {
    if (this.actions.length === 0) {
      return { success: true, committedCount: 0 }
    }

    if (this.isCommitted) {
      throw new Error('This Unit of Work has already been committed.')
    }

    try {
      const response = await fetch('/api/unit-of-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: this.actions }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let parsedError: string
        try {
          const jsonErr = JSON.parse(errorText)
          parsedError = jsonErr.error || errorText
        } catch {
          parsedError = errorText
        }
        throw new Error(`Unit of Work transaction failed (HTTP ${response.status}): ${parsedError}`)
      }

      const result = await response.json()
      this.isCommitted = true

      // Post-commit: Synchronize local state caches seamlessly
      await this.syncLocalCaches()

      return {
        success: true,
        committedCount: this.actions.length,
        results: result.results,
      }
    } catch (err: any) {
      this.rollback()
      console.error('[UnitOfWork] Commit error:', err)
      throw err
    }
  }

  /**
   * Synchronize frontend caches after successful atomic server commit
   */
  private async syncLocalCaches(): Promise<void> {
    const hasTaxonomyActions = this.actions.some((a) =>
      ['save_domain', 'save_chapter', 'save_lesson', 'save_question', 'save_questions', 'delete_taxonomy'].includes(a.type)
    )
    const hasQuestionActions = this.actions.some((a) =>
      ['save_question', 'save_questions', 'delete_question', 'delete_taxonomy'].includes(a.type)
    )
    const hasCollectionActions = this.actions.some((a) =>
      ['save_collection', 'delete_collection', 'save_question', 'save_questions', 'delete_question'].includes(a.type)
    )
    const hasAssessmentActions = this.actions.some((a) =>
      ['save_assessment', 'delete_assessment'].includes(a.type)
    )

    try {
      if (hasTaxonomyActions) {
        await questionBankService.fetchTaxonomy().catch(() => {})
      }
      if (hasQuestionActions) {
        await questionBankService.fetchQuestionsFromDatabase().catch(() => {})
      }
      if (hasCollectionActions) {
        await questionBankService.fetchCollectionsFromDatabase().catch(() => {})
      }
      if (hasAssessmentActions) {
        await assessmentService.fetchAssessmentsFromDatabase().catch(() => {})
      }
    } catch (cacheErr) {
      console.warn('[UnitOfWork] Notice synchronizing local caches post-commit:', cacheErr)
    }
  }
}

/**
   Convenient helper to build and atomically execute a Unit of Work
 */
export async function executeUnitOfWork(
  buildWork: (uow: UnitOfWork) => void | Promise<void>
): Promise<UnitOfWorkCommitResult> {
  const uow = new UnitOfWork()
  await buildWork(uow)
  return await uow.commit()
}
