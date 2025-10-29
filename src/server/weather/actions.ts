"use server";

interface WeatherData {
  currentTemp: number;
  rainfall: number;
  currentCondition: string;
  hourlyForecast: Array<{
    hour: number;
    period: string;
    temp: number;
    condition: string;
  }>;
}

interface CurrentWeatherResponse {
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
}

interface ForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min?: number;
      temp_max?: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    pop: number; 
    rain?: {
      "3h": number; // Rainfall in mm for the last 3 hours
    };
  }>;
}

export async function getWeatherData(): Promise<
  | { success: true; data: WeatherData }
  | { success: false; error: string }
> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const lat = process.env.DEFAULT_LAT;
    const lon = process.env.DEFAULT_LON;

    if (!apiKey || !lat || !lon) {
      throw new Error("Missing weather API configuration");
    }

    // Fetch current weather
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const currentResponse = await fetch(currentWeatherUrl, {
      next: { revalidate: 900 }, // Cache for 15 minutes
    });

    if (!currentResponse.ok) {
      throw new Error(
        `Failed to fetch current weather: ${currentResponse.status}`,
      );
    }

    const currentData: CurrentWeatherResponse = await currentResponse.json();

    // Fetch forecast (for hourly data and precipitation)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const forecastResponse = await fetch(forecastUrl, {
      next: { revalidate: 900 }, // Cache for 15 minutes
    });

    if (!forecastResponse.ok) {
      throw new Error(`Failed to fetch forecast: ${forecastResponse.status}`);
    }

    const forecastData: ForecastResponse = await forecastResponse.json();

    // Calculate forecasted rainfall for the next 24 hours
    const nowTimestamp = Date.now() / 1000; 
    const next24Hours = nowTimestamp + 24 * 60 * 60;
    let totalRainfall = 0;

    for (const item of forecastData.list) {
      if (item.dt >= nowTimestamp && item.dt <= next24Hours) {
        if (item.rain?.["3h"]) {
          totalRainfall += item.rain["3h"];
        }
      }
    }

    // Generate hourly forecast for next 6 hours (interpolating from 3-hour data)
    const now = new Date();
    const hourlyForecast = [];

    for (let i = 0; i < 6; i++) {
      const targetTime = new Date(now.getTime() + i * 60 * 60 * 1000); 
      const targetTimestamp = targetTime.getTime() / 1000;

      let interpolatedTemp;
      let weatherCondition;

      // For the first hour (i=0), use current actual temperature and condition
      if (i === 0) {
        interpolatedTemp = currentData.main.temp;
        weatherCondition = currentData.weather[0]?.main || "Clear";
      } else {
        // Find the two closest forecast points to interpolate between
        let beforePoint = forecastData.list[0];
        let afterPoint = forecastData.list[1];

        for (let j = 0; j < forecastData.list.length - 1; j++) {
          const current = forecastData.list[j];
          const next = forecastData.list[j + 1];

          if (
            current &&
            next &&
            current.dt <= targetTimestamp &&
            next.dt >= targetTimestamp
          ) {
            beforePoint = current;
            afterPoint = next;
            break;
          }
        }

        // Interpolate temperature between the two points
        if (beforePoint && afterPoint && beforePoint.dt !== afterPoint.dt) {
          const ratio =
            (targetTimestamp - beforePoint.dt) /
            (afterPoint.dt - beforePoint.dt);
          interpolatedTemp =
            beforePoint.main.temp +
            ratio * (afterPoint.main.temp - beforePoint.main.temp);
        } else {
          interpolatedTemp = beforePoint?.main.temp || currentData.main.temp;
        }

        // Use the condition from the nearest point
        const nearestPoint =
          Math.abs((beforePoint?.dt || 0) - targetTimestamp) <
          Math.abs((afterPoint?.dt || 0) - targetTimestamp)
            ? beforePoint
            : afterPoint;

        weatherCondition = nearestPoint?.weather[0]?.main || "Clear";
      }

      let hour = targetTime.getHours();
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

      hourlyForecast.push({
        hour,
        period,
        temp: Math.round(interpolatedTemp),
        condition: weatherCondition,
      });
    }

    return {
      success: true,
      data: {
        currentTemp: Math.round(currentData.main.temp),
        rainfall: Math.round(totalRainfall * 10) / 10, // Round to 1 decimal
        currentCondition: currentData.weather[0]?.main || "Clear",
        hourlyForecast,
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
