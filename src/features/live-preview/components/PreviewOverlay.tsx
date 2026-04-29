'use client'

import React from 'react'

interface PreviewOverlayProps {
  previewValue: string | number | boolean | null
  position: { left: number; top: number; width: number; height: number }
}

export function PreviewOverlay({ previewValue, position }: PreviewOverlayProps) {
  if (previewValue === null) return null

  return (
    <div
      style={position}
      className="pointer-events-none absolute z-[50] flex items-center px-2 font-mono text-sm italic text-zinc-400 opacity-80 transition-opacity duration-150"
    >
      {String(previewValue)}
    </div>
  )
}
