export { CellHistoryPanel } from './components/CellHistoryPanel'
export { HistoryEntry } from './components/HistoryEntry'
export { useCellHistory } from './hooks/useCellHistory'
export {
  getCellHistory,
  recordCellChange,
  restoreCell,
} from './services/historyService'
export type {
  CellHistoryEntry,
  RestoredCellResult,
} from './services/historyService'
