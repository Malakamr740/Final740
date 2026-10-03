import type {
  ReportData,
  QuestionReviewItem,
  DomainPerformance,
  DomainClassification,
  CategoryTimeStats,
  TimeAnalysisResult,
  BreakdownRow,
} from '../components/Reports/Types'
import type { DomainRubricCopyConfig } from './reportTemplateService'

export type {
  ReportData,
  QuestionReviewItem,
  DomainPerformance,
  DomainClassification,
  CategoryTimeStats,
  TimeAnalysisResult,
  BreakdownRow,
}

// Configurable thresholds as requested
export const STRONG_DOMAIN_THRESHOLD = 75
export const MODERATE_DOMAIN_THRESHOLD = 50
export const TIME_SLOW_THRESHOLD_PCT = 25

/**
 * Returns verbosity-level-2 explanation for a domain performance card:
 * Sentence 1: Stating the performance fact
 * Sentence 2: Giving an actionable insight
 */
export function generateDomainExplanation(
  domainName: string,
  accuracyPct: number,
  classification: DomainClassification,
  correct: number,
  total: number,
  avgTimeSec: number,
  strongThreshold = STRONG_DOMAIN_THRESHOLD,
  moderateThreshold = MODERATE_DOMAIN_THRESHOLD,
  rubricCopy?: DomainRubricCopyConfig
): { criterion: string; fact: string; insight: string } {
  const key = classification.toLowerCase() as 'strong' | 'moderate' | 'weak'
  const defaults = {
    strong: {
      criterion: 'Category accuracy is at least {strongThreshold}%.',
      explanation: '{category} scored {accuracy}% ({correct} of {total} correct), meeting the configured mastery threshold.',
      recommendation: 'Continue with advanced practice and timed challenge sets in this area.',
    },
    moderate: {
      criterion: 'Category accuracy is at least {moderateThreshold}% and below {strongThreshold}%.',
      explanation: '{category} scored {accuracy}% ({correct} of {total} correct), placing it in the developing band.',
      recommendation: 'Review missed questions and practice this category to build consistency.',
    },
    weak: {
      criterion: 'Category accuracy is below {moderateThreshold}%.',
      explanation: '{category} scored {accuracy}% ({correct} of {total} correct), below the configured benchmark.',
      recommendation: 'Revisit foundational concepts in this category and complete guided practice before advancing.',
    },
  }
  const configuredCopy = rubricCopy?.[key] || defaults[key]
  const values: Record<string, string> = {
    category: domainName,
    accuracy: String(accuracyPct),
    correct: String(correct),
    total: String(total),
    avgTime: String(avgTimeSec),
    strongThreshold: String(strongThreshold),
    moderateThreshold: String(moderateThreshold),
  }
  const render = (text: string, fallback: string) =>
    (text.trim() || fallback).replace(/\{(\w+)\}/g, (match, token: string) => values[token] ?? match)

  return {
    criterion: render(configuredCopy.criterion, defaults[key].criterion),
    fact: render(configuredCopy.explanation, defaults[key].explanation),
    insight: render(configuredCopy.recommendation, defaults[key].recommendation),
  }
}

/**
 * Computes domain performance based on taxonomy hierarchy
 */
