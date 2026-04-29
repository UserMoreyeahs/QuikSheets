export interface RowVisibilityRule {
  id?: string
  workbookId: string
  sheetId: string
  /** Column whose value is matched against the user's identity */
  ownerColumn: number
  /** What to compare it against: 'profile.email' | 'profile.display_name' */
  compareTo: 'profile.email' | 'profile.display_name'
}
