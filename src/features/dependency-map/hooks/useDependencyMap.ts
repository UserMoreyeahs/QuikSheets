'use client'

import { useCallback, useEffect, useState } from 'react'

export function useDependencyMap() {
  const [showMap, setShowMap] = useState(false)

  const toggleMap = useCallback(() => {
    setShowMap((current) => !current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey) return
      if (event.key.toLowerCase() !== 'm') return

      event.preventDefault()
      toggleMap()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleMap])

  return {
    showMap,
    setShowMap,
    toggleMap,
  }
}
