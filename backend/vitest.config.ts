import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/p42_test',
    },
    coverage: {
      enabled: true,
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/seed.ts',
        'src/types.ts',
        'src/routes/import.ts',
        'src/routes/survey.ts',
        'src/services/importer.ts',
        'src/**/__mocks__/**',
        'src/**/__generated__/**',
        'src/**/*.d.ts',
        'src/**/index.ts',
      ],
    },
  },
});
