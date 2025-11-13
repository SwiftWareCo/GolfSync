import { NextResponse } from "next/server";

import { db } from "~/server/db";

import { weatherCache } from "~/server/db/schema";

import { desc, sql } from "drizzle-orm";

 

/**

 * Health Check Endpoint

 *

 * Returns the health status of the application including:

 * - Overall status

 * - Database connectivity

 * - Last weather update time

 * - Cron job status

 * - Application version

 *

 * This endpoint is used for:

 * - Uptime monitoring

 * - Health checks from load balancers

 * - Deployment verification

 * - Debugging production issues

 */

export async function GET() {

  const startTime = Date.now();

 

  try {

    // Check database connectivity

    let databaseStatus: "connected" | "disconnected" = "disconnected";

    let lastWeatherUpdate: string | null = null;

    let weatherUpdateAge: number | null = null;

 

    try {

      // Test database connection with a simple query

      await db.execute(sql`SELECT 1`);

      databaseStatus = "connected";

 

      // Get last weather update

      const latestWeather = await db

        .select({

          updatedAt: weatherCache.updatedAt,

        })

        .from(weatherCache)

        .orderBy(desc(weatherCache.updatedAt))

        .limit(1);

 

      if (latestWeather[0]) {

        lastWeatherUpdate = latestWeather[0].updatedAt.toISOString();

        weatherUpdateAge = Date.now() - latestWeather[0].updatedAt.getTime();

      }

    } catch (error) {

      console.error("Database health check failed:", error);

      databaseStatus = "disconnected";

    }

 

    // Determine overall status

    const isHealthy = databaseStatus === "connected";

 

    // Determine cron status based on weather update age

    // Weather should update every 15 minutes (cron schedule)

    let cronStatus: "running" | "stale" | "unknown" = "unknown";

    if (weatherUpdateAge !== null) {

      // Consider stale if last update was more than 30 minutes ago

      const thirtyMinutesMs = 30 * 60 * 1000;

      cronStatus = weatherUpdateAge < thirtyMinutesMs ? "running" : "stale";

    }

 

    // Get package version

    const version = process.env.npm_package_version || "unknown";

 

    // Calculate response time

    const responseTime = Date.now() - startTime;

 

    // Build response

    const response = {

      status: isHealthy ? "healthy" : "unhealthy",

      timestamp: new Date().toISOString(),

      checks: {

        database: {

          status: databaseStatus,

          message:

            databaseStatus === "connected"

              ? "Database connection successful"

              : "Database connection failed",

        },

        weather: {

          lastUpdate: lastWeatherUpdate,

          updateAge: weatherUpdateAge ? `${Math.round(weatherUpdateAge / 1000)}s` : null,

          status: cronStatus,

          message:

            cronStatus === "running"

              ? "Weather updates are current"

              : cronStatus === "stale"

                ? "Weather updates are stale (>30 minutes)"

                : "No weather data found",

        },

      },

      system: {

        version,

        uptime: process.uptime(),

        memory: {

          used: process.memoryUsage().heapUsed,

          total: process.memoryUsage().heapTotal,

        },

        environment: process.env.NODE_ENV || "unknown",

      },

      performance: {

        responseTime: `${responseTime}ms`,

      },

    };

 

    // Return appropriate status code

    const statusCode = isHealthy ? 200 : 503;

 

    return NextResponse.json(response, {

      status: statusCode,

      headers: {

        "Cache-Control": "no-store, no-cache, must-revalidate",

      },

    });

  } catch (error) {

    // Catch-all for unexpected errors

    console.error("Health check endpoint error:", error);

 

    return NextResponse.json(

      {

        status: "unhealthy",

        timestamp: new Date().toISOString(),

        error: "Health check failed",

        message: error instanceof Error ? error.message : "Unknown error",

      },

      {

        status: 503,

        headers: {

          "Cache-Control": "no-store, no-cache, must-revalidate",

        },

      }

    );

  }

}