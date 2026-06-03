'use client'

/**
 * ConnectorBuilder — 3-step "Get Data" wizard
 *
 * Step 1: Pick connector kind
 * Step 2: Configure the connector (URL, credentials, query)
 * Step 3: Preview sample data + map columns to sheet columns
 *
 * Opening behaviour:
 *   - If `activeConnectionId` is set in the store, the wizard opens in edit mode
 *     pre-populated with the existing connection's config.
 *   - Otherwise it opens in create mode.
 *
 * Security:
 *   Secret fields (kind === 'secret') render as <input type="password"> and are
 *   NEVER written to localStorage. They flow to Supabase only via saveConnection().
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  X,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Check,
  Database,
  Globe,
  FileText,
  Table2,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useConnectorsStore } from '../store/connectorsStore'
import { connectorList, getConnector } from '../connectors/index'
import { buildDefaultMapping } from '../utils/applyMapping'
import { useWorkbookStore } from '@/store/workbookStore'
import type {
  ConnectorKind,
  ColumnMapping,
  FetchResult,
  ConnectorSchedule,
  CellValue,
} from '../types'

// ---------------------------------------------------------------------------
// Icons per connector kind
// ---------------------------------------------------------------------------

const KIND_ICONS: Record<ConnectorKind, React.ReactNode> = {
  'csv-url': <FileText className="h-5 w-5" />,
  'json-url': <Globe className="h-5 w-5" />,
  'google-sheets-public': <Table2 className="h-5 w-5" />,
  'postgres': <Database className="h-5 w-5" />,
  'rest-api': <Zap className="h-5 w-5" />,
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StepIndicatorProps {
  current: number
  total: number
  labels: string[]
}

function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border transition-colors ${
              i < current
                ? 'bg-blue-600 border-blue-600 text-white'
                : i === current
                ? 'bg-white border-blue-600 text-blue-600 ring-2 ring-blue-200'
                : 'bg-white border-gray-300 text-gray-400'
            }`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`flex-1 h-0.5 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          )}
          {i < total - 1 && (
            <span
              className={`hidden sm:block text-xs ${
                i <= current ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}
            />
          )}
        </React.Fragment>
      ))}
      <div className="ml-3 text-sm font-medium text-gray-700">
        {labels[current]}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Pick connector kind
// ---------------------------------------------------------------------------

interface Step1Props {
  selected: ConnectorKind | null
  onSelect: (kind: ConnectorKind) => void
}

function Step1PickConnector({ selected, onSelect }: Step1Props) {
  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Choose a data source to import into your sheet.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {connectorList.map((conn) => (
          <button
            key={conn.id}
            type="button"
            onClick={() => onSelect(conn.id)}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
              selected === conn.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <span
              className={`mt-0.5 ${selected === conn.id ? 'text-blue-600' : 'text-gray-500'}`}
            >
              {KIND_ICONS[conn.id]}
            </span>
            <div>
              <div className="font-medium text-sm text-gray-900">{conn.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{conn.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Configure
// ---------------------------------------------------------------------------

interface Step2ConfigProps {
  kind: ConnectorKind
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

function Step2Configure({ kind, config, onChange }: Step2ConfigProps) {
  const connector = getConnector(kind)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-blue-600">{KIND_ICONS[kind]}</span>
        <h3 className="font-semibold text-gray-900">{connector.name}</h3>
      </div>
      <div className="space-y-4">
        {connector.configSchema.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.kind === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(
                    config[field.name] !== undefined
                      ? config[field.name]
                      : field.defaultValue ?? true
                  )}
                  onChange={(e) => onChange(field.name, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {field.placeholder ?? 'Yes'}
                </span>
              </label>
            ) : field.kind === 'textarea' ? (
              <textarea
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                placeholder={field.placeholder}
                value={String(config[field.name] ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            ) : (
              <input
                type={field.kind === 'secret' ? 'password' : 'text'}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={field.placeholder}
                value={String(config[field.name] ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
                autoComplete={field.kind === 'secret' ? 'new-password' : undefined}
              />
            )}
            {field.kind === 'secret' && (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Stored encrypted in Supabase. Never saved in browser storage.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Preview + mapping
// ---------------------------------------------------------------------------

interface Step3PreviewProps {
  result: FetchResult | null
  mapping: ColumnMapping[]
  onMappingChange: (mapping: ColumnMapping[]) => void
  schedule: ConnectorSchedule
  onScheduleChange: (s: ConnectorSchedule) => void
  onRefresh: () => void
  loading: boolean
  error: string | null
}

function formatPreviewValue(v: CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  const s = String(v)
  return s.length > 40 ? s.slice(0, 37) + '…' : s
}

function Step3Preview({
  result,
  mapping,
  onMappingChange,
  schedule,
  onScheduleChange,
  onRefresh,
  loading,
  error,
}: Step3PreviewProps) {
  function updateTargetColumn(sourceField: string, targetColumn: number) {
    onMappingChange(
      mapping.map((m) =>
        m.sourceField === sourceField ? { ...m, targetColumn } : m
      )
    )
  }

  function updateTransform(sourceField: string, transform: ColumnMapping['transform']) {
    onMappingChange(
      mapping.map((m) =>
        m.sourceField === sourceField
          // exactOptionalPropertyTypes: only set `transform` when it has a value;
          // drop the key entirely when undefined so we never assign `undefined`.
          ? (transform !== undefined ? { ...m, transform } : (() => { const { transform: _t, ...rest } = m; void _t; return rest })())
          : m
      )
    )
  }

  return (
    <div className="space-y-4">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Preview &amp; Column Mapping</h3>
          {result && (
            <p className="text-xs text-gray-500 mt-0.5">
              Showing {result.rows.length} of {result.rowCount} rows
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !result && (
        <div className="space-y-2 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      )}

      {/* Data preview table */}
      {result && result.columns.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {result.columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                  >
                    {col}
                    <span className="ml-1 text-gray-400 font-normal">
                      ({result.columnTypes[result.columns.indexOf(col)] ?? 'string'})
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.rows.slice(0, 8).map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                      {formatPreviewValue(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Column mapping */}
      {result && result.columns.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Map columns to sheet</h4>
          <div className="space-y-2">
            {mapping.map((m) => (
              <div key={m.sourceField} className="flex items-center gap-2 text-sm">
                <span className="w-36 truncate font-medium text-gray-700" title={m.sourceField}>
                  {m.sourceField}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-xs">Col</span>
                  <input
                    type="number"
                    min={1}
                    max={702}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={m.targetColumn + 1}
                    onChange={(e) =>
                      updateTargetColumn(m.sourceField, Math.max(0, Number(e.target.value) - 1))
                    }
                  />
                </div>
                <select
                  className="ml-auto px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={m.transform ?? ''}
                  onChange={(e) =>
                    updateTransform(
                      m.sourceField,
                      (e.target.value || undefined) as ColumnMapping['transform']
                    )
                  }
                >
                  <option value="">Auto</option>
                  <option value="string">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Refresh schedule</h4>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={schedule}
          onChange={(e) => onScheduleChange(e.target.value as ConnectorSchedule)}
        >
          <option value="manual">Manual only</option>
          <option value="on-open">On workbook open</option>
          <option value="daily">Daily (requires server)</option>
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main builder dialog
// ---------------------------------------------------------------------------

interface ConnectorBuilderProps {
  workbookId: string
}

export function ConnectorBuilder({ workbookId }: ConnectorBuilderProps) {
  const { builderOpen, activeConnectionId, connections, closeBuilder, createConnection, updateConnection } =
    useConnectorsStore()
  const { activeSheetId } = useWorkbookStore()

  // Resolve active connection (edit mode)
  const activeConn = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId) ?? null
    : null

  // Wizard state
  const [step, setStep] = useState(0)
  const [selectedKind, setSelectedKind] = useState<ConnectorKind | null>(
    activeConn?.connectorKind ?? null
  )
  const [config, setConfig] = useState<Record<string, unknown>>(activeConn?.config ?? {})
  const [mapping, setMapping] = useState<ColumnMapping[]>(activeConn?.mapping ?? [])
  const [schedule, setSchedule] = useState<ConnectorSchedule>(activeConn?.schedule ?? 'manual')
  const [previewResult, setPreviewResult] = useState<FetchResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const hasMounted = useRef(false)

  // Reset when opening
  useEffect(() => {
    if (!builderOpen) {
      hasMounted.current = false
      return
    }
    if (hasMounted.current) return
    hasMounted.current = true

    if (activeConn) {
      setStep(activeConn.connectorKind ? 1 : 0)
      setSelectedKind(activeConn.connectorKind)
      setConfig(activeConn.config)
      setMapping(activeConn.mapping)
      setSchedule(activeConn.schedule ?? 'manual')
    } else {
      setStep(0)
      setSelectedKind(null)
      setConfig({})
      setMapping([])
      setSchedule('manual')
    }
    setPreviewResult(null)
    setPreviewError(null)
  }, [builderOpen, activeConn])

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const loadPreview = useCallback(async () => {
    if (!selectedKind) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const connector = getConnector(selectedKind)
      const result = await connector.sample(config)
      setPreviewResult(result)
      // Auto-build mapping if not set
      if (mapping.length === 0 || mapping.length !== result.columns.length) {
        setMapping(buildDefaultMapping(result.columns))
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to fetch preview.')
    } finally {
      setPreviewLoading(false)
    }
  }, [selectedKind, config, mapping.length])

  // Auto-load preview when entering step 3
  useEffect(() => {
    if (step === 2 && selectedKind && !previewResult) {
      void loadPreview()
    }
  }, [step, selectedKind, previewResult, loadPreview])

  const canProceed = (): boolean => {
    if (step === 0) return selectedKind !== null
    if (step === 1) {
      if (!selectedKind) return false
      const connector = getConnector(selectedKind)
      return connector.configSchema
        .filter((f) => f.required)
        .every((f) => {
          const val = config[f.name]
          return val !== undefined && val !== null && String(val).trim() !== ''
        })
    }
    return true
  }

  const handleNext = async () => {
    if (step === 1) {
      // Transition to preview — load sample
      setStep(2)
    } else if (step < 2) {
      setStep(step + 1)
    }
  }

  const handleSave = () => {
    if (!selectedKind) return
    const sheetId = activeConn?.sheetId || activeSheetId

    if (activeConn) {
      updateConnection(activeConn.id, {
        connectorKind: selectedKind,
        config,
        mapping,
        schedule,
        workbookId,
        sheetId,
      })
    } else {
      createConnection({
        workbookId,
        sheetId,
        connectorKind: selectedKind,
        config,
        mapping,
        schedule,
      })
    }
    closeBuilder()
  }

  if (!builderOpen) return null

  const STEP_LABELS = ['Choose Source', 'Configure', 'Preview & Map']

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {activeConn ? 'Edit Data Connection' : 'Get Data'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Import external data directly into your sheet
            </p>
          </div>
          <button
            type="button"
            onClick={closeBuilder}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4">
          <StepIndicator current={step} total={3} labels={STEP_LABELS} />
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {step === 0 && (
            <Step1PickConnector
              selected={selectedKind}
              onSelect={(kind) => {
                setSelectedKind(kind)
                setConfig({})
                setPreviewResult(null)
              }}
            />
          )}
          {step === 1 && selectedKind && (
            <Step2Configure
              kind={selectedKind}
              config={config}
              onChange={handleConfigChange}
            />
          )}
          {step === 2 && selectedKind && (
            <Step3Preview
              result={previewResult}
              mapping={mapping}
              onMappingChange={setMapping}
              schedule={schedule}
              onScheduleChange={setSchedule}
              onRefresh={loadPreview}
              loading={previewLoading}
              error={previewError}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeBuilder}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            {step < 2 ? (
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={!canProceed()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={previewLoading}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <Check className="h-4 w-4" />
                {activeConn ? 'Save Changes' : 'Create Connection'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
