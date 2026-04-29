export type ColumnDetectedType = 'number' | 'text' | 'date' | 'boolean' | 'mixed'

export interface DistributionPoint {
  label: string
  count: number
  min?: number
  max?: number
  timestamp?: number
}

export interface TopValue {
  value: string
  count: number
}

export interface ColumnAnalysis {
  totalCells: number
  filledCells: number
  emptyCells: number
  emptyPercent: number
  uniqueValues: number
  duplicateValues: number
  detectedType: ColumnDetectedType
  dominantType: Exclude<ColumnDetectedType, 'mixed'>
  mixedTypeCount: number
  mixedTypeIndexes: number[]
  distribution: DistributionPoint[]
  topValues: TopValue[]
  outliers: number[]
  hasNegatives: boolean
  negativeIndexes: number[]
}

interface ClassifiedValue {
  index: number
  raw: unknown
  normalized: string
  type: Exclude<ColumnDetectedType, 'mixed'>
  numericValue?: number
  timestamp?: number
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

function isDateLike(value: string): boolean {
  return /^\d{4}-\d{1,2}-\d{1,2}/.test(value) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value)
}

function classifyValue(value: unknown, index: number): ClassifiedValue | null {
  if (isEmptyValue(value)) return null

  if (typeof value === 'boolean') {
    return { index, raw: value, normalized: String(value), type: 'boolean' }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { index, raw: value, normalized: String(value), type: 'number', numericValue: value }
  }

  const normalized = String(value).trim()
  const lower = normalized.toLowerCase()

  if (lower === 'true' || lower === 'false') {
    return { index, raw: value, normalized, type: 'boolean' }
  }

  const numericValue = Number(normalized.replace(/[$,%]/g, ''))
  if (Number.isFinite(numericValue) && normalized !== '') {
    return { index, raw: value, normalized, type: 'number', numericValue }
  }

  if (isDateLike(normalized)) {
    const timestamp = new Date(normalized).getTime()
    if (Number.isFinite(timestamp)) {
      return { index, raw: value, normalized, type: 'date', timestamp }
    }
  }

  return { index, raw: value, normalized, type: 'text' }
}

function getDominantType(values: ClassifiedValue[]): Exclude<ColumnDetectedType, 'mixed'> {
  const counts = new Map<Exclude<ColumnDetectedType, 'mixed'>, number>()
  values.forEach((value) => {
    counts.set(value.type, (counts.get(value.type) ?? 0) + 1)
  })

  return (
    Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'text'
  )
}

function countValues(values: string[]): TopValue[] {
  const counts = new Map<string, number>()
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
}

function buildNumberDistribution(values: ClassifiedValue[]): DistributionPoint[] {
  const numericValues = values
    .map((value) => value.numericValue)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (numericValues.length === 0) return []

  const min = Math.min(...numericValues)
  const max = Math.max(...numericValues)
  if (min === max) {
    return [{ label: String(min), count: numericValues.length, min, max }]
  }

  const bucketCount = 10
  const width = (max - min) / bucketCount
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketMin = min + index * width
    const bucketMax = index === bucketCount - 1 ? max : bucketMin + width
    return {
      label: `${bucketMin.toFixed(1)}-${bucketMax.toFixed(1)}`,
      count: 0,
      min: bucketMin,
      max: bucketMax,
    }
  })

  numericValues.forEach((value) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((value - min) / width))
    const bucket = buckets[bucketIndex]
    if (bucket) {
      bucket.count += 1
    }
  })

  return buckets
}

function buildDateDistribution(values: ClassifiedValue[]): DistributionPoint[] {
  const dateValues = values
    .map((value) => value.timestamp)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const counts = new Map<string, { count: number; timestamp: number }>()
  dateValues.forEach((timestamp) => {
    const label = new Date(timestamp).toISOString().slice(0, 10)
    const existing = counts.get(label)
    counts.set(label, {
      count: (existing?.count ?? 0) + 1,
      timestamp,
    })
  })

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, count: value.count, timestamp: value.timestamp }))
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))
}

function buildTextDistribution(values: ClassifiedValue[]): DistributionPoint[] {
  return countValues(values.map((value) => value.normalized))
    .slice(0, 10)
    .map((value) => ({ label: value.value, count: value.count }))
}

function getOutlierIndexes(values: ClassifiedValue[]): number[] {
  const numericValues = values.filter((value) => typeof value.numericValue === 'number')
  if (numericValues.length < 2) return []

  const mean =
    numericValues.reduce((sum, value) => sum + (value.numericValue ?? 0), 0) / numericValues.length
  const variance =
    numericValues.reduce((sum, value) => sum + Math.pow((value.numericValue ?? 0) - mean, 2), 0) /
    numericValues.length
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) return []

  return numericValues
    .filter((value) => Math.abs((value.numericValue ?? 0) - mean) > 3 * stdDev)
    .map((value) => value.index)
}

export function analyzeColumn(values: unknown[]): ColumnAnalysis {
  const classifiedValues = values
    .map((value, index) => classifyValue(value, index))
    .filter((value): value is ClassifiedValue => value !== null)
  const dominantType = getDominantType(classifiedValues)
  const mixedTypeIndexes = classifiedValues
    .filter((value) => value.type !== dominantType)
    .map((value) => value.index)
  const detectedType = mixedTypeIndexes.length > 0 ? 'mixed' : dominantType
  const filledCells = classifiedValues.length
  const emptyCells = values.length - filledCells
  const countedValues = countValues(classifiedValues.map((value) => value.normalized))
  const duplicateValues = countedValues.reduce(
    (total, value) => total + Math.max(0, value.count - 1),
    0
  )
  const valuesForDistribution = classifiedValues.filter((value) => value.type === dominantType)
  const distribution =
    dominantType === 'number'
      ? buildNumberDistribution(valuesForDistribution)
      : dominantType === 'date'
        ? buildDateDistribution(valuesForDistribution)
        : buildTextDistribution(valuesForDistribution)
  const negativeIndexes = classifiedValues
    .filter((value) => value.type === 'number' && (value.numericValue ?? 0) < 0)
    .map((value) => value.index)

  return {
    totalCells: values.length,
    filledCells,
    emptyCells,
    emptyPercent: values.length > 0 ? (emptyCells / values.length) * 100 : 0,
    uniqueValues: countedValues.length,
    duplicateValues,
    detectedType,
    dominantType,
    mixedTypeCount: mixedTypeIndexes.length,
    mixedTypeIndexes,
    distribution,
    topValues:
      dominantType === 'text'
        ? countedValues.slice(0, 5)
        : [],
    outliers: getOutlierIndexes(classifiedValues.filter((value) => value.type === 'number')),
    hasNegatives: negativeIndexes.length > 0,
    negativeIndexes,
  }
}
