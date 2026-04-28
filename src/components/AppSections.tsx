import React from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { NOTIFICATION_PREFERENCE_OPTIONS } from '../constants';
import type {
  CitySummary,
  CoordinatePoint,
  FavoritePoint,
  NotificationPreferences,
  Overview,
  SelectionMode,
  WeatherDetails,
} from '../types';
import { MapClickHandler, RecenterMap } from './MapHelpers';

type FormatTemperature = (temperature: number) => string;
type HeroCity = Pick<WeatherDetails, 'city' | 'temperature_c' | 'condition'> | null;

export function TopActions({
  canShowInstallButton,
  handleInstallApp,
  handleScrollToHourly,
  handleScrollToMap,
  handleTestPush,
  handleThemeToggle,
  theme,
}: {
  canShowInstallButton: boolean;
  handleInstallApp: () => void | Promise<void>;
  handleScrollToHourly: () => void;
  handleScrollToMap: () => void;
  handleTestPush: () => void | Promise<void>;
  handleThemeToggle: () => void;
  theme: 'light' | 'dark';
}) {
  return (
    <div className="top-actions">
      <div className="hero-shortcuts">
        <button className="hero-shortcut-button" onClick={handleScrollToHourly} type="button">
          Перейти к прогнозам
        </button>
        <button className="hero-shortcut-button" onClick={handleScrollToMap} type="button">
          Перейти к карте
        </button>
      </div>

      <div className="page-toolbar">
        {canShowInstallButton && (
          <button className="install-app-button" onClick={handleInstallApp} type="button">
            Установить приложение
          </button>
        )}
        <button className="browser-notification-toggle" onClick={handleTestPush} type="button">
          Тест push
        </button>
        <button className="theme-toggle" onClick={handleThemeToggle} type="button">
          {theme === 'light' ? 'Темная тема' : 'Светлая тема'}
        </button>
      </div>
    </div>
  );
}

export function HeroSummary({
  formatTemperature,
  heroCity,
  heroSectionRef,
  overview,
  shouldShowHeroLoading,
  weather,
}: {
  formatTemperature: FormatTemperature;
  heroCity: HeroCity;
  heroSectionRef: React.RefObject<HTMLElement | null>;
  overview: Overview | null;
  shouldShowHeroLoading: boolean;
  weather: WeatherDetails | null;
}) {
  return (
    <section className="hero hero--centered hero--single" ref={heroSectionRef}>
      <div className="hero__panel hero__panel--summary">
        <p className="hero__panel-label">{overview?.title ?? 'Сводка'}</p>
        <h2>
          {heroCity?.city ?? (
            shouldShowHeroLoading ? (
              <span className="hero-loading" aria-label="Загружаем данные о погоде" role="status">
                <span className="hero-loading__spinner" aria-hidden="true" />
              </span>
            ) : (
              'Выберите город на карте или в Избранном'
            )
          )}
        </h2>
        <p className="hero__temperature">
          {heroCity ? formatTemperature(heroCity.temperature_c) : '--'}
        </p>
        <p className="hero__meta">
          Ощущается как: {weather ? formatTemperature(weather.feels_like_c) : '--'}
        </p>
        <p className="hero__condition">{heroCity?.condition ?? ''}</p>
      </div>
    </section>
  );
}

export function CurrentWeatherCard({
  error,
  formatTemperature,
  loading,
  weather,
  weatherLoading,
}: {
  error: string;
  formatTemperature: FormatTemperature;
  loading: boolean;
  weather: WeatherDetails | null;
  weatherLoading: boolean;
}) {
  return (
    <div className="weather-card">
      {(loading || weatherLoading) && <p className="status">Загружаем данные...</p>}
      {!loading && error && <p className="status status--error">{error}</p>}

      {!loading && weather && (
        <>
          <div className="weather-card__header">
            <div>
              <p className="section-label">Сейчас</p>
              <h2>
                {weather.city}, {weather.country}
              </h2>
              <p className="updated-at">Обновлено: {weather.updated_at}</p>
            </div>

            <div className="weather-card__hero-value">
              {formatTemperature(weather.temperature_c)}
            </div>
          </div>

          <p className="weather-condition">{weather.condition}</p>
          <div className="metrics-grid">
            <article className="metric">
              <span>Ощущается как</span>
              <strong>{formatTemperature(weather.feels_like_c)}</strong>
            </article>
            <article className="metric">
              <span>Влажность</span>
              <strong>{weather.humidity}%</strong>
            </article>
            <article className="metric">
              <span>Ветер</span>
              <strong>{weather.wind_speed} м/с</strong>
            </article>
            <article className="metric">
              <span>Давление</span>
              <strong>{weather.pressure_mmhg} мм рт. ст.</strong>
            </article>
            <article className="metric">
              <span>Видимость</span>
              <strong>{weather.visibility_km} км</strong>
            </article>
          </div>
        </>
      )}
    </div>
  );
}

