'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type R = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
};

function MapSizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    // Run several times to catch the container after any fade-in animation settles.
    const timers = [100, 300, 600, 1000].map((ms) => setTimeout(fix, ms));
    window.addEventListener('resize', fix);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

export default function ResourceMap({ resources }: { resources: R[] }) {
  const pts = resources.filter(
    (r): r is R & { lat: number; lng: number } => r.lat !== null && r.lng !== null
  );
  if (pts.length === 0) return null;

  return (
    <div style={{ height: '280px', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[40.7128, -73.96]}
        zoom={10}
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
        scrollWheelZoom={false}
      >
        <MapSizeFix />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pts.map((r) => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={icon}>
            <Popup>
              <strong>{r.name}</strong>
              <br />
              {r.address}
              <br />
              {r.phone}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}