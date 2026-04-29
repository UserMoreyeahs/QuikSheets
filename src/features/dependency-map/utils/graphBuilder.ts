import { fromCellNotation, toCellNotation } from '@/lib/cellAddress'
import { getCellDisplayValue, getCellFormulaBarValue, getSheetMatrix } from '@/lib/fortuneSheet'
import type { Cell, Sheet } from '@fortune-sheet/core'
import type { Edge, Node } from '@xyflow/react'

export type DependencyNodeType = 'formula' | 'input'
export type DependencyHealth = 'healthy' | 'circular' | 'broken' | 'input'
export type DependencyEdgeType = 'solid' | 'dashed'

export interface DependencyMapNodeData extends Record<string, unknown> {
  address: string
  color: string
  formula: string
  health: DependencyHealth
  label: string
  nodeType: DependencyNodeType
  row: number
  col: number
  sheetId: string
  sheetIndex: number
  sheetName: string
}

export interface DependencyMapEdgeData extends Record<string, unknown> {
  edgeType: DependencyEdgeType
}

export interface DependencyMapCellTarget {
  row: number
  col: number
  sheetId: string
  sheetIndex: number
  sheetName: string
}

export type DependencyFlowNode = Node<DependencyMapNodeData, 'dependencyMapNode'>
export type DependencyFlowEdge = Edge<DependencyMapEdgeData>

interface WorkingNode extends DependencyMapNodeData {
  id: string
}

interface ParsedReference {
  row: number
  col: number
  sheetId: string
  sheetIndex: number
  sheetName: string
}

interface SheetLookup {
  byName: Map<string, number>
  names: string[]
}

const FORMULA_NODE_COLOR = '#22c55e'
const CIRCULAR_NODE_COLOR = '#eab308'
const BROKEN_NODE_COLOR = '#ef4444'
const INPUT_NODE_COLOR = '#94a3b8'

const EDGE_COLOR = '#64748b'
const SHEET_COLUMN_WIDTH = 640
const INPUT_NODE_X = 48
const FORMULA_NODE_X = 312
const NODE_START_Y = 56
const INPUT_NODE_GAP = 84
const FORMULA_NODE_GAP = 128

function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase()
}

function normalizeCellReference(reference: string): string {
  return reference.replace(/\$/g, '').toUpperCase()
}

function getSheetId(sheet: Sheet, index: number): string {
  return typeof sheet.id === 'string' ? sheet.id : `sheet-${index}`
}

function getSheetName(sheet: Sheet, index: number): string {
  return sheet.name ?? `Sheet${index + 1}`
}

function createSheetLookup(sheets: Sheet[]): SheetLookup {
  const byName = new Map<string, number>()
  const names = sheets.map((sheet, index) => {
    const name = getSheetName(sheet, index)
    byName.set(normalizeSheetName(name), index)
    return name
  })

  return { byName, names }
}

function getNodeId(sheetId: string, row: number, col: number): string {
  return `${sheetId}:${row}:${col}`
}

function getNodeColor(health: DependencyHealth): string {
  switch (health) {
    case 'broken':
      return BROKEN_NODE_COLOR
    case 'circular':
      return CIRCULAR_NODE_COLOR
    case 'input':
      return INPUT_NODE_COLOR
    default:
      return FORMULA_NODE_COLOR
  }
}

function hasBrokenReference(cell: Cell | null, formula: string): boolean {
  const displayValue = getCellDisplayValue(cell)
  const displayText = displayValue !== null && displayValue !== undefined ? String(displayValue) : ''

  return formula.toUpperCase().includes('#REF!') || displayText.toUpperCase().includes('#REF!')
}

