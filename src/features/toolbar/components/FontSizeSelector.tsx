'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 64, 72]

interface FontSizeSelectorProps {
  value: number
  onChange: (size: number) => void
}

export function FontSizeSelector({ value, onChange }: FontSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(String(value))
  const [rect, setRect] = useState<DOMRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(String(value))
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleInputFocus() {
    if (wrapperRef.current) {
      setRect(wrapperRef.current.getBoundingClientRect())
    }
    setIsOpen(true)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseInt(inputValue)
      if (!isNaN(num) && num >= 6 && num <= 400) onChange(num)
      setIsOpen(false)
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setInputValue(String(value))
      setIsOpen(false)
    }
  }

  return (
    <>
      <div ref={wrapperRef} className="flex items-center">
        <button
          onClick={() => {
            const num = Math.max(6, value - 1)
            onChange(num)
            setInputValue(String(num))
          }}
          title="Decrease font size"
          className="flex h-7 w-5 items-center justify-center rounded-l text-xs text-zinc-500 transition-colors hover:bg-zinc-100"
        >
          -
        </button>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          className="h-7 w-9 border-x border-zinc-200 text-center font-mono text-xs text-zinc-700 outline-none focus:border-blue-400 focus:bg-blue-50"
        />

        <button
          onClick={() => {
            const num = Math.min(400, value + 1)
            onChange(num)
            setInputValue(String(num))
          }}
          title="Increase font size"
          className="flex h-7 w-5 items-center justify-center rounded-r text-xs text-zinc-500 transition-colors hover:bg-zinc-100"
        >
          +
        </button>
      </div>

      {isOpen && rect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 2,
            left: rect.left,
            width: 64,
            maxHeight: 200,
            zIndex: 9999,
          }}
          className="overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg"
        >
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              onMouseDown={() => {
                onChange(size)
                setInputValue(String(size))
                setIsOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-center py-1 text-xs transition-colors hover:bg-zinc-100',
                value === size ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-700'
              )}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
