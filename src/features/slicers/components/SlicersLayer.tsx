'use client'

/**
 * SlicersLayer
 * ------------
 * Renders all active slicer panels as floating objects inside the grid
 * container (position: absolute, requires relative parent).
 */

import { useSlicerStore } from '../store/slicerStore'
import { SlicerPanel } from './SlicerPanel'

export function SlicersLayer() {
  const slicers = useSlicerStore((s) => s.slicers)
  if (slicers.length === 0) return null

  return (
    <>
      {slicers.map((sl) => (
        <SlicerPanel key={sl.id} slicer={sl} />
      ))}
    </>
  )
}
