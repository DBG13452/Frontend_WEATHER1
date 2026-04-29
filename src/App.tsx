import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './leafletSetup';
import './App.css';
import {
  CityControls,
  CurrentWeatherCard,
  FavoritesPanel,
  ForecastCard,
  HeroSummary,
  HourlyForecastCard,
  NotificationSettings,
  ToastBanner,
  TopActions,
  WeatherMapSection,
} from './components/AppSections';
import {
  FAVORITES_STORAGE_KEY,
  SELECTION_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './constants';
import type {
  CitySummary,
  CoordinatePoint,
  FavoritePoint,
  NotificationPreferences,
  PersistedSelection,
  SelectionMode,
  TomorrowAlert,
} from './types';
import {
  loadFavoritesFromStorage,
  loadNotificationPreferencesFromStorage,
  loadSelectionFromStorage,
  loadThemeFromStorage,
  loadTomorrowAlertsFromStorage,
  normalizeFavorites,
  normalizeNotificationPreferences,
  persistNotificationPreferences,
  persistTomorrowAlerts,
} from './utils/storage';
import {
  buildPointId,
  formatSignedTemperature,
} from './utils/weather';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useRainViewerLayer } from './hooks/useRainViewerLayer';
import { useWeatherData } from './hooks/useWeatherData';
import { useWeatherSelection } from './hooks/useWeatherSelection';

axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

