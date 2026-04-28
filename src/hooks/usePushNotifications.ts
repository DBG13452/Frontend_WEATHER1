import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import axios from 'axios';
import { FAVICON_URL, SERVICE_WORKER_URL } from '../constants';
import type {
  BeforeInstallPromptEvent,
  PushSubscriptionPayload,
  TomorrowAlert,
  WeatherDetails,
} from '../types';
import {
  loadFavoritesFromStorage,
  loadPushSubscriptionFromStorage,
  loadTomorrowAlertsFromStorage,
  normalizeNotificationPreferences,
  normalizeTomorrowAlerts,
  persistPushSubscription,
  persistTomorrowAlerts,
} from '../utils/storage';
import {
  buildTomorrowNotificationText,
  getCurrentDateKey,
  urlBase64ToUint8Array,
} from '../utils/weather';

export function usePushNotifications({
  setToastLines,
  setTomorrowAlerts,
  tomorrowAlerts,
}: {
  setToastLines: Dispatch<SetStateAction<string[]>>;
  setTomorrowAlerts: Dispatch<SetStateAction<TomorrowAlert[]>>;
  tomorrowAlerts: TomorrowAlert[];
}) {
  const [pushSubscription, setPushSubscription] = useState<PushSubscriptionPayload | null>(
    loadPushSubscriptionFromStorage
  );
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
  });
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    return window.Notification.permission;
  });
  const previousAlertIdsRef = useRef<string[]>(tomorrowAlerts.map((alertItem) => alertItem.id));
  const pushRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const pushPublicKeyRef = useRef<string | null>(null);
  const isBrowserNotificationSupported = browserNotificationPermission !== 'unsupported';

  useEffect(() => {
    persistPushSubscription(pushSubscription);
  }, [pushSubscription]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const initializeServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
        pushRegistrationRef.current = registration;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          return;
        }

        const subscriptionJson = subscription.toJSON();
        if (
          !subscriptionJson.endpoint ||
          !subscriptionJson.keys?.p256dh ||
          !subscriptionJson.keys?.auth
        ) {
          return;
        }

        setPushSubscription({
          endpoint: subscriptionJson.endpoint,
          expirationTime:
            typeof subscriptionJson.expirationTime === 'number'
              ? subscriptionJson.expirationTime
              : null,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
        });
      } catch (registrationError) {
        console.error(registrationError);
      }
    };

    void initializeServiceWorker();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const syncStandaloneState = () => {
      const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
      setIsStandaloneApp(mediaQuery.matches || iosStandalone === true);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setInstallPromptEvent(installEvent);
    };

    const handleAppInstalled = () => {
      setIsStandaloneApp(true);
      setInstallPromptEvent(null);
      setToastLines(['Приложение установлено. Теперь его можно открывать как отдельное приложение.']);
    };

    syncStandaloneState();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncStandaloneState);
    } else {
      mediaQuery.addListener(syncStandaloneState);
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt as EventListener
      );
      window.removeEventListener('appinstalled', handleAppInstalled);

      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', syncStandaloneState);
      } else {
        mediaQuery.removeListener(syncStandaloneState);
      }
    };
  }, [setToastLines]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return;
    }

    const syncBrowserPermission = () => {
      setBrowserNotificationPermission(window.Notification.permission);
    };

    syncBrowserPermission();
    window.addEventListener('focus', syncBrowserPermission);
    document.addEventListener('visibilitychange', syncBrowserPermission);

    return () => {
      window.removeEventListener('focus', syncBrowserPermission);
      document.removeEventListener('visibilitychange', syncBrowserPermission);
    };
  }, []);

  const showBrowserNotification = useCallback((messages: string[]) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (window.Notification.permission !== 'granted') {
      return;
    }

    const tabIsBackground =
      typeof document !== 'undefined' &&
      (document.visibilityState === 'hidden' || !document.hasFocus());
    if (!tabIsBackground) {
      return;
    }

    try {
      new window.Notification(
        messages.length > 1 ? `Прогноз на завтра (${messages.length})` : 'Прогноз на завтра',
        {
          body: messages.join('\n'),
          icon: FAVICON_URL,
          tag: 'weather-tomorrow-alert',
        }
      );
    } catch (notificationError) {
      console.error(notificationError);
    }
  }, []);

  const registerPushServiceWorker = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      throw new Error('Service Worker is not supported');
    }

    if (pushRegistrationRef.current) {
      return pushRegistrationRef.current;
    }

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    pushRegistrationRef.current = registration;
    return registration;
  }, []);

  const getVapidPublicKey = useCallback(async (): Promise<string> => {
    if (pushPublicKeyRef.current) {
      return pushPublicKeyRef.current;
    }

    const response = await axios.get<{
      enabled: boolean;
      reason: string | null;
      public_key: string | null;
    }>('/api/push/public-key');

    if (!response.data.enabled || !response.data.public_key) {
      throw new Error(response.data.reason || 'Push is disabled on backend');
    }

    pushPublicKeyRef.current = response.data.public_key;
    return response.data.public_key;
  }, []);

  const ensurePushSubscription = useCallback(async (): Promise<PushSubscriptionPayload> => {
    if (typeof window === 'undefined' || !('PushManager' in window)) {
      throw new Error('Push API is not supported');
    }
    if (window.Notification.permission !== 'granted') {
      throw new Error('Browser notifications permission is not granted');
    }

    const registration = await registerPushServiceWorker();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey = await getVapidPublicKey();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const subscriptionJson = subscription.toJSON();
    if (
      !subscriptionJson.endpoint ||
      !subscriptionJson.keys?.p256dh ||
      !subscriptionJson.keys?.auth
    ) {
      throw new Error('Invalid push subscription');
    }

    const payload: PushSubscriptionPayload = {
      endpoint: subscriptionJson.endpoint,
      expirationTime:
        typeof subscriptionJson.expirationTime === 'number'
          ? subscriptionJson.expirationTime
          : null,
      keys: {
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      },
    };
    setPushSubscription(payload);
    return payload;
  }, [getVapidPublicKey, registerPushServiceWorker]);

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return 'unsupported' as const;
    }

    const currentPermission = window.Notification.permission;
    if (currentPermission !== 'default') {
      setBrowserNotificationPermission(currentPermission);
      return currentPermission;
    }

    const requestedPermission = await window.Notification.requestPermission();
    setBrowserNotificationPermission(requestedPermission);
    return requestedPermission;
  }, []);

  const registerPushAlert = useCallback(
    async (
      alert: TomorrowAlert,
      subscriptionPayload: PushSubscriptionPayload,
      options?: { resetLastNotifiedOn?: boolean }
    ) => {
      await axios.post('/api/push/register-alert', {
        subscription: subscriptionPayload,
        alert: {
          id: alert.id,
          label: alert.label,
          country: alert.country,
          latitude: alert.latitude,
          longitude: alert.longitude,
          preferences: normalizeNotificationPreferences(alert.preferences),
        },
        reset_last_notified_on: options?.resetLastNotifiedOn === true,
      });
    },
    []
  );

  const unregisterPushAlert = useCallback(
    async (alertId: string, endpoint?: string) => {
      const subscriptionEndpoint = endpoint || pushSubscription?.endpoint;
      if (!subscriptionEndpoint) {
        return;
      }

      try {
        await axios.post('/api/push/unregister-alert', {
          endpoint: subscriptionEndpoint,
          alert_id: alertId,
        });
      } catch (requestError) {
        console.error(requestError);
      }
    },
    [pushSubscription?.endpoint]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (!isBrowserNotificationSupported) {
      return;
    }
    if (window.Notification.permission !== 'default') {
      return;
    }

    let isCancelled = false;

    const requestPermissionOnFirstVisit = async () => {
      try {
        const permission = await window.Notification.requestPermission();
        if (isCancelled) {
          return;
        }
        setBrowserNotificationPermission(permission);
        if (permission === 'granted') {
          await ensurePushSubscription();
        }
      } catch (permissionError) {
        console.error(permissionError);
      }
    };

    void requestPermissionOnFirstVisit();

    return () => {
      isCancelled = true;
    };
  }, [ensurePushSubscription, isBrowserNotificationSupported]);

  useEffect(() => {
    if (browserNotificationPermission !== 'granted') {
      return;
    }
    if (tomorrowAlerts.length === 0) {
      return;
    }

    const syncAlerts = async () => {
      try {
        const subscriptionPayload = await ensurePushSubscription();
        await Promise.all(
          tomorrowAlerts.map((alertItem) => registerPushAlert(alertItem, subscriptionPayload))
        );
      } catch (syncError) {
        console.error(syncError);
      }
    };

    void syncAlerts();
  }, [
    browserNotificationPermission,
    ensurePushSubscription,
    registerPushAlert,
    tomorrowAlerts,
  ]);

  useEffect(() => {
    const previousIds = new Set(previousAlertIdsRef.current);
    const currentIds = new Set(tomorrowAlerts.map((alertItem) => alertItem.id));
    const removedAlertIds = Array.from(previousIds).filter((alertId) => !currentIds.has(alertId));

    if (removedAlertIds.length > 0 && pushSubscription?.endpoint) {
      removedAlertIds.forEach((alertId) => {
        void unregisterPushAlert(alertId, pushSubscription.endpoint);
      });
    }

    previousAlertIdsRef.current = Array.from(currentIds);
  }, [tomorrowAlerts, pushSubscription?.endpoint, unregisterPushAlert]);

  useEffect(() => {
    let isCancelled = false;

    const checkTomorrowAlertsOnStartup = async () => {
      const storedAlerts = loadTomorrowAlertsFromStorage();
      if (storedAlerts.length === 0) {
        return;
      }

      const todayKey = getCurrentDateKey();
      const favoriteIds = new Set(loadFavoritesFromStorage().map((favorite) => favorite.id));
      const nextAlerts = [...storedAlerts];
      const notificationMessages: string[] = [];

      for (let index = 0; index < nextAlerts.length; index += 1) {
        const alertItem = nextAlerts[index];
        if (!favoriteIds.has(alertItem.id) || alertItem.last_notified_on === todayKey) {
          continue;
        }

        try {
          const response = await axios.get<WeatherDetails>('/api/weather/by-coordinates', {
            params: {
              latitude: alertItem.latitude,
              longitude: alertItem.longitude,
            },
          });

          const message = buildTomorrowNotificationText(
            alertItem.label,
            response.data,
            normalizeNotificationPreferences(alertItem.preferences)
          );
          if (!message) {
            continue;
          }
          notificationMessages.push(message);

          nextAlerts[index] = {
            ...alertItem,
            label: response.data.city || alertItem.label,
            country: response.data.country || alertItem.country,
            latitude: response.data.latitude,
            longitude: response.data.longitude,
            last_notified_on: todayKey,
          };
        } catch (requestError) {
          console.error(requestError);
        }
      }

      if (isCancelled) {
        return;
      }

      const normalizedNextAlerts = normalizeTomorrowAlerts(nextAlerts);
      if (JSON.stringify(normalizedNextAlerts) !== JSON.stringify(storedAlerts)) {
        persistTomorrowAlerts(normalizedNextAlerts);
        setTomorrowAlerts(normalizedNextAlerts);
      }

      if (notificationMessages.length > 0) {
        setToastLines(notificationMessages);
        showBrowserNotification(notificationMessages);
      }
    };

    checkTomorrowAlertsOnStartup();

    return () => {
      isCancelled = true;
    };
  }, [setToastLines, setTomorrowAlerts, showBrowserNotification]);

  const handleInstallApp = useCallback(async () => {
    if (!installPromptEvent) {
      const isIosSafari =
        typeof window !== 'undefined' &&
        /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
        /safari/i.test(window.navigator.userAgent) &&
        !/crios|fxios|edgios|chrome|android/i.test(window.navigator.userAgent);

      if (isIosSafari) {
        setToastLines([
          'Для iPhone/iPad: нажмите Поделиться в Safari и выберите "На экран Домой".',
        ]);
        return;
      }

      setToastLines([
        'Установка пока недоступна в этом браузере. Попробуйте Chrome/Edge на HTTPS-домене.',
      ]);
      return;
    }

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setToastLines(['Установка приложения подтверждена.']);
      }
    } catch (installError) {
      console.error(installError);
      setToastLines(['Не удалось запустить установку приложения.']);
    } finally {
      setInstallPromptEvent(null);
    }
  }, [installPromptEvent, setToastLines]);

  const handleTestPush = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setToastLines(['Этот браузер не поддерживает системные уведомления.']);
        return;
      }

      if (window.Notification.permission === 'denied') {
        setBrowserNotificationPermission('denied');
        setToastLines(['Уведомления заблокированы в браузере. Разрешите их в настройках сайта.']);
        return;
      }

      const permission = await requestBrowserNotificationPermission();
      if (permission !== 'granted') {
        setToastLines(['Без разрешения браузера тест push недоступен.']);
        return;
      }

      const subscriptionPayload = await ensurePushSubscription();

      const response = await axios.post<{
        ok: boolean;
        sent: number;
        failed: number;
        targeted: number;
      }>('/api/push/test', {
        endpoint: subscriptionPayload.endpoint,
        subscription: subscriptionPayload,
        title: 'Тест push-уведомления',
        body: 'Если вы видите это системное уведомление, push работает корректно.',
      });

      if (response.data.sent > 0) {
        setToastLines(['Тест push отправлен. Проверьте системное уведомление браузера.']);
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            if (window.Notification.permission === 'granted') {
              new window.Notification('Тест push-уведомления', {
                body: 'Проверка канала push: если вы видите это сообщение, уведомления работают.',
                icon: FAVICON_URL,
                tag: 'manual-push-test-fallback',
              });
            }
          } catch (notificationError) {
            console.error(notificationError);
          }
        }
      } else {
        setToastLines(['Тест push не отправлен. Проверьте подписку и разрешение уведомлений.']);
      }
    } catch (requestError) {
      console.error(requestError);
      const backendDetail =
        axios.isAxiosError(requestError) &&
        requestError.response?.data &&
        typeof (requestError.response.data as { detail?: unknown }).detail === 'string'
          ? ((requestError.response.data as { detail: string }).detail ?? null)
          : null;
      const fallbackMessage =
        requestError instanceof Error ? requestError.message : 'Неизвестная ошибка';
      setToastLines([
        backendDetail
          ? `Ошибка тестового push: ${backendDetail}`
          : `Ошибка тестового push: ${fallbackMessage}`,
      ]);
    }
  }, [ensurePushSubscription, requestBrowserNotificationPermission, setToastLines]);

  return {
    canShowInstallButton: !isStandaloneApp,
    ensurePushSubscription,
    handleInstallApp,
    handleTestPush,
    isBrowserNotificationSupported,
    registerPushAlert,
    requestBrowserNotificationPermission,
    unregisterPushAlert,
  };
}
