"use client";

import { CloudRain } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";

export function WeatherDisplay() {
  const [mounted, setMounted] = useState(false);
  const [weatherData, setWeatherData] = useState({
    today: new Date(),
    highTemp: 0,
    lowTemp: 0,
    rainfall: 0,
    currentTemp: 0,
    hourlyForecast: [] as Array<{ hour: number; period: string; temp: number }>,
  });

  useEffect(() => {
    const today = new Date();
    const currentHour = today.getHours();

    // Generate random data (1-15 range)
    const highTemp = Math.floor(Math.random() * 15) + 1;
    const lowTemp = Math.floor(Math.random() * 15) + 1;
    const rainfall = Math.floor(Math.random() * 15) + 1;
    const currentTemp = Math.floor(Math.random() * 15) + 1;

    // Generate next 5 hours with random temps
    const hourlyForecast = Array.from({ length: 5 }, (_, i) => {
      const hour = (currentHour + i) % 24;
      const temp = Math.floor(Math.random() * 15) + 1;
      return {
        hour: hour === 0 ? 12 : hour > 12 ? hour - 12 : hour,
        period: hour >= 12 ? "PM" : "AM",
        temp,
      };
    });

    setWeatherData({
      today,
      highTemp,
      lowTemp,
      rainfall,
      currentTemp,
      hourlyForecast,
    });
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        <div className="px-6 py-6 animate-pulse">
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formattedDate = format(weatherData.today, "EEEE, MMMM d");
  const mobileHourlyForecast = weatherData.hourlyForecast.slice(0, 4);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md">
      {/* Desktop Layout */}
      <div className="hidden lg:flex lg:items-center lg:justify-between lg:px-6 lg:py-6">
        {/* Left Side: Current Weather Info */}
        <div className="flex flex-col gap-4">
          {/* Date and Daily Summary */}
          <div className="flex items-center gap-6">
            <div className="text-lg font-medium text-neutral-800">
              {formattedDate}
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-600">
              <span>H: {weatherData.highTemp}°C</span>
              <span>L: {weatherData.lowTemp}°C</span>
              <span className="flex items-center gap-1">
                <span>Rainfall: {weatherData.rainfall}mm</span>
              </span>
            </div>
          </div>

          {/* Current Temperature */}
          <div className="flex items-center gap-3">
            <CloudRain className="h-12 w-12 text-blue-500" />
            <span className="text-4xl font-bold text-neutral-800">
              {weatherData.currentTemp}°C
            </span>
          </div>
        </div>

        {/* Right Side: Hourly Forecast */}
        <div className="flex gap-3">
          {weatherData.hourlyForecast.map((forecast, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 rounded-lg bg-gradient-to-b from-blue-50 to-blue-100 px-4 py-3 min-w-[80px]"
            >
              <span className="text-xs font-medium text-neutral-600">
                {forecast.hour} {forecast.period}
              </span>
              <CloudRain className="h-6 w-6 text-blue-500" />
              <span className="text-sm font-semibold text-neutral-800">
                {forecast.temp}°C
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex flex-col gap-4 px-6 py-6 lg:hidden">
        {/* Date and Daily Summary */}
        <div className="flex flex-col gap-2 text-center">
          <div className="text-lg font-medium text-neutral-800">
            {formattedDate}
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-neutral-600">
            <span>H: {weatherData.highTemp}°C</span>
            <span>L: {weatherData.lowTemp}°C</span>
            <span>Rainfall: {weatherData.rainfall}mm</span>
          </div>
        </div>

        {/* Hourly Forecast - Starting with current time (4 hours) */}
        <div className="flex justify-center gap-2">
          {mobileHourlyForecast.map((forecast, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 rounded-lg bg-gradient-to-b from-blue-50 to-blue-100 px-4 py-3 min-w-[70px] flex-1 max-w-[80px]"
            >
              <span className="text-xs font-medium text-neutral-600">
                {index === 0 ? "Now" : `${forecast.hour} ${forecast.period}`}
              </span>
              <CloudRain className="h-6 w-6 text-blue-500" />
              <span className="text-sm font-semibold text-neutral-800">
                {forecast.temp}°C
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
