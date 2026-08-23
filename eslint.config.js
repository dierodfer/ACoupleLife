import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * SonarJS es el mismo motor de reglas que SonarCloud aplica a JS/TS, así que
 * pasar el linter aquí evita que los problemas lleguen al análisis remoto.
 */
export default tseslint.config(
  { ignores: ['dist', 'local-data', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      sonarjs.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // El código está en español y «todo» significa «all»: la regla lo toma por
      // un marcador de tarea pendiente en cada comentario que usa la palabra.
      'sonarjs/todo-tag': 'off',

      // `PersonaId`, `MesKey` y `FechaKey` son alias semánticos de `string`
      // documentados en tipos.ts: dicen qué formato lleva cada cadena.
      'sonarjs/redundant-type-aliases': 'off',

      // Prefijo `_` para parámetros que existen solo por firma (los mocks locales
      // reciben un fileId que no usan).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      // Los fixtures repiten importes y claves a propósito, para que cada test
      // se lea entero sin saltar a una constante compartida.
      'sonarjs/no-duplicate-string': 'off',
    },
  },
)
