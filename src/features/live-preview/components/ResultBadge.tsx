'use client'

import React from 'react'

interface ResultBadgeProps {
  previewValue: string | number | boolean | null
  isValid: boolean
}

export function ResultBadge({ previewValue, isValid }: ResultBadgeProps) {
  if (!isValid || previewValue === null) return null

  return (
    <div className="fixed right-4 top-[132px] z-[95] rounded-full bg-zinc-900 px-3 py-1.5 font-mono text-xs text-white shadow-lg transition-opacity duration-150">
      = {String(previewValue)}
    </div>
  )
}
