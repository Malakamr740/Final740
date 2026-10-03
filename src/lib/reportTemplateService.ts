import { supabase, isSupabaseConfigured } from './supabaseClient'
import {
  deleteOrganizationConfig,
  loadOrganizationConfig,
  saveOrganizationConfig,
} from './organizationConfigService'

export interface ReportSectionConfig {
  id: string
  title: string
  subtitle?: string
  enabled: boolean
  order: number
  description?: string
}

export interface RubricTier {
  id: string
  name: string
  minScore: number
  maxScore: number
  badgeColor: string
  description: string
  recommendation: string
}

export interface CategoryLabelConfig {
  strong: string
  moderate: string
  weak: string
}

export interface DomainRubricCopy {
  criterion: string
  explanation: string
  recommendation: string
}

export type DomainRubricCopyConfig = Record<'strong' | 'moderate' | 'weak', DomainRubricCopy>

export type ReportSectionId =
  | 'showHeroMetrics'
  | 'showThreeStateDonut'
  | 'showStrongDomains'
  | 'showWeakDomains'
  | 'showTimeAnalysis'
  | 'showTaxonomyTree'
  | 'showErrorPatterns'
  | 'showQuestionSolutions'
  | 'showActionPlan'
  | 'showCourseRecommendations'

export type ReportRuleMetric =
  | 'grade'
  | 'score'
  | 'totalTimeMinutes'
  | 'avgTimeSeconds'
  | 'questionCount'

export interface ReportSectionRule {
  metric: ReportRuleMetric
  operator: 'gte' | 'lte' | 'equals' | 'contains'
  value: string
}

export const REPORT_SECTION_DISPLAY_FIELDS: Record<ReportSectionId, Array<{ id: string; label: string }>> = {
  showHeroMetrics: [
    { id: 'banner', label: 'Header banner' },
    { id: 'studentName', label: 'Student name' },
    { id: 'assessmentName', label: 'Assessment name' },
    { id: 'completedDate', label: 'Completion date' },
    { id: 'score', label: 'Overall score' },
    { id: 'classification', label: 'Classification' },
    { id: 'duration', label: 'Total duration' },
    { id: 'questionCount', label: 'Question count' },
  ],
  showThreeStateDonut: [
    { id: 'chart', label: 'Donut chart' },
    { id: 'accuracy', label: 'Accuracy' },
    { id: 'statusBreakdown', label: 'Correct / incorrect / unanswered counts' },
  ],
  showStrongDomains: [
    { id: 'domainName', label: 'Category name' },
    { id: 'domainType', label: 'Category type' },
    { id: 'classification', label: 'Strong / focus classification' },
    { id: 'criterion', label: 'Why this category meets the rubric' },
    { id: 'accuracy', label: 'Accuracy' },
    { id: 'answerCount', label: 'Correct / total answers' },
    { id: 'averageTime', label: 'Average time per question' },
    { id: 'unanswered', label: 'Unanswered count' },
    { id: 'explanation', label: 'Performance explanation and insight' },
  ],
  showWeakDomains: [
    { id: 'domainName', label: 'Category name' },
    { id: 'domainType', label: 'Category type' },
    { id: 'classification', label: 'Strong / focus classification' },
    { id: 'criterion', label: 'Why this category meets the rubric' },
    { id: 'accuracy', label: 'Accuracy' },
    { id: 'answerCount', label: 'Correct / total answers' },
    { id: 'averageTime', label: 'Average time per question' },
    { id: 'unanswered', label: 'Unanswered count' },
    { id: 'explanation', label: 'Performance explanation and insight' },
  ],
  showTimeAnalysis: [
    { id: 'overallAverage', label: 'Overall average time' },
    { id: 'threshold', label: 'Pacing threshold' },
    { id: 'categoryBreakdown', label: 'Category pacing table' },
    { id: 'categoryName', label: 'Pacing table category names' },
    { id: 'questionCount', label: 'Pacing table question counts' },
    { id: 'averagePace', label: 'Pacing table average times' },
    { id: 'variance', label: 'Pacing table benchmark variance' },
    { id: 'pacingAssessment', label: 'Pacing table assessment' },
    { id: 'quickest', label: 'Quickest question' },
    { id: 'slowest', label: 'Slowest question' },
  ],
  showTaxonomyTree: [
    { id: 'categories', label: 'Categories' },
    { id: 'lessons', label: 'Chapters and lessons' },
    { id: 'skills', label: 'Skills' },
    { id: 'otherTypes', label: 'Other taxonomy types' },
    { id: 'rowLabels', label: 'Category and item names' },
    { id: 'answerCounts', label: 'Correct / total answers' },
    { id: 'percentages', label: 'Percentages' },
    { id: 'classifications', label: 'Performance classifications' },
  ],
  showErrorPatterns: [
    { id: 'conceptual', label: 'Conceptual gaps' },
    { id: 'rushed', label: 'Rushed mistakes' },
    { id: 'timesink', label: 'Timesink mistakes' },
    { id: 'summary', label: 'Summary sentence' },
  ],
  showQuestionSolutions: [
    { id: 'questionText', label: 'Question text' },
    { id: 'status', label: 'Answer status' },
    { id: 'difficulty', label: 'Difficulty' },
    { id: 'time', label: 'Time spent and test average' },
    { id: 'taxonomy', label: 'Category, lesson, and skill' },
    { id: 'studentResponse', label: 'Student response' },
    { id: 'expectedSolution', label: 'Expected solution' },
    { id: 'explanation', label: 'Step-by-step explanation' },
  ],
  showActionPlan: [
    { id: 'audience', label: 'Target audience' },
    { id: 'title', label: 'Plan title and tagline' },
    { id: 'summary', label: 'Plan summary' },
    { id: 'milestones', label: 'Milestones and tasks' },
    { id: 'routine', label: 'Weekly routine' },
    { id: 'advice', label: 'Key advice' },
  ],
  showCourseRecommendations: [
    { id: 'recommendation', label: 'Study recommendation' },
    { id: 'courseName', label: 'Course name' },
    { id: 'description', label: 'Course description' },
    { id: 'enrollmentLink', label: 'Enrollment link' },
  ],
}

