import { extraneousDependenciesPatterns } from '@lukasbriza/eslint-config/base'
import nestjs from '@lukasbriza/eslint-config/nestjs'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'prisma/**',
      '**/*.generated.*',
      'src/modules/prisma/generated/**',
      'schema.graphql',
      'migrations/**',
      'database/**',
    ],
  },
  ...nestjs,
  { files: ['**/*.{ts,tsx,cts,mts}'], languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  {
    // The shared list allows devDependencies in `tests/` and `*.spec.ts`. This app keeps its tests in `test/`, and the
    // shared helpers of the use case specs (`setup.ts`, ...) are not `*.spec.ts`, so the folder is allowed as a whole.
    files: ['test/**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        { devDependencies: [...extraneousDependenciesPatterns, '**/test/**/*'] },
      ],
    },
  },
  {
    rules: {
      'lines-between-class-members': ['error', { enforce: [{ blankLine: 'always', prev: 'method', next: 'method' }] }],
    },
  },
]
