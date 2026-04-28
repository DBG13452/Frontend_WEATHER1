import { useMemo } from 'react';
import { DEFAULT_CENTER } from '../constants';
import type { CoordinatePoint, FavoritePoint, TomorrowAlert, WeatherDetails } from '../types';
import { buildPointId } from '../utils/weather';

export function useWeatherSelection({
  favorites,
  loading,
  selectedPoint,
  tomorrowAlerts,
  weather,
  weatherLoading,
}: {
  favorites: FavoritePoint[];
  loading: boolean;
  selectedPoint: CoordinatePoint | null;
  tomorrowAlerts: TomorrowAlert[];
  weather: WeatherDetails | null;
  weatherLoading: boolean;
}) {
  const heroCity = weather
    ? {
        city: weather.city,
        temperature_c: weather.temperature_c,
        condition: weather.condition,
      }
    : null;
  const shouldShowHeroLoading = favorites.length > 0 && !heroCity && (loading || weatherLoading);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedPoint) {
      return [selectedPoint.latitude, selectedPoint.longitude];
    }

    return [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];
  }, [selectedPoint]);

  const currentPointId = useMemo(() => {
    if (!weather) {
      return null;
    }

    return buildPointId(weather.latitude, weather.longitude);
  }, [weather]);

  const currentFavorite = useMemo(() => {
    if (!currentPointId) {
      return null;
    }

    return favorites.find((favorite) => favorite.id === currentPointId) ?? null;
  }, [currentPointId, favorites]);

  const currentAlert = useMemo(() => {
    if (!currentPointId) {
      return null;
    }

    return tomorrowAlerts.find((alertItem) => alertItem.id === currentPointId) ?? null;
  }, [currentPointId, tomorrowAlerts]);

  const activeAlertIds = useMemo(
    () => new Set(tomorrowAlerts.map((alertItem) => alertItem.id)),
    [tomorrowAlerts]
  );

  const isTomorrowAlertEnabled = useMemo(() => {
    if (!currentPointId) {
      return false;
    }

    return tomorrowAlerts.some((alertItem) => alertItem.id === currentPointId);
  }, [currentPointId, tomorrowAlerts]);

  return {
    activeAlertIds,
    currentAlert,
    currentFavorite,
    currentPointId,
    heroCity,
    isCurrentFavorite: currentFavorite !== null,
    isTomorrowAlertEnabled,
    mapCenter,
    shouldShowHeroLoading,
  };
}
