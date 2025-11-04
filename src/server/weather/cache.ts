"use server";

import { db } from "~/server/db";
import { weatherCache, type WeatherCacheInsert } from "~/server/db/schema";
import { desc, sql } from "drizzle-orm";

/**
 * OpenWeather API response interfaces
 * Only includes fields actually used in the application
 */
interface OpenWeatherCurrentResponse {
  main: {
    temp: number;
  };
  weather: Array<{
    main: string;
  }>;
}

interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number; // Unix timestamp
    dt_txt: string; // Date/time text like "2025-10-31 06:00:00"
    main: {
      temp: number;
    };
    weather: Array<{
      main: string;
    }>;
    pop: number; // Probability of precipitation (0-1)
    rain?: {
      "3h": number; // Rainfall in mm for 3-hour period
    };
  }>;
}

interface HourlyForecastItem {
  hour: number;
  period: string;
  temp: number;
  condition: string;
}

/**
 * Fetches weather data from WeatherAPI.com and updates the database cache
 */
export async function updateWeatherCache(): Promise<
  | { success: true; timestamp: Date }
  | { success: false; error: string }
> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const lat = process.env.DEFAULT_LAT;
    const lon = process.env.DEFAULT_LON;

    if (!apiKey || !lat || !lon) {
      throw new Error("Missing weather API configuration");
    }

    // Fetch current weather from OpenWeather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const currentResponse = await fetch(currentUrl, {
      cache: "no-store",
    });

    if (!currentResponse.ok) {
      throw new Error(
        `Failed to fetch current weather from OpenWeather: ${currentResponse.status}`,
      );
    }

    const currentData: OpenWeatherCurrentResponse = await currentResponse.json();

    // Fetch 5-day forecast (3-hour intervals) from OpenWeather
    // cnt=16 gives us 48 hours (16 × 3h = 48h) which covers today + tomorrow
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast/?lat=${lat}&lon=${lon}&units=metric&cnt=16&appid=${apiKey}`;
    const forecastResponse = await fetch(forecastUrl, {
      cache: "no-store",
    });

    if (!forecastResponse.ok) {
      throw new Error(
        `Failed to fetch forecast from OpenWeather: ${forecastResponse.status}`,
      );
    }

    const forecastData: OpenWeatherForecastResponse = await forecastResponse.json();

    // Calculate daily rainfall by grouping 3-hour forecasts by LOCAL date
    // OpenWeather returns UTC times, but we need to group by local Vancouver date
    const dailyRainfall = new Map<string, number>();

    for (const item of forecastData.list) {
      // Convert UTC timestamp to Vancouver local date
      // dt is Unix timestamp in seconds
      const utcDate = new Date(item.dt * 1000);

      // Use toLocaleString with Vancouver timezone to get proper local date
      const vancouverDateStr = utcDate.toLocaleString('en-CA', {
        timeZone: 'America/Vancouver',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split(',')[0]?.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'); // Convert MM/DD/YYYY to YYYY-MM-DD

      if (!vancouverDateStr) continue;

      const rainfall3h = item.rain?.["3h"] ?? 0;

      dailyRainfall.set(vancouverDateStr, (dailyRainfall.get(vancouverDateStr) ?? 0) + rainfall3h);
    }

    // Get today and tomorrow's dates in YYYY-MM-DD format (Vancouver timezone)
    const now = new Date();
    
    // Get current date in Vancouver timezone
    const vancouverNow = now.toLocaleString('en-CA', {
      timeZone: 'America/Vancouver',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = vancouverNow.split(',')[0]?.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') ?? '';
    
    // Get tomorrow's date in Vancouver timezone
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const vancouverTomorrow = tomorrowDate.toLocaleString('en-CA', {
      timeZone: 'America/Vancouver',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const tomorrowStr = vancouverTomorrow.split(',')[0]?.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') ?? '';

    const todayRainfall = dailyRainfall.get(todayStr) ?? 0;
    const tomorrowRainfall = dailyRainfall.get(tomorrowStr) ?? 0;

    // Generate hourly forecast for next 6 hours
    // OpenWeather gives 3-hour intervals, so we'll use the closest available times
    const hourlyForecast: HourlyForecastItem[] = [];

    // For first hour, use current weather with Vancouver timezone
    const currentVancouverTime = now.toLocaleString('en-CA', {
      timeZone: 'America/Vancouver',
      hour: 'numeric',
      hour12: false
    });
    const currentHour = parseInt(currentVancouverTime);
    const currentPeriod = currentHour >= 12 ? "PM" : "AM";
    const currentDisplayHour = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;

    hourlyForecast.push({
      hour: currentDisplayHour,
      period: currentPeriod,
      temp: Math.round(currentData.main.temp),
      condition: currentData.weather[0]?.main ?? "Clear",
    });

    // For next 5 hours, use forecast data (take every other 3-hour interval to approximate hourly)
    for (let i = 0; i < Math.min(5, forecastData.list.length); i++) {
      const forecast = forecastData.list[i];
      if (!forecast) continue;

      // Convert forecast time to Vancouver timezone
      const forecastTime = new Date(forecast.dt * 1000);
      const vancouverHourStr = forecastTime.toLocaleString('en-CA', {
        timeZone: 'America/Vancouver',
        hour: 'numeric',
        hour12: false
      });
      const hour = parseInt(vancouverHourStr);
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

      hourlyForecast.push({
        hour: displayHour,
        period,
        temp: Math.round(forecast.main.temp),
        condition: forecast.weather[0]?.main ?? "Clear",
      });
    }

    // Prepare cache data (only store what's actually displayed)
    const cacheData: WeatherCacheInsert = {
      currentTemp: currentData.main.temp,
      condition: currentData.weather[0]?.main ?? "Clear",
      conditionText: currentData.weather[0]?.main ?? "Clear",
      todayRainfall: todayRainfall,
      tomorrowRainfall: tomorrowRainfall,
      hourlyForecast: hourlyForecast.slice(0, 6), // Ensure we only have 6 items
      lastUpdated: new Date(),
    };

    // Insert into database (we'll only keep the latest record)
    await db.insert(weatherCache).values(cacheData);

    // Clean up old cache entries (keep only the latest 10)
    const allEntries = await db
      .select({ id: weatherCache.id })
      .from(weatherCache)
      .orderBy(desc(weatherCache.lastUpdated));

    if (allEntries.length > 10) {
      const idsToDelete = allEntries.slice(10).map((entry) => entry.id);
      await db
        .delete(weatherCache)
        .where(sql`${weatherCache.id} IN ${sql.raw(`(${idsToDelete.join(",")})`)}`);
    }

    return { success: true, timestamp: new Date() };
  } catch (error) {
    console.error("Failed to update weather cache:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update weather cache",
    };
  }
}

/**
 * Retrieves weather data from the database cache
 */
export async function getWeatherFromCache() {
  try {
    const cachedWeather = await db
      .select()
      .from(weatherCache)
      .orderBy(desc(weatherCache.lastUpdated))
      .limit(1);

    if (cachedWeather.length === 0) {
      return null;
    }

    return cachedWeather[0];
  } catch (error) {
    console.error("Failed to retrieve weather from cache:", error);
    return null;
  }
}

/**
 * Checks if the weather cache is stale (older than 20 minutes)
 * Must be async due to "use server" directive
 */
export async function isWeatherStale(lastUpdated: Date | string): Promise<boolean> {
  const now = new Date();
  const updatedDate = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
  const diffMinutes = (now.getTime() - updatedDate.getTime()) / 1000 / 60;
  return diffMinutes > 20;
}
