'use client';

import { useState } from 'react';

/**
 * Peta Vektor Interaktif 5 Wilayah Administratif DKI Jakarta
 * Menampilkan status klasifikasi ISPU hasil model Machine Learning
 */
export default function JakartaAirMap({ regions = [], selectedRegionId, onSelectRegion }) {
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Map region paths to authentic geometric boundaries of DKI Jakarta
  const REGION_SHAPES = [
    {
      id: 'utara',
      name: 'Jakarta Utara',
      station: 'SPKU 2 Kelapa Gading',
      labelPos: { x: 300, y: 70 },
      // Coastal strip across the north
      path: 'M 140,85 C 160,50 240,30 330,30 C 420,30 470,55 510,80 L 515,115 L 430,125 L 340,110 L 250,115 L 180,125 Z'
    },
    {
      id: 'barat',
      name: 'Jakarta Barat',
      station: 'SPKU 3 Kebon Jeruk',
      labelPos: { x: 130, y: 175 },
      // West region
      path: 'M 60,135 C 110,120 180,125 180,125 L 230,130 L 220,185 L 210,230 L 140,240 C 90,235 60,190 60,135 Z'
    },
    {
      id: 'pusat',
      name: 'Jakarta Pusat',
      station: 'SPKU 1 Bundaran HI',
      labelPos: { x: 275, y: 165 },
      // Central region
      path: 'M 230,130 L 340,110 L 345,155 L 330,205 L 225,205 L 220,185 Z'
    },
    {
      id: 'timur',
      name: 'Jakarta Timur',
      station: 'SPKU 5 Lubang Buaya',
      labelPos: { x: 420, y: 220 },
      // East region
      path: 'M 340,110 L 430,125 L 515,115 C 525,180 500,280 470,330 L 360,335 C 345,280 345,210 330,205 L 345,155 Z'
    },
    {
      id: 'selatan',
      name: 'Jakarta Selatan',
      station: 'SPKU 4 Jagakarsa',
      labelPos: { x: 235, y: 275 },
      // South region
      path: 'M 225,205 L 330,205 C 345,210 345,280 360,335 L 320,365 C 230,375 160,330 140,240 L 210,230 Z'
    }
  ];

  const handleMouseMove = (e, regData) => {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setHoveredRegion(regData);
  };

  const handleMouseLeave = () => {
    setHoveredRegion(null);
  };

  const getRegionData = (id) => {
    return regions.find((r) => r.id === id) || {
      id,
      name: id,
      station: 'SPKU DKI',
      ispu: { status: 'SEDANG', statusColor: '#f59e0b', dominantPollutant: 'PM2.5', pollutants: { pm25: 42, pm10: 55 } }
    };
  };

  return (
    <div className="jakarta-map-card">
      <div className="map-card-header">
        <div className="map-title-wrap">
          <div className="map-badge">SPATIAL ML CLASSIFICATION</div>
          <h4>Peta Kualitas Udara 5 Wilayah DKI Jakarta</h4>
          <p>Arahkan kursor untuk melihat status polutan, klik wilayah untuk sinkronisasi rincian cuaca.</p>
        </div>

        <div className="map-legend-row">
          <span className="legend-chip">
            <span className="leg-dot dot-baik"></span> Baik
          </span>
          <span className="legend-chip">
            <span className="leg-dot dot-sedang"></span> Sedang
          </span>
          <span className="legend-chip">
            <span className="leg-dot dot-buruk"></span> Tidak Sehat
          </span>
        </div>
      </div>

      <div className="map-svg-container">
        <svg
          viewBox="0 0 560 390"
          className="jakarta-interactive-svg"
          aria-label="Peta Interaktif Kualitas Udara DKI Jakarta"
        >
          {/* Subtle grid pattern background */}
          <defs>
            <pattern id="mapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(227, 230, 242, 0.4)" strokeWidth="0.8" />
            </pattern>
            <filter id="regionGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.25" />
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="url(#mapGrid)" rx="16" />

          {/* Region Polygons */}
          {REGION_SHAPES.map((shape) => {
            const data = getRegionData(shape.id);
            const isSelected = selectedRegionId === shape.id;
            const isHovered = hoveredRegion?.id === shape.id;
            const color = data.ispu?.statusColor || '#38bdf8';

            return (
              <g
                key={shape.id}
                className={`map-region-group ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                onClick={() => onSelectRegion && onSelectRegion(data)}
                onMouseMove={(e) => handleMouseMove(e, data)}
                onMouseLeave={handleMouseLeave}
                tabIndex={0}
                role="button"
                aria-label={`${shape.name} - Status: ${data.ispu?.status || 'Sedang'}`}
              >
                <path
                  d={shape.path}
                  fill={color}
                  fillOpacity={isSelected ? 0.88 : (isHovered ? 0.75 : 0.45)}
                  stroke={isSelected ? '#1e1b4b' : color}
                  strokeWidth={isSelected ? 3.5 : 2}
                  className="region-polygon"
                  style={{
                    filter: isHovered || isSelected ? 'url(#regionGlow)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />

                {/* Region Label Text */}
                <text
                  x={shape.labelPos.x}
                  y={shape.labelPos.y}
                  textAnchor="middle"
                  className="region-label-text"
                  pointerEvents="none"
                >
                  <tspan x={shape.labelPos.x} dy="0" fontWeight="800" fontSize="13" fill="#0f172a">
                    {shape.name.replace('Jakarta ', 'Jak-')}
                  </tspan>
                  <tspan x={shape.labelPos.x} dy="15" fontWeight="700" fontSize="11" fill={color}>
                    {data.ispu?.status || 'SEDANG'}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip on Hover */}
        {hoveredRegion && (
          <div
            className="map-floating-tooltip"
            style={{
              left: `${Math.min(380, Math.max(10, tooltipPos.x - 110))}px`,
              top: `${Math.max(10, tooltipPos.y - 105)}px`
            }}
          >
            <div className="tooltip-head">
              <strong>{hoveredRegion.name}</strong>
              <span
                className="tooltip-badge"
                style={{
                  backgroundColor: hoveredRegion.ispu?.statusColor,
                  color: '#ffffff'
                }}
              >
                {hoveredRegion.ispu?.status}
              </span>
            </div>
            <div className="tooltip-sub">{hoveredRegion.station}</div>
            <div className="tooltip-metrics">
              <span>PM2.5: <strong>{hoveredRegion.ispu?.pollutants?.pm25 ?? 42} µg/m³</strong></span>
              <span>PM10: <strong>{hoveredRegion.ispu?.pollutants?.pm10 ?? 55}</strong></span>
              <span>Polutan Kritis: <strong>{hoveredRegion.ispu?.dominantPollutant ?? 'PM2.5'}</strong></span>
            </div>
          </div>
        )}
      </div>

      <div className="map-card-footer">
        <span>💡 <em>Klik salah satu wilayah pada peta untuk melihat rincian polutan dan rekomendasi di panel kanan.</em></span>
      </div>
    </div>
  );
}
