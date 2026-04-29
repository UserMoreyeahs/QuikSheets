'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { NumberFormat } from '@/types/sheet.types'

const NUMBER_FORMATS: { value: NumberFormat; label: string; example: string }[] = [
  { value: 'general',    label: 'General',      example: '1234.5'           },
  { value: 'number',     label: 'Number',       example: '1,234.50'         },
  { value: 'currency',   label: 'Currency',     example: '$1,234.50'        },
  { value: 'accounting', label: 'Accounting',   example: '$ 1,234.50'       },
  { value: 'percentage', label: 'Percentage',   example: '12.34%'           },
  { value: 'fraction',   label: 'Fraction',     example: '1 1/4'            },
  { value: 'scientific', label: 'Scientific',   example: '1.23E+03'         },
  { value: 'text',       label: 'Text',         example: '"1234"'           },
  { value: 'date_short', label: 'Short Date',   example: '1/15/2024'        },
  { value: 'date_long',  label: 'Long Date',    example: 'January 15, 2024' },
  { value: 'time',       label: 'Time',         example: '3:30 PM'          },
]

interface NumberFormatSelectorProps {
  value: NumberFormat
  onChange: (format: NumberFormat) => void
}

export function NumberFormatSelector({ value, onChange }: NumberFormatSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const current = NUMBER_FORMATS.find((f) => f.value === value)

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
        title="Number format"
        className="flex h-7 w-[90px] items-center justify-between gap-1 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
      >
        <span className="truncate">{current?.label ?? 'General'}</span>
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
            width: 220,
            zIndex: 9999,
          }}
          className="overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {NUMBER_FORMATS.map((format) => (
            <button
              key={format.value}
              onClick={() => {
                onChange(format.value)
                setIsOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-zinc-100',
                value === format.value ? 'bg-blue-50 text-blue-700' : 'text-zinc-700'
              )}
            >
              <span>{format.label}</span>
              <span className="font-mono text-zinc-400">{format.example}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
