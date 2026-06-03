/**
 * row-rls — Public API barrel
 *
 * Import from '@/features/row-rls' to access everything this feature exports.
 */

// Types
export type {
  RowVisibilityRule,
  RulePredicate,
  RulePredicateOperator,
  RuleScope,
} from './types'

// Store
export { useRowRlsStore } from './store/rowRlsStore'

// Evaluator
export { evaluateRules } from './utils/rowRlsEvaluator'

// Hook (for orchestrator to mount in page.tsx)
export { useApplyRowRls } from './hooks/useApplyRowRls'

// Builder UI
export { RowRlsBuilder } from './components/RowRlsBuilder'
