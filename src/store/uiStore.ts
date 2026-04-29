import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  activeModal: string | null
}

interface UIActions {
  setSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveModal: (modal: string | null) => void
}

const initialState: UIState = {
  sidebarOpen: false,
  commandPaletteOpen: false,
  activeModal: null,
}

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    (set) => ({
      ...initialState,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setActiveModal: (modal) => set({ activeModal: modal }),
    }),
    { name: 'ui-store' }
  )
)