export interface ReportTemplateConfig {
  id: string
  assessmentId?: string // undefined or 'global' means default for all assessments
  title: string
  subtitle?: string
  headerBannerText?: string
  showHeroMetrics: boolean
  showThreeStateDonut: boolean
  showStrongDomains: boolean
  showWeakDomains: boolean
  showTimeAnalysis: boolean
  showTaxonomyTree: boolean
  showErrorPatterns: boolean
  showQuestionSolutions: boolean
  showActionPlan: boolean
  showCourseRecommendations: boolean
  categoryLabels: CategoryLabelConfig
  domainRubricCopy: DomainRubricCopyConfig
  sectionRules: Partial<Record<ReportSectionId, ReportSectionRule>>
  sectionFields: Partial<Record<ReportSectionId, string[]>>
  
  // Custom threshold overrides
  strongThreshold: number
  moderateThreshold: number
  slowTimeThresholdPct: number

  // Rubric Tiers
  rubricTiers: RubricTier[]

  // Custom diagnostic notes or instructions
  customNotesTitle?: string
  customNotesBody?: string
  footerDisclaimer?: string

  updatedAt: string
}

const STORAGE_KEY_PREFIX = 'math_diag_report_config_'
const DEFAULT_GLOBAL_KEY = 'math_diag_report_config_global'

function normalizeReportTemplate(parsed: Partial<ReportTemplateConfig>): ReportTemplateConfig {
  return {
    ...DEFAULT_GLOBAL_REPORT_TEMPLATE,
    ...parsed,
    categoryLabels: {
      ...DEFAULT_GLOBAL_REPORT_TEMPLATE.categoryLabels,
      ...(parsed.categoryLabels || {}),
    },
    domainRubricCopy: {
      ...DEFAULT_GLOBAL_REPORT_TEMPLATE.domainRubricCopy,
      ...(parsed.domainRubricCopy || {}),
      strong: {
        ...DEFAULT_GLOBAL_REPORT_TEMPLATE.domainRubricCopy.strong,
        ...(parsed.domainRubricCopy?.strong || {}),
      },
      moderate: {
        ...DEFAULT_GLOBAL_REPORT_TEMPLATE.domainRubricCopy.moderate,
        ...(parsed.domainRubricCopy?.moderate || {}),
      },
      weak: {
        ...DEFAULT_GLOBAL_REPORT_TEMPLATE.domainRubricCopy.weak,
        ...(parsed.domainRubricCopy?.weak || {}),
      },
    },
    sectionRules: {
      ...DEFAULT_GLOBAL_REPORT_TEMPLATE.sectionRules,
      ...(parsed.sectionRules || {}),
    },
    sectionFields: {
      ...DEFAULT_GLOBAL_REPORT_TEMPLATE.sectionFields,
      ...(parsed.sectionFields || {}),
    },
  }
}

