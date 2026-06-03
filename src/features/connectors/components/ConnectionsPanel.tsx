'use client'

/**
 * ConnectionsPanel
 *
 * Displays the list of saved connector connections for the current workbook.
 * Accessible from Data > Get Data > Manage Connections.
 *
 * Features:
 *   - List all connections with kind icon, name, sheet target, last-synced time
 *   - "Sync now" button per connection (shows spinner while syncing)
 *   - "Edit" button opens the ConnectorBuilder in edit mode
 *   - "Delete" button removes the connection after confirmation
 *   - "Add Connection" shortcut button opens the builder in create mode
 */

import React from 'react'
import {
  Database,
  Globe,
  FileText,
  Table2,
  Zap,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { useConnectorsStore } from '../store/connectorsStore'
import type { ConnectorConnection, ConnectorKind } from '../types'

interface ConnectionsPanelProps {
  isOpen: boolean
  onClose: () => void
}

const KIND_ICONS: Record<ConnectorKind, React.ReactNode> = {
  'csv-url': <FileText className="h-4 w-4" />,
  'json-url': <Globe className="h-4 w-4" />,
  'google-sheets-public': <Table2 className="h-4 w-4" />,
  'postgres': <Database className="h-4 w-4" />,
  'rest-api': <Zap className="h-4 w-4" />,
}

const KIND_LABELS: Record<ConnectorKind, string> = {
  'csv-url': 'CSV URL',
  'json-url': 'JSON URL',
  'google-sheets-public': 'Google Sheets',
  'postgres': 'PostgreSQL',
  'rest-api': 'REST API',
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function ConnectionRow({ conn }: { conn: ConnectorConnection }) {
  const { runSync, openBuilder, deleteConnection, syncing, syncErrors } = useConnectorsStore()
  const isSyncing = syncing[conn.id] ?? false
  const syncError = syncErrors[conn.id] ?? ''

  function handleDelete() {
    if (window.confirm(`Delete connection "${KIND_LABELS[conn.connectorKind]}"? This cannot be undone.`)) {
      deleteConnection(conn.id)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
        {KIND_ICONS[conn.connectorKind]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {KIND_LABELS[conn.connectorKind]}
          </span>
          {conn.schedule && conn.schedule !== 'manual' && (
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              {conn.schedule === 'on-open' ? 'On open' : 'Daily'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 truncate">
            Last synced: {formatRelativeTime(conn.lastSyncedAt)}
          </span>
        </div>
        {syncError && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{syncError}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Sync */}
        <button
          type="button"
          onClick={() => void runSync(conn.id)}
          disabled={isSyncing}
          title="Sync now"
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-40"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>

        {/* Edit */}
        <button
          type="button"
          onClick={() => openBuilder(conn.id)}
          title="Edit connection"
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          <Pencil className="h-4 w-4" />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          title="Delete connection"
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function ConnectionsPanel({ isOpen, onClose }: ConnectionsPanelProps) {
  const { connections, openBuilder } = useConnectorsStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Data Connections</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          >
            ×
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {connections.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Database className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No connections yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Add a data source to import external data into your sheet.
              </p>
            </div>
          ) : (
            connections.map((conn) => <ConnectionRow key={conn.id} conn={conn} />)
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={() => { openBuilder(); onClose() }}
            className="flex items-center gap-2 w-full justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </button>
        </div>
      </div>
    </div>
  )
}
