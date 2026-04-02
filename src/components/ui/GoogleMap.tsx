import React, { useEffect, useRef, useState } from 'react';

interface GoogleMapProps {
  lat: number;
  lng: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  zoom?: number;
}

const DEFAULT_LAT = 48.5132;
const DEFAULT_LNG = 32.2597; // Kropyvnytskyi

const KROPYV_BOUNDS = {
  north: 48.570,
  south: 48.450,
  east: 32.340,
  west: 32.170,
};

export const GoogleMap: React.FC<GoogleMapProps> = ({ lat, lng, onLocationSelect, zoom = 14 }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.google?.maps) {
      setReady(true);
      return;
    }
    const iv = setInterval(() => {
      if (window.google?.maps) {
        setReady(true);
        clearInterval(iv);
      }
    }, 300);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const center = { lat: lat || DEFAULT_LAT, lng: lng || DEFAULT_LNG };
    const kropyvBounds = new google.maps.LatLngBounds(
      { lat: KROPYV_BOUNDS.south, lng: KROPYV_BOUNDS.west },
      { lat: KROPYV_BOUNDS.north, lng: KROPYV_BOUNDS.east }
    );

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapId: 'crm_map',
      disableDefaultUI: false,
      streetViewControl: false,
      restriction: {
        latLngBounds: kropyvBounds,
        strictBounds: false,
      },
    });

    const AdvancedMarkerElement = google.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement) {
      console.error('Google Maps marker library is not available.');
      return;
    }

    const el = document.createElement('div');
    const pinSize = 36;
    el.style.cssText = `
      width:${pinSize}px; height:${pinSize + 9}px;
      display:flex; flex-direction:column; align-items:center;
      cursor:${onLocationSelect ? 'crosshair' : 'pointer'};
      transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
      filter: drop-shadow(0 3px 7px rgba(0,0,0,0.28));
      position:relative;
    `;

    const pin = document.createElement('div');
    pin.style.cssText = `
      width:${pinSize}px; height:${pinSize}px;
      border-radius:50% 50% 50% 0; transform:rotate(-45deg);
      background:#3b82f6; border:2.5px solid white;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,.2);
    `;

    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = 'transform:rotate(45deg);display:flex;align-items:center;justify-content:center;';
    iconWrap.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" fill="white"/><rect x="9" y="13" width="6" height="8" rx="0.5" fill="#3b82f6"/></svg>';
    pin.appendChild(iconWrap);
    el.appendChild(pin);

    const tail = document.createElement('div');
    tail.style.cssText = 'width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #3b82f6;margin-top:-1px;';
    el.appendChild(tail);

    if (!document.getElementById('marker-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'marker-pulse-style';
      style.textContent = '@keyframes markerPulse{0%{transform:scale(0.8);opacity:0.4}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}';
      document.head.appendChild(style);
    }

    const pulse = document.createElement('div');
    pulse.style.cssText = `position:absolute;width:${pinSize + 8}px;height:${pinSize + 8}px;border-radius:50%;background:#3b82f6;opacity:0;animation:markerPulse 2.5s ease-out infinite;pointer-events:none;top:-4px;left:-4px;`;
    el.appendChild(pulse);

    markerRef.current = new AdvancedMarkerElement({
      position: center,
      map: googleMapRef.current,
      gmpDraggable: !!onLocationSelect,
      content: el,
    });

    if (onLocationSelect) {
      markerRef.current.addEventListener('dragend', () => {
        const pos = markerRef.current?.position;
        if (!pos) return;
        const nextLat = typeof pos.lat === 'function' ? (pos as google.maps.LatLng).lat() : (pos as google.maps.LatLngLiteral).lat;
        const nextLng = typeof pos.lng === 'function' ? (pos as google.maps.LatLng).lng() : (pos as google.maps.LatLngLiteral).lng;
        onLocationSelect(nextLat, nextLng);
      });

      googleMapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        const newLat = e.latLng?.lat();
        const newLng = e.latLng?.lng();
        if (newLat == null || newLng == null || !markerRef.current) return;
        markerRef.current.position = { lat: newLat, lng: newLng };
        onLocationSelect(newLat, newLng);
      });
    }
  }, [ready]);

  useEffect(() => {
    if (!googleMapRef.current || !markerRef.current || !lat || !lng) return;
    const pos = { lat, lng };
    googleMapRef.current.setCenter(pos);
    markerRef.current.position = pos;
  }, [lat, lng]);

  if (!ready) {
    return (
      <div className="h-full w-full rounded-md border bg-muted/20 flex items-center justify-center" style={{ minHeight: '288px' }}>
        <p className="text-sm text-muted-foreground">Завантаження карти...</p>
      </div>
    );
  }

  return <div ref={mapRef} className="h-full w-full rounded-md border" style={{ minHeight: '288px' }} />;
};
