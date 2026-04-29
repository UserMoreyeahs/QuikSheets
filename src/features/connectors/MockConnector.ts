import type { Connector } from './types'

export const MockConnector: Connector = {
  id: 'mock',
  name: 'Mock data source',
  configSchema: [
    { name: 'rowCount', kind: 'number', required: true, label: 'Row count' },
  ],
  async fetch(config) {
    const rowCount = Number((config as { rowCount?: number }).rowCount ?? 5)
    const columns = ['Region', 'Sales Rep', 'Revenue']
    const regions = ['North', 'South', 'East', 'West']
    const reps = ['Asha', 'Ben', 'Chen', 'Diana']
    const rows: (string | number | boolean | null)[][] = []
    for (let i = 0; i < rowCount; i++) {
      rows.push([
        regions[i % regions.length] ?? 'North',
        reps[i % reps.length] ?? 'Asha',
        Math.round((10_000 + Math.random() * 90_000) * 100) / 100,
      ])
    }
    return { columns, rows }
  },
}
