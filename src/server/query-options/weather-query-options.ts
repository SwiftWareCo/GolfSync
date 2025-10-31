import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import { getWeatherData } from "~/server/weather/actions";

// Types
export type WeatherData = {
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
};

// Query Options
export const weatherQueryOptions = {
  // Get current weather data
  current: () =>
    queryOptions({
      queryKey: queryKeys.weather.current(),
      queryFn: async (): Promise<WeatherData> => {
        const result = await getWeatherData();
        if (!result.success) {
          throw new Error(result.error || "Failed to load weather data");
        }
        return result.data;
      },
      staleTime: 20 * 60 * 1000, // 20 minutes - matches cache staleness check
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in memory a bit longer
      refetchOnWindowFocus: true, // Get fresh weather when user returns to tab
      retry: 2, // Retry failed requests up to 2 times
    }),
};
