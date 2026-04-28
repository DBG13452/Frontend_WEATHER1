import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BARNAUL_CITY_NAME } from '../constants';
import type {
  CitySummary,
  CoordinatePoint,
  FavoritePoint,
  Overview,
  SelectionMode,
  WeatherDetails,
} from '../types';
import { buildPointId } from '../utils/weather';

export function useWeatherData({
  favorites,
  selectedCity,
  selectedPoint,
  selectionMode,
  setSelectedPoint,
}: {
  favorites: FavoritePoint[];
  selectedCity: string;
  selectedPoint: CoordinatePoint | null;
  selectionMode: SelectionMode;
  setSelectedPoint: Dispatch<SetStateAction<CoordinatePoint | null>>;
}) {
  const [cities, setCities] = useState<CitySummary[]>([]);
  const [weather, setWeather] = useState<WeatherDetails | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [citiesResponse, overviewResponse] = await Promise.all([
          axios.get<CitySummary[]>('/api/cities'),
          axios.get<Overview>('/api/overview'),
        ]);

        setCities(citiesResponse.data);
        setOverview(overviewResponse.data);
      } catch (requestError) {
        setError('Не удалось подключиться к серверу и загрузить список городов.');
        console.error(requestError);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedCity || selectionMode !== 'city') {
      return;
    }

    const loadWeatherByCity = async () => {
      try {
        setError('');
        setWeatherLoading(true);
        const response = await axios.get<WeatherDetails>('/api/weather', {
          params: { city: selectedCity },
        });
        setWeather(response.data);
        setSelectedPoint({
          latitude: response.data.latitude,
          longitude: response.data.longitude,
        });
        setCities((currentCities) =>
          currentCities.map((city) =>
            city.name === response.data.city
              ? {
                  ...city,
                  condition: response.data.condition,
                  temperature_c: response.data.temperature_c,
                }
              : city
          )
        );
      } catch (requestError) {
        setError('Не удалось загрузить данные о погоде.');
        console.error(requestError);
      } finally {
        setWeatherLoading(false);
      }
    };

    loadWeatherByCity();
  }, [selectedCity, selectionMode, setSelectedPoint]);

  useEffect(() => {
    if (!selectedPoint || selectionMode !== 'coordinates') {
      return;
    }

    const loadWeatherByCoordinates = async () => {
      try {
        setError('');
        setWeatherLoading(true);
        const response = await axios.get<WeatherDetails>('/api/weather/by-coordinates', {
          params: {
            latitude: selectedPoint.latitude,
            longitude: selectedPoint.longitude,
          },
        });
        const selectedPointId = buildPointId(selectedPoint.latitude, selectedPoint.longitude);
        const favoriteForPoint =
          favorites.find((favorite) => favorite.id === selectedPointId) ?? null;
        const isGenericLocation =
          response.data.city === 'Точка на карте' ||
          response.data.country === 'Неизвестная страна' ||
          response.data.country === 'По координатам' ||
          response.data.city.startsWith('Точка ');

        if (isGenericLocation && favoriteForPoint) {
          setWeather({
            ...response.data,
            city: favoriteForPoint.label,
            country: favoriteForPoint.country || response.data.country,
          });
        } else {
          setWeather(response.data);
        }
      } catch (requestError) {
        setError('Не удалось загрузить прогноз для выбранной точки.');
        console.error(requestError);
      } finally {
        setWeatherLoading(false);
      }
    };

    loadWeatherByCoordinates();
  }, [favorites, selectedPoint, selectionMode]);

  const selectableCities = useMemo(
    () => cities.filter((city) => city.name !== BARNAUL_CITY_NAME),
    [cities]
  );

  return {
    cities,
    error,
    loading,
    overview,
    selectableCities,
    setError,
    setWeather,
    weather,
    weatherLoading,
  };
}