export function CityControls({
  citySearchQuery,
  formatTemperature,
  handleAddFavorite,
  handleCitySearch,
  handleCitySelect,
  isCurrentFavorite,
  selectableCities,
  selectedCity,
  selectionMode,
  setCitySearchQuery,
  weather,
}: {
  citySearchQuery: string;
  formatTemperature: FormatTemperature;
  handleAddFavorite: () => void;
  handleCitySearch: (event: React.FormEvent<HTMLFormElement>) => void;
  handleCitySelect: (city: CitySummary) => void;
  isCurrentFavorite: boolean;
  selectableCities: CitySummary[];
  selectedCity: string;
  selectionMode: SelectionMode;
  setCitySearchQuery: React.Dispatch<React.SetStateAction<string>>;
  weather: WeatherDetails | null;
}) {
  return (
    <div className="controls-card controls-card--hero">
      <div>
        <p className="section-label">Выбор города</p>
        <h3>Быстрый переход к готовым локациям</h3>
      </div>

      <div className="city-grid">
        {selectableCities.map((city) => (
          <button
            key={city.name}
            className={`city-chip ${
              selectionMode === 'city' && selectedCity === city.name ? 'city-chip--active' : ''
            }`}
            onClick={() => handleCitySelect(city)}
            type="button"
          >
            <span>{city.name}</span>
            <small>
              {formatTemperature(city.temperature_c)} · {city.condition}
            </small>
          </button>
        ))}
      </div>

      <div className="controls-quick-actions">
        <form className="map-city-search controls-city-search" onSubmit={handleCitySearch}>
          <input
            className="map-city-search__input"
            onChange={(event) => setCitySearchQuery(event.target.value)}
            placeholder="Введите название города"
            type="text"
            value={citySearchQuery}
          />
          <button className="map-city-search__button" type="submit">
            Выбрать
          </button>
        </form>
        <button
          className="favorite-action controls-add-favorite"
          disabled={!weather || isCurrentFavorite}
          onClick={handleAddFavorite}
          type="button"
        >
          {isCurrentFavorite ? 'Уже в избранном' : 'Добавить в избранное'}
        </button>
      </div>
    </div>
  );
}

