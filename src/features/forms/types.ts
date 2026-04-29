export type FormFieldKind =
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'currency'
  | 'status'

export interface FormField {
  id: string
  label: string
  columnIndex: number
  kind: FormFieldKind
  required: boolean
  helpText?: string
  options?: string[] // for select / status
}

export interface FormDefinition {
  id?: string
  workbookId: string
  sheetId: string
  name: string
  slug: string
  isPublic: boolean
  fields: FormField[]
}

export interface FormSubmission {
  formId: string
  values: Record<string, string | number | boolean>
}
