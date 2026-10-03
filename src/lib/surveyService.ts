import { isSupabaseConfigured } from './supabaseClient'
import { loadOrganizationConfig, saveOrganizationConfig } from './organizationConfigService'

export interface SurveyQuestionOption {
  id: string
  label: string
  value: string
}

export interface SurveyQuestion {
  id: string
  prompt: string
  description?: string
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'text'
  required: boolean
  options?: SurveyQuestionOption[]
  order_index: number
  category?: string
}

export interface ActionPlanMilestone {
  title: string
  timeframe: string
  description: string
  tasks: string[]
}

export interface ActionPlan {
  id: string
  title: string
  tagline: string
  summary: string
  target_audience: string
  badge_color?: string
  min_score?: number
  max_score?: number
  target_study_hours?: string[]
  target_test_window?: string[]
  primary_challenge?: string[]
  target_score_goal?: string[]
  milestones: ActionPlanMilestone[]
  weekly_routine: {
    day_group: string
    focus: string
    suggested_hours: string
  }[]
  prescriptive_advice: string[]
  recommended_resources: string[]
}

export interface StudentSurveyResponse {
  attempt_id: string
  submitted_at: string
  answers: Record<string, any>
  matched_plan_id?: string
}

export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'target_test_date',
    prompt: 'When is your official test date (EST / SAT / ACT)?',
    description: 'Helps us tailor your pacing and roadmap.',
    type: 'single_choice',
    required: true,
    order_index: 0,
    category: 'timeline',
    options: [
      { id: 'opt_1m', label: 'Within the next 4 weeks (Urgent / Final Polish)', value: 'within_1m' },
      { id: 'opt_3m', label: 'In 2 to 3 months (Standard Prep Window)', value: '2_to_3m' },
      { id: 'opt_6m', label: 'In 4 to 6 months or more (Comprehensive Foundation)', value: '4_to_6m' },
      { id: 'opt_undecided', label: 'Not scheduled yet / Just testing my level', value: 'undecided' },
    ],
  },
  {
    id: 'weekly_study_time',
    prompt: 'How many hours per week can you realistically commit to prep?',
    description: 'Be honest so we don’t over-pack or under-utilize your schedule.',
    type: 'single_choice',
    required: true,
    order_index: 1,
    category: 'study_habits',
    options: [
      { id: 'opt_low', label: 'Less than 4 hours / week (Light / Busy Schedule)', value: 'under_4h' },
      { id: 'opt_med', label: '5 to 8 hours / week (Balanced Routine)', value: '5_to_8h' },
      { id: 'opt_high', label: '9 to 14 hours / week (Intensive Focus)', value: '9_to_14h' },
      { id: 'opt_max', label: '15+ hours / week (Full Bootcamp Mode)', value: '15plus_h' },
    ],
  },
  {
    id: 'primary_challenge',
    prompt: 'What was your biggest challenge while completing this assessment?',
    description: 'We will emphasize this in your action roadmap.',
    type: 'single_choice',
    required: true,
    order_index: 2,
    category: 'challenges',
    options: [
      { id: 'opt_time', label: 'Pacing & running out of time on tougher questions', value: 'time_management' },
      { id: 'opt_gaps', label: 'Gaps in math rules, formulas & concepts (e.g. quadratics, geometry)', value: 'concept_gaps' },
      { id: 'opt_traps', label: 'Careless mistakes / Falling for tricky wording', value: 'careless_errors' },
      { id: 'opt_fatigue', label: 'Mental fatigue & focus drop toward the end of modules', value: 'fatigue' },
    ],
  },
  {
    id: 'target_score_goal',
    prompt: 'What is your dream score range for this exam?',
    description: 'Target score tier for your university aspirations.',
    type: 'single_choice',
    required: false,
    order_index: 3,
    category: 'confidence',
    options: [
      { id: 'opt_pass', label: 'Solid Competitive Score (600–650 SAT / 26–28 ACT / 600–700 EST)', value: 'competitive' },
      { id: 'opt_high_tier', label: 'High Achiever Score (680–740 SAT / 29–32 ACT / 700–750 EST)', value: 'high_achiever' },
      { id: 'opt_elite', label: 'Top Tier / 99th Percentile (750–800 SAT / 33–36 ACT / 760–800 EST)', value: 'elite' },
    ],
  },
  {
    id: 'calculator_comfort',
    prompt: 'How comfortable are you leveraging Desmos / graphing calculator shortcuts?',
    description: 'Graphing shortcuts can save up to 40% of test time.',
    type: 'single_choice',
    required: false,
    order_index: 4,
    category: 'study_habits',
    options: [
      { id: 'calc_novice', label: 'Novice: I mostly do algebra on paper by hand', value: 'novice' },
      { id: 'calc_intermediate', label: 'Intermediate: I use standard graphing and table lookups', value: 'intermediate' },
      { id: 'calc_expert', label: 'Advanced: I solve systems, regressions, and limits with Desmos', value: 'advanced' },
    ],
  },
]