export const DEFAULT_REPORT_RUBRIC_TIERS: RubricTier[] = [
  {
    id: 'tier-mastery',
    name: 'Mastery Tier (Advanced)',
    minScore: 80,
    maxScore: 100,
    badgeColor: 'emerald',
    description: 'Demonstrated superior conceptual command and consistent procedural execution across assessed mathematical domains.',
    recommendation: 'Target advanced challenge modules, full-length timed pacing drills, and elite scoring strategies.',
  },
  {
    id: 'tier-proficient',
    name: 'Proficient Tier (Intermediate)',
    minScore: 65,
    maxScore: 79,
    badgeColor: 'blue',
    description: 'Demonstrated solid baseline mathematical intuition and standard problem-solving with isolated sub-topic slips.',
    recommendation: 'Target intermediate practice sets and eliminate careless misreads on multi-step questions.',
  },
  {
    id: 'tier-developing',
    name: 'Developing Foundations (Core)',
    minScore: 50,
    maxScore: 64,
    badgeColor: 'amber',
    description: 'Core concepts require targeted reinforcement, with several gaps in algebraic manipulation or geometric formulas.',
    recommendation: 'Target foundational drills and formula retention before progressing to timed pressure sets.',
  },
  {
    id: 'tier-foundational',
    name: 'Critical Foundation Rebuild',
    minScore: 0,
    maxScore: 49,
    badgeColor: 'rose',
    description: 'Significant foundational gaps identified that require comprehensive step-by-step topic review and teacher guidance.',
    recommendation: 'Enroll in structured concept remediation and practice untimed foundational problem sets.',
  },
]

export const DEFAULT_GLOBAL_REPORT_TEMPLATE: ReportTemplateConfig = {
  id: 'global-template',
  title: 'Diagnostic Performance Assessment',
  subtitle: 'Comprehensive Mathematics Diagnostic Evaluation',
  headerBannerText: 'Student Diagnostic Evaluation',
  showHeroMetrics: true,
  showThreeStateDonut: true,
  showStrongDomains: true,
  showWeakDomains: true,
  showTimeAnalysis: true,
  showTaxonomyTree: true,
  showErrorPatterns: true,
  showQuestionSolutions: true,
  showActionPlan: true,
  showCourseRecommendations: true,
  categoryLabels: {
    strong: 'Strong Domains',
    moderate: 'Developing Domains',
    weak: 'Focus Areas',
  },
  domainRubricCopy: {
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
  },
  sectionRules: {},
  sectionFields: {},
  strongThreshold: 75,
  moderateThreshold: 50,
  slowTimeThresholdPct: 25,
  rubricTiers: DEFAULT_REPORT_RUBRIC_TIERS,
  customNotesTitle: 'Diagnostic Overview & Educator Guidance',
  customNotesBody: 'This report reflects individual diagnostic performance. Mastery indicators and time pacing are benchmarked against official examination standards.',
  footerDisclaimer: 'Report automatically compiled by Scholar Academy Math Assessment System.',
  updatedAt: new Date().toISOString(),
}

const _templatesMap = new Map<string, ReportTemplateConfig>()
let _hasLoadedGlobalTemplate = false

// Clear any old browser storage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(DEFAULT_GLOBAL_KEY)
  } catch {}
}

