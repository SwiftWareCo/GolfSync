/**

 * Authorization Helper Functions

 *

 * Provides reusable authorization checks for server actions and API routes.

 * Implements role-based access control (RBAC) and ownership verification.

 */

 

import { auth } from "@clerk/nextjs/server";

import { db } from "~/server/db";

import { members } from "~/server/db/schema";

import { eq } from "drizzle-orm";

 

// ============================================================================

// TYPES

// ============================================================================

 

export type AuthenticatedUser = {

  userId: string;

  sessionClaims: any;

  isAdmin: boolean;

  isMember: boolean;

  memberId: string | null;

};

 

export type AuthorizationError = {

  code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND";

  message: string;

  status: 401 | 403 | 404;

};

 

// ============================================================================

// CORE AUTHENTICATION

// ============================================================================

 

/**

 * Get authenticated user with role information

 * @throws {Error} If user is not authenticated

 */

export async function getAuthUser(): Promise<AuthenticatedUser> {

  const { userId, sessionClaims } = await auth();

 

  if (!userId) {

    const error: AuthorizationError = {

      code: "UNAUTHORIZED",

      message: "Authentication required",

      status: 401,

    };

    throw new Error(JSON.stringify(error));

  }

 

  const isAdmin = (sessionClaims as any)?.publicMetadata?.isAdmin === true;

  const isMember = (sessionClaims as any)?.publicMetadata?.isMember === true;

  const memberId = (sessionClaims as any)?.publicMetadata?.memberId || null;

 

  return {

    userId,

    sessionClaims,

    isAdmin,

    isMember,

    memberId,

  };

}

 

/**

 * Check if user is authenticated (non-throwing version)

 */

export async function isAuthenticated(): Promise<boolean> {

  try {

    await getAuthUser();

    return true;

  } catch {

    return false;

  }

}

 

// ============================================================================

// ROLE-BASED AUTHORIZATION

// ============================================================================

 

/**

 * Require user to be authenticated

 * @throws {Error} If user is not authenticated

 */

export async function requireAuth(): Promise<AuthenticatedUser> {

  return await getAuthUser();

}

 

/**

 * Require user to be an admin

 * @throws {Error} If user is not authenticated or not an admin

 */

export async function requireAdmin(): Promise<AuthenticatedUser> {

  const user = await getAuthUser();

 

  if (!user.isAdmin) {

    const error: AuthorizationError = {

      code: "FORBIDDEN",

      message: "Admin access required",

      status: 403,

    };

    throw new Error(JSON.stringify(error));

  }

 

  return user;

}

 

/**

 * Require user to be a member

 * @throws {Error} If user is not authenticated or not a member

 */

export async function requireMember(): Promise<AuthenticatedUser> {

  const user = await getAuthUser();

 

  if (!user.isMember && !user.isAdmin) {

    const error: AuthorizationError = {

      code: "FORBIDDEN",

      message: "Member access required",

      status: 403,

    };

    throw new Error(JSON.stringify(error));

  }

 

  return user;

}

 

/**

 * Require user to be either admin or member

 * @throws {Error} If user is not authenticated or lacks permissions

 */

export async function requireAdminOrMember(): Promise<AuthenticatedUser> {

  const user = await getAuthUser();

 

  if (!user.isAdmin && !user.isMember) {

    const error: AuthorizationError = {

      code: "FORBIDDEN",

      message: "Admin or member access required",

      status: 403,

    };

    throw new Error(JSON.stringify(error));

  }

 

  return user;

}

 

// ============================================================================

// OWNERSHIP VERIFICATION

// ============================================================================

 

/**

 * Verify user owns the specified member record

 * Admins can access any member record

 * Members can only access their own record

 *

 * @param memberId - The member ID to verify ownership of

 * @throws {Error} If user doesn't own the member record

 */

export async function requireMemberOwnership(

  memberId: number | string

): Promise<AuthenticatedUser> {

  const user = await getAuthUser();

 

  // Admins can access any member

  if (user.isAdmin) {

    return user;

  }

 

  // Members can only access their own record

  const memberIdStr = String(memberId);

  if (user.memberId !== memberIdStr) {

    const error: AuthorizationError = {

      code: "FORBIDDEN",

      message: "You can only access your own member record",

      status: 403,

    };

    throw new Error(JSON.stringify(error));

  }

 

  return user;

}

 