export const DEFAULT_ACTION_PLANS: ActionPlan[] = [
  {
    id: 'plan_urgent_speed_sprint',
    title: 'High-Velocity Score Sprint (Exam in < 30 Days)',
    tagline: 'High-impact yield focusing on timing tactics, calculator automation & high-frequency question patterns.',
    target_audience: 'Students testing in the next 4 weeks with urgent deadlines.',
    badge_color: 'amber',
    min_score: 0,
    max_score: 100,
    target_test_window: ['within_1m'],
    primary_challenge: ['time_management', 'careless_errors', 'fatigue'],
    summary: 'With your test just around the corner, do not try to reread textbooks cover-to-cover. Focus exclusively on the top 4 recurring tested patterns, timed section drills, and aggressive calculator optimization to eliminate pacing bottlenecks.',
    milestones: [
      {
        title: 'Phase 1: High-Frequency Error Elimination',
        timeframe: 'Days 1 to 7',
        description: 'Target the exact taxonomy sub-skills where you lost quick points in your diagnostic test.',
        tasks: [
          'Review every incorrect answer from your diagnostic and identify if it was content vs. misreading.',
          'Memorize the top 10 digital calculator shortcuts (Desmos systems of equations, regressions, vertex forms).',
          'Complete 2 timed 20-question mini-drills under strict 1.5 minutes per question pacing.'
        ],
      },
      {
        title: 'Phase 2: Timed Simulation & Endurance',
        timeframe: 'Days 8 to 18',
        description: 'Simulate full realistic test-day constraints with module breaks.',
        tasks: [
          'Take 2 full-length timed diagnostic modules back-to-back at the exact hour of your real exam.',
          'Maintain an Error Journal: write the exact trigger that led to each mistake.',
          'Practice "Skip & Flag" discipline: never spend over 2 minutes on any single problem.'
        ],
      },
      {
        title: 'Phase 3: Final Taper & Confidence',
        timeframe: 'Days 19 to Test Day',
        description: 'Rest and mental consolidation to peak on exam day.',
        tasks: [
          'Review your personalized formula sheet and Desmos quick-reference sheet daily.',
          'Solve 10 warm-up questions 48 hours before the test; rest completely 24 hours prior.',
          'Double check your device, approved calculator settings, and admission ticket.'
        ],
      },
    ],
    weekly_routine: [
      { day_group: 'Monday & Wednesday', focus: 'High-Yield Algebra & Desmos Automation', suggested_hours: '2 Hours' },
      { day_group: 'Tuesday & Thursday', focus: 'Targeted Weak Sub-Topics & Error Log Review', suggested_hours: '1.5 Hours' },
      { day_group: 'Saturday', focus: 'Full Timed Module Simulation with strict 35m timer', suggested_hours: '2.5 Hours' },
      { day_group: 'Sunday', focus: 'Deep Error Breakdown & Formula Retention', suggested_hours: '1 Hour' },
    ],
    prescriptive_advice: [
      'Prioritize questions 1–15 in each module where accuracy yields the highest point-per-minute return.',
      'Always graph equations in Desmos first when finding intersections or roots instead of manual quadratic factoring.',
      'Use the process of elimination actively on tricky Geometry & Trigonometry problems.'
    ],
    recommended_resources: [
      'Digital SAT / EST Official Practice Modules',
      'Desmos Graphing Calculator Masterclass Shortcuts',
      'Personalized Diagnostic Error Journal'
    ],
  },
  {
    id: 'plan_foundation_rebuilder',
    title: 'Core Concept Mastery & Foundation Rebuilder',
    tagline: 'Step-by-step conceptual mastery turning confusing algebra and word problems into reliable instincts.',
    target_audience: 'Students with fundamental concept gaps seeking a reliable score transformation.',
    badge_color: 'rose',
    min_score: 0,
    max_score: 65,
    primary_challenge: ['concept_gaps'],
    summary: 'Your diagnostic highlights that gaps in algebra foundations and question phrasing are holding back your score. This plan re-establishes rock-solid core mechanics before ramping up time pressure.',
    milestones: [
      {
        title: 'Block 1: Linear Equations & Word Problem Decoding',
        timeframe: 'Weeks 1 to 3',
        description: 'Master rate of change, y-intercept interpretations, and multi-step inequality translation.',
        tasks: [
          'Complete 30 untimed foundational questions on linear systems and slope in context.',
          'Highlight key mathematical operational keywords in word problems before calculating.',
          'Practice verifying solutions by plugging back in to ensure zero arithmetic slips.'
        ],
      },
      {
        title: 'Block 2: Nonlinear Expressions & Quadratics',
        timeframe: 'Weeks 4 to 6',
        description: 'Gain fluency with factoring, discriminant rules, vertex forms, and exponents.',
        tasks: [
          'Master factoring techniques and the quadratic formula without hesitation.',
          'Practice identifying parabola vertex coordinates directly from $y = a(x - h)^2 + k$.',
          'Solve 25 targeted questions on radical and rational expressions with extraneous roots.'
        ],
      },
      {
        title: 'Block 3: Data Analysis & Applied Math',
        timeframe: 'Weeks 7 to 9',
        description: 'Tackle two-way tables, percentages, standard deviation, and geometry basics.',
        tasks: [
          'Complete dedicated unit conversions and weighted percentage drills.',
          'Drill circle equations $(x - h)^2 + (y - k)^2 = r^2$ and right triangle trigonometry ratios.',
          'Take an intermediate diagnostic checkpoint to verify foundation gains.'
        ],
      },
    ],
    weekly_routine: [
      { day_group: 'Monday / Wednesday / Friday', focus: 'Concept Learning & Guided Examples', suggested_hours: '1.5 Hours' },
      { day_group: 'Tuesday / Thursday', focus: 'Independent Untimed Practice (20 Questions)', suggested_hours: '1 Hour' },
      { day_group: 'Weekend', focus: 'Weekly Concept Quiz & Teacher Video Walkthroughs', suggested_hours: '2 Hours' },
    ],
    prescriptive_advice: [
      'Do not rush yourself with a timer yet. Accuracy comes first; speed is a natural byproduct of knowing what to do.',
      'Draw a sketch for every single geometry or coordinate plane problem without a provided figure.',
      'Keep a dedicated math formula notebook with one example problem written beneath each formula.'
    ],
    recommended_resources: [
      'Comprehensive SAT / EST Math Foundation Course',
      'Step-by-step Taxonomy Concept Bank',
      'Formula Flashcards & Quick-Reference Sheet'
    ],
  },
  {
    id: 'plan_steady_comprehensive',
    title: 'Strategic 3-Month Score Optimizer',
    tagline: 'A balanced, predictable study system combining concept refinement, timing drills, and regular checkpoint tests.',
    target_audience: 'Students preparing with 2 to 3 months to achieve substantial score leaps.',
    badge_color: 'blue',
    min_score: 40,
    max_score: 85,
    target_test_window: ['2_to_3m', '4_to_6m'],
    summary: 'A structured, sustainable roadmap designed to systematically turn B-tier scores into top-tier university qualifications through phased topic mastery, deliberate practice, and targeted mock test reviews.',
    milestones: [
      {
        title: 'Month 1: Diagnostic Taxonomy Repair',
        timeframe: 'Weeks 1 to 4',
        description: 'Focus exclusively on your lowest-scoring taxonomy categories identified in this report.',
        tasks: [
          'Review the category breakdown of this diagnostic and complete 40 practice questions per weak domain.',
          'Integrate graphing calculator techniques for non-linear equations and system solutions.',
          'Achieve 85%+ accuracy on untimed category practice sets.'
        ],
      },
      {
        title: 'Month 2: Mixed-Category Practice & Pacing',
        timeframe: 'Weeks 5 to 8',
        description: 'Introduce timed mixed sets to train mental context-switching between topics.',
        tasks: [
          'Complete two 25-question mixed timed problem sets each week.',
          'Track pacing: aim for 1 min on easy questions, 1.5 min on medium, and up to 2 min on hard.',
          'Review tricky question traps with an instructor or video solutions.'
        ],
      },
      {
        title: 'Month 3: Full Adaptive Simulations & Polish',
        timeframe: 'Weeks 9 to 12',
        description: 'Fine-tune test stamina, question triage, and reach your target score threshold.',
        tasks: [
          'Take 3 full diagnostic assessments spaced one week apart.',
          'Log every single mistake in your Error Ledger and re-solve it 48 hours later.',
          'Finalize timing strategy and mental test-day stamina.'
        ],
      },
    ],
    weekly_routine: [
      { day_group: 'Monday & Wednesday', focus: 'Target Weakness Chapters & Problem Sets', suggested_hours: '2 Hours' },
      { day_group: 'Tuesday & Thursday', focus: 'Mixed Practice & Desmos Graphing Drills', suggested_hours: '1.5 Hours' },
      { day_group: 'Saturday', focus: 'Timed Checkpoint Test & Deep Analysis', suggested_hours: '2.5 Hours' },
    ],
    prescriptive_advice: [
      'Spend at least as much time reviewing why an answer was wrong as you spent solving it.',
      'Develop an automatic trigger for question types (e.g. "when I see sum of roots, I immediately think $-b/a$").',
      'Consistently re-test flagged questions from 2 weeks ago to ensure retention.'
    ],
    recommended_resources: [
      'Comprehensive Prep Academy Level Modules',
      'Official Question Bank by Topic & Difficulty',
      'Diagnostic Analytics Progress Tracker'
    ],
  },
  {
    id: 'plan_elite_maximizer',
    title: 'Elite 99th-Percentile Perfection Track (750–800 / 34–36)',
    tagline: 'Fine-tuning for high performers aiming for Ivy League and prestigious university scores.',
    target_audience: 'Students already scoring above 75% seeking zero-defect precision and trap immunity.',
    badge_color: 'purple',
    min_score: 75,
    max_score: 100,
    target_score_goal: ['elite', 'high_achiever'],
    summary: 'You already possess strong mathematical foundations. The difference between a 720 and an 800 is not content knowledge—it is trap recognition, absolute error immunity, and lightning-fast alternative verification methods.',
    milestones: [
      {
        title: 'Phase 1: Hard-Tier & Boundary Case Dissection',
        timeframe: 'Weeks 1 to 3',
        description: 'Exclusively train on the hardest 10% of questions in the bank.',
        tasks: [
          'Solve 50 Level-4 and Level-5 difficulty questions (polynomial remainder theorems, complex circle tangents, parametric functions).',
          'Identify common test-writer trick patterns (e.g. asking for $2x - 3$ instead of just $x$).',
          'Practice double-verification: solving once algebraically and once graphically in under 90 seconds.'
        ],
      },
      {
        title: 'Phase 2: Speed Buffer Training',
        timeframe: 'Weeks 4 to 6',
        description: 'Complete modules 5–7 minutes faster than standard time to build an emergency review buffer.',
        tasks: [
          'Complete standard 35-minute modules in 28 minutes, leaving 7 full minutes for double-checking.',
          'Systematically check the first 5 questions for careless arithmetic or sign slips.',
          'Maintain a zero-mistake benchmark on all medium-difficulty questions.'
        ],
      },
      {
        title: 'Phase 3: Peak Performance Simulation',
        timeframe: 'Final 2 Weeks',
        description: 'Lock in 100% confidence and precision.',
        tasks: [
          'Complete 2 full realistic assessments in high-pressure environments.',
          'Review the "Top 25 Sneakiest Test Traps" summary.',
          'Attain mental stillness and peak test-day confidence.'
        ],
      },
    ],
    weekly_routine: [
      { day_group: 'Monday & Wednesday', focus: 'Hardest-Tier Problem Sets & Advanced Algebra', suggested_hours: '2 Hours' },
      { day_group: 'Tuesday & Thursday', focus: 'Speed Buffer Sprints & Multi-Method Verifications', suggested_hours: '2 Hours' },
      { day_group: 'Saturday', focus: 'Full High-Difficulty Diagnostic & Zero-Tolerance Error Audit', suggested_hours: '3 Hours' },
    ],
    prescriptive_advice: [
      'Underline exactly what the prompt asks for before hitting submit (e.g. diameter vs. radius, $x + y$ vs. $x$).',
      'If an algebraic solution takes more than 5 lines of paper, pause: there is almost certainly a shortcut or calculator trick.',
      'Check for constraints like "positive integer" or "$x > 0$" which invalidate tempting answer choices.'
    ],
    recommended_resources: [
      'Advanced Math Bootcamp & Hard-Tier Bank',
      'Digital SAT / EST Extreme Difficulty Problem Sets',
      'Desmos Advanced Regression & Matrix Tricks'
    ],
  },
]

