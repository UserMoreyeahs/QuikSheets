'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

export interface MenuBarHandlers {
  onNewWorkbook?: () => void
  onOpenDashboard?: () => void
  onSaveNow?: () => void
  onImport?: () => void
  onExportCSV?: () => void
  onExportXLSX?: () => void
  onExportPDF?: () => void

  onUndo?: () => void
  onRedo?: () => void
  onFind?: () => void
  onFindReplace?: () => void

  onToggleFormulaBar?: () => void
  onToggleGridlines?: () => void
  onMapView?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void

  onInsertSheet?: () => void
  onInsertChart?: () => void
  onInsertForm?: () => void

  onClearFormatting?: () => void
  onConditionalFormatting?: () => void
  onMergeCells?: () => void
  onUnmergeCells?: () => void

  onSort?: () => void
  onFilter?: () => void
  onValidation?: () => void
  onProtectedRanges?: () => void

  onAIAssistant?: () => void
  onScratchpad?: () => void
  onShortcuts?: () => void

  onCommandPalette?: () => void
}

interface MenuItemDef {
  label: string
  shortcut?: string
  onClick?: () => void
  comingSoon?: boolean
  destructive?: boolean
  separator?: boolean
}

interface MenuDef {
  name: string
  items: Array<MenuItemDef | { separator: true } | { sectionLabel: string }>
}

function buildMenus(h: MenuBarHandlers): MenuDef[] {
  const cs = (label: string): MenuItemDef => ({ label, comingSoon: true })
  const wired = (
    label: string,
    onClick: (() => void) | undefined,
    shortcut?: string
  ): MenuItemDef =>
    onClick
      ? { label, onClick, ...(shortcut ? { shortcut } : {}) }
      : { label, comingSoon: true, ...(shortcut ? { shortcut } : {}) }

  return [
    {
      name: 'File',
      items: [
        wired('New workbook', h.onNewWorkbook, 'Ctrl+Alt+N'),
        wired('Open recent…', h.onOpenDashboard),
        { separator: true },
        wired('Save now', h.onSaveNow, 'Ctrl+S'),
        cs('Make a copy'),
        { separator: true },
        wired('Import', h.onImport),
        { sectionLabel: 'Download' },
        wired('Comma-separated values (.csv)', h.onExportCSV),
        wired('Microsoft Excel (.xlsx)', h.onExportXLSX),
        wired('PDF document (.pdf)', h.onExportPDF),
        { separator: true },
        cs('Print'),
        cs('Page setup'),
        { separator: true },
        cs('Move to trash'),
      ],
    },
    {
      name: 'Edit',
      items: [
        wired('Undo', h.onUndo, 'Ctrl+Z'),
        wired('Redo', h.onRedo, 'Ctrl+Y'),
        { separator: true },
        cs('Cut'),
        cs('Copy'),
        cs('Paste'),
        cs('Paste values only'),
        { separator: true },
        wired('Find', h.onFind, 'Ctrl+F'),
        wired('Find and replace', h.onFindReplace, 'Ctrl+H'),
        { separator: true },
        cs('Delete'),
        cs('Delete row'),
        cs('Delete column'),
      ],
    },
    {
      name: 'View',
      items: [
        wired('Show formula bar', h.onToggleFormulaBar),
        wired('Show gridlines', h.onToggleGridlines),
        { separator: true },
        wired('Dependency map', h.onMapView, 'Ctrl+M'),
        cs('Freeze rows'),
        cs('Freeze columns'),
        { separator: true },
        wired('Zoom in', h.onZoomIn, 'Ctrl+='),
        wired('Zoom out', h.onZoomOut, 'Ctrl+-'),
        wired('Reset zoom', h.onZoomReset, 'Ctrl+0'),
        { separator: true },
        cs('Full screen'),
      ],
    },
    {
      name: 'Insert',
      items: [
        cs('Cells above'),
        cs('Cells below'),
        cs('Rows above'),
        cs('Rows below'),
        cs('Column left'),
        cs('Column right'),
        { separator: true },
        wired('Sheet', h.onInsertSheet),
        wired('Chart', h.onInsertChart),
        wired('Form', h.onInsertForm),
        { separator: true },
        cs('Image'),
        cs('Link'),
        cs('Comment'),
        cs('Note'),
        cs('Function'),
      ],
    },
    {
      name: 'Format',
      items: [
        cs('Bold'),
        cs('Italic'),
        cs('Underline'),
        cs('Strikethrough'),
        { separator: true },
        cs('Font size'),
        cs('Text color'),
        cs('Fill color'),
        cs('Borders'),
        { separator: true },
        cs('Align'),
        cs('Wrap text'),
        wired('Merge cells', h.onMergeCells, 'Ctrl+Shift+M'),
        wired('Unmerge', h.onUnmergeCells, 'Ctrl+Shift+U'),
        { separator: true },
        cs('Number format'),
        wired('Conditional formatting', h.onConditionalFormatting),
        { separator: true },
        wired('Clear formatting', h.onClearFormatting, 'Ctrl+\\'),
      ],
    },
    {
      name: 'Data',
      items: [
        wired('Sort', h.onSort),
        wired('Create filter', h.onFilter),
        cs('Filter views'),
        { separator: true },
        wired('Data validation', h.onValidation),
        wired('Protected ranges', h.onProtectedRanges),
        { separator: true },
        cs('Pivot table'),
        cs('Named ranges'),
        cs('Remove duplicates'),
      ],
    },
    {
      name: 'Tools',
      items: [
        wired('AI assistant', h.onAIAssistant, 'Alt+A'),
        cs('Spelling'),
        { separator: true },
        wired('Scratchpad', h.onScratchpad, 'Ctrl+`'),
        cs('Macros'),
        cs('Form builder'),
        cs('Automations'),
      ],
    },
    {
      name: 'Help',
      items: [
        wired('Keyboard shortcuts', h.onShortcuts, '?'),
        wired('Command palette', h.onCommandPalette, 'Ctrl+K'),
        { separator: true },
        cs('Documentation'),
        cs('Report a bug'),
        cs('Contact support'),
        { separator: true },
        cs('About Quiksheets'),
      ],
    },
  ]
}

