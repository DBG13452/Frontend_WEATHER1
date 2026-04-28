import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { CoordinatePoint } from '../types';

export function MapClickHandler({
  onSelect,
}: {
  onSelect: (point: CoordinatePoint) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

export function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 5));
  }, [center, map]);

  return null;
}