const STORAGE_KEYS = {
  SURVEY_QUESTIONS: 'sat_diagnostic_survey_questions_v1',
  ACTION_PLANS: 'sat_diagnostic_action_plans_v1',
  SURVEY_RESPONSES: 'sat_diagnostic_survey_responses_v1',
}

let _surveyQuestionsCache: SurveyQuestion[] = []
let _hasLoadedSurveyQuestions = false

let _actionPlansCache: ActionPlan[] = []
let _hasLoadedActionPlans = false

let _surveyResponsesCache: Record<string, StudentSurveyResponse> = {}
let _hasLoadedResponses = false

// Clear any old browser storage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(STORAGE_KEYS.SURVEY_QUESTIONS)
    localStorage.removeItem(STORAGE_KEYS.ACTION_PLANS)
    localStorage.removeItem(STORAGE_KEYS.SURVEY_RESPONSES)
  } catch {}
}

export const surveyService = {
  getQuestions(): SurveyQuestion[] {
    if (!_hasLoadedSurveyQuestions && typeof window !== 'undefined') {
      this.loadQuestionsFromDatabase().catch(() => {})
    }
    return _surveyQuestionsCache
  },

  async loadQuestionsFromDatabase(): Promise<SurveyQuestion[]> {
    _hasLoadedSurveyQuestions = true
    try {
      const res = await fetch('/api/surveys/questions')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          _surveyQuestionsCache = data.sort((a, b) => a.order_index - b.order_index)
          return _surveyQuestionsCache
        }
      }
    } catch (e) {
      console.warn('Failed to load survey questions from server API:', e)
    }

    if (isSupabaseConfigured) {
      try {
        const saved = await loadOrganizationConfig<SurveyQuestion[]>('survey_questions')
        if (saved?.length) {
          _surveyQuestionsCache = saved.sort((a, b) => a.order_index - b.order_index)
          return _surveyQuestionsCache
        }
      } catch (error) {
        console.warn('Failed to load survey questions from Supabase:', error)
      }
    }

    return _surveyQuestionsCache
  },

  async saveQuestions(questions: SurveyQuestion[]): Promise<void> {
    _surveyQuestionsCache = questions
    try {
      await fetch('/api/surveys/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questions),
      })
    } catch (e) {
      console.warn('Failed to save survey questions to server API:', e)
    }

    if (isSupabaseConfigured) await saveOrganizationConfig('survey_questions', questions)
  },

  async resetQuestions(): Promise<SurveyQuestion[]> {
    await this.saveQuestions([])
    return []
  },

  getActionPlans(): ActionPlan[] {
    if (!_hasLoadedActionPlans && typeof window !== 'undefined') {
      this.loadActionPlansFromDatabase().catch(() => {})
    }
    return _actionPlansCache
  },

  async loadActionPlansFromDatabase(): Promise<ActionPlan[]> {
    _hasLoadedActionPlans = true
    try {
      const res = await fetch('/api/surveys/action-plans')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          _actionPlansCache = data
          return _actionPlansCache
        }
      }
    } catch (e) {
      console.warn('Failed to load action plans from server API:', e)
    }

    if (isSupabaseConfigured) {
      try {
        const saved = await loadOrganizationConfig<ActionPlan[]>('action_plans')
        if (saved?.length) {
          _actionPlansCache = saved
          return _actionPlansCache
        }
      } catch (error) {
        console.warn('Failed to load action plans from Supabase:', error)
      }
    }

    return _actionPlansCache
  },

  async saveActionPlans(plans: ActionPlan[]): Promise<void> {
    _actionPlansCache = plans
    try {
      await fetch('/api/surveys/action-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plans),
      })
    } catch (e) {
      console.warn('Failed to save action plans to server API:', e)
    }

    if (isSupabaseConfigured) await saveOrganizationConfig('action_plans', plans)
  },

  async resetActionPlans(): Promise<ActionPlan[]> {
    await this.saveActionPlans([])
    return []
  },

  saveStudentResponse(attemptId: string, answers: Record<string, any>, scorePct?: number): ActionPlan {
    const plans = this.getActionPlans()
    const matchedPlan = this.matchActionPlan(answers, scorePct, plans)

    const response: StudentSurveyResponse = {
      attempt_id: attemptId,
      submitted_at: new Date().toISOString(),
      answers,
      matched_plan_id: matchedPlan.id,
    }

    _surveyResponsesCache[attemptId] = response

    try {
      fetch('/api/surveys/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }).catch(() => {})
    } catch {}

    return matchedPlan
  },

  getResponse(attemptId: string): StudentSurveyResponse | null {
    return _surveyResponsesCache[attemptId] || null
  },

  getAllResponses(): Record<string, StudentSurveyResponse> {
    if (!_hasLoadedResponses && typeof window !== 'undefined') {
      _hasLoadedResponses = true
      fetch('/api/surveys/responses')
        .then((r) => r.json())
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            data.forEach((item) => {
              if (item && item.attempt_id) {
                _surveyResponsesCache[item.attempt_id] = item
              }
            })
          }
        })
        .catch(() => {})
    }
    return _surveyResponsesCache
  },

  matchActionPlan(answers: Record<string, any>, scorePct: number = 50, availablePlans?: ActionPlan[]): ActionPlan {
    const plans = availablePlans || this.getActionPlans()
    if (plans.length === 0) {
      return DEFAULT_ACTION_PLANS[0]
    }

    const testDate = answers['target_test_date']
    const challenge = answers['primary_challenge']
    const scoreGoal = answers['target_score_goal']

    let bestPlan = plans[0]
    let highestScore = -1

    for (const plan of plans) {
      let score = 0

      if (plan.min_score !== undefined && scorePct < plan.min_score) {
        score -= 5
      } else if (plan.max_score !== undefined && scorePct > plan.max_score) {
        score -= 5
      } else {
        score += 3
      }

      if (testDate === 'within_1m') {
        if (plan.target_test_window?.includes('within_1m') || plan.id === 'plan_urgent_speed_sprint') {
          score += 10
        }
      }

      if (scorePct >= 75 || scoreGoal === 'elite') {
        if (plan.id === 'plan_elite_maximizer' || (plan.min_score && plan.min_score >= 70)) {
          score += 8
        }
      }

      if (challenge === 'concept_gaps' || scorePct < 50) {
        if (plan.id === 'plan_foundation_rebuilder' || plan.primary_challenge?.includes('concept_gaps')) {
          score += 8
        }
      }

      if (challenge === 'time_management' || challenge === 'careless_errors') {
        if (plan.primary_challenge?.includes(challenge)) {
          score += 4
        }
      }

      if (score > highestScore) {
        highestScore = score
        bestPlan = plan
      }
    }

    return bestPlan
  },
}