export function MenuBar({ handlers, leading }: { handlers: MenuBarHandlers; leading?: ReactNode }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menus = buildMenus(handlers)

  // Alt+F, Alt+E, etc. to focus menus (Excel/Sheets parity)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      const menu = menus.find((m) => m.name[0]?.toLowerCase() === key)
      if (menu) {
        e.preventDefault()
        setOpenMenu(menu.name)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [menus])

  return (
    <div className="flex items-center border-b border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
      {leading ? <div className="mr-3 flex items-center">{leading}</div> : null}
      <nav className="flex items-center" role="menubar">
        {menus.map((menu) => (
          <DropdownMenu
            key={menu.name}
            open={openMenu === menu.name}
            onOpenChange={(open) => setOpenMenu(open ? menu.name : null)}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                role="menuitem"
                onMouseEnter={() => {
                  // If any menu is open, switch to this one (Excel-like behavior)
                  if (openMenu && openMenu !== menu.name) setOpenMenu(menu.name)
                }}
                className="rounded-sm px-3 py-1.5 text-[13px] font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 data-[state=open]:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 dark:data-[state=open]:bg-zinc-800"
              >
                <span>
                  <span className="underline-offset-2 [text-decoration-skip-ink:none]">
                    {menu.name[0]}
                  </span>
                  {menu.name.slice(1)}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {menu.items.map((item, idx) => {
                if ('separator' in item && item.separator)
                  return <DropdownMenuSeparator key={`sep-${idx}`} />
                if ('sectionLabel' in item)
                  return (
                    <DropdownMenuLabel
                      key={`label-${idx}`}
                      className="text-[10px] font-medium uppercase tracking-wider text-zinc-400"
                    >
                      {item.sectionLabel}
                    </DropdownMenuLabel>
                  )
                const i = item as MenuItemDef
                return (
                  <DropdownMenuItem
                    key={`${menu.name}-${i.label}-${idx}`}
                    disabled={false}
                    onSelect={() => {
                      if (i.comingSoon) {
                        toast.message('Coming soon', {
                          description: `"${i.label}" isn't wired yet — it's tracked in the rebuild plan.`,
                        })
                        return
                      }
                      i.onClick?.()
                    }}
                    className={
                      i.comingSoon
                        ? 'text-zinc-400 dark:text-zinc-500'
                        : i.destructive
                          ? 'text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950'
                          : ''
                    }
                  >
                    <span className="flex-1">{i.label}</span>
                    {i.shortcut ? (
                      <DropdownMenuShortcut>{i.shortcut}</DropdownMenuShortcut>
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </nav>
    </div>
  )
}
