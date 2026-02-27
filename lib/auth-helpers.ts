import { auth } from "./auth";
import { NextResponse } from "next/server";
import { log } from "./logger";

/**
 * Get the authenticated user's ID from the session.
 * Returns null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Returns a 401 response if not authenticated, otherwise returns the user ID.
 */
export async function requireAuth(): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  const userId = await getAuthUserId();
  if (!userId) {
    log.debug("Auth", "Unauthorized request", { path: "api" });
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId };
}
