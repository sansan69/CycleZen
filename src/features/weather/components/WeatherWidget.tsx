'use client';

import { useEffect, useState } from 'react';
import type { Coordinate } from '@/features/route-generation/services/open-route-service';
import { getWeatherForLocation, getWeatherWarnings, type WeatherData } from '../services/weather-service';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherWidgetProps {
  location: Coordinate;
}

export function WeatherWidget({ location }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      setLoading(true);
      setError(false);
      const data = await getWeatherForLocation(location.lat, location.lng);
      if (!cancelled) {
        if (data) {
          setWeather(data);
        } else {
          setError(true);
        }
        setLoading(false);
      }
    }
    
    load();
    return () => { cancelled = true; };
  }, [location.lat, location.lng]);

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  if (error || !weather) {
    return null; // Silently hide if unavailable
  }

  const warnings = getWeatherWarnings(weather);
  const iconUrl = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`;

  return (
    <div className="bg-card rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src={iconUrl} 
            alt={weather.description}
            className="w-10 h-10"
            width={40}
            height={40}
          />
          <div>
            <p className="text-lg font-bold">{weather.temperature}°C</p>
            <p className="text-xs text-muted-foreground capitalize">{weather.description}</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Feels like {weather.feelsLike}°C</p>
          <p>💧 {weather.humidity}% | 🌬️ {weather.windSpeed} km/h</p>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {warnings.map((w, i) => (
            <span key={i} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
