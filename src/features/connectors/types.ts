export interface ConnectorConfigField {
  name: string
  kind: 'string' | 'number' | 'boolean' | 'secret'
  required: boolean
  label: string
}

export interface Connector<TConfig = Record<string, unknown>> {
  readonly id: string
  readonly name: string
  readonly configSchema: ConnectorConfigField[]
  fetch(config: TConfig): Promise<{
    columns: string[]
    rows: (string | number | boolean | null)[][]
  }>
}
