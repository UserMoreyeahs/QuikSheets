/**
 * Connector registry
 *
 * All connector implementations are registered here.  The wizard picker and
 * the runSync action both import from this file — keeping instantiation in one
 * place prevents duplicate fetching logic.
 */

import type { Connector, ConnectorKind } from '../types'
import { csvUrlConnector } from './csvUrl'
import { jsonUrlConnector } from './jsonUrl'
import { googleSheetsPublicConnector } from './googleSheetsPublic'
import { postgresConnector } from './postgres'
import { restApiConnector } from './restApi'

/** All registered connectors, keyed by their `ConnectorKind` id. */
export const connectorRegistry: Record<ConnectorKind, Connector> = {
  'csv-url': csvUrlConnector as unknown as Connector,
  'json-url': jsonUrlConnector as unknown as Connector,
  'google-sheets-public': googleSheetsPublicConnector as unknown as Connector,
  'postgres': postgresConnector as unknown as Connector,
  'rest-api': restApiConnector as unknown as Connector,
}

/** Ordered list for the picker UI (most common first). */
export const connectorList: Connector[] = [
  csvUrlConnector as unknown as Connector,
  jsonUrlConnector as unknown as Connector,
  googleSheetsPublicConnector as unknown as Connector,
  restApiConnector as unknown as Connector,
  postgresConnector as unknown as Connector,
]

/** Resolve a connector by kind, or throw if unknown. */
export function getConnector(kind: ConnectorKind): Connector {
  const connector = connectorRegistry[kind]
  if (!connector) throw new Error(`Unknown connector kind: ${kind}`)
  return connector
}

export { csvUrlConnector } from './csvUrl'
export { jsonUrlConnector } from './jsonUrl'
export { googleSheetsPublicConnector } from './googleSheetsPublic'
export { postgresConnector } from './postgres'
export { restApiConnector } from './restApi'
