import { describe, it, expect } from 'vitest';
import {
  createSuccessResult,
  createErrorResult,
  createDateString,
} from './test-helpers';
import {
  createMockMember,
  createMockTeesheet,
  createMockTimeBlock,
} from './db-mock';

describe('Test Utilities', () => {
  describe('Mock Helpers', () => {
    it('should create mock member with default values', () => {
      const member = createMockMember();
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('firstName', 'Test');
      expect(member).toHaveProperty('lastName', 'Member');
      expect(member).toHaveProperty('email');
    });

    it('should create mock member with overrides', () => {
      const member = createMockMember({ firstName: 'John', lastName: 'Doe' });
      expect(member.firstName).toBe('John');
      expect(member.lastName).toBe('Doe');
    });

    it('should create mock teesheet', () => {
      const teesheet = createMockTeesheet();
      expect(teesheet).toHaveProperty('id');
      expect(teesheet).toHaveProperty('date');
      expect(teesheet).toHaveProperty('published');
    });

    it('should create mock time block', () => {
      const timeBlock = createMockTimeBlock();
      expect(timeBlock).toHaveProperty('id');
      expect(timeBlock).toHaveProperty('startTime');
      expect(timeBlock).toHaveProperty('maxMembers', 4);
    });
  });

  describe('Result Helpers', () => {
    it('should create success result', () => {
      const result = createSuccessResult({ id: 1 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });
    });

    it('should create error result', () => {
      const result = createErrorResult('Test error');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('Date Helpers', () => {
    it('should create date string for today', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = createDateString(0);
      expect(result).toBe(today);
    });

    it('should create date string for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = tomorrow.toISOString().split('T')[0];
      const result = createDateString(1);
      expect(result).toBe(expected);
    });

    it('should create date string for past date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expected = yesterday.toISOString().split('T')[0];
      const result = createDateString(-1);
      expect(result).toBe(expected);
    });
  });
});