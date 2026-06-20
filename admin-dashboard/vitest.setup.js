import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import axios from 'axios';

// Jest -> Vitest shim
// Provides common APIs used by teammate tests.
globalThis.jest = Object.assign(Object.create(null), vi, {
  fn: vi.fn,
  spyOn: vi.spyOn,
  mock: vi.mock,
  unmock: vi.unmock,
  doMock: vi.doMock,
  doUnmock: vi.doUnmock,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
});

// Make axios available globally for tests that spyOn without importing
globalThis.axios = axios;

// Polyfills required by react-hot-toast (and potential scroll usage)
if (!globalThis.window) globalThis.window = globalThis;
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}