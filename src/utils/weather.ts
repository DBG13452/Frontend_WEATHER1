import type { NotificationPreferences, WeatherDetails } from '../types';

export const buildPointId = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;

export const getCurrentDateKey = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const formatSignedTemperature = (temperature: number): string => {
  const roundedTemperature = Math.ceil(temperature);
  const sign = roundedTemperature > 0 ? '+' : '';
  return `${sign}${roundedTemperature}\u00B0C`;
};

export const buildTomorrowNotificationText = (
  alertLabel: string,
  weatherDetails: WeatherDetails,
  preferences: NotificationPreferences
): string | null => {
  const tomorrowForecast =
    weatherDetails.forecast.find((forecastDay) =>
      forecastDay.day.toLowerCase().includes('завтра')
    ) ?? weatherDetails.forecast[1];

  if (!tomorrowForecast) {
    return null;
  }

  const details: string[] = [];
  if (preferences.precipitation) {
    details.push(
      `Вероятность осадков ${weatherDetails.tomorrow_metrics?.precipitation_chance ?? 0}%`
    );
  }
  if (preferences.humidity) {
    details.push(`Влажность ${weatherDetails.tomorrow_metrics?.humidity ?? 0}%`);
  }
  if (preferences.wind) {
    const windSpeed = Math.ceil(
      weatherDetails.tomorrow_metrics?.wind_speed_m_s ??
        (typeof tomorrowForecast.wind_speed_m_s === 'number'
          ? tomorrowForecast.wind_speed_m_s
          : weatherDetails.wind_speed)
    );
    details.push(`Ветер ${windSpeed} м/с`);
  }
  if (preferences.pressure) {
    details.push(`Давление ${weatherDetails.tomorrow_metrics?.pressure_mmhg ?? 0} мм рт. ст.`);
  }
  if (preferences.visibility) {
    details.push(`Видимость ${weatherDetails.tomorrow_metrics?.visibility_km ?? 0} км`);
  }

  const baseText =
    `${alertLabel}: завтра ${tomorrowForecast.condition.toLowerCase()}. ` +
    `Днем до ${formatSignedTemperature(tomorrowForecast.max_temp_c)}, ` +
    `Ночью до ${formatSignedTemperature(tomorrowForecast.min_temp_c)}`;

  return details.length > 0 ? `${baseText}. ${details.join(', ')}` : baseText;
};

export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
};
