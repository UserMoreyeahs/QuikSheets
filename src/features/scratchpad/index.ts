export { ScratchpadGrid } from './components/ScratchpadGrid'
export { ScratchpadPanel } from './components/ScratchpadPanel'
export { ScratchpadToggle } from './components/ScratchpadToggle'
export { useScratchpad } from './hooks/useScratchpad'
export {
  parseCrossReference,
  resolveCrossReferenceFormula,
  resolveReference,
  type CrossReferenceResult,
  type ResolvedReferenceValue,
} from './utils/crossReference'
export {
  STORAGE_KEY,
  clearScratchpad,
  loadScratchpad,
  saveScratchpad,
} from './utils/scratchpadStorage'