export function computeDomainPerformance(
  report: ReportData,
  strongThreshold = STRONG_DOMAIN_THRESHOLD,
  moderateThreshold = MODERATE_DOMAIN_THRESHOLD,
  rubricCopy?: DomainRubricCopyConfig
): {
  strongDomains: DomainPerformance[]
  weakDomains: DomainPerformance[]
  moderateDomains: DomainPerformance[]
  allDomains: DomainPerformance[]
} {
  const { questions, breakdowns } = report

  // Map to group questions by domain (category or skill)
  const domainMap = new Map<
    string,
    {
      domainId: string
      domainName: string
      domainType: string
      total: number
      correct: number
      unanswered: number
      totalTime: number
    }
  >()

  // 1. First aggregate from questions directly (most granular & accurate)
  if (questions && questions.length > 0) {
    for (const q of questions) {
      const domainName = q.category_name || q.lesson_name || q.skill_name || 'General Mathematics'
      const domainId = domainName
      const isCorrect = q.is_correct || q.status === 'correct'
      const isUnanswered =
        q.status === 'unanswered' ||
        (!isCorrect &&
          (!q.student_answer ||
            Object.keys(q.student_answer).length === 0 ||
            q.student_answer.unanswered === true))

      const existing = domainMap.get(domainName) || {
        domainId,
        domainName,
        domainType: q.category_name ? 'category' : 'skill',
        total: 0,
        correct: 0,
        unanswered: 0,
        totalTime: 0,
      }

      existing.total += 1
      if (isCorrect) existing.correct += 1
      if (isUnanswered) existing.unanswered += 1
      existing.totalTime += q.time_spent_seconds || 0

      domainMap.set(domainName, existing)
    }
  } else if (breakdowns && breakdowns.length > 0) {
    // Fallback: derive from breakdowns if questions list isn't populated
    for (const b of breakdowns.filter((b: BreakdownRow) => b.type === 'category' || b.type === 'skill')) {
      const existing = domainMap.get(b.label) || {
        domainId: b.id || b.label,
        domainName: b.label,
        domainType: b.type,
        total: b.total_questions,
        correct: b.correct_count,
        unanswered: 0,
        totalTime: (b.avg_time_seconds || 0) * b.total_questions,
      }
      domainMap.set(b.label, existing)
    }
  }

  const allDomains: DomainPerformance[] = []

  for (const [, item] of domainMap.entries()) {
    const accuracyPct =
      item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0
    const avgTimeSec =
      item.total > 0 ? Math.round(item.totalTime / item.total) : 0

    let classification: DomainClassification = 'Weak'
    if (accuracyPct >= strongThreshold) {
      classification = 'Strong'
    } else if (accuracyPct >= moderateThreshold) {
      classification = 'Moderate'
    }

    const { criterion, fact, insight } = generateDomainExplanation(
      item.domainName,
      accuracyPct,
      classification,
      item.correct,
      item.total,
      avgTimeSec,
      strongThreshold,
      moderateThreshold,
      rubricCopy
    )

    allDomains.push({
      domainId: item.domainId,
      domainName: item.domainName,
      domainType: item.domainType,
      total: item.total,
      correct: item.correct,
      unanswered: item.unanswered,
      accuracyPct,
      avgTimeSec,
      classification,
      classificationCriteria: criterion,
      performanceFact: fact,
      actionableInsight: insight,
    })
  }

  const strongDomains = allDomains
    .filter((d) => d.classification === 'Strong')
    .sort((a, b) => b.accuracyPct - a.accuracyPct)

  const weakDomains = allDomains
    .filter((d) => d.classification === 'Weak')
    .sort((a, b) => a.accuracyPct - b.accuracyPct)

  const moderateDomains = allDomains
    .filter((d) => d.classification === 'Moderate')
    .sort((a, b) => b.accuracyPct - a.accuracyPct)

  return {
    strongDomains,
    weakDomains,
    moderateDomains,
    allDomains,
  }
}

/**
 * Computes time analysis per category:
 * Flags categories taking > slowThresholdPct (default 25%) above overall avg.
 * Finds quickest and slowest questions solved.
 */
