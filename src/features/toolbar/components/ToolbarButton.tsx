'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ToolbarButtonProps {
  onClick?: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  className?: string
}

export function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
  className,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-7 min-w-[28px] items-center justify-center',
        'rounded px-1.5 text-sm transition-colors duration-100',
        'select-none outline-none',
        isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        disabled && 'cursor-not-allowed opacity-30',
        className
      )}
    >
      {children}
    </button>
  )
}
