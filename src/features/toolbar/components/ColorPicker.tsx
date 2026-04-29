'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7',
  '#cccccc', '#d9d9d9', '#ffffff', '#ff0000', '#ff4500',
  '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8',
  '#0000ff', '#9900ff', '#ff00ff', '#f4cccc', '#fce5cd',
  '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3',
  '#d9d2e9', '#ead1dc', '#ea9999', '#f9cb9c', '#ffe599',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  trigger: React.ReactNode
  label: string
}

export function ColorPicker({ value, onChange, trigger, label }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCustomColor(value)
  }, [value])

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
        title={label}
        className="flex h-7 flex-col items-center justify-center rounded px-1 hover:bg-zinc-100 transition-colors"
      >
        {trigger}
        <div
          className="mt-0.5 h-[3px] w-4 rounded-sm"
          style={{ backgroundColor: value }}
        />
      </button>

      {isOpen && rect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 2,
            left: rect.left,
            width: 200,
            zIndex: 9999,
          }}
          className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
        >
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {label}
          </div>

          <div className="mb-3 grid grid-cols-10 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onChange(color)
                  setIsOpen(false)
                }}
                className={cn(
                  'h-4 w-4 rounded-sm border transition-transform hover:scale-110',
                  value === color
                    ? 'border-blue-500 ring-1 ring-blue-400'
                    : 'border-zinc-200'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-zinc-200 bg-transparent p-0.5"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onChange(customColor)
                  setIsOpen(false)
                }
              }}
              placeholder="#000000"
              className="flex-1 rounded border border-zinc-200 px-2 py-1 font-mono text-xs outline-none focus:border-blue-400"
            />
            <button
              onClick={() => {
                onChange(customColor)
                setIsOpen(false)
              }}
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
