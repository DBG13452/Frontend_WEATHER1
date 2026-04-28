import { useEffect, useState } from 'react';
import { FALLBACK_RAIN_LAYER_URL, RAINVIEWER_API_URL } from '../constants';

type RainViewerFrame = {
  path?: string;
};

type RainViewerResponse = {
  host?: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
};

const buildRainLayerUrl = (host: string, path: string) =>
  `${host}${path}/256/{z}/{x}/{y}/6/1_1.png`;

export function useRainViewerLayer() {
  const [rainLayerUrl, setRainLayerUrl] = useState<string>(FALLBACK_RAIN_LAYER_URL);

  useEffect(() => {
    let isCancelled = false;

    const loadRainViewerLayer = async () => {
      try {
        const response = await fetch(RAINVIEWER_API_URL);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as RainViewerResponse;
        const host = typeof payload.host === 'string' ? payload.host : '';
        const latestPastFrame = payload.radar?.past?.at(-1)?.path;
        const latestNowcastFrame = payload.radar?.nowcast?.[0]?.path;
        const resolvedPath = latestPastFrame || latestNowcastFrame;

        if (!host || !resolvedPath || isCancelled) {
          return;
        }

        setRainLayerUrl(buildRainLayerUrl(host, resolvedPath));
      } catch (error) {
        console.error(error);
      }
    };

    void loadRainViewerLayer();

    return () => {
      isCancelled = true;
    };
  }, []);

  return rainLayerUrl;
}
