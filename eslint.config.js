import stylistic from '@stylistic/eslint-plugin'
import ts from 'typescript-eslint'

export default [
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: ts.parser,
            parserOptions: {
                project: './tsconfig.json',
                sourceType: 'module'
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/semi': ['error', 'never'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/comma-dangle': ['error', 'never'],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/comma-spacing': ['error', { before: false, after: true }],
            '@stylistic/quote-props': ['error', 'as-needed']
        }
    }
]