export const reportTemplateService = {
  getTemplateForAssessment(assessmentId?: string): ReportTemplateConfig {
    const key = assessmentId || 'global'
    if (_templatesMap.has(key)) {
      return _templatesMap.get(key)!
    }
    if (_templatesMap.has('global')) {
      return _templatesMap.get('global')!
    }

    if (!_hasLoadedGlobalTemplate && typeof window !== 'undefined') {
      this.loadTemplateForAssessment(assessmentId).catch(() => {})
    }

    return normalizeReportTemplate(DEFAULT_GLOBAL_REPORT_TEMPLATE)
  },

  async loadTemplateForAssessment(assessmentId?: string): Promise<ReportTemplateConfig> {
    const key = assessmentId || 'global'

    // 1. Try server SQLite database API
    try {
      const res = await fetch(`/api/report-templates/${key}`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          const normalized = normalizeReportTemplate(data)
          _templatesMap.set(key, normalized)
          return normalized
        }
      }
    } catch (e) {
      console.warn('Failed to load report template from server API:', e)
    }

    if (!isSupabaseConfigured) {
      return this.getTemplateForAssessment(assessmentId)
    }

    try {
      if (assessmentId) {
        const assessmentConfig = await loadOrganizationConfig<Partial<ReportTemplateConfig>>(
          'report_template',
          assessmentId
        )
        if (assessmentConfig) {
          const template = normalizeReportTemplate(assessmentConfig)
          _templatesMap.set(key, template)
          return template
        }
      }

      const globalConfig = await loadOrganizationConfig<Partial<ReportTemplateConfig>>('report_template')
      if (globalConfig) {
        const template = normalizeReportTemplate(globalConfig)
        _templatesMap.set('global', template)
        return template
      }
    } catch (e) {
      console.warn('Failed to load report template from Supabase:', e)
    }

    return this.getTemplateForAssessment(assessmentId)
  },

  async loadTemplateForAttempt(attemptId: string, resumeToken: string): Promise<ReportTemplateConfig> {
    if (!isSupabaseConfigured) return this.getTemplateForAssessment()

    const { data, error } = await supabase.rpc('get_attempt_app_config', {
      p_attempt_id: attemptId,
      p_resume_token: resumeToken,
      p_config_key: 'report_template',
    })
    if (error) {
      console.warn('Failed to load report template for attempt:', error.message)
      return this.getTemplateForAssessment()
    }
    return data ? normalizeReportTemplate(data) : this.getTemplateForAssessment()
  },

  async saveTemplateForAssessment(assessmentId: string | undefined, template: ReportTemplateConfig): Promise<void> {
    const key = assessmentId || 'global'
    const payload = normalizeReportTemplate({ ...template, updatedAt: new Date().toISOString() })
    _templatesMap.set(key, payload)

    // Save to server database API
    try {
      await fetch('/api/report-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, template: payload }),
      })
    } catch (e) {
      console.warn('Failed to save report template to server API:', e)
    }

    if (isSupabaseConfigured) {
      try {
        await saveOrganizationConfig('report_template', payload, assessmentId)
      } catch (e) {
        console.error('Failed to save report template to Supabase:', e)
      }
    }
  },

  async resetTemplate(assessmentId?: string): Promise<ReportTemplateConfig> {
    const key = assessmentId || 'global'
    _templatesMap.delete(key)

    try {
      await fetch(`/api/report-templates/${key}`, { method: 'DELETE' })
      if (isSupabaseConfigured) await deleteOrganizationConfig('report_template', assessmentId)
    } catch (e) {
      console.error('Failed to reset report template:', e)
    }
    return normalizeReportTemplate(DEFAULT_GLOBAL_REPORT_TEMPLATE)
  },

  resolveRubricLevel(scorePercentage: number, template?: ReportTemplateConfig): RubricTier {
    const config = template || this.getTemplateForAssessment()
    const tiers = config.rubricTiers && config.rubricTiers.length > 0 ? config.rubricTiers : DEFAULT_REPORT_RUBRIC_TIERS

    // Find match where score is between minScore and maxScore
    const matched = tiers.find((t) => scorePercentage >= t.minScore && scorePercentage <= t.maxScore)
    if (matched) return matched

    // Fallback if not matched
    if (scorePercentage >= 80) return tiers[0]
    if (scorePercentage >= 65) return tiers[1] || tiers[0]
    if (scorePercentage >= 50) return tiers[2] || tiers[0]
    return tiers[tiers.length - 1]
  }
}
