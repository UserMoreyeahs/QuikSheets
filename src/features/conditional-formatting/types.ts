export type CFConditionType =
  | 'cell_value'
  | 'text_contains'
  | 'cell_empty'
  | 'cell_not_empty'
  | 'duplicate_values'
  | 'unique_values'
  | 'top_n'
  | 'bottom_n'
  | 'above_average'
  | 'below_average'
  | 'custom_formula'

export type CFOperator =
  | 'equal'
  | 'not_equal'
  | 'greater'
  | 'greater_equal'
  | 'less'
  | 'less_equal'
  | 'between'
  | 'not_between'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'

export interface CFCondition {
  type: CFConditionType
  operator?: CFOperator
  value?: string
  value2?: string
  n?: number
}

export interface CFFormat {
  fill?: string
  color?: string
  bold?: boolean
  italic?: boolean
}

export interface CFRule {
  id: string
  name?: string
  range: string
  condition: CFCondition
  format: CFFormat
  priority: number
}

export interface CFBackupCell {
  bg?: string
  fc?: string
  bl?: 0 | 1
  it?: 0 | 1
}
