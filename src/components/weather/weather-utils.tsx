import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
} from "lucide-react";

interface WeatherIconProps {
  condition: string;
  className?: string;
}

export function getWeatherIcon({
  condition,
  className = "h-full w-full text-blue-500",
}: WeatherIconProps) {
  switch (condition.toLowerCase()) {
    case "clear":
      return <Sun className={className} />;
    case "clouds":
      return <Cloud className={className} />;
    case "rain":
      return <CloudRain className={className} />;
    case "drizzle":
      return <CloudDrizzle className={className} />;
    case "thunderstorm":
      return <CloudLightning className={className} />;
    case "snow":
      return <CloudSnow className={className} />;
    case "mist":
    case "fog":
    case "haze":
      return <CloudFog className={className} />;
    case "smoke":
    case "dust":
    case "sand":
    case "ash":
      return <Wind className={className} />;
    default:
      return <CloudSun className={className} />;
  }
}
