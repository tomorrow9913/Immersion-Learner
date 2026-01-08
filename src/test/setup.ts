import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

Object.defineProperty(globalThis, 'chrome', {
  value: {
    runtime: {
      sendMessage: vi.fn(),
      getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      id: 'test-extension-id',
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contextMenus: {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn(),
      onClicked: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
  writable: true,
});

Object.defineProperty(globalThis.URL, 'createObjectURL', {
  value: vi.fn(() => 'mocked-blob-url'),
  writable: true,
});

Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
  writable: true,
});

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
  writable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});