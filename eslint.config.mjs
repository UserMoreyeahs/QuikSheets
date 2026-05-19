import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const config = [
  {
    ignores: [
      '.playwright-verify.spec.ts',
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
      'next-env.d.ts',
      // Git worktrees contain duplicate copies of the repo that lint would
      // double-scan and report thousands of false errors against. The
      // worktrees have their own checkout-local lint config if needed.
      '.claude/**',
      '.clone/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', argsIgnorePattern: '^_' }],
    },
  },
]

export default config
