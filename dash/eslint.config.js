import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['out', 'dist', 'node_modules', '*.config.js', '*.config.ts'] },

  // Base TS rules everywhere
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Renderer (React + DOM)
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // We're on the new JSX transform — no need for React in scope.
      'react/react-in-jsx-scope': 'off',
      // Tailwind classes generate a lot of literal strings; not useful here.
      'react/no-unknown-property': 'off',
    },
  },

  // Main / preload (Node + Electron)
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Prettier last so it can disable conflicting stylistic rules.
  prettier,
);