function createWorkingNode(params: {
  cell: Cell | null
  col: number
  nodeType: DependencyNodeType
  row: number
  sheet: Sheet
  sheetIndex: number
}): WorkingNode {
  const sheetId = getSheetId(params.sheet, params.sheetIndex)
  const sheetName = getSheetName(params.sheet, params.sheetIndex)
  const address = toCellNotation(params.row, params.col)
  const formula = getCellFormulaBarValue(params.cell)
  const health = params.nodeType === 'input' ? 'input' : 'healthy'

  return {
    id: getNodeId(sheetId, params.row, params.col),
    address,
    color: getNodeColor(health),
    formula: formula.startsWith('=') ? formula : '',
    health,
    label: address,
    nodeType: params.nodeType,
    row: params.row,
    col: params.col,
    sheetId,
    sheetIndex: params.sheetIndex,
    sheetName,
  }
}

function parseCell(reference: string): { row: number; col: number } | null {
  try {
    return fromCellNotation(normalizeCellReference(reference))
  } catch {
    return null
  }
}

function expandRange(startReference: string, endReference?: string): Array<{ row: number; col: number }> {
  const start = parseCell(startReference)
  const end = endReference ? parseCell(endReference) : start
  if (!start || !end) return []

  const startRow = Math.min(start.row, end.row)
  const endRow = Math.max(start.row, end.row)
  const startCol = Math.min(start.col, end.col)
  const endCol = Math.max(start.col, end.col)
  const cells: Array<{ row: number; col: number }> = []

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      cells.push({ row, col })
    }
  }

  return cells
}

function parseFormulaReferences(
  formula: string,
  currentSheetIndex: number,
  lookup: SheetLookup,
  sheets: Sheet[]
): { references: ParsedReference[]; hasBrokenReference: boolean } {
  const pattern =
    /(?:'([^']+)'|([A-Za-z_][\w .-]*))!\s*(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?|\b(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?\b/g
  const references = new Map<string, ParsedReference>()
  let hasBroken = formula.toUpperCase().includes('#REF!')
  let match: RegExpExecArray | null

  while ((match = pattern.exec(formula)) !== null) {
    const sheetName = match[1] ?? match[2] ?? null
    const startReference = match[3] ?? match[5]
    const endReference = match[4] ?? match[6]
    if (!startReference) continue

    const targetSheetIndex =
      sheetName === null
        ? currentSheetIndex
        : (lookup.byName.get(normalizeSheetName(sheetName)) ?? -1)

    const targetSheet = sheets[targetSheetIndex]
    if (!targetSheet) {
      hasBroken = true
      continue
    }

    expandRange(startReference, endReference).forEach(({ row, col }) => {
      const sheetId = getSheetId(targetSheet, targetSheetIndex)
      const referenceId = getNodeId(sheetId, row, col)
      references.set(referenceId, {
        row,
        col,
        sheetId,
        sheetIndex: targetSheetIndex,
        sheetName: lookup.names[targetSheetIndex] ?? getSheetName(targetSheet, targetSheetIndex),
      })
    })
  }

  return {
    references: Array.from(references.values()),
    hasBrokenReference: hasBroken,
  }
}

function detectCircularNodes(edges: DependencyFlowEdge[]): Set<string> {
  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    const next = adjacency.get(edge.source) ?? []
    next.push(edge.target)
    adjacency.set(edge.source, next)
  })

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const stack: string[] = []
  const circular = new Set<string>()

  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      const cycleStart = stack.indexOf(nodeId)
      if (cycleStart >= 0) {
        stack.slice(cycleStart).forEach((id) => circular.add(id))
      }
      return
    }

    if (visited.has(nodeId)) return

    visiting.add(nodeId)
    stack.push(nodeId)

    ;(adjacency.get(nodeId) ?? []).forEach(visit)

    stack.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  Array.from(adjacency.keys()).forEach(visit)
  return circular
}

function sortNodes(nodes: WorkingNode[]): WorkingNode[] {
  return [...nodes].sort((left, right) => {
    if (left.sheetIndex !== right.sheetIndex) return left.sheetIndex - right.sheetIndex
    if (left.nodeType !== right.nodeType) return left.nodeType === 'input' ? -1 : 1
    if (left.row !== right.row) return left.row - right.row
    return left.col - right.col
  })
}

