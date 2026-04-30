'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Clock,
  FileSpreadsheet,
  LayoutGrid,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { useDashboardWorkbooks } from '@/features/workbook/useDashboardWorkbooks'
import { cn } from '@/lib/utils'

interface WorkbookSidebarProps {
  activeWorkbookId?: string
  collapsed?: boolean
  onToggle?: () => void
  onNewWorkbook?: () => void
}

export function WorkbookSidebar({
  activeWorkbookId,
  collapsed = false,
  onNewWorkbook,
}: WorkbookSidebarProps) {
  const router = useRouter()
  const { workbooks, isLoading } = useDashboardWorkbooks()
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem('quiksheets_favorites')
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]))
    } catch {
      // ignore
    }
  }, [])

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('quiksheets_favorites', JSON.stringify(Array.from(next)))
      } catch {
        // ignore
      }
      return next
    })
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 shrink-0 flex-col items-center border-r border-zinc-200 bg-white py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/dashboard"
          title="Dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <LayoutGrid className="h-4 w-4" />
        </Link>
      </aside>
    )
  }

  const starred = workbooks.filter((wb) => favorites.has(wb.id))
  const recent = workbooks.slice(0, 8)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Brand row */}
      <div className="flex h-12 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
        <FileSpreadsheet className="h-5 w-5 text-blue-600" aria-hidden="true" />
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Quiksheets</span>
      </div>

      {/* Primary nav */}
      <nav className="px-2 pt-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <LayoutGrid className="h-4 w-4" />
          Dashboard
        </Link>
        <button
          type="button"
          onClick={onNewWorkbook}
          className="mt-1 flex w-full items-center gap-2 rounded-md bg-blue-600 px-2 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New workbook
        </button>
      </nav>

      <SidebarSection title="Starred">
        {starred.length === 0 ? (
          <p className="px-3 py-1 text-xs text-zinc-400">Click ⭐ on a workbook to pin it.</p>
        ) : (
          starred.map((wb) => (
            <SidebarWorkbookRow
              key={wb.id}
              id={wb.id}
              name={wb.name}
              isLocal={wb.source === 'local'}
              isActive={wb.id === activeWorkbookId}
              isFavorite
              onClick={() => router.push(`/sheet/${wb.id}`)}
              onToggleFavorite={() => toggleFavorite(wb.id)}
            />
          ))
        )}
      </SidebarSection>

      <SidebarSection title="Recent" icon={<Clock className="h-3 w-3" />}>
        {isLoading && recent.length === 0 ? (
          <p className="px-3 py-1 text-xs text-zinc-400">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-3 py-1 text-xs text-zinc-400">No workbooks yet.</p>
        ) : (
          recent.map((wb) => (
            <SidebarWorkbookRow
              key={wb.id}
              id={wb.id}
              name={wb.name}
              isLocal={wb.source === 'local'}
              isActive={wb.id === activeWorkbookId}
              isFavorite={favorites.has(wb.id)}
              onClick={() => router.push(`/sheet/${wb.id}`)}
              onToggleFavorite={() => toggleFavorite(wb.id)}
            />
          ))
        )}
      </SidebarSection>

      <SidebarSection title="Templates" icon={<Sparkles className="h-3 w-3" />}>
        <Link
          href="/dashboard?tab=templates"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Sparkles className="h-3 w-3" />
          Browse 8 templates
        </Link>
      </SidebarSection>

      {/* Footer */}
      <div className="mt-auto border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <Trash2 className="h-3 w-3" />
          Trash
        </Link>
      </div>
    </aside>
  )
}

function SidebarSection({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 px-2">
      <div className="flex items-center gap-1.5 px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {icon}
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function SidebarWorkbookRow({
  name,
  isLocal,
  isActive,
  isFavorite,
  onClick,
  onToggleFavorite,
}: {
  id: string
  name: string
  isLocal: boolean
  isActive: boolean
  isFavorite: boolean
  onClick: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      )}
    >
      <FileSpreadsheet
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'
        )}
      />
      <span className="flex-1 truncate text-[13px]">{name}</span>
      {isLocal ? (
        <span className="rounded bg-zinc-100 px-1 py-0 text-[9px] font-medium text-zinc-400 dark:bg-zinc-800">
          L
        </span>
      ) : null}
      <button
        type="button"
        aria-label={isFavorite ? 'Unstar' : 'Star'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        className={cn(
          'rounded p-0.5 transition-all',
          isFavorite
            ? 'text-amber-500 opacity-100'
            : 'text-zinc-400 opacity-0 hover:text-amber-500 group-hover:opacity-100'
        )}
      >
        <Star className={cn('h-3 w-3', isFavorite && 'fill-current')} />
      </button>
    </div>
  )
}
