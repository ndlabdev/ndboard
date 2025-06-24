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
            '@stylistic/quote-props': ['error', 'as-needed'],
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/arrow-parens': ['error', 'always'],
            '@stylistic/space-before-blocks': ['error', 'always'],
            '@stylistic/space-before-function-paren': ['error', 'never'],
            '@stylistic/space-in-parens': ['error', 'never'],
            '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/space-unary-ops': ['error', { words: true, nonwords: false }],
            '@stylistic/padded-blocks': ['error', 'never'],
            '@stylistic/block-spacing': ['error', 'always'],
            '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
            '@stylistic/object-curly-newline': [
                'error',
                {
                    ObjectExpression: { multiline: true, minProperties: 1 },
                    ImportDeclaration: { minProperties: 2 },
                    ExportDeclaration: 'never'
                }
            ],
            '@stylistic/array-element-newline': [
                'error',
                { multiline: true, minItems: 5 }
            ],
            '@stylistic/function-paren-newline': ['error', 'consistent'],
            '@stylistic/member-delimiter-style': [
                'error',
                {
                    multiline: { delimiter: 'semi', requireLast: true },
                    singleline: { delimiter: 'semi', requireLast: false }
                }
            ],
            '@stylistic/max-statements-per-line': ['error', { max: 1 }],
            '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }]
        }
    }
]