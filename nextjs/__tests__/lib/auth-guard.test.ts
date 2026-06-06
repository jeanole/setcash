/**
 * Unit tests for verifyAdminRole helper (SEC-02)
 *
 * Tests DB role re-verification and force re-auth on demotion.
 */

// Mock next/headers cookies
const mockDelete = jest.fn();
const mockCookies = jest.fn().mockResolvedValue({ delete: mockDelete });
jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

// Mock @/lib/db
const mockUserFindUnique = jest.fn();
const mockProjectMemberFindUnique = jest.fn();
jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    projectMember: { findUnique: (...args: unknown[]) => mockProjectMemberFindUnique(...args) },
  },
}));

import { verifyAdminRole } from '@/lib/auth-guard';

describe('verifyAdminRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return authorized when DB role is admin and matches JWT', async () => {
    mockUserFindUnique.mockResolvedValue({ isSuperAdmin: false });
    mockProjectMemberFindUnique.mockResolvedValue({ role: 'admin' });

    const result = await verifyAdminRole('user@example.com', 'project-1');

    expect(result.authorized).toBe(true);
    expect(result.response).toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should return authorized when DB role is owner', async () => {
    mockUserFindUnique.mockResolvedValue({ isSuperAdmin: false });
    mockProjectMemberFindUnique.mockResolvedValue({ role: 'owner' });

    const result = await verifyAdminRole('owner@example.com', 'project-1');

    expect(result.authorized).toBe(true);
    expect(result.response).toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should return authorized when user is superadmin in DB', async () => {
    mockUserFindUnique.mockResolvedValue({ isSuperAdmin: true });

    const result = await verifyAdminRole('superadmin@example.com', 'project-1');

    expect(result.authorized).toBe(true);
    expect(result.response).toBeUndefined();
    // Should not even check project membership for superadmin
    expect(mockProjectMemberFindUnique).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should return unauthorized with 401 and delete cookies when DB role is user but JWT claims admin (demotion detected)', async () => {
    mockUserFindUnique.mockResolvedValue({ isSuperAdmin: false });
    mockProjectMemberFindUnique.mockResolvedValue({ role: 'user' });

    const result = await verifyAdminRole('demoted@example.com', 'project-1');

    expect(result.authorized).toBe(false);
    expect(result.response).toBeDefined();

    // Verify 401 status (not 403 - per D-04)
    expect(result.response!.status).toBe(401);

    // Verify response body contains ROLE_CHANGED code
    const body = await result.response!.json();
    expect(body.code).toBe('ROLE_CHANGED');
    expect(body.error).toContain('role changed');

    // Verify both cookie variants are deleted
    expect(mockDelete).toHaveBeenCalledWith('authjs.session-token');
    expect(mockDelete).toHaveBeenCalledWith('__Secure-authjs.session-token');
  });

  it('should return unauthorized with 401 when user has no project membership', async () => {
    mockUserFindUnique.mockResolvedValue({ isSuperAdmin: false });
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const result = await verifyAdminRole('removed@example.com', 'project-1');

    expect(result.authorized).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(401);

    const body = await result.response!.json();
    expect(body.code).toBe('ROLE_CHANGED');

    // Verify both cookie variants are deleted
    expect(mockDelete).toHaveBeenCalledWith('authjs.session-token');
    expect(mockDelete).toHaveBeenCalledWith('__Secure-authjs.session-token');
  });
});
