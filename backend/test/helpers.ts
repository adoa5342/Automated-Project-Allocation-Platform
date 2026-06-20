process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/p42_test';
process.env.VITEST = process.env.VITEST || '1';

let serverPromise: Promise<typeof import('../src/server')> | null = null;
export async function getServer() {
  if (!serverPromise) {
    serverPromise = import('../src/server');
  }
  return serverPromise;
}

let utilsPromise: Promise<typeof import('../src/services/utils')> | null = null;
export async function getUtils() {
  if (!utilsPromise) {
    utilsPromise = import('../src/services/utils');
  }
  return utilsPromise;
}
