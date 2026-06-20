// Vitest global setup for backend tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Provide a harmless default to avoid Prisma env checks during tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/p42_test';

import { afterEach, vi } from 'vitest';

// Reset spies/mocks between tests to avoid bleed-over
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