function positionNodes(nodes: WorkingNode[]): DependencyFlowNode[] {
  const formulaCountBySheet = new Map<number, number>()
  const inputCountBySheet = new Map<number, number>()

  return sortNodes(nodes).map((node) => {
    const isFormula = node.nodeType === 'formula'
    const countMap = isFormula ? formulaCountBySheet : inputCountBySheet
    const currentIndex = countMap.get(node.sheetIndex) ?? 0
    countMap.set(node.sheetIndex, currentIndex + 1)

    const x = node.sheetIndex * SHEET_COLUMN_WIDTH + (isFormula ? FORMULA_NODE_X : INPUT_NODE_X)
    const y = NODE_START_Y + currentIndex * (isFormula ? FORMULA_NODE_GAP : INPUT_NODE_GAP)

    return {
      id: node.id,
      type: 'dependencyMapNode',
      position: { x, y },
      data: {
        ...node,
        color: getNodeColor(node.health),
      },
    }
  })
}

export function buildDependencyGraph(sheetData: Sheet[]): {
  nodes: DependencyFlowNode[]
  edges: DependencyFlowEdge[]
} {
  const nodeMap = new Map<string, WorkingNode>()
  const edges: DependencyFlowEdge[] = []
  const edgeIds = new Set<string>()
  const lookup = createSheetLookup(sheetData)

  sheetData.forEach((sheet, sheetIndex) => {
    getSheetMatrix(sheet).forEach((row, rowIndex) => {
      ;(row ?? []).forEach((cell, colIndex) => {
        const formula = getCellFormulaBarValue(cell)
        const isFormula = formula.startsWith('=')
        const isBroken = hasBrokenReference(cell, formula)
        if (!isFormula && !isBroken) return

        const node = createWorkingNode({
          cell,
          col: colIndex,
          nodeType: isFormula ? 'formula' : 'input',
          row: rowIndex,
          sheet,
          sheetIndex,
        })
        node.health = isBroken ? 'broken' : node.health
        nodeMap.set(node.id, node)
      })
    })
  })

  Array.from(nodeMap.values())
    .filter((node) => node.nodeType === 'formula')
    .forEach((formulaNode) => {
      const sheet = sheetData[formulaNode.sheetIndex]
      if (!sheet) return

      const { references, hasBrokenReference: hasBroken } = parseFormulaReferences(
        formulaNode.formula,
        formulaNode.sheetIndex,
        lookup,
        sheetData
      )

      if (hasBroken) {
        formulaNode.health = 'broken'
      }

      references.forEach((reference) => {
        const referencedSheet = sheetData[reference.sheetIndex]
        if (!referencedSheet) return

        const referenceId = getNodeId(reference.sheetId, reference.row, reference.col)
        const existingNode = nodeMap.get(referenceId)

        if (!existingNode) {
          const referencedCell = getSheetMatrix(referencedSheet)[reference.row]?.[reference.col] ?? null
          nodeMap.set(
            referenceId,
            createWorkingNode({
              cell: referencedCell,
              col: reference.col,
              nodeType: 'input',
              row: reference.row,
              sheet: referencedSheet,
              sheetIndex: reference.sheetIndex,
            })
          )
        }

        const edgeId = `${referenceId}->${formulaNode.id}`
        if (edgeIds.has(edgeId)) return

        const edgeType: DependencyEdgeType =
          reference.sheetIndex === formulaNode.sheetIndex ? 'solid' : 'dashed'
        edgeIds.add(edgeId)
        edges.push({
          id: edgeId,
          source: referenceId,
          target: formulaNode.id,
          type: 'smoothstep',
          data: { edgeType },
          style: {
            stroke: EDGE_COLOR,
            strokeWidth: 2,
            ...(edgeType === 'dashed' ? { strokeDasharray: '7 5' } : {}),
          },
        })
      })
    })

  const circularNodes = detectCircularNodes(edges)
  circularNodes.forEach((nodeId) => {
    const node = nodeMap.get(nodeId)
    if (!node || node.health === 'broken' || node.nodeType !== 'formula') return
    node.health = 'circular'
  })

  return {
    nodes: positionNodes(Array.from(nodeMap.values())),
    edges,
  }
}
