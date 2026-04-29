import { HyperFormula } from 'hyperformula'
import type { ConfigParams } from 'hyperformula'

export const HYPERFORMULA_CONFIG = {
  licenseKey: 'gpl-v3',
  precisionRounding: 10,
  useColumnIndex: false,
  useStats: false,
  evaluateNullToZero: false,
  nullYear: 30,
  dateFormats: ['MM/DD/YYYY', 'MM/DD/YY', 'YYYY/MM/DD'],
  timeFormats: ['hh:mm', 'hh:mm:ss.sss'],
  currencySymbol: ['$', 'Rs', 'EUR', 'GBP'],
  localeLang: 'en',
  decimalSeparator: '.',
} as const satisfies Partial<ConfigParams>

let instance: HyperFormula | null = null

export function getHyperFormulaInstance(): HyperFormula {
  if (!instance) {
    instance = HyperFormula.buildEmpty(HYPERFORMULA_CONFIG)
  }

  return instance
}

export function destroyHyperFormulaInstance(): void {
  if (instance) {
    instance.destroy()
    instance = null
  }
}
