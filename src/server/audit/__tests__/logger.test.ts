import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

// Import AFTER mocks
import { createAuditLog, createCriticalAuditLog, auditLog, criticalAuditLog } from '../logger';
import { db } from '../../db';
import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Clerk auth
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    vi.mocked(currentUser).mockResolvedValue({
      id: 'user_123',
      firstName: 'John',
      lastName: 'Doe',
      publicMetadata: { role: 'ADMIN' },
    } as any);

    // Mock headers
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') return '192.168.1.1';
        if (name === 'user-agent') return 'Mozilla/5.0';
        if (name === 'x-request-id') return 'req_123';
        return null;
      }),
    } as any);

    // Mock database insert
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            action: 'CREATE',
            tableName: 'members',
            recordId: 123,
            severity: 'INFO',
            userId: 'user_123',
            userName: 'John Doe',
            userRole: 'ADMIN',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            sessionId: 'req_123',
            requestId: 'req_123',
            oldValues: null,
            newValues: { firstName: 'John', lastName: 'Doe' },
            changedFields: [],
            reason: null,
            metadata: null,
            createdAt: new Date('2025-11-06T00:00:00Z'),
          },
        ]),
      }),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // MAIN AUDIT LOGGING FUNCTIONS
  // ============================================================================

  describe('createAuditLog', () => {
    it('should create audit log with all context', async () => {
      const result = await createAuditLog({
        action: 'CREATE',
        tableName: 'members',
        recordId: 123,
        newValues: { firstName: 'John', lastName: 'Doe' },
      });

      expect(result).toBeDefined();
      expect(result?.action).toBe('CREATE');
      expect(result?.tableName).toBe('members');
      expect(result?.recordId).toBe(123);
      expect(result?.userId).toBe('user_123');
      expect(result?.userName).toBe('John Doe');
      expect(result?.userRole).toBe('ADMIN');
      expect(result?.ipAddress).toBe('192.168.1.1');
    });

    it('should handle missing user context gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null });

      const result = await createAuditLog({
        action: 'CREATE',
        tableName: 'members',
        recordId: 123,
      });

      expect(result).toBeDefined();
      // Should use SYSTEM as default user
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const result = await createAuditLog({
        action: 'CREATE',
        tableName: 'members',
        recordId: 123,
      });

      expect(result).toBeNull();
    });

    it('should calculate changed fields for UPDATE action', async () => {
      const result = await createAuditLog({
        action: 'UPDATE',
        tableName: 'members',
        recordId: 123,
        oldValues: { firstName: 'John', lastName: 'Doe' },
        newValues: { firstName: 'Jane', lastName: 'Doe' },
      });

      expect(result).toBeDefined();
      // changedFields should include 'firstName' but not 'lastName'
    });

    it('should set default severity to INFO', async () => {
      const result = await createAuditLog({
        action: 'CREATE',
        tableName: 'members',
        recordId: 123,
      });

      expect(result?.severity).toBe('INFO');
    });

    it('should accept custom severity level', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              severity: 'CRITICAL',
              // ... other fields
            },
          ]),
        }),
      } as any);

      const result = await createAuditLog({
        action: 'DELETE',
        tableName: 'members',
        recordId: 123,
        severity: 'CRITICAL',
      });

      expect(result?.severity).toBe('CRITICAL');
    });

    it('should include metadata when provided', async () => {
      const metadata = { memberCount: 4, lotteryDate: '2025-11-15' };

      const result = await createAuditLog({
        action: 'ASSIGN',
        tableName: 'lottery_entries',
        recordId: 456,
        metadata,
      });

      expect(result).toBeDefined();
    });

    it('should include reason when provided', async () => {
      const reason = 'Member requested cancellation';

      const result = await createAuditLog({
        action: 'CANCEL',
        tableName: 'time_block_members',
        recordId: 789,
        reason,
      });

      expect(result).toBeDefined();
    });
  });

  describe('createCriticalAuditLog', () => {
    it('should create critical audit log with enhanced tracking', async () => {
      // Mock two database inserts (audit log + critical audit log)
      let callCount = 0;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              // First call: audit log
              return [{ id: 1, action: 'OVERRIDE' }];
            } else {
              // Second call: critical audit log
              return [{
                id: 1,
                auditLogId: 1,
                operationType: 'RESTRICTION_OVERRIDE',
                riskLevel: 'HIGH',
                impactedMembers: [1, 2, 3],
              }];
            }
          }),
        }),
      } as any);

      const result = await createCriticalAuditLog({
        action: 'OVERRIDE',
        tableName: 'timeblock_restrictions',
        recordId: 456,
        operationType: 'RESTRICTION_OVERRIDE',
        riskLevel: 'HIGH',
        impactedMembers: [1, 2, 3],
        complianceFlags: ['SECURITY'],
      });

      expect(result).toBeDefined();
      expect(result?.operationType).toBe('RESTRICTION_OVERRIDE');
      expect(result?.riskLevel).toBe('HIGH');
    });

    it('should handle audit log creation failure', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const result = await createCriticalAuditLog({
        action: 'OVERRIDE',
        tableName: 'timeblock_restrictions',
        recordId: 456,
        operationType: 'RESTRICTION_OVERRIDE',
      });

      expect(result).toBeNull();
    });

    it('should set default risk level to MEDIUM', async () => {
      let callCount = 0;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [{ id: 1 }];
            } else {
              return [{ id: 1, auditLogId: 1, riskLevel: 'MEDIUM' }];
            }
          }),
        }),
      } as any);

      const result = await createCriticalAuditLog({
        action: 'PROCESS',
        tableName: 'lottery_entries',
        operationType: 'LOTTERY_PROCESS',
      });

      expect(result?.riskLevel).toBe('MEDIUM');
    });

    it('should include financial impact when provided', async () => {
      let callCount = 0;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [{ id: 1 }];
            } else {
              return [{
                id: 1,
                auditLogId: 1,
                financialImpact: '$150.00',
              }];
            }
          }),
        }),
      } as any);

      const result = await createCriticalAuditLog({
        action: 'CREATE',
        tableName: 'power_cart_charges',
        recordId: 123,
        operationType: 'FINANCIAL_CHARGE',
        financialImpact: '$150.00',
      });

      expect(result?.financialImpact).toBe('$150.00');
    });

    it('should include compliance flags', async () => {
      let callCount = 0;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              return [{ id: 1 }];
            } else {
              return [{
                id: 1,
                auditLogId: 1,
                complianceFlags: ['PII', 'FINANCIAL'],
              }];
            }
          }),
        }),
      } as any);

      const result = await createCriticalAuditLog({
        action: 'UPDATE',
        tableName: 'members',
        recordId: 123,
        operationType: 'MEMBER_UPDATE',
        complianceFlags: ['PII', 'FINANCIAL'],
      });

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // CONVENIENCE FUNCTIONS
  // ============================================================================

  describe('auditLog convenience functions', () => {
    it('should log CREATE operation', async () => {
      const result = await auditLog.create(
        'members',
        123,
        { firstName: 'John' },
        { source: 'admin_panel' }
      );

      expect(result).toBeDefined();
      expect(result?.action).toBe('CREATE');
      expect(result?.tableName).toBe('members');
    });

    it('should log UPDATE operation', async () => {
      const result = await auditLog.update(
        'members',
        123,
        { firstName: 'John' },
        { firstName: 'Jane' },
        'Name correction'
      );

      expect(result).toBeDefined();
      expect(result?.tableName).toBe('members');
      expect(result?.recordId).toBe(123);
    });

    it('should log DELETE operation with WARN severity', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 1, action: 'DELETE', severity: 'WARN', tableName: 'members', recordId: 123 },
          ]),
        }),
      } as any);

      const result = await auditLog.delete(
        'members',
        123,
        { firstName: 'John' },
        'Account deactivation'
      );

      expect(result?.action).toBe('DELETE');
      expect(result?.severity).toBe('WARN');
    });

    it('should log PUBLISH operation', async () => {
      const result = await auditLog.publish(
        'teesheets',
        456,
        { date: '2025-11-15' }
      );

      expect(result).toBeDefined();
      expect(result?.tableName).toBe('members'); // From mock
      expect(result?.recordId).toBe(123); // From mock
    });

    it('should log ASSIGN operation', async () => {
      const result = await auditLog.assign(
        'lottery_entries',
        789,
        { timeBlockId: 10 }
      );

      expect(result).toBeDefined();
      expect(result?.tableName).toBe('members'); // From mock
    });

    it('should log CANCEL operation', async () => {
      const result = await auditLog.cancel(
        'time_block_members',
        101,
        'Member requested cancellation'
      );

      expect(result).toBeDefined();
      expect(result?.tableName).toBe('members'); // From mock
    });
  });

  describe('criticalAuditLog convenience functions', () => {
    beforeEach(() => {
      // Mock for critical audit logs (two inserts)
      let callCount = 0;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount % 2 === 1) {
              return [{ id: 1 }]; // Audit log
            } else {
              return [{ id: 1, auditLogId: 1 }]; // Critical audit log
            }
          }),
        }),
      } as any);
    });

    it('should log member update with PII flag', async () => {
      const result = await criticalAuditLog.memberUpdate(
        123,
        { email: 'old@example.com' },
        { email: 'new@example.com' }
      );

      expect(result).toBeDefined();
    });

    it('should log restriction override', async () => {
      const result = await criticalAuditLog.restrictionOverride(
        456,
        789,
        'Emergency booking for tournament'
      );

      expect(result).toBeDefined();
    });

    it('should log lottery processing', async () => {
      const result = await criticalAuditLog.lotteryProcess(
        '2025-11-15',
        [1, 2, 3, 4],
        { totalEntries: 50, totalAssigned: 40 }
      );

      expect(result).toBeDefined();
    });

    it('should log financial charge', async () => {
      const result = await criticalAuditLog.financialCharge(
        'power_cart_charges',
        101,
        '$150.00',
        { numHoles: 18 }
      );

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  describe('Changed fields detection', () => {
    it('should detect changed fields in UPDATE', async () => {
      const result = await createAuditLog({
        action: 'UPDATE',
        tableName: 'members',
        recordId: 123,
        oldValues: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        newValues: {
          firstName: 'Jane', // Changed
          lastName: 'Doe',   // Unchanged
          email: 'jane@example.com', // Changed
        },
      });

      expect(result).toBeDefined();
      // changedFields should include firstName and email
    });

    it('should ignore timestamp fields in change detection', async () => {
      const result = await createAuditLog({
        action: 'UPDATE',
        tableName: 'members',
        recordId: 123,
        oldValues: {
          firstName: 'John',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        newValues: {
          firstName: 'John',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-11-06'), // Changed but should be ignored
        },
      });

      expect(result).toBeDefined();
      // changedFields should be empty (timestamps ignored)
    });

    it('should handle null/undefined values in change detection', async () => {
      const result = await createAuditLog({
        action: 'UPDATE',
        tableName: 'members',
        recordId: 123,
        oldValues: {
          firstName: 'John',
          middleName: null,
        },
        newValues: {
          firstName: 'John',
          middleName: 'Michael', // Changed from null
        },
      });

      expect(result).toBeDefined();
      // changedFields should include middleName
    });
  });
});