import { NavigateFunction } from 'react-router-dom'

const STORAGE_KEY = 'math_platform_nav_history'

// In-memory stack with session storage backup
let historyStack: string[] = []

try {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      historyStack = parsed
    }
  }
} catch {
  historyStack = []
}

function persistStack() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(historyStack.slice(-30)))
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Record a route transition in the navigation history.
 */
export function recordNavigation(path: string): void {
  if (!path) return
  // Don't record consecutive duplicate paths
  if (historyStack.length > 0 && historyStack[historyStack.length - 1] === path) {
    return
  }
  historyStack.push(path)
  if (historyStack.length > 30) {
    historyStack.shift()
  }
  persistStack()
}

/**
 * Computes a sensible hierarchical parent path for any admin or application route.
 */
export function getParentPath(currentPath: string): string {
  // Module questions subpage -> parent assessment detail
  if (currentPath.includes('/modules/')) {
    const match = currentPath.match(/^(\/admin\/assessments\/[^/]+)/)
    if (match) return match[1]
    return '/admin/assessments'
  }
  // Assessment subpages -> /admin/assessments
  if (currentPath.startsWith('/admin/assessments/') && currentPath !== '/admin/assessments') {
    return '/admin/assessments'
  }
  // Question bank subpages -> /admin/questions
  if (currentPath.startsWith('/admin/questions/') && currentPath !== '/admin/questions') {
    return '/admin/questions'
  }
  // Attempt reports -> /admin/assessments
  if (currentPath.startsWith('/admin/attempts/')) {
    return '/admin/assessments'
  }
  // Any other admin page -> /admin
  if (currentPath.startsWith('/admin') && currentPath !== '/admin') {
    return '/admin'
  }
  return '/admin'
}

/**
 * Navigates to the previous page in history, or fallback to the logical parent.
 */
export function navigateBack(
  navigate: NavigateFunction,
  currentPath: string,
  explicitBackPath?: string
): void {
  if (explicitBackPath) {
    navigate(explicitBackPath)
    return
  }

  // Look backwards in historyStack for the first path that differs from currentPath
  for (let i = historyStack.length - 1; i >= 0; i--) {
    const candidate = historyStack[i]
    if (candidate && candidate !== currentPath) {
      // Slice history up to that point
      historyStack = historyStack.slice(0, i + 1)
      persistStack()
      navigate(candidate)
      return
    }
  }

  // Fallback to logical hierarchical parent
  const parent = getParentPath(currentPath)
  navigate(parent)
}
