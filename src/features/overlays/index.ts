/**
 * Barrel — shapes / icons / text-box overlays.
 *
 * Mirrors src/features/images: the layer mounts once, the store holds
 * inserted overlays, the pickers open via tiny dedicated stores. The
 * insertTextBox helper is the only "skip the picker" entry point.
 */

export { OverlaysLayer } from './components/OverlaysLayer'
export { ShapePicker } from './components/ShapePicker'
export { IconPicker } from './components/IconPicker'
export { insertTextBox } from './utils/insertTextBox'
export {
  useOverlayStore,
  useShapePickerStore,
  useIconPickerStore,
  type InsertedOverlay,
  type ShapeOverlay,
  type IconOverlay,
  type TextboxOverlay,
  type ShapeKind,
} from './store/overlayStore'
export { CURATED_ICON_NAMES, type CuratedIconName } from './utils/curatedIcons'
