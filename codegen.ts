import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'src/schema/**/*.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/generated/**/*'],
  generates: {
    './src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-resolvers'
      ],
      config: {
        contextType: '../types#GitIgnoreContext',
        enumsAsTypes: true,
        immutableTypes: true,
        useIndexSignature: true
      }
    }
  }
}

export default config
