// Mock for 'server-only' package in Vitest test environment.
// The real package throws at import time if loaded client-side.
// In Vitest (Node environment) we simply export nothing.
export {};
