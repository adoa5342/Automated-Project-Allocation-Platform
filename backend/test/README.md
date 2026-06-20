# Backend Tests

Unit & integration tests for the backend API:
Vitest & Supertest

## Test Files

- **`setup.ts`** - Global test configuration and environment setup
- **`auth.spec.ts`** - Authentication and protected route tests
- **`server.spec.ts`** - Basic server functionality tests  
- **`utils.spec.ts`** - Utility function tests (database operations, data fetching)
- **`importer.spec.ts`** - CSV data import functionality tests
- **`allocate.spec.ts`** - Project allocation algorithm integration tests
- **`database.spec.ts`** - Database maintenance endpoints (reset and record export)
- **`allocationHistory.spec.ts`** - Allocation history summaries and detail endpoints
- **`studentSurvey.spec.ts`** - Student survey catalog and submission endpoints
- **`helpers.ts`** - Shared utilities for loading the Express app and services within tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:cov
```
