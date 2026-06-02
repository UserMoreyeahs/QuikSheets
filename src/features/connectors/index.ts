/**
 * External Connectors — Public API
 *
 * Import from here rather than from internal module paths.
 *
 * Usage:
 *   import { ConnectorBuilder, useConnectorsStore, connectorList } from '@/features/connectors'
 */

// UI components
export { ConnectorBuilder } from './components/ConnectorBuilder'
export { ConnectionsPanel } from './components/ConnectionsPanel'

// Store
export { useConnectorsStore } from './store/connectorsStore'

// Connector registry & list
export { connectorList, connectorRegistry, getConnector } from './connectors/index'

// Individual connectors (for direct use in tests or server code)
export { csvUrlConnector } from './connectors/csvUrl'
export { jsonUrlConnector } from './connectors/jsonUrl'
export { googleSheetsPublicConnector } from './connectors/googleSheetsPublic'
export { postgresConnector } from './connectors/postgres'
export { restApiConnector } from './connectors/restApi'

// Utilities
export { applyMapping, buildDefaultMapping } from './utils/applyMapping'
export { inferColumnType, inferColumnTypes } from './utils/typeInferrer'

// Types
export type {
  Connector,
  ConnectorKind,
  ConnectorConnection,
  ConnectorSchedule,
  ConnectorConfigField,
  ConfigSchema,
  ColumnMapping,
  FetchResult,
  ColumnTypeHint,
  CellValue,
  ConnectorsStoreState,
  ConnectorsStoreActions,
} from './types'
