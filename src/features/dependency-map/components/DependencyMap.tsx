'use client'

import '@xyflow/react/dist/style.css'

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react'
import { X } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { MapNode } from '@/features/dependency-map/components/MapNode'
import {
  buildDependencyGraph,
  type DependencyFlowNode,
  type DependencyMapCellTarget,
  type DependencyMapNodeData,
} from '@/features/dependency-map/utils/graphBuilder'
import type { Sheet } from '@fortune-sheet/core'

interface DependencyMapProps {
  sheetData: Sheet[]
  onCellSelect: (target: DependencyMapCellTarget) => void
  onExit: () => void
}

// Module-scope constants — referencing these stays stable across renders so
// ReactFlow doesn't see "props changed" on every parent render and trigger an
// internal setState loop (Maximum update depth exceeded).
const nodeTypes = {
  dependencyMapNode: MapNode,
} as const

const FIT_VIEW_OPTIONS = { padding: 0.24 }
const PRO_OPTIONS = { hideAttribution: true }

function getNodeColor(node: Node): string {
  return (node.data as DependencyMapNodeData).color
}

const legendItems = [
  { color: '#22c55e', label: 'Formula', detail: 'healthy' },
  { color: '#eab308', label: 'Circular', detail: 'cycle detected' },
  { color: '#ef4444', label: 'Broken', detail: '#REF!' },
  { color: '#94a3b8', label: 'Input', detail: 'referenced value' },
] as const

export function DependencyMap({ sheetData, onCellSelect, onExit }: DependencyMapProps) {
  const graph = useMemo(() => buildDependencyGraph(sheetData), [sheetData])

  const handleNodeClick = useCallback<NodeMouseHandler<DependencyFlowNode>>(
    (_event, node) => {
      const data = node.data
      onCellSelect({
        row: data.row,
        col: data.col,
        sheetId: data.sheetId,
        sheetIndex: data.sheetIndex,
        sheetName: data.sheetName,
      })
    },
    [onCellSelect]
  )

  return (
    <div className="absolute inset-0 z-[80] bg-zinc-950 text-zinc-100">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.12}
        maxZoom={1.8}
        proOptions={PRO_OPTIONS}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#3f3f46" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={getNodeColor}
          nodeStrokeWidth={3}
          maskColor="rgba(9, 9, 11, 0.72)"
          className="!bg-zinc-900"
        />
      </ReactFlow>

      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-zinc-800 bg-zinc-950/90 px-3 py-2 shadow-xl">
        <div className="grid gap-1.5">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-zinc-100">{item.label}</span>
              <span className="text-zinc-400">{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {graph.nodes.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-300 shadow-xl">
          No formula dependencies found
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="absolute right-4 top-4 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 shadow-xl transition-colors hover:bg-zinc-800"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Exit Map View
      </button>
    </div>
  )
}
