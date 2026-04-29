export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface FormulaGenerationRequest {
  instruction: string
  cellAddress: string
  sheetContext: {
    headers: string[]
    sampleData: string[][]
  }
}

export interface FormulaGenerationResponse {
  formula: string
  explanation: string
}

export interface FormulaExplainRequest {
  formula: string
  referencedValues: Record<string, string>
}

export interface FormulaExplainResponse {
  explanation: string
  dependencies: string[]
  sensitivityNote: string
}
