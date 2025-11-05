import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CLERK_SECRET_KEY = 'test_secret_key';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test_publishable_key';
process.env.WEATHER_API_KEY = 'test_weather_key';
process.env.CRON_SECRET = 'test_cron_secret';
process.env.VAPID_PRIVATE_KEY = 'test_vapid_private';
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test_vapid_public';
process.env.DEFAULT_LAT = '49.2827';
process.env.DEFAULT_LON = '-123.1207';
process.env.NODE_ENV = 'test';
process.env.SKIP_ENV_VALIDATION = '1';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};