function App() {
  const persistedSelection = useMemo(loadSelectionFromStorage, []);
  const [selectedCity, setSelectedCity] = useState<string>(persistedSelection.selectedCity);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(
    persistedSelection.selectionMode
  );
  const [selectedPoint, setSelectedPoint] = useState<CoordinatePoint | null>(
    persistedSelection.selectedPoint
  );
  const [favorites, setFavorites] = useState<FavoritePoint[]>(loadFavoritesFromStorage);
  const rainLayerUrl = useRainViewerLayer();
  const {
    error,
    loading,
    overview,
    selectableCities,
    setError,
    setWeather,
    weather,
    weatherLoading,
  } = useWeatherData({
    favorites,
    selectedCity,
    selectedPoint,
    selectionMode,
    setSelectedPoint,
  });
  const [tomorrowAlerts, setTomorrowAlerts] = useState<TomorrowAlert[]>(
    loadTomorrowAlertsFromStorage
  );
  const {
    activeAlertIds,
    currentAlert,
    currentFavorite,
    currentPointId,
    heroCity,
    isCurrentFavorite,
    isTomorrowAlertEnabled,
    mapCenter,
    selectedFavoriteIndex,
    shouldShowHeroLoading,
  } = useWeatherSelection({
    favorites,
    loading,
    selectedPoint,
    tomorrowAlerts,
    weather,
    weatherLoading,
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(loadThemeFromStorage);
  const [citySearchQuery, setCitySearchQuery] = useState<string>(
    persistedSelection.citySearchQuery
  );
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    loadNotificationPreferencesFromStorage
  );
  const [toastLines, setToastLines] = useState<string[]>([]);
  const {
    canShowInstallButton,
    ensurePushSubscription,
    handleInstallApp,
    handleTestPush,
    isBrowserNotificationSupported,
    registerPushAlert,
    requestBrowserNotificationPermission,
    unregisterPushAlert,
  } = usePushNotifications({
    setToastLines,
    setTomorrowAlerts,
    tomorrowAlerts,
  });
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const hourlySectionRef = useRef<HTMLElement | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const normalizedFavorites = normalizeFavorites(favorites);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalizedFavorites));
  }, [favorites]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    persistNotificationPreferences(notificationPreferences);
  }, [notificationPreferences]);

  useEffect(() => {
    if (!selectedCity && !selectedPoint && !citySearchQuery) {
      window.localStorage.removeItem(SELECTION_STORAGE_KEY);
      return;
    }

    const selectionPayload: PersistedSelection = {
      selectionMode,
      selectedCity,
      selectedPoint,
      citySearchQuery,
    };
    window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectionPayload));
  }, [citySearchQuery, selectedCity, selectedPoint, selectionMode]);

  useEffect(() => {
    persistTomorrowAlerts(tomorrowAlerts);
  }, [tomorrowAlerts]);

  useEffect(() => {
    setTomorrowAlerts((currentAlerts) => {
      const favoriteById = new Map(favorites.map((favorite) => [favorite.id, favorite]));
      let hasChanges = false;

      const syncedAlerts: TomorrowAlert[] = [];
      currentAlerts.forEach((alertItem) => {
        const favorite = favoriteById.get(alertItem.id);
        if (!favorite) {
          hasChanges = true;
          return;
        }

        if (
          alertItem.label !== favorite.label ||
          alertItem.country !== favorite.country ||
          alertItem.latitude !== favorite.latitude ||
          alertItem.longitude !== favorite.longitude
        ) {
          hasChanges = true;
          syncedAlerts.push({
            ...alertItem,
            label: favorite.label,
            country: favorite.country,
            latitude: favorite.latitude,
            longitude: favorite.longitude,
          });
          return;
        }

        syncedAlerts.push(alertItem);
      });

      return hasChanges ? syncedAlerts : currentAlerts;
    });
  }, [favorites]);

  useEffect(() => {
    if (toastLines.length === 0) {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      return;
    }

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastLines([]);
      toastTimerRef.current = null;
    }, 15000);

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toastLines]);

  useEffect(() => {
    if (!currentAlert) {
      return;
    }

    setNotificationPreferences(normalizeNotificationPreferences(currentAlert.preferences));
  }, [currentAlert]);

  const formatTemperature = formatSignedTemperature;

  const handleCitySelect = (city: CitySummary) => {
    setSelectionMode('city');
    setSelectedCity(city.name);
    setCitySearchQuery(city.name);
    setSelectedPoint({
      latitude: city.latitude,
      longitude: city.longitude,
    });
  };

  const handleMapSelect = (point: CoordinatePoint) => {
    setSelectionMode('coordinates');
    setSelectedCity('');
    setSelectedPoint(point);
  };

  const selectFavorite = (favorite: FavoritePoint) => {
    setError('');
    setSelectionMode('coordinates');
    setSelectedCity('');
    setSelectedPoint({
      latitude: favorite.latitude,
      longitude: favorite.longitude,
    });
    setCitySearchQuery(favorite.label);
  };

  const handleAddFavorite = () => {
    if (!weather || isCurrentFavorite) {
      return;
    }

    const favoriteId = buildPointId(weather.latitude, weather.longitude);

    setFavorites((currentFavorites) => {
      if (currentFavorites.some((favorite) => favorite.id === favoriteId)) {
        return currentFavorites;
      }

      return [
        {
          id: favoriteId,
          label: weather.city,
          country: weather.country,
          latitude: weather.latitude,
          longitude: weather.longitude,
        },
        ...currentFavorites,
      ];
    });
  };

  const handleFavoriteSelect = (favorite: FavoritePoint) => {
    selectFavorite(favorite);
  };

  const handleFavoriteStep = (direction: -1 | 1) => {
    if (favorites.length < 2) {
      return;
    }

    let nextIndex = direction > 0 ? 0 : favorites.length - 1;
    if (selectedFavoriteIndex >= 0) {
      nextIndex =
        (selectedFavoriteIndex + direction + favorites.length) % favorites.length;
    }

    const nextFavorite = favorites[nextIndex];
    if (!nextFavorite) {
      return;
    }

    selectFavorite(nextFavorite);
  };

  const handlePreviousFavorite = () => {
    handleFavoriteStep(-1);
  };

  const handleNextFavorite = () => {
    handleFavoriteStep(1);
  };

  const handleFavoriteRemove = (favoriteId: string) => {
    setFavorites((currentFavorites) =>
      currentFavorites.filter((favorite) => favorite.id !== favoriteId)
    );
    const selectedPointId = selectedPoint
      ? buildPointId(selectedPoint.latitude, selectedPoint.longitude)
      : null;
    const isRemovedFavoriteSelected =
      selectedPointId === favoriteId || currentPointId === favoriteId;

    if (isRemovedFavoriteSelected) {
      setSelectionMode('city');
      setSelectedCity('');
      setSelectedPoint(null);
      setCitySearchQuery('');
      setWeather(null);
      setError('');
    }
    setTomorrowAlerts((currentAlerts) => {
      const nextAlerts = currentAlerts.filter((alertItem) => alertItem.id !== favoriteId);
      persistTomorrowAlerts(nextAlerts);
      return nextAlerts;
    });
    void unregisterPushAlert(favoriteId);
  };

  const handleNotificationPreferenceToggle = (key: keyof NotificationPreferences) => {
    setNotificationPreferences((currentPreferences) => {
      const nextPreferences = {
        ...currentPreferences,
        [key]: !currentPreferences[key],
      };

      if (currentPointId && isTomorrowAlertEnabled) {
        setTomorrowAlerts((currentAlerts) => {
          const nextAlerts = currentAlerts.map((alertItem) =>
            alertItem.id === currentPointId
              ? {
                  ...alertItem,
                  preferences: normalizeNotificationPreferences(nextPreferences),
                }
              : alertItem
          );
          persistTomorrowAlerts(nextAlerts);
          return nextAlerts;
        });
      }

      return nextPreferences;
    });
  };

  const handleToggleTomorrowAlert = async () => {
    if (!weather || !currentPointId || !isCurrentFavorite) {
      return;
    }

    if (isTomorrowAlertEnabled) {
      setTomorrowAlerts((currentAlerts) => {
        const nextAlerts = currentAlerts.filter((alertItem) => alertItem.id !== currentPointId);
        persistTomorrowAlerts(nextAlerts);
        return nextAlerts;
      });
      void unregisterPushAlert(currentPointId);
      setToastLines([`Уведомление для "${weather.city}" отключено.`]);
      return;
    }

    const nextAlert: TomorrowAlert = {
      id: currentPointId,
      label: currentFavorite?.label ?? weather.city,
      country: currentFavorite?.country ?? weather.country,
      latitude: weather.latitude,
      longitude: weather.longitude,
      last_notified_on: null,
      preferences: normalizeNotificationPreferences(notificationPreferences),
    };

    setTomorrowAlerts((currentAlerts) => {
      if (currentAlerts.some((alertItem) => alertItem.id === currentPointId)) {
        return currentAlerts;
      }

      const nextAlerts = [nextAlert, ...currentAlerts];
      persistTomorrowAlerts(nextAlerts);
      return nextAlerts;
    });

    if (!isBrowserNotificationSupported) {
      setToastLines([
        `Уведомление для "${weather.city}" сохранено, но браузер не поддерживает системные уведомления.`,
      ]);
      return;
    }

    const notificationPermission = await requestBrowserNotificationPermission();
    if (notificationPermission === 'denied') {
      setToastLines([
        `Уведомление для "${weather.city}" сохранено, но уведомления браузера заблокированы.`,
      ]);
      return;
    }

    try {
      if (notificationPermission !== 'granted') {
        setToastLines([
          `Уведомление для "${weather.city}" сохранено. Чтобы получать push при закрытой вкладке, разрешите уведомления браузера.`,
        ]);
        return;
      }

      const subscriptionPayload = await ensurePushSubscription();
      await registerPushAlert(nextAlert, subscriptionPayload, { resetLastNotifiedOn: true });
      setToastLines([`Уведомление для "${weather.city}" включено.`]);
    } catch (registrationError) {
      console.error(registrationError);
      setToastLines([
        `Уведомление для "${weather.city}" сохранено, но не удалось сразу синхронизировать push на сервере.`,
      ]);
    }
  };

  const handleThemeToggle = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  const handleCitySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCity = citySearchQuery.trim();

    if (!normalizedCity) {
      setError('Введите название города.');
      return;
    }

    setError('');
    setSelectionMode('city');
    setSelectedCity(normalizedCity);
  };

  const handleScrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToHourly = () => {
    hourlySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToTop = () => {
    heroSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCloseToast = () => {
    setToastLines([]);
  };

  const favoritePositionLabel =
    favorites.length >= 2
      ? selectedFavoriteIndex >= 0
        ? `Избранное: ${selectedFavoriteIndex + 1} из ${favorites.length}`
        : `Избранное: ${favorites.length} городов`
      : null;


  return (
    <div className={`app-shell app-shell--${theme}`}>
      <main className="page">
        <TopActions
          canShowInstallButton={canShowInstallButton}
          handleInstallApp={handleInstallApp}
          handleScrollToHourly={handleScrollToHourly}
          handleScrollToMap={handleScrollToMap}
          handleTestPush={handleTestPush}
          handleThemeToggle={handleThemeToggle}
          theme={theme}
        />

        <HeroSummary
          canNavigateFavorites={favorites.length >= 2}
          disableFavoriteNavigation={weatherLoading}
          favoritePositionLabel={favoritePositionLabel}
          formatTemperature={formatTemperature}
          handleNextFavorite={handleNextFavorite}
          handlePreviousFavorite={handlePreviousFavorite}
          heroCity={heroCity}
          heroSectionRef={heroSectionRef}
          overview={overview}
          shouldShowHeroLoading={shouldShowHeroLoading}
          weather={weather}
        />

        <CurrentWeatherCard
          error={error}
          formatTemperature={formatTemperature}
          loading={loading}
          weather={weather}
          weatherLoading={weatherLoading}
        />

        <CityControls
          citySearchQuery={citySearchQuery}
          formatTemperature={formatTemperature}
          handleAddFavorite={handleAddFavorite}
          handleCitySearch={handleCitySearch}
          handleCitySelect={handleCitySelect}
          isCurrentFavorite={isCurrentFavorite}
          selectableCities={selectableCities}
          selectedCity={selectedCity}
          selectionMode={selectionMode}
          setCitySearchQuery={setCitySearchQuery}
          weather={weather}
        />

        <FavoritesPanel
          activeAlertIds={activeAlertIds}
          favorites={favorites}
          handleFavoriteRemove={handleFavoriteRemove}
          handleFavoriteSelect={handleFavoriteSelect}
        />

        <HourlyForecastCard
          formatTemperature={formatTemperature}
          hourlySectionRef={hourlySectionRef}
          weather={weather}
        />

        <ForecastCard
          formatTemperature={formatTemperature}
          overview={overview}
          weather={weather}
        />

        <NotificationSettings
          handleNotificationPreferenceToggle={handleNotificationPreferenceToggle}
          handleToggleTomorrowAlert={handleToggleTomorrowAlert}
          isCurrentFavorite={isCurrentFavorite}
          isTomorrowAlertEnabled={isTomorrowAlertEnabled}
          notificationPreferences={notificationPreferences}
          weather={weather}
        />

        <WeatherMapSection
          citySearchQuery={citySearchQuery}
          formatTemperature={formatTemperature}
          handleAddFavorite={handleAddFavorite}
          handleCitySearch={handleCitySearch}
          handleMapSelect={handleMapSelect}
          isCurrentFavorite={isCurrentFavorite}
          mapCenter={mapCenter}
          mapSectionRef={mapSectionRef}
          rainLayerUrl={rainLayerUrl}
          selectedPoint={selectedPoint}
          setCitySearchQuery={setCitySearchQuery}
          weather={weather}
        />

        <ToastBanner handleCloseToast={handleCloseToast} toastLines={toastLines} />

        <button className="scroll-top-button" onClick={handleScrollToTop} type="button">
          ↑
        </button>
      </main>
    </div>
  );
}

export default App;








