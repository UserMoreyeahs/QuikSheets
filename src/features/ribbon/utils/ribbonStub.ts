'use client'

import { toast } from 'sonner'

/**
 * Stub helper for ribbon buttons that exist in the Excel-faithful ribbon
 * but don't have a real implementation yet.  Shows a toast so users know
 * the button works visually but the feature is upcoming.
 */
export function ribbonStub(featureName: string): () => void {
  return () => {
    toast(`${featureName}`, {
      description: 'Coming soon. This Excel feature will be wired up in a future release.',
    })
  }
}
