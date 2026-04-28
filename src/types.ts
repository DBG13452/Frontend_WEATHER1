export type CitySummary = {
  name: string;
  country: string;
  condition: string;
  temperature_c: number;
  latitude: number;
  longitude: number;
};

export type ForecastItem = {
  day: string;
  condition: string;
  min_temp_c: number;
  max_temp_c: number;
  precipitation_chance: number;
  wind_speed_m_s?: number;
};

export type HourlyForecastItem = {
  time: string;
  condition: string;
  temperature_c: number;
  precipitation_chance: number;
};

export type WeatherDetails = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  condition: string;
  temperature_c: number;
  feels_like_c: number;
  humidity: number;
  wind_speed: number;
  pressure_mmhg: number;
  visibility_km: number;
  tomorrow_metrics: {
    precipitation_chance: number;
    humidity: number;
    wind_speed_m_s: number;
    pressure_mmhg: number;
    visibility_km: number;
  };
  forecast: ForecastItem[];
  hourly_forecast: HourlyForecastItem[];
};

export type Overview = {
  title: string;
  description: string;
  cities_count: number;
  highlight: {
    city: string;
    temperature_c: number;
    condition: string;
  };
};

export type SelectionMode = 'city' | 'coordinates';

export type CoordinatePoint = {
  latitude: number;
  longitude: number;
};

export type FavoritePoint = {
  id: string;
  label: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type NotificationPreferences = {
  precipitation: boolean;
  humidity: boolean;
  wind: boolean;
  pressure: boolean;
  visibility: boolean;
};

export type TomorrowAlert = {
  id: string;
  label: string;
  country: string;
  latitude: number;
  longitude: number;
  last_notified_on: string | null;
  preferences: NotificationPreferences;
};

export type PersistedSelection = {
  selectionMode: SelectionMode;
  selectedCity: string;
  selectedPoint: CoordinatePoint | null;
  citySearchQuery: string;
};

export type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};
