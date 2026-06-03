'use client'

/**
 * Zustand store for the automation UI surface.
 *
 * - `open` / `close`: controls the create/edit dialog.
 * - `openRuns` / `closeRuns`: controls the runs panel.
 * - `automations`: client-side cache for the workbook's enabled automations
 *   (used for trigger matching without a round-trip on every key stroke).
 */

import { create } from 'zustand'
import type { AutomationDefinition } from '../types'

interface AutomationStore {
  /** The create-automation dialog is visible. */
  dialogOpen: boolean
  openDialog: () => void
  closeDialog: () => void

  /** The automation runs panel is visible. */
  runsOpen: boolean
  openRuns: () => void
  closeRuns: () => void

  /** ID of the automation whose runs are displayed in the panel. */
  selectedAutomationId: string | null
  setSelectedAutomationId: (id: string | null) => void

  /** Client-side cache. Populated by the Automate tab on mount. */
  automations: AutomationDefinition[]
  setAutomations: (automations: AutomationDefinition[]) => void
  addAutomation: (automation: AutomationDefinition) => void
}

export const useAutomationStore = create<AutomationStore>((set) => ({
  dialogOpen: false,
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),

  runsOpen: false,
  openRuns: () => set({ runsOpen: true }),
  closeRuns: () => set({ runsOpen: false }),

  selectedAutomationId: null,
  setSelectedAutomationId: (id) => set({ selectedAutomationId: id }),

  automations: [],
  setAutomations: (automations) => set({ automations }),
  addAutomation: (automation) =>
    set((state) => ({ automations: [automation, ...state.automations] })),
}))
