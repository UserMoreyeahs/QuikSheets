'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DependencyFlowNode } from '@/features/dependency-map/utils/graphBuilder'

export function MapNode({ data, selected }: NodeProps<DependencyFlowNode>) {
  const isFormula = data.nodeType === 'formula'
  const formulaText = data.formula.length > 0 ? data.formula : data.sheetName

  return (
    <div
      title={`${data.sheetName}!${data.address}${data.formula ? ` ${data.formula}` : ''}`}
      className={[
        'relative rounded-md border-2 bg-white shadow-sm transition-shadow',
        isFormula ? 'w-44 px-3 py-2' : 'w-28 px-2 py-1.5',
        selected ? 'shadow-lg ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-950' : '',
      ].join(' ')}
      style={{ borderColor: data.color }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-zinc-300 !bg-white"
      />

      <div className="min-w-0">
        <div
          className={[
            'truncate font-mono font-semibold text-zinc-900',
            isFormula ? 'text-sm' : 'text-xs',
          ].join(' ')}
        >
          {data.address}
        </div>
        <div className="mt-0.5 truncate text-[10px] leading-4 text-zinc-500">
          {formulaText}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-zinc-300 !bg-white"
      />
    </div>
  )
}
