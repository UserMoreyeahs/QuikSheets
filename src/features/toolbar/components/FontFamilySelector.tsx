'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { FontFamily } from '@/types/sheet.types'

const FONTS: FontFamily[] = [
  'Inter', 'Arial', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Trebuchet MS', 'Impact',
  'Comic Sans MS', 'Helvetica', 'Palatino', 'Garamond',
]

interface FontFamilySelectorProps {
  value: FontFamily
  onChange: (font: FontFamily) => void
}

export function FontFamilySelector({ value, onChange }: FontFamilySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleOpen() {
    if (buttonRef.current) {
      setRect(buttonRef.current.getBoundingClientRect())
    }
    setIsOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        title="Font family"
        className="flex h-7 w-[110px] items-center justify-between gap-1 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
      >
        <span className="truncate" style={{ fontFamily: value }}>
          {value}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-zinc-400">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && rect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 2,
            left: rect.left,
            width: 160,
            maxHeight: 240,
            zIndex: 9999,
          }}
          className="overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {FONTS.map((font) => (
            <button
              key={font}
              onClick={() => {
                onChange(font)
                setIsOpen(false)
              }}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100',
                value === font ? 'bg-blue-50 text-blue-700' : 'text-zinc-700'
              )}
              style={{ fontFamily: font }}
            >
              {font}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
