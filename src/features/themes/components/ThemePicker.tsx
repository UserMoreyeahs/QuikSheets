'use client'

/**
 * ThemePicker — Page Layout > Themes / Colors / Fonts dialog.
 *
 * All three Page Layout ribbon buttons open this single picker. Each
 * theme card shows:
 *   - 6 colour swatches (primary / accent / success / warning / danger / surface)
 *   - the heading and body font names
 *   - a one-line description
 *
 * Clicking a card sets the active theme. Subsequent Format-as-Table /
 * chart inserts pick up the new palette automatically via the imperative
 * getActiveTheme() helper.
 */

import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Check } from 'lucide-react'
import { useThemeStore, THEME_PRESETS } from '../store/themeStore'
import type { Theme } from '../types'

export function ThemePicker() {
  const open = useThemeStore((s) => s.pickerOpen)
  const close = useThemeStore((s) => s.closePicker)
  const activeId = useThemeStore((s) => s.activeThemeId)
  const setActive = useThemeStore((s) => s.setActiveTheme)

  function pick(theme: Theme) {
    setActive(theme.id)
    toast.success(`Theme: ${theme.name} applied`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Workbook Theme</DialogTitle>
          <DialogDescription>
            Pick a colour palette and font pair. Applies to Format-as-Table,
            new charts, and the Theme Colors row in the colour picker.
            Existing cells keep their explicit formatting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2 md:grid-cols-3">
          {THEME_PRESETS.map((theme) => {
            const active = theme.id === activeId
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => pick(theme)}
                className={
                  'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ' +
                  (active
                    ? 'border-blue-500 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-900/20'
                    : 'border-zinc-200 hover:border-blue-400 hover:bg-blue-50/30 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/10')
                }
              >
                {/* Header row: name + active checkmark */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {theme.name}
                  </span>
                  {active && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                </div>

                {/* Description */}
                <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {theme.description}
                </p>

                {/* Colour swatches */}
                <div className="flex h-6 gap-0.5 overflow-hidden rounded">
                  {(['primary', 'accent', 'success', 'warning', 'danger', 'surface'] as const).map((key) => (
                    <span
                      key={key}
                      title={key}
                      style={{ background: theme.colors[key] }}
                      className="flex-1 border-r border-white last:border-r-0 dark:border-zinc-900"
                    />
                  ))}
                </div>

                {/* Font pair */}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span style={{ fontFamily: theme.headingFont }}>Heading · {theme.headingFont}</span>
                  <span style={{ fontFamily: theme.bodyFont }}>Body · {theme.bodyFont}</span>
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
