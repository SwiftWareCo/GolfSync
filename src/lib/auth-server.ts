import { auth } from "@clerk/nextjs/server";

/**
 * Require user to be authenticated
 * @returns {Promise<{userId: string, sessionClaims: any}>}
 * @throws {Error} If user is not authenticated
 */
export async function requireAuthentication() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  return { userId, sessionClaims };
}

/**
 * Require user to be authenticated AND have admin privileges
 * @returns {Promise<{userId: string, sessionClaims: any}>}
 * @throws {Error} If user is not authenticated or not an admin
 */
export async function requireAdmin() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const isAdmin = (sessionClaims as any)?.publicMetadata?.isAdmin === true;
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return { userId, sessionClaims };
}
