import React, { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react'
import { CreateQuestionPage } from './CreateQuestionPage'
import AdminLayout from '../components/AdminLayout'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class QuestionEditErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in EditQuestionPage:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <AdminLayout
          title="Question Editor"
          subtitle="Review and edit question specifications"
          showBackButton={true}
          backButtonPath="/admin/questions"
        >
          <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Question Editor Recovery</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              We encountered an issue loading this question formula or media content. You can reload the editor or return to the Question Bank.
            </p>
            {this.state.error && (
              <p className="text-[11px] font-mono bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-600 max-h-24 overflow-y-auto">
                {this.state.error.message}
              </p>
            )}
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
              <Link
                to="/admin/questions"
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Question Bank</span>
              </Link>
            </div>
          </div>
        </AdminLayout>
      )
    }

    return this.props.children
  }
}

export default function EditQuestionPage() {
  return (
    <QuestionEditErrorBoundary>
      <CreateQuestionPage />
    </QuestionEditErrorBoundary>
  )
}
