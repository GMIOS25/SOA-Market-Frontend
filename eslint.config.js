import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'src/api/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // `npx shadcn add` có lúc sinh `import { cn } from "cn"` và tự cài 1 gói npm lạ tên "cn".
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'cn', message: 'Dùng `import { cn } from "@/lib/utils"` (shadcn CLI sinh sai alias).' }] },
      ],
    },
  },
  {
    // shadcn/ui primitives export variant helpers (buttonVariants...) alongside components by convention.
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
)
