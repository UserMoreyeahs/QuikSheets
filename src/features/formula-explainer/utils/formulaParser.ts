import { extractCellReferences } from '@/features/formula-engine'

export function parseFormulaReferences(formula: string): string[] {
  const rangePattern = /\b([A-Z]+\d+:[A-Z]+\d+)\b/g
  const ranges: string[] = []
  let match: RegExpExecArray | null

  while ((match = rangePattern.exec(formula.toUpperCase())) !== null) {
    if (match[1]) ranges.push(match[1])
  }

  const singles = extractCellReferences(formula.toUpperCase()).filter(
    (reference) => !ranges.some((range) => range.split(':').includes(reference))
  )

  return Array.from(new Set([...ranges, ...singles]))
}
