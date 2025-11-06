import { defineConfig } from 'vitest/config';

import react from '@vitejs/plugin-react';

import path from 'path';

 

export default defineConfig({

  plugins: [react()],

  test: {
    pool: 'threads',

    environment: 'happy-dom',

    globals: true,

    setupFiles: ['./src/__tests__/setup.ts'],

    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],

    exclude: ['node_modules', 'dist', '.next', 'coverage'],

    coverage: {

      provider: 'v8',

      reporter: ['text', 'json', 'html', 'lcov'],

      exclude: [

        'node_modules/',

        'src/__tests__/',

        '**/*.config.{js,ts}',

        '**/types/**',

        '**/*.d.ts',

        '.next/',

        'coverage/',

      ],

      thresholds: {

        lines: 70,

        functions: 70,

        branches: 70,

        statements: 70,

      },

    },

  },

  resolve: {

    alias: {

      '~': path.resolve(__dirname, './src'),

    },

  },

});