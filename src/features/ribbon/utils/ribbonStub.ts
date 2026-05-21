'use client'

import { toast } from 'sonner'

/**
 * Marker symbol attached to handlers returned by `ribbonStub()`.
 *
 * RibbonLargeButton / RibbonButton / RibbonSplitButton check for this
 * symbol on their `onClick` prop. When present, they render the button
 * in a visibly-disabled "Coming soon" state with a tooltip naming the
 * feature — instead of looking fully active and only revealing the
 * unimplemented state after a click.
 *
 * This is a zero-call-site refactor: ~114 ribbon buttons that already
 * use `onClick={ribbonStub('Foo')}` now automatically render correctly
 * without touching each call.
 */
export const RIBBON_STUB_MARKER = Symbol.for('quiksheets.ribbonStub')

export interface RibbonStubHandler {
  (): void
  [RIBBON_STUB_MARKER]: string
}

/**
 * Returns an onClick handler tagged with `RIBBON_STUB_MARKER`.
 *
 * Ribbon button components detect the marker and:
 *   - Render the button with reduced opacity + dashed underline
 *   - Add a title attribute "<featureName> — coming soon"
 *   - Still allow the click (so the toast feedback works for power-users
 *     who *want* to know what's not built yet), but the visual state
 *     prevents confused clicks on "broken" buttons.
 */
export function ribbonStub(featureName: string): RibbonStubHandler {
  const handler = (() => {
    toast(`${featureName}`, {
      description: 'Coming soon. This Excel feature will be wired up in a future release.',
    })
  }) as RibbonStubHandler
  handler[RIBBON_STUB_MARKER] = featureName
  return handler
}

/**
 * Type guard: returns the feature name if `onClick` is a stub handler,
 * else `null`. Use this from ribbon button components to detect stub
 * state.
 */
export function getStubFeatureName(
  onClick: unknown,
): string | null {
  if (typeof onClick !== 'function') return null
  const handler = onClick as unknown as { [k: symbol]: unknown }
  const name = handler[RIBBON_STUB_MARKER]
  return typeof name === 'string' ? name : null
}
