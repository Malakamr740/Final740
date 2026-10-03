import React from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import {
  Sparkles,
  FileText,
  HelpCircle,
  ArrowRight,
  Sliders,
} from 'lucide-react'

export default function AdminDashboardPage() {
  const cards = [
    {
      title: 'Report & Rubric Builder',
      description:
        'Customize generated report sections, domain mastery criteria, and rubric performance tiers.',
      href: '/admin/report-settings',
      badge: 'Customizable',
      iconBg: 'bg-indigo-50 text-indigo-600',
      icon: <Sliders className="w-5 h-5 text-indigo-600" />,
    },
    {
      title: 'Post-Assessment Surveys & Action Plans',
      description:
        'Manage diagnostic reflection questions and personalized growth action plans.',
      href: '/admin/survey-action-plans',
      badge: 'New Feature',
      iconBg: 'bg-purple-50 text-purple-600',
      icon: <Sparkles className="w-5 h-5 text-purple-600" />,
    },
    {
      title: 'Assessment Catalog',
      description:
        'Design adaptive math diagnostics, timed benchmarks, and module evaluations.',
      href: '/admin/assessments',
      iconBg: 'bg-blue-50 text-blue-600',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
    },
    {
      title: 'Question Bank',
      description:
        'Manage taxonomy-aligned items, answer choices, and mathematical explanations.',
      href: '/admin/questions',
      iconBg: 'bg-emerald-50 text-emerald-600',
      icon: <HelpCircle className="w-5 h-5 text-emerald-600" />,
    },
    {
      title: 'Curriculum Taxonomy',
      description:
        'Explore hierarchical domains, standards, clusters, and objective trees.',
      href: '/admin/taxonomy',
      iconBg: 'bg-amber-50 text-amber-600',
      icon: (
        <svg
          className="w-5 h-5 text-amber-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M6.5 14V8.5a2 2 0 0 1 2-2H14" />
        </svg>
      ),
    },
    {
      title: 'Levels & Courses',
      description:
        'Configure grade bands, pacing thresholds, and difficulty scoring curves.',
      href: '/admin/levels',
      iconBg: 'bg-purple-50 text-purple-600',
      icon: (
        <svg
          className="w-5 h-5 text-purple-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="w-full">
        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Diagnostic Platform Administration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of your diagnostic assessments, curricular taxonomy, and student action
            workflows
          </p>
        </div>

        {/* 6 Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Link
              key={card.title}
              to={card.href}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200 group relative min-h-[200px] min-w-0"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}
                  >
                    {card.icon}
                  </div>
                  {card.badge && (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full">
                      {card.badge}
                    </span>
                  )}
                </div>

                <h2 className="text-base font-bold text-slate-900 mt-5 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h2>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{card.description}</p>
              </div>

              <div className="mt-8 pt-2 flex items-center justify-between text-xs font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                <span>Open Management</span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
