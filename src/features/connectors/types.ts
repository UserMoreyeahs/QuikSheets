/**
 * External Connectors — Type Definitions
 *
 * Models the full "Get Data" connector system, mirroring Excel's Power Query
 * experience. A `Connector` describes how to fetch data from a specific source.
 * A `ConnectorConnection` persists the user's configuration for a particular
 * workbook + sheet pair.
 *
 * Credential security:
 *   Any field with `kind === "secret"` in `configSchema` MUST be stored
 *   encrypted in Supabase (config_json column on connector_connections table,
 *   server-side only). Plaintext secrets are NEVER written to localStorage.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** All supported connector back-ends. */
export type ConnectorKind =
  | 'csv-url'
  | 'json-url'
  | 'google-sheets-public'
  | 'postgres'
  | 'rest-api'

/** How often the connection should automatically re-sync. */
export type ConnectorSchedule = 'manual' | 'on-open' | 'daily'

/** Value types that can appear in a fetched row. */
export type CellValue = string | number | boolean | null

// ---------------------------------------------------------------------------
// JSON-Schema–lite field descriptor
// ---------------------------------------------------------------------------

/**
 * Describes a single user-facing config field for a connector.
 *
 * `kind === 'secret'` signals that the value must NOT be stored in localStorage
 * and must be encrypted server-side via the Supabase service-role client.
 */
export interface ConnectorConfigField {
  /** Machine name — used as the key in the config object. */
  name: string
  /** UI label shown to the user. */
  label: string
  /** Data type + rendering hint. */
  kind: 'string' | 'number' | 'boolean' | 'secret' | 'textarea'
  /** Whether the user must supply a value. */
  required: boolean
  /** Placeholder / hint shown inside the input. */
  placeholder?: string
  /** Default value pre-filled in the wizard. */
  defaultValue?: string | number | boolean
}

/** Minimal JSONSchema-compatible config schema (array of field descriptors). */
export type ConfigSchema = ConnectorConfigField[]

// ---------------------------------------------------------------------------
// Connector interface
// ---------------------------------------------------------------------------

/**
 * A pluggable data-source adapter.
 *
 * Each connector is a plain-object module (no class instantiation needed) that
 * knows how to:
 *   1. Describe its configuration requirements (`configSchema`).
 *   2. Fetch a small sample for the preview step (`sample`).
 *   3. Fetch the full dataset (`fetch`).
 *
 * The `fetch` return type intentionally mirrors `Connector.sample` so that
 * preview and full-load share the same rendering path.
 */
export interface FetchResult {
  /** Ordered column display names. */
  columns: string[]
  /** Rows; each inner array aligns with `columns`. */
  rows: CellValue[][]
  /**
   * Detected per-column type hints. Length === columns.length.
   * Used in the column-mapping step to pre-fill transform selectors.
   */
  columnTypes: ColumnTypeHint[]
  /** How many rows were returned. */
  rowCount: number
}

/** Broad type hint for a column, inferred from sampled values. */
export type ColumnTypeHint = 'string' | 'number' | 'boolean' | 'date' | 'mixed'

export interface Connector<TConfig = Record<string, unknown>> {
  /** Unique stable identifier (matches `ConnectorKind`). */
  readonly id: ConnectorKind
  /** Human-readable display name shown in the picker. */
  readonly name: string
  /** Short description shown below the name in the picker. */
  readonly description: string
  /** Fields the user must fill in to configure this connector. */
  readonly configSchema: ConfigSchema
  /**
   * Fetch a small preview sample (≤ 20 rows) for the wizard's preview step.
   * Should be fast — called on every config change in the wizard.
   */
  sample(config: TConfig): Promise<FetchResult>
  /**
   * Fetch the full dataset.
   * Called when the user clicks "Sync now" or the schedule fires.
   */
  fetch(config: TConfig): Promise<FetchResult>
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/**
 * Maps one source field (by name or index) to a target sheet column (0-based).
 * An optional `transform` coerces the raw string value before writing to the cell.
 */
export interface ColumnMapping {
  /** Source field name (from `FetchResult.columns`). */
  sourceField: string
  /** 0-based column index in the destination sheet. */
  targetColumn: number
  /** Optional coercion applied before writing to the cell. */
  transform?: 'date' | 'number' | 'string' | 'boolean'
}

// ---------------------------------------------------------------------------
// Persisted connection record
// ---------------------------------------------------------------------------

/**
 * A saved connector configuration for a specific workbook + sheet.
 * Stored in Supabase `connector_connections` table (with RLS) and mirrored
 * to localStorage for offline use (secrets are OMITTED from the localStorage copy).
 */
export interface ConnectorConnection {
  /** UUID — generated on create. */
  id: string
  /** FK → workbooks.id */
  workbookId: string
  /** FK → sheet ID within the workbook. */
  sheetId: string
  /** Which connector back-end powers this connection. */
  connectorKind: ConnectorKind
  /**
   * Connector-specific configuration.
   * Fields marked `kind === 'secret'` in the connector's `configSchema`
   * are stored ONLY in Supabase (never in localStorage).
   */
  config: Record<string, unknown>
  /** Column mapping from source fields → sheet columns. */
  mapping: ColumnMapping[]
  /** Refresh schedule. Defaults to "manual". */
  schedule?: ConnectorSchedule
  /** ISO timestamp of the most recent successful sync. */
  lastSyncedAt?: string
  /** ISO timestamp when this connection was created. */
  createdAt: string
}

// ---------------------------------------------------------------------------
// Store shape (for connectorsStore.ts)
// ---------------------------------------------------------------------------

export interface ConnectorsStoreState {
  /** All connections for the current workbook. */
  connections: ConnectorConnection[]
  /** Whether the builder dialog is open. */
  builderOpen: boolean
  /** Connection being edited (null = creating a new one). */
  activeConnectionId: string | null
  /** Whether a sync is currently in flight. Keyed by connection id. */
  syncing: Record<string, boolean>
  /** Last sync error per connection id. */
  syncErrors: Record<string, string>
}

export interface ConnectorsStoreActions {
  /** Load connections from localStorage (Supabase sync happens separately). */
  loadConnections: (workbookId: string) => void
  /** Add a new connection (persisted immediately). */
  createConnection: (conn: Omit<ConnectorConnection, 'id' | 'createdAt'>) => ConnectorConnection
  /** Update an existing connection. */
  updateConnection: (id: string, updates: Partial<Omit<ConnectorConnection, 'id'>>) => void
  /** Remove a connection. */
  deleteConnection: (id: string) => void
  /** Execute a sync for the given connection and write rows into the sheet. */
  runSync: (id: string) => Promise<void>
  /** Open the builder dialog (optionally pre-selecting a connection to edit). */
  openBuilder: (connectionId?: string) => void
  /** Close the builder dialog. */
  closeBuilder: () => void
  /** Set which connection is active in the builder. */
  setActive: (id: string | null) => void
}
