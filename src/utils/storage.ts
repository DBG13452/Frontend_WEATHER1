import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  FAVORITES_STORAGE_KEY,
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  PUSH_SUBSCRIPTION_STORAGE_KEY,
  SELECTION_STORAGE_KEY,
  THEME_STORAGE_KEY,
  TOMORROW_ALERTS_STORAGE_KEY,
} from '../constants';
import type {
  FavoritePoint,
  NotificationPreferences,
  PersistedSelection,
  PushSubscriptionPayload,
  SelectionMode,
  TomorrowAlert,
} from '../types';
import { buildPointId } from './weather';

export const normalizeNotificationPreferences = (
  value: unknown
): NotificationPreferences => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const candidate = value as Partial<NotificationPreferences>;
  return {
    precipitation:
      typeof candidate.precipitation === 'boolean'
        ? candidate.precipitation
        : typeof (candidate as { feels_like?: unknown }).feels_like === 'boolean'
          ? Boolean((candidate as { feels_like: boolean }).feels_like)
          : DEFAULT_NOTIFICATION_PREFERENCES.precipitation,
    humidity:
      typeof candidate.humidity === 'boolean'
        ? candidate.humidity
        : DEFAULT_NOTIFICATION_PREFERENCES.humidity,
    wind:
      typeof candidate.wind === 'boolean' ? candidate.wind : DEFAULT_NOTIFICATION_PREFERENCES.wind,
    pressure:
      typeof candidate.pressure === 'boolean'
        ? candidate.pressure
        : DEFAULT_NOTIFICATION_PREFERENCES.pressure,
    visibility:
      typeof candidate.visibility === 'boolean'
        ? candidate.visibility
        : DEFAULT_NOTIFICATION_PREFERENCES.visibility,
  };
};

export const normalizeFavorites = (value: unknown): FavoritePoint[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueFavorites = new Map<string, FavoritePoint>();

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const candidate = item as Partial<FavoritePoint>;
    if (typeof candidate.latitude !== 'number' || typeof candidate.longitude !== 'number') {
      return;
    }

    const normalizedId = buildPointId(candidate.latitude, candidate.longitude);
    if (uniqueFavorites.has(normalizedId)) {
      return;
    }

    uniqueFavorites.set(normalizedId, {
      id: normalizedId,
      label: typeof candidate.label === 'string' ? candidate.label : 'Точка',
      country: typeof candidate.country === 'string' ? candidate.country : '',
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });
  });

  return Array.from(uniqueFavorites.values());
};

export const normalizeTomorrowAlerts = (value: unknown): TomorrowAlert[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueAlerts = new Map<string, TomorrowAlert>();

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const candidate = item as Partial<TomorrowAlert>;
    if (typeof candidate.latitude !== 'number' || typeof candidate.longitude !== 'number') {
      return;
    }

    const normalizedId = buildPointId(candidate.latitude, candidate.longitude);
    if (uniqueAlerts.has(normalizedId)) {
      return;
    }

    uniqueAlerts.set(normalizedId, {
      id: normalizedId,
      label: typeof candidate.label === 'string' ? candidate.label : 'Точка',
      country: typeof candidate.country === 'string' ? candidate.country : '',
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      last_notified_on:
        typeof candidate.last_notified_on === 'string' ? candidate.last_notified_on : null,
      preferences: normalizeNotificationPreferences(candidate.preferences),
    });
  });

  return Array.from(uniqueAlerts.values());
};

export const loadFavoritesFromStorage = (): FavoritePoint[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (!rawFavorites) {
    return [];
  }

  try {
    return normalizeFavorites(JSON.parse(rawFavorites));
  } catch (storageError) {
    console.error(storageError);
    return [];
  }
};

export const loadThemeFromStorage = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'dark' ? 'dark' : 'light';
};

export const loadTomorrowAlertsFromStorage = (): TomorrowAlert[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawAlerts = window.localStorage.getItem(TOMORROW_ALERTS_STORAGE_KEY);
  if (!rawAlerts) {
    return [];
  }

  try {
    return normalizeTomorrowAlerts(JSON.parse(rawAlerts));
  } catch (storageError) {
    console.error(storageError);
    return [];
  }
};

export const loadNotificationPreferencesFromStorage = (): NotificationPreferences => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const rawPreferences = window.localStorage.getItem(NOTIFICATION_PREFERENCES_STORAGE_KEY);
  if (!rawPreferences) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  try {
    return normalizeNotificationPreferences(JSON.parse(rawPreferences));
  } catch (storageError) {
    console.error(storageError);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
};

export const persistNotificationPreferences = (preferences: NotificationPreferences) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPreferences = normalizeNotificationPreferences(preferences);
  window.localStorage.setItem(
    NOTIFICATION_PREFERENCES_STORAGE_KEY,
    JSON.stringify(normalizedPreferences)
  );
};

export const persistTomorrowAlerts = (alerts: TomorrowAlert[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedAlerts = normalizeTomorrowAlerts(alerts);
  window.localStorage.setItem(TOMORROW_ALERTS_STORAGE_KEY, JSON.stringify(normalizedAlerts));
};

export const loadPushSubscriptionFromStorage = (): PushSubscriptionPayload | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(PUSH_SUBSCRIPTION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PushSubscriptionPayload>;
    if (
      typeof parsed.endpoint !== 'string' ||
      !parsed.keys ||
      typeof parsed.keys.p256dh !== 'string' ||
      typeof parsed.keys.auth !== 'string'
    ) {
      return null;
    }

    return {
      endpoint: parsed.endpoint,
      expirationTime:
        typeof parsed.expirationTime === 'number' ? parsed.expirationTime : null,
      keys: {
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
      },
    };
  } catch (storageError) {
    console.error(storageError);
    return null;
  }
};

export const persistPushSubscription = (value: PushSubscriptionPayload | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(PUSH_SUBSCRIPTION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(PUSH_SUBSCRIPTION_STORAGE_KEY, JSON.stringify(value));
};

export const loadSelectionFromStorage = (): PersistedSelection => {
  const fallback: PersistedSelection = {
    selectionMode: 'city',
    selectedCity: '',
    selectedPoint: null,
    citySearchQuery: '',
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  const rawSelection = window.localStorage.getItem(SELECTION_STORAGE_KEY);
  if (!rawSelection) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawSelection) as Partial<PersistedSelection>;
    const selectionMode: SelectionMode =
      parsed.selectionMode === 'coordinates' ? 'coordinates' : 'city';
    const selectedCity = typeof parsed.selectedCity === 'string' ? parsed.selectedCity : '';
    const citySearchQuery =
      typeof parsed.citySearchQuery === 'string' ? parsed.citySearchQuery : selectedCity;
    const selectedPoint =
      parsed.selectedPoint &&
      typeof parsed.selectedPoint === 'object' &&
      typeof parsed.selectedPoint.latitude === 'number' &&
      typeof parsed.selectedPoint.longitude === 'number'
        ? {
            latitude: parsed.selectedPoint.latitude,
            longitude: parsed.selectedPoint.longitude,
          }
        : null;

    return {
      selectionMode,
      selectedCity,
      selectedPoint,
      citySearchQuery,
    };
  } catch (storageError) {
    console.error(storageError);
    return fallback;
  }
};
