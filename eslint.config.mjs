import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const ignores = {
  ignores: [
    '.playwright-verify.spec.ts',
    '.next/**',
    'node_modules/**',
    'test-results/**',
    'coverage/**',
    'next-env.d.ts',
  ],
}

const projectRules = {
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
    'react-hooks/set-state-in-effect': 'off',
  },
}

const config = [...nextCoreWebVitals, ...nextTypescript, ignores, projectRules]

export default config