export function computeTimeAnalysis(
  questions: QuestionReviewItem[],
  overallAvgTime: number,
  slowThresholdPct = TIME_SLOW_THRESHOLD_PCT
): TimeAnalysisResult {
  if (!questions || questions.length === 0) {
    return {
      overallAvgTime,
      slowThresholdPct,
      categories: [],
      quickestSolved: null,
      slowestSolved: null,
    }
  }

  // Calculate actual overall average if not provided or 0
  const totalTimeAll = questions.reduce((acc, q) => acc + (q.time_spent_seconds || 0), 0)
  const effectiveOverallAvg =
    overallAvgTime > 0
      ? overallAvgTime
      : questions.length > 0
      ? Math.round(totalTimeAll / questions.length)
      : 0

  // Group by category
  const catMap = new Map<
    string,
    { category: string; totalTime: number; count: number; correctCount: number }
  >()

  for (const q of questions) {
    const category = q.category_name || 'General Questions'
    const isCorrect = q.is_correct || q.status === 'correct'
    const entry = catMap.get(category) || {
      category,
      totalTime: 0,
      count: 0,
      correctCount: 0,
    }
    entry.totalTime += q.time_spent_seconds || 0
    entry.count += 1
    if (isCorrect) entry.correctCount += 1
    catMap.set(category, entry)
  }

  const categories: CategoryTimeStats[] = []

  for (const [, item] of catMap.entries()) {
    const avgTimeSec = item.count > 0 ? Math.round(item.totalTime / item.count) : 0
    const deltaFromOverallPct =
      effectiveOverallAvg > 0
        ? Math.round(((avgTimeSec - effectiveOverallAvg) / effectiveOverallAvg) * 100)
        : 0
    const flaggedSlow = deltaFromOverallPct > slowThresholdPct

    categories.push({
      category: item.category,
      avgTimeSec,
      deltaFromOverallPct,
      flaggedSlow,
      questionCount: item.count,
      correctCount: item.correctCount,
    })
  }

  // Sort by deltaFromOverallPct descending (slowest first)
  categories.sort((a, b) => b.deltaFromOverallPct - a.deltaFromOverallPct)

  // Quickest question solved (correct answers with recorded time)
  const correctQuestions = questions.filter(
    (q) => (q.is_correct || q.status === 'correct') && q.time_spent_seconds !== undefined
  )
  const quickestSolved =
    correctQuestions.length > 0
      ? [...correctQuestions].sort((a, b) => a.time_spent_seconds - b.time_spent_seconds)[0]
      : null

  // Slowest question solved overall
  const slowestSolved =
    questions.length > 0
      ? [...questions].sort((a, b) => (b.time_spent_seconds || 0) - (a.time_spent_seconds || 0))[0]
      : null

  return {
    overallAvgTime: effectiveOverallAvg,
    slowThresholdPct,
    categories,
    quickestSolved,
    slowestSolved,
  }
}

/**
 * Three-state question classification:
 * Classifies all questions into 'correct', 'incorrect', or 'unanswered'
 */
export function classifyQuestionState(
  q: QuestionReviewItem
): 'correct' | 'incorrect' | 'unanswered' {
  if (q.status) {
    return q.status
  }
  if (q.is_correct) {
    return 'correct'
  }
  // Check if student submitted an actual answer
  const sa = q.student_answer
  if (!sa || Object.keys(sa).length === 0 || sa.unanswered === true) {
    return 'unanswered'
  }
  if (sa.choice_id || (sa.value !== undefined && String(sa.value).trim() !== '') || sa.text) {
    return 'incorrect'
  }
  return 'unanswered'
}

export function computeThreeStateSummary(questions: QuestionReviewItem[]): {
  total: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  correctPct: number
  incorrectPct: number
  unansweredPct: number
} {
  let correctCount = 0
  let incorrectCount = 0
  let unansweredCount = 0

  for (const q of questions) {
    const st = classifyQuestionState(q)
    if (st === 'correct') correctCount++
    else if (st === 'incorrect') incorrectCount++
    else unansweredCount++
  }

  const total = questions.length
  const correctPct = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const incorrectPct = total > 0 ? Math.round((incorrectCount / total) * 100) : 0
  const unansweredPct = total > 0 ? Math.round((unansweredCount / total) * 100) : 0

  return {
    total,
    correctCount,
    incorrectCount,
    unansweredCount,
    correctPct,
    incorrectPct,
    unansweredPct,
  }
}

// Support both singular and plural naming for backwards compatibility
export const computeThreeStatesSummary = computeThreeStateSummary

