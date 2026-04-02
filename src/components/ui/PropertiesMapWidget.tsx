import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_LAT = 48.5132;
const DEFAULT_LNG = 32.2597;

export interface MapProperty {
  id: string;
  title: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  status: string | null;
}

interface Props { properties: MapProperty[]; }

const CAT_COLORS: Record<string, string> = {
  apartment: '#3b82f6',
  house:     '#10b981',
  commercial:'#f59e0b',
  other:     '#8b5cf6',
};
const CAT_LABELS: Record<string, string> = {
  apartment: 'Квартира', house: 'Будинок', commercial: 'Комерція', other: 'Інше',
};

/* ─── Animated house marker SVG ─────────────────────────────────────────────── */
function makeHouseMarker(color: string, isArchived: boolean, size: 'normal' | 'large' = 'normal'): HTMLElement {
  const s = size === 'large' ? 44 : 32;
  const opacity = isArchived ? 0.55 : 1;
  const c = isArchived ? '#9ca3af' : color;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${s}px; height:${s + 8}px;
    display:flex; flex-direction:column; align-items:center;
    cursor:pointer; transition:transform 0.18s cubic-bezier(.34,1.56,.64,1);
    opacity:${opacity};
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));
  `;

  // Pin body (circle)
  const pin = document.createElement('div');
  pin.style.cssText = `
    width:${s}px; height:${s}px;
    border-radius:50% 50% 50% 0;
    transform: rotate(-45deg);
    background:${c};
    border: 2.5px solid white;
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: all 0.18s ease;
  `;

  // House icon inside pin (rotated back)
  const iconWrap = document.createElement('div');
  iconWrap.style.cssText = `transform: rotate(45deg); display:flex; align-items:center; justify-content:center;`;
  const iconSize = size === 'large' ? 18 : 13;
  iconWrap.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" fill="white"/>
    <rect x="9" y="13" width="6" height="8" rx="0.5" fill="${c}"/>
  </svg>`;
  pin.appendChild(iconWrap);

  // Tail/point
  const tail = document.createElement('div');
  tail.style.cssText = `
    width:0; height:0;
    border-left:5px solid transparent;
    border-right:5px solid transparent;
    border-top:7px solid ${c};
    margin-top:-1px;
  `;

  wrap.appendChild(pin);
  wrap.appendChild(tail);

  // Pulse animation for active markers
  if (!isArchived) {
    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position:absolute;
      width:${s + 8}px; height:${s + 8}px;
      border-radius:50%;
      background:${c};
      opacity:0;
      animation: markerPulse 2.5s ease-out infinite;
      pointer-events:none;
      top:-4px; left:-4px;
    `;
    wrap.style.position = 'relative';
    wrap.appendChild(pulse);

    // Inject keyframes once
    if (!document.getElementById('marker-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'marker-pulse-style';
      style.textContent = `
        @keyframes markerPulse {
          0%   { transform: scale(0.8); opacity: 0.4; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  return wrap;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */
export const PropertiesMapWidget: React.FC<Props> = ({ properties }) => {
  const mapRef     = useRef<HTMLDivElement>(null);
  const gmapRef    = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<(google.maps.marker.AdvancedMarkerElement | google.maps.Marker)[]>([]);
  const infoRef    = useRef<google.maps.InfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const navigate   = useNavigate();

  useEffect(() => {
    if (window.google?.maps) { setReady(true); return; }
    const iv = setInterval(() => { if (window.google?.maps) { setReady(true); clearInterval(iv); } }, 300);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || gmapRef.current) return;
    gmapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
      zoom: 12,
      mapId: 'crm_dashboard_map',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });
    infoRef.current = new google.maps.InfoWindow();
  }, [ready]);

  useEffect(() => {
    if (!gmapRef.current || !ready) return;

    markersRef.current.forEach(m => {
      if (m instanceof google.maps.Marker) m.setMap(null);
      else (m as google.maps.marker.AdvancedMarkerElement).map = null;
    });
    markersRef.current = [];

    const withCoords = properties.filter(p => p.latitude && p.longitude);
    if (withCoords.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    withCoords.forEach(prop => {
      const pos = { lat: prop.latitude!, lng: prop.longitude! };
      const color = CAT_COLORS[prop.category ?? ''] ?? '#6b7280';
      const isArchived = prop.status === 'archived' || prop.status === 'sold' || prop.status === 'rented';

      const priceStr = prop.price
        ? `${new Intl.NumberFormat('uk-UA').format(prop.price)} ${prop.currency ?? ''}`
        : '';

      const infoContent = `
        <div style="font-family:sans-serif;min-width:180px;max-width:240px;padding:4px">
          <p style="font-weight:700;font-size:13px;margin:0 0 4px;line-height:1.3">${prop.title}</p>
          ${prop.address ? `<p style="font-size:11px;color:#6b7280;margin:0 0 4px">${prop.address}</p>` : ''}
          ${priceStr ? `<p style="font-size:12px;font-weight:600;color:#059669;margin:0 0 6px">${priceStr}</p>` : ''}
          <a href="/properties/${prop.id}" style="font-size:11px;color:#3b82f6;text-decoration:none"
             onclick="event.preventDefault();window.__navigateProp('${prop.id}')">
            Переглянути →
          </a>
        </div>`;

      if (google.maps.marker?.AdvancedMarkerElement) {
        const el = makeHouseMarker(color, isArchived, 'normal');
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: gmapRef.current!,
          content: el,
          title: prop.title,
        });

        // Hover enlarge
        marker.addEventListener('mouseenter', () => {
          const wrap = el;
          wrap.style.transform = 'scale(1.35) translateY(-4px)';
          wrap.style.zIndex = '9999';
        });
        marker.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1) translateY(0)';
          el.style.zIndex = '';
        });

        marker.addEventListener('gmp-click', () => {
          infoRef.current?.setContent(infoContent);
          infoRef.current?.open({ map: gmapRef.current!, anchor: marker });
        });

        markersRef.current.push(marker);
      } else {
        // Fallback
        const marker = new google.maps.Marker({
          position: pos, map: gmapRef.current!,
          title: prop.title,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                <circle cx="16" cy="16" r="14" fill="${isArchived ? '#9ca3af' : color}" stroke="white" stroke-width="2.5"/>
                <path d="M8 17L16 11L24 17V25H19V20H13V25H8V17Z" fill="white"/>
                <polygon points="16,40 10,30 22,30" fill="${isArchived ? '#9ca3af' : color}"/>
              </svg>`)}`,
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 40),
          },
        });
        marker.addListener('click', () => {
          infoRef.current?.setContent(infoContent);
          infoRef.current?.open(gmapRef.current!, marker);
        });
        markersRef.current.push(marker);
      }

      bounds.extend(pos);
    });

    if (withCoords.length === 1) {
      gmapRef.current.setCenter({ lat: withCoords[0].latitude!, lng: withCoords[0].longitude! });
      gmapRef.current.setZoom(15);
    } else if (withCoords.length > 1) {
      gmapRef.current.fitBounds(bounds, 64);
    }
  }, [properties, ready]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__navigateProp = (id: string) => navigate(`/properties/${id}`);
    return () => { delete (window as unknown as Record<string, unknown>).__navigateProp; };
  }, [navigate]);

  const withCoords = properties.filter(p => p.latitude && p.longitude).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
        {Object.entries(CAT_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CAT_COLORS[key] }} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-[11px]">{withCoords} з {properties.length} з координатами</span>
      </div>
      {!ready ? (
        <div className="h-80 bg-muted/20 rounded-xl border flex items-center justify-center text-sm text-muted-foreground">
          Завантаження карти...
        </div>
      ) : (
        <div ref={mapRef} className="h-80 w-full rounded-xl border overflow-hidden" />
      )}
    </div>
  );
};
