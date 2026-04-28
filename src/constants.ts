import type { CoordinatePoint, NotificationPreferences } from './types';

export const PUBLIC_URL = process.env.PUBLIC_URL || '';
export const SERVICE_WORKER_URL = `${PUBLIC_URL}/sw.js`;
export const FAVICON_URL = `${PUBLIC_URL}/favicon.ico`;

export const FAVORITES_STORAGE_KEY = 'weather-favorites';
export const THEME_STORAGE_KEY = 'weather-theme';
export const SELECTION_STORAGE_KEY = 'weather-last-selection';
export const TOMORROW_ALERTS_STORAGE_KEY = 'weather-tomorrow-alerts';
export const PUSH_SUBSCRIPTION_STORAGE_KEY = 'weather-push-subscription';
export const NOTIFICATION_PREFERENCES_STORAGE_KEY = 'weather-alert-preferences';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  precipitation: true,
  humidity: true,
  wind: true,
  pressure: true,
  visibility: true,
};

export const NOTIFICATION_PREFERENCE_OPTIONS: Array<{
  key: keyof NotificationPreferences;
  label: string;
}> = [
  { key: 'precipitation', label: 'Вероятность осадков' },
  { key: 'humidity', label: 'Влажность' },
  { key: 'wind', label: 'Ветер' },
  { key: 'pressure', label: 'Давление' },
  { key: 'visibility', label: 'Видимость' },
];

export const DEFAULT_CENTER: CoordinatePoint = {
  latitude: 55.7558,
  longitude: 37.6176,
};

export const BARNAUL_CITY_NAME = 'Барнаул';

export const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';

export const FALLBACK_RAIN_LAYER_URL =
  'https://tilecache.rainviewer.com/v2/radar/nowcast_0/256/{z}/{x}/{y}/6/1_1.png';