/**

 * Verify user can access the specified member record

 * Checks if user is admin OR if the member belongs to them via Clerk userId

 *

 * @param memberId - The member ID to verify access for

 * @throws {Error} If user cannot access the member record

 */

export async function requireMemberAccess(

  memberId: number | string

): Promise<AuthenticatedUser> {

  const user = await getAuthUser();

 

  // Admins can access any member

  if (user.isAdmin) {

    return user;

  }

 

  // For members, verify the member record belongs to them

  const member = await db.query.members.findFirst({

    where: eq(members.id, Number(memberId)),

    columns: {

      id: true,

      userId: true,

    },

  });

 

  if (!member) {

    const error: AuthorizationError = {

      code: "NOT_FOUND",

      message: "Member not found",

      status: 404,

    };

    throw new Error(JSON.stringify(error));

  }

 

  if (member.userId !== user.userId) {

    const error: AuthorizationError = {

      code: "FORBIDDEN",

      message: "You can only access your own member record",

      status: 403,

    };

    throw new Error(JSON.stringify(error));

  }

 

  return user;

}

 

// ============================================================================

// CONDITIONAL AUTHORIZATION

// ============================================================================

 

/**

 * Check if user is admin (non-throwing)

 */

export async function isAdmin(): Promise<boolean> {

  try {

    const user = await getAuthUser();

    return user.isAdmin;

  } catch {

    return false;

  }

}

 

/**

 * Check if user is member (non-throwing)

 */

export async function isMember(): Promise<boolean> {

  try {

    const user = await getAuthUser();

    return user.isMember || user.isAdmin;

  } catch {

    return false;

  }

}

 

/**

 * Check if user owns member record (non-throwing)

 */

export async function ownsMemberRecord(

  memberId: number | string

): Promise<boolean> {

  try {

    await requireMemberOwnership(memberId);

    return true;

  } catch {

    return false;

  }

}

 

// ============================================================================

// ERROR HELPERS

// ============================================================================

 

/**

 * Parse authorization error from Error object

 */

export function parseAuthError(error: unknown): AuthorizationError {

  if (error instanceof Error) {

    try {

      const parsed = JSON.parse(error.message);

      if (parsed.code && parsed.message && parsed.status) {

        return parsed as AuthorizationError;

      }

    } catch {

      // Not a JSON error, fall through

    }

  }

 

  // Default error

  return {

    code: "UNAUTHORIZED",

    message: "Authentication failed",

    status: 401,

  };

}

 

/**

 * Check if error is an authorization error

 */

export function isAuthError(error: unknown): boolean {

  if (error instanceof Error) {

    try {

      const parsed = JSON.parse(error.message);

      return (

        parsed.code &&

        ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(parsed.code)

      );

    } catch {

      return false;

    }

  }

  return false;

}

 

// ============================================================================

// RESPONSE HELPERS

// ============================================================================

 

/**

 * Create standardized error response for authorization failures

 */

export function createAuthErrorResponse(error: unknown) {

  const authError = isAuthError(error) ? parseAuthError(error) : null;

 

  if (authError) {

    return {

      success: false,

      error: authError.message,

      code: authError.code,

      status: authError.status,

    };

  }

 

  return {

    success: false,

    error: "An error occurred",

    code: "INTERNAL_ERROR",

    status: 500,

  };

}

 

// ============================================================================

// UTILITY FUNCTIONS

// ============================================================================

 

/**

 * Get member ID for current user

 * Returns null if user doesn't have a member record

 */

export async function getCurrentMemberId(): Promise<number | null> {

  try {

    const user = await getAuthUser();

    return user.memberId ? Number(user.memberId) : null;

  } catch {

    return null;

  }

}

 

/**

 * Get user ID for current user

 * Returns null if not authenticated

 */

export async function getCurrentUserId(): Promise<string | null> {

  try {

    const user = await getAuthUser();

    return user.userId;

  } catch {

    return null;

  }

}

 

/**

 * Require admin or member ownership

 * Admins can access anything, members can only access their own data

 *

 * @param memberId - The member ID to check ownership for

 */

export async function requireAdminOrOwnership(

  memberId: number | string

): Promise<AuthenticatedUser> {

  const user = await getAuthUser();

 

  // Admins bypass ownership check

  if (user.isAdmin) {

    return user;

  }

 

  // Members must own the record

  return await requireMemberOwnership(memberId);

}