"use client";

import { CloudRain } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { weatherQueryOptions } from "~/server/query-options/weather-query-options";
import { getWeatherIcon } from "./weather-utils";

export function WeatherDisplay() {
  const { data: weatherData, isLoading, error } = useQuery(weatherQueryOptions.current());

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        <div className="px-6 py-6 animate-pulse">
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2 text-red-600">
            <CloudRain className="h-5 w-5" />
            <span className="text-sm">Unable to load weather data</span>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(), "EEEE, MMMM d");
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
              <span>Today's Rainfall: {weatherData.todayRainfall}mm</span>
              <span>•</span>
              <span>Tomorrow's Rainfall: {weatherData.tomorrowRainfall}mm</span>
            </div>
          </div>

          {/* Current Temperature */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12">
              {getWeatherIcon({ condition: weatherData.currentCondition })}
            </div>
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
                {index === 0 ? "Now" : `${forecast.hour} ${forecast.period}`}
              </span>
              <div className="h-6 w-6">
                {getWeatherIcon({ condition: forecast.condition })}
              </div>
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
        <div className="flex flex-col gap-3 text-center">
          <div className="text-lg font-medium text-neutral-800">
            {formattedDate}
          </div>

          {/* Current Temperature */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10">
              {getWeatherIcon({ condition: weatherData.currentCondition })}
            </div>
            <span className="text-3xl font-bold text-neutral-800">
              {weatherData.currentTemp}°C
            </span>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-neutral-600">
            <span>Today: {weatherData.todayRainfall}mm</span>
            <span>•</span>
            <span>Tomorrow: {weatherData.tomorrowRainfall}mm</span>
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
              <div className="h-6 w-6">
                {getWeatherIcon({ condition: forecast.condition })}
              </div>
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