export function FavoritesPanel({
  activeAlertIds,
  favorites,
  handleFavoriteRemove,
  handleFavoriteSelect,
}: {
  activeAlertIds: Set<string>;
  favorites: FavoritePoint[];
  handleFavoriteRemove: (favoriteId: string) => void;
  handleFavoriteSelect: (favorite: FavoritePoint) => void;
}) {
  return (
    <div className="controls-card controls-card--favorites">
      <div>
        <p className="section-label">Избранное</p>
        <h3>Сохраненные локации</h3>
      </div>

      <div className="favorites-panel">
        <div className="favorites-list">
          {favorites.length === 0 && (
            <p className="favorites-empty">Пока нет сохраненных точек.</p>
          )}

          {favorites.map((favorite) => (
            <div className="favorite-item" key={favorite.id}>
              <button
                className="favorite-item__main"
                onClick={() => handleFavoriteSelect(favorite)}
                type="button"
              >
                <strong>{favorite.label}</strong>
                <span>{favorite.country}</span>
                <small className="favorite-item__alert">
                  {activeAlertIds.has(favorite.id)
                    ? 'Уведомление на завтра: включено'
                    : 'Уведомление на завтра: выключено'}
                </small>
                <small>
                  {favorite.latitude.toFixed(4)}, {favorite.longitude.toFixed(4)}
                </small>
              </button>
              <button
                className="favorite-item__remove"
                onClick={() => handleFavoriteRemove(favorite.id)}
                type="button"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NotificationSettings({
  handleNotificationPreferenceToggle,
  handleToggleTomorrowAlert,
  isCurrentFavorite,
  isTomorrowAlertEnabled,
  notificationPreferences,
  weather,
}: {
  handleNotificationPreferenceToggle: (key: keyof NotificationPreferences) => void;
  handleToggleTomorrowAlert: () => void | Promise<void>;
  isCurrentFavorite: boolean;
  isTomorrowAlertEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  weather: WeatherDetails | null;
}) {
  return (
    <aside className="hero__panel hero__settings" aria-label="Настройка уведомлений">
      <p className="hero__panel-label">Настройка уведомлений</p>
      <h3>Выберите параметры в алерте</h3>
      <p className="hero__settings-hint">
        {weather
          ? `${weather.city}, ${weather.country}`
          : 'Выберите город для настройки уведомлений'}
      </p>

      <div className="hero__settings-options">
        {NOTIFICATION_PREFERENCE_OPTIONS.map((option) => (
          <label className="hero__settings-option" key={option.key}>
            <input
              checked={notificationPreferences[option.key]}
              onChange={() => handleNotificationPreferenceToggle(option.key)}
              type="checkbox"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <button
        className={`notification-settings__toggle ${
          isTomorrowAlertEnabled
            ? 'notification-settings__toggle--off'
            : 'notification-settings__toggle--on'
        }`}
        disabled={!weather || !isCurrentFavorite}
        onClick={handleToggleTomorrowAlert}
        type="button"
      >
        {isTomorrowAlertEnabled ? 'Отключить уведомления' : 'Включить уведомления'}
      </button>
      {!isCurrentFavorite && (
        <small className="hero__settings-note">
          Добавьте выбранный город в избранное, чтобы включить уведомления.
        </small>
      )}
    </aside>
  );
}

export function HourlyForecastCard({
  formatTemperature,
  hourlySectionRef,
  weather,
}: {
  formatTemperature: FormatTemperature;
  hourlySectionRef: React.RefObject<HTMLElement | null>;
  weather: WeatherDetails | null;
}) {
  return (
    <section className="hourly-card" ref={hourlySectionRef}>
      <div className="forecast-card__header">
        <div>
          <p className="section-label">Почасовой прогноз</p>
          <h3>Погода на 24 часа</h3>
        </div>
        <p>Для выбранной точки с шагом в 1 час.</p>
      </div>

      <div className="hourly-scroll" role="region" aria-label="Почасовой прогноз на 24 часа">
        <div className="hourly-grid">
          {weather?.hourly_forecast.map((hour) => (
            <article className="hourly-item" key={`${hour.time}-${hour.condition}`}>
              <p className="hourly-item__time">{hour.time}</p>
              <strong>{hour.condition}</strong>
              <p className="hourly-item__temp">{formatTemperature(hour.temperature_c)}</p>
              <p className="hourly-item__precipitation">
                Вероятность осадков: {hour.precipitation_chance}%
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ForecastCard({
  formatTemperature,
  overview,
  weather,
}: {
  formatTemperature: FormatTemperature;
  overview: Overview | null;
  weather: WeatherDetails | null;
}) {
  return (
    <section className="forecast-card">
      <div className="forecast-card__header">
        <div>
          <p className="section-label">Прогноз</p>
          <h3>Ближайшие 7 дней</h3>
        </div>
        <p>{overview?.description}</p>
      </div>

      <div className="forecast-scroll" role="region" aria-label="Прогноз на ближайшие дни">
        <div className="forecast-grid">
          {weather?.forecast.map((day) => (
            <article className="forecast-item" key={day.day}>
              <p className="forecast-item__day">{day.day}</p>
              <strong>{day.condition}</strong>
              <p>
                {formatTemperature(day.min_temp_c)} / {formatTemperature(day.max_temp_c)}
              </p>
              <span>Осадки: {day.precipitation_chance}%</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WeatherMapSection({
  citySearchQuery,
  formatTemperature,
  handleAddFavorite,
  handleCitySearch,
  handleMapSelect,
  isCurrentFavorite,
  mapCenter,
  mapSectionRef,
  rainLayerUrl,
  selectedPoint,
  setCitySearchQuery,
  weather,
}: {
  citySearchQuery: string;
  formatTemperature: FormatTemperature;
  handleAddFavorite: () => void;
  handleCitySearch: (event: React.FormEvent<HTMLFormElement>) => void;
  handleMapSelect: (point: CoordinatePoint) => void;
  isCurrentFavorite: boolean;
  mapCenter: [number, number];
  mapSectionRef: React.RefObject<HTMLElement | null>;
  rainLayerUrl: string;
  selectedPoint: CoordinatePoint | null;
  setCitySearchQuery: React.Dispatch<React.SetStateAction<string>>;
  weather: WeatherDetails | null;
}) {
  return (
    <section className="map-card" ref={mapSectionRef}>
      <div className="map-card__header">
        <div>
          <p className="section-label">Карта</p>
          <h3>Нажмите на карту для выбора города</h3>
        </div>
        <p>Базовая карта OpenStreetMap</p>
      </div>

      <div className="map-card__body">
        <div className="map-frame">
          <MapContainer
            attributionControl={false}
            center={mapCenter}
            zoom={5}
            maxZoom={10}
            className="leaflet-map"
            scrollWheelZoom
          >
            <RecenterMap center={mapCenter} />
            <TileLayer
              className="base-map-layer"
              maxZoom={19}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <TileLayer
              className="rainviewer-layer"
              maxNativeZoom={10}
              maxZoom={10}
              opacity={0.5}
              url={rainLayerUrl}
            />
            {selectedPoint && (
              <Marker position={[selectedPoint.latitude, selectedPoint.longitude]}>
                <Popup>
                  <div className="popup-weather">
                    <strong>{weather?.city ?? 'Выбранная точка'}</strong>
                    <span>
                      {weather ? formatTemperature(weather.temperature_c) : 'Загрузка...'}
                    </span>
                    <span>{weather?.condition ?? 'Получаем данные о погоде'}</span>
                  </div>
                </Popup>
              </Marker>
            )}
            <MapClickHandler onSelect={handleMapSelect} />
          </MapContainer>
          <div className="custom-attribution">Источники: OpenStreetMap contributors, RainViewer</div>
        </div>

        <div className="map-card__info">
          <div className="map-card__info-panel">
            <span>Избранное</span>
            <strong>
              <button
                className="favorite-action"
                disabled={!weather || isCurrentFavorite}
                onClick={handleAddFavorite}
                type="button"
              >
                {isCurrentFavorite ? 'Уже в избранном' : 'Добавить в избранное'}
              </button>
            </strong>
          </div>
          <div className="map-card__info-panel">
            <span>Определенный город</span>
            <strong>{weather ? `${weather.city}, ${weather.country}` : 'Загрузка...'}</strong>
          </div>
          <form className="map-city-search" onSubmit={handleCitySearch}>
            <input
              className="map-city-search__input"
              onChange={(event) => setCitySearchQuery(event.target.value)}
              placeholder="Введите название города"
              type="text"
              value={citySearchQuery}
            />
            <button className="map-city-search__button" type="submit">
              Показать
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export function ToastBanner({
  handleCloseToast,
  toastLines,
}: {
  handleCloseToast: () => void;
  toastLines: string[];
}) {
  if (toastLines.length === 0) {
    return null;
  }

  return (
    <aside className="toast-banner" role="status" aria-live="polite">
      <div className="toast-banner__header">
        <strong>Прогноз на завтра</strong>
        <button className="toast-banner__close" onClick={handleCloseToast} type="button">
          Закрыть
        </button>
      </div>
      <div className="toast-banner__body">
        {toastLines.map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      </div>
    </aside>
  );
}
