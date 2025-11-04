import { NextRequest, NextResponse } from "next/server";
import { updateWeatherCache } from "~/server/weather/cache";

/**
 * Cron endpoint to update weather cache every 15 minutes
 * This route should be called by Vercel Cron or an external cron service
 *
 * Security: Requires Bearer token authentication via CRON_SECRET env variable
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is authorized
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 500 },
      );
    }

    if (authHeader !== expectedAuth) {
      console.warn("Unauthorized cron request attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update the weather cache
    const result = await updateWeatherCache();

    if (result.success) {
      return NextResponse.json({
        success: true,
        timestamp: result.timestamp.toISOString(),
        message: "Weather cache updated successfully",
      });
    } else {
      console.error("Failed to update weather cache:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: "Failed to update weather cache",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in weather cron endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST method for manual testing
 * Not used by the cron job, but useful for manual triggers
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
