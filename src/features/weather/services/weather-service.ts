export interface WeatherData {
  temperature: number;       // Celsius
  feelsLike: number;
  windSpeed: number;         // km/h
  windDirection: number;     // degrees
  precipitation: number;     // mm last hour
  humidity: number;          // %
  description: string;       // e.g. "clear sky"
  icon: string;              // OpenWeatherMap icon code
}

const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

function hasApiKey(): boolean {
  return !!API_KEY && API_KEY.length > 0;
}

export async function getWeatherForLocation(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  if (!hasApiKey()) {
    console.warn('[Weather] No OpenWeather API key configured');
    return null;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/weather?lat=${lat}&lon=${lng}&units=metric&appid=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      windDirection: data.wind.deg,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      humidity: data.main.humidity,
      description: data.weather[0]?.description || 'Unknown',
      icon: data.weather[0]?.icon || '01d',
    };
  } catch (error) {
    console.error('[Weather] Failed to fetch weather:', error);
    return null;
  }
}

export function getWeatherWarnings(weather: WeatherData): string[] {
  const warnings: string[] = [];
  
  if (weather.precipitation > 0.5) {
    warnings.push('Rain expected 🌧️');
  }
  if (weather.windSpeed > 30) {
    warnings.push(`Strong wind: ${weather.windSpeed} km/h 💨`);
  }
  if (weather.temperature > 35) {
    warnings.push(`Hot: ${weather.temperature}°C 🥵`);
  }
  if (weather.temperature < 5) {
    warnings.push(`Cold: ${weather.temperature}°C 🥶`);
  }
  
  return warnings;
}
