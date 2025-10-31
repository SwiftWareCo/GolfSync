"use server";

import { getWeatherFromCache, isWeatherStale, updateWeatherCache } from "./cache";

interface WeatherData {
  currentTemp: number;
  todayRainfall: number;
  tomorrowRainfall: number;
  currentCondition: string;
  hourlyForecast: Array<{
    hour: number;
    period: string;
    temp: number;
    condition: string;
  }>;
}

/**
 * Gets weather data from the database cache.
 * If cache is missing or stale, attempts to refresh it.
 */
export async function getWeatherData(): Promise<
  | { success: true; data: WeatherData }
  | { success: false; error: string }
> {
  try {
    // Try to get cached weather data
    const cachedWeather = await getWeatherFromCache();

    // If no cache exists or cache is stale, try to update it
    if (!cachedWeather || (await isWeatherStale(cachedWeather.lastUpdated))) {
      const updateResult = await updateWeatherCache();

      if (updateResult.success) {
        // Fetch the newly updated cache
        const freshWeather = await getWeatherFromCache();
        if (freshWeather) {
          return {
            success: true,
            data: {
              currentTemp: Math.round(freshWeather.currentTemp),
              todayRainfall: Math.round(freshWeather.todayRainfall * 10) / 10,
              tomorrowRainfall: Math.round(freshWeather.tomorrowRainfall * 10) / 10,
              currentCondition: freshWeather.condition,
              hourlyForecast: freshWeather.hourlyForecast as Array<{
                hour: number;
                period: string;
                temp: number;
                condition: string;
              }>,
            },
          };
        }
      }

      // If update failed but we have stale data, use it anyway
      if (cachedWeather) {
        console.warn("Using stale weather data due to update failure");
        return {
          success: true,
          data: {
            currentTemp: Math.round(cachedWeather.currentTemp),
            todayRainfall: Math.round(cachedWeather.todayRainfall * 10) / 10,
            tomorrowRainfall: Math.round(cachedWeather.tomorrowRainfall * 10) / 10,
            currentCondition: cachedWeather.condition,
            hourlyForecast: cachedWeather.hourlyForecast as Array<{
              hour: number;
              period: string;
              temp: number;
              condition: string;
            }>,
          },
        };
      }

      throw new Error("No weather data available");
    }

    // Return fresh cached data
    return {
      success: true,
      data: {
        currentTemp: Math.round(cachedWeather.currentTemp),
        todayRainfall: Math.round(cachedWeather.todayRainfall * 10) / 10,
        tomorrowRainfall: Math.round(cachedWeather.tomorrowRainfall * 10) / 10,
        currentCondition: cachedWeather.condition,
        hourlyForecast: cachedWeather.hourlyForecast as Array<{
          hour: number;
          period: string;
          temp: number;
          condition: string;
        }>,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch weather data",
    };
  }
}
