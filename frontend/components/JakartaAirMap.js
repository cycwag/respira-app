'use client';

import { useState } from 'react';

/**
 * Peta Vektor Interaktif 5 Wilayah Administratif DKI Jakarta
 * Disesuaikan secara presisi dengan Peta Provinsi Resmi DKI Jakarta (Jaya Raya)
 * Menampilkan status klasifikasi ISPU hasil model Machine Learning
 */
export default function JakartaAirMap({ regions = [], selectedRegionId, onSelectRegion }) {
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Kontur geometris presisi 5 Wilayah Daratan DKI Jakarta dari Peta Provinsi Resmi
  const REGION_SHAPES = [
    {
      id: 'utara',
      name: 'Jakarta Utara',
      station: 'SPKU 2 Kelapa Gading',
      label: 'JAKARTA UTARA',
      labelPos: { x: 410, y: 155 },
      path: 'M 159.2,89.2 L 166.4,89.2 L 173.6,98.8 L 185.6,106.0 L 200.0,106.0 L 204.8,110.8 L 228.8,108.4 L 233.6,113.2 L 238.4,110.8 L 243.2,115.6 L 260.0,115.6 L 262.4,113.2 L 262.4,103.6 L 264.8,103.6 L 267.2,106.0 L 267.2,115.6 L 272.0,118.0 L 276.8,113.2 L 276.8,106.0 L 279.2,106.0 L 281.6,122.8 L 291.2,137.2 L 300.8,130.0 L 300.8,125.2 L 305.6,137.2 L 315.2,134.8 L 336.8,137.2 L 341.6,132.4 L 348.8,132.4 L 363.2,125.2 L 377.6,110.8 L 382.4,110.8 L 384.8,108.4 L 384.8,96.4 L 392.0,94.0 L 399.2,101.2 L 408.8,101.2 L 411.2,98.8 L 413.6,101.2 L 423.2,101.2 L 423.2,110.8 L 428.0,115.6 L 435.2,106.0 L 432.8,101.2 L 442.4,101.2 L 444.8,106.0 L 454.4,106.0 L 464.0,98.8 L 485.6,101.2 L 488.0,98.8 L 502.4,98.8 L 514.4,91.6 L 514.4,101.2 L 519.2,108.4 L 519.2,120.4 L 516.8,122.8 L 516.8,134.8 L 519.2,137.2 L 519.2,151.6 L 516.8,154.0 L 521.6,166.0 L 519.2,178.0 L 497.6,182.8 L 492.8,190.0 L 485.6,190.0 L 485.6,182.8 L 476.0,173.2 L 468.8,182.8 L 456.8,185.2 L 447.2,192.4 L 444.8,204.4 L 449.6,218.8 L 432.8,218.8 L 428.0,214.0 L 413.6,211.6 L 406.4,204.4 L 392.0,197.2 L 389.6,190.0 L 384.8,190.0 L 363.2,178.0 L 365.6,175.6 L 363.2,173.2 L 336.8,175.6 L 339.2,166.0 L 334.4,161.2 L 329.6,158.8 L 324.8,161.2 L 317.6,149.2 L 300.8,154.0 L 296.0,142.0 L 279.2,144.4 L 272.0,151.6 L 272.0,161.2 L 245.6,161.2 L 240.8,163.6 L 238.4,158.8 L 209.6,151.6 L 183.2,137.2 L 159.2,113.2 L 149.6,96.4 L 149.6,94.0 L 156.8,91.6 Z'
    },
    {
      id: 'barat',
      name: 'Jakarta Barat',
      station: 'SPKU 3 Kebon Jeruk',
      label: 'JAKARTA BARAT',
      labelPos: { x: 200, y: 205 },
      path: 'M 135.2,96.4 L 137.6,98.8 L 144.8,96.4 L 159.2,120.4 L 185.6,144.4 L 207.2,156.4 L 236.0,163.6 L 238.4,168.4 L 272.0,166.0 L 276.8,161.2 L 276.8,151.6 L 288.8,146.8 L 293.6,146.8 L 298.4,158.8 L 303.2,156.4 L 312.8,178.0 L 310.4,187.6 L 308.0,185.2 L 296.0,185.2 L 293.6,187.6 L 274.4,185.2 L 269.6,190.0 L 286.4,218.8 L 286.4,228.4 L 279.2,233.2 L 276.8,242.8 L 264.8,254.8 L 250.4,252.4 L 248.0,262.0 L 243.2,262.0 L 238.4,266.8 L 240.8,271.6 L 238.4,278.8 L 226.4,278.8 L 224.0,276.4 L 156.8,278.8 L 159.2,264.4 L 166.4,257.2 L 166.4,240.4 L 168.8,238.0 L 166.4,233.2 L 164.0,230.8 L 154.4,233.2 L 154.4,226.0 L 149.6,221.2 L 125.6,206.8 L 116.0,204.4 L 116.0,187.6 L 113.6,185.2 L 111.2,166.0 L 116.0,161.2 L 118.4,151.6 L 113.6,146.8 L 113.6,139.6 L 116.0,137.2 L 116.0,122.8 L 123.2,122.8 L 128.0,115.6 L 113.6,106.0 L 113.6,98.8 L 132.8,98.8 Z'
    },
    {
      id: 'pusat',
      name: 'Jakarta Pusat',
      station: 'SPKU 1 Bundaran HI',
      label: 'JAKARTA PUSAT',
      labelPos: { x: 330, y: 215 },
      path: 'M 308.0,156.4 L 315.2,156.4 L 327.2,168.4 L 332.0,166.0 L 334.4,168.4 L 332.0,178.0 L 339.2,182.8 L 358.4,178.0 L 365.6,185.2 L 387.2,194.8 L 382.4,204.4 L 380.0,233.2 L 363.2,233.2 L 346.4,247.6 L 351.2,252.4 L 344.0,252.4 L 341.6,257.2 L 322.4,250.0 L 305.6,247.6 L 300.8,262.0 L 288.8,274.0 L 269.6,286.0 L 272.0,271.6 L 264.8,259.6 L 284.0,240.4 L 284.0,233.2 L 291.2,230.8 L 291.2,216.4 L 274.4,192.4 L 293.6,192.4 L 296.0,190.0 L 312.8,192.4 L 317.6,187.6 L 317.6,175.6 L 308.0,158.8 Z'
    },
    {
      id: 'timur',
      name: 'Jakarta Timur',
      station: 'SPKU 5 Lubang Buaya',
      label: 'JAKARTA TIMUR',
      labelPos: { x: 435, y: 310 },
      path: 'M 473.6,182.8 L 480.8,185.2 L 483.2,194.8 L 495.2,194.8 L 497.6,187.6 L 519.2,182.8 L 519.2,230.8 L 512.0,240.4 L 514.4,245.2 L 509.6,262.0 L 507.2,264.4 L 504.8,262.0 L 497.6,271.6 L 490.4,271.6 L 485.6,278.8 L 485.6,290.8 L 478.4,300.4 L 478.4,319.6 L 452.0,322.0 L 449.6,317.2 L 444.8,317.2 L 440.0,326.8 L 432.8,324.4 L 423.2,336.4 L 423.2,346.0 L 430.4,353.2 L 428.0,365.2 L 432.8,384.4 L 440.0,391.6 L 442.4,389.2 L 447.2,394.0 L 447.2,410.8 L 449.6,413.2 L 447.2,425.2 L 442.4,430.0 L 447.2,437.2 L 442.4,449.2 L 444.8,451.6 L 440.0,456.4 L 440.0,470.8 L 435.2,475.6 L 437.6,482.8 L 425.6,478.0 L 418.4,490.0 L 416.0,487.6 L 411.2,490.0 L 399.2,487.6 L 396.8,490.0 L 394.4,482.8 L 389.6,482.8 L 387.2,478.0 L 380.0,475.6 L 382.4,470.8 L 377.6,466.0 L 365.6,470.8 L 358.4,466.0 L 358.4,458.8 L 351.2,451.6 L 348.8,442.0 L 344.0,442.0 L 339.2,449.2 L 334.4,449.2 L 334.4,439.6 L 336.8,437.2 L 334.4,432.4 L 339.2,430.0 L 334.4,420.4 L 339.2,418.0 L 344.0,420.4 L 351.2,410.8 L 356.0,413.2 L 360.8,408.4 L 358.4,403.6 L 360.8,398.8 L 351.2,389.2 L 353.6,377.2 L 346.4,372.4 L 348.8,362.8 L 346.4,360.4 L 358.4,348.4 L 356.0,341.2 L 363.2,334.0 L 363.2,326.8 L 368.0,317.2 L 368.0,302.8 L 370.4,305.2 L 372.8,302.8 L 372.8,295.6 L 368.0,290.8 L 370.4,288.4 L 370.4,278.8 L 360.8,264.4 L 348.8,257.2 L 356.0,254.8 L 353.6,245.2 L 363.2,238.0 L 382.4,238.0 L 384.8,235.6 L 389.6,199.6 L 418.4,218.8 L 425.6,218.8 L 432.8,223.6 L 452.0,223.6 L 454.4,221.2 L 449.6,204.4 L 452.0,194.8 L 473.6,185.2 Z'
    },
    {
      id: 'selatan',
      name: 'Jakarta Selatan',
      station: 'SPKU 4 Jagakarsa',
      label: 'JAKARTA SELATAN',
      labelPos: { x: 295, y: 355 },
      path: 'M 308.0,254.8 L 320.0,254.8 L 339.2,262.0 L 344.0,259.6 L 356.0,266.8 L 353.6,269.2 L 360.8,281.2 L 365.6,278.8 L 363.2,283.6 L 365.6,286.0 L 363.2,288.4 L 365.6,298.0 L 360.8,307.6 L 363.2,317.2 L 353.6,324.4 L 358.4,334.0 L 351.2,336.4 L 348.8,341.2 L 351.2,348.4 L 339.2,360.4 L 341.6,362.8 L 339.2,372.4 L 346.4,382.0 L 344.0,391.6 L 351.2,394.0 L 356.0,401.2 L 353.6,403.6 L 356.0,408.4 L 348.8,403.6 L 346.4,413.2 L 341.6,410.8 L 327.2,420.4 L 332.0,427.6 L 329.6,430.0 L 332.0,434.8 L 329.6,437.2 L 329.6,446.8 L 324.8,451.6 L 327.2,461.2 L 322.4,463.6 L 324.8,468.4 L 322.4,470.8 L 312.8,470.8 L 310.4,473.2 L 308.0,470.8 L 296.0,470.8 L 286.4,480.4 L 276.8,480.4 L 274.4,482.8 L 267.2,480.4 L 267.2,461.2 L 276.8,454.0 L 274.4,442.0 L 279.2,439.6 L 281.6,427.6 L 288.8,420.4 L 291.2,413.2 L 286.4,408.4 L 279.2,410.8 L 243.2,410.8 L 238.4,406.0 L 240.8,398.8 L 236.0,394.0 L 238.4,391.6 L 233.6,384.4 L 228.8,382.0 L 228.8,367.6 L 219.2,365.2 L 221.6,360.4 L 204.8,350.8 L 209.6,346.0 L 209.6,336.4 L 207.2,334.0 L 209.6,326.8 L 207.2,319.6 L 197.6,314.8 L 200.0,300.4 L 195.2,295.6 L 197.6,293.2 L 192.8,286.0 L 192.8,281.2 L 240.8,283.6 L 245.6,278.8 L 243.2,269.2 L 250.4,266.8 L 252.8,259.6 L 260.0,259.6 L 267.2,271.6 L 264.8,288.4 L 272.0,290.8 L 296.0,274.0 L 305.6,264.4 L 308.0,257.2 Z'
    }
  ];

  // Titik koordinat gugusan pulau Kepulauan Seribu di dalam kotak inset
  const KEPULAUAN_ISLANDS = [
    { cx: 78, cy: 335, r: 2.2 },
    { cx: 82, cy: 345, r: 2.5 },
    { cx: 88, cy: 358, r: 3.0 },
    { cx: 94, cy: 368, r: 2.2 },
    { cx: 90, cy: 380, r: 2.8 },
    { cx: 98, cy: 395, r: 2.5 },
    { cx: 104, cy: 412, r: 3.2 },
    { cx: 108, cy: 426, r: 2.8 },
    { cx: 114, cy: 442, r: 3.5 },
    { cx: 120, cy: 456, r: 2.2 },
    { cx: 126, cy: 468, r: 3.0 }
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
    const found = regions.find((r) => r.id === id);
    if (found) return found;

    if (id === 'seribu') {
      return {
        id: 'seribu',
        name: 'Kab. Kepulauan Seribu',
        station: 'SPKU Stasiun Pulau Pramuka',
        temperature: 28.6,
        humidity: 78,
        ispu: {
          status: 'BAIK',
          statusColor: '#10b981',
          dominantPollutant: 'PM2.5',
          advice: 'Kualitas udara sangat baik dan bersih. Wilayah perairan kepulauan memiliki risiko polusi terendah di DKI Jakarta.',
          pollutants: { pm25: 14.2, pm10: 24, so2: 8, co: 10, o3: 20, no2: 9 }
        },
        cluster: {
          clusterId: 2,
          rank: 0,
          name: 'Klaster Risiko Terkontrol',
          badge: 'Zona Aman Pesisir',
          level: 'low',
          color: '#10b981',
          description: 'Sirkulasi udara laut terbuka, konsentrasi partikulat terendah di DKI Jakarta.'
        }
      };
    }

    return {
      id,
      name: id,
      station: 'SPKU DKI Jakarta',
      temperature: 29.5,
      humidity: 76,
      ispu: {
        status: 'SEDANG',
        statusColor: '#f59e0b',
        dominantPollutant: 'PM2.5',
        advice: 'Kualitas udara dapat diterima. Kelompok sensitif dianjurkan mengenakan masker.',
        pollutants: { pm25: 42, pm10: 55, so2: 18, co: 20, o3: 35, no2: 22 }
      },
      cluster: {
        clusterId: 0,
        rank: 1,
        name: 'Klaster Risiko Moderat',
        badge: 'Zona Paparan Sedang',
        level: 'medium',
        color: '#f59e0b',
        description: 'Kawasan urban komersial/pemukiman, polusi meningkat saat jam sibuk.'
      }
    };
  };

  return (
    <div className="jakarta-map-card">
      <div className="map-card-header">
        <div className="map-title-wrap">
          <div className="map-badge">SPATIAL ML CLUSTERING & CLASSIFICATION</div>
          <h4>Peta Kualitas Udara 5 Wilayah DKI Jakarta</h4>
          <p>
            Representasi kartografis resmi Provinsi DKI Jakarta. Arahkan kursor untuk melihat status polutan, klik wilayah untuk sinkronisasi rincian data.
          </p>
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
          viewBox="0 0 545 505"
          className="jakarta-interactive-svg"
          aria-label="Peta Interaktif Provinsi DKI Jakarta"
        >
          <defs>
            {/* Bayangan wilayah saat aktif/hover */}
            <filter id="regionGlow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="5" stdDeviation="6" floodOpacity="0.32" />
            </filter>
            {/* Pola grid halus perairan laut latar belakang */}
            <pattern id="seaGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(224, 231, 255, 0.45)" strokeWidth="0.75" />
            </pattern>
          </defs>

          {/* Latar Belakang Wilayah Perairan / Kanvas */}
          <rect width="100%" height="100%" fill="#ffffff" rx="16" />
          <rect width="100%" height="100%" fill="url(#seaGrid)" rx="16" />

          {/* ======================================================== */}
          {/* HEADER RESMI PETA KARTOGRAFI: LAMBANG JAYA RAYA & JUDUL   */}
          {/* ======================================================== */}
          <g className="map-header-ornament" transform="translate(18, 16)">
            {/* Lambang Perisai Jaya Raya DKI Jakarta */}
            <g transform="translate(0, 0) scale(0.68)">
              {/* Outer Golden Shield */}
              <path
                d="M 5,5 L 55,5 C 55,5 57,38 52,52 C 45,68 30,76 30,76 C 30,76 15,68 8,52 C 3,38 5,5 Z"
                fill="#ffcc00"
                stroke="#d97706"
                strokeWidth="2.5"
              />
              {/* Inner Shield (Blue Sea/Sky) */}
              <path
                d="M 9,9 L 51,9 C 51,9 53,36 48,48 C 42,62 30,70 30,70 C 30,70 18,62 12,48 C 7,36 9,9 Z"
                fill="#0284c7"
              />
              {/* Waves (Ombak Laut Jakarta) */}
              <path
                d="M 12,42 Q 21,38 30,42 T 48,42 L 48,48 C 42,62 30,70 30,70 C 30,70 18,62 12,48 Z"
                fill="#0369a1"
              />
              {/* Monas Monument White Silhouette */}
              <path
                d="M 27,48 L 33,48 L 32,30 L 34,30 L 34,28 L 31.5,18 L 30,13 L 28.5,18 L 26,28 L 26,30 L 28,30 Z"
                fill="#ffffff"
              />
              {/* Monas Flame (Lidah Api Emas) */}
              <circle cx="30" cy="11.5" r="2.2" fill="#facc15" />
              {/* Ribbon JAYA RAYA */}
              <rect x="7" y="55" width="46" height="11" rx="2" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
              <text x="30" y="63.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#ffffff" letterSpacing="0.6">
                JAYA RAYA
              </text>
            </g>

            {/* Teks Judul Peta Resmi */}
            <g transform="translate(48, 12)">
              <text x="0" y="12" fontWeight="900" fontSize="12" fill="#0f172a" letterSpacing="0.5">
                PETA PROVINSI
              </text>
              <text x="0" y="27" fontWeight="800" fontSize="10.5" fill="#1e293b" letterSpacing="0.3">
                DAERAH KHUSUS IBUKOTA (DKI JAKARTA)
              </text>
            </g>
          </g>

          {/* ======================================================== */}
          {/* INSET BOX: WILAYAH KEPULAUAN (KEPULAUAN SERIBU)          */}
          {/* ======================================================== */}
          {(() => {
            const seribuData = getRegionData('seribu');
            const isSelected = selectedRegionId === 'seribu';
            const isHovered = hoveredRegion?.id === 'seribu';
            const status = seribuData.ispu?.status || 'BAIK';
            const statusColor = seribuData.ispu?.statusColor || '#10b981';

            return (
              <g
                className={`map-inset-group ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                onClick={() => onSelectRegion && onSelectRegion(seribuData)}
                onMouseMove={(e) => handleMouseMove(e, seribuData)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                role="button"
                aria-label={`Kab. Kepulauan Seribu - Status: ${status}`}
              >
                {/* Judul Kotak Inset */}
                <text x="30" y="275" fontWeight="800" fontSize="9" fill="#0f172a" letterSpacing="0.4">
                  WILAYAH KEPULAUAN
                </text>

                {/* Kotak Bingkai Inset dengan highlight seleksi */}
                <rect
                  x="24"
                  y="282"
                  width="135"
                  height="205"
                  fill={isSelected ? 'rgba(16, 185, 129, 0.16)' : (isHovered ? 'rgba(56, 217, 217, 0.22)' : '#ecfeff')}
                  stroke={isSelected ? '#1e1b4b' : (isHovered ? statusColor : '#0f172a')}
                  strokeWidth={isSelected ? 3.5 : 1.8}
                  rx="3"
                  style={{
                    filter: isHovered || isSelected ? 'url(#regionGlow)' : 'none',
                    transition: 'all 0.22s ease-in-out'
                  }}
                />

                {/* Gugusan Titik-Titik Pulau Seribu */}
                {KEPULAUAN_ISLANDS.map((isl, idx) => (
                  <circle
                    key={idx}
                    cx={isl.cx}
                    cy={isl.cy}
                    r={isSelected || isHovered ? isl.r * 1.3 : isl.r}
                    fill={isSelected ? '#10b981' : '#00e5ff'}
                    stroke="#0f172a"
                    strokeWidth="1.2"
                    style={{ transition: 'all 0.2s ease' }}
                  />
                ))}

                {/* Label Nama Kepulauan Seribu */}
                <text
                  x="91"
                  y="405"
                  textAnchor="middle"
                  fontWeight="900"
                  fontSize="10"
                  fill="#0f172a"
                  letterSpacing="0.5"
                >
                  KEPULAUAN
                </text>
                <text
                  x="91"
                  y="418"
                  textAnchor="middle"
                  fontWeight="900"
                  fontSize="10"
                  fill="#0f172a"
                  letterSpacing="0.5"
                >
                  SERIBU
                </text>

                {/* Badge Indikator Status ISPU */}
                <text
                  x="91"
                  y="432"
                  textAnchor="middle"
                  fontWeight="800"
                  fontSize="8.5"
                  fill={statusColor}
                >
                  ● {status}
                </text>
              </g>
            );
          })()}

          {/* ======================================================== */}
          {/* POLIGON 5 WILAYAH DARATAN KOTA ADMINISTRASI DKI JAKARTA  */}
          {/* ======================================================== */}
          {REGION_SHAPES.map((shape) => {
            const data = getRegionData(shape.id);
            const isSelected = selectedRegionId === shape.id;
            const isHovered = hoveredRegion?.id === shape.id;
            const status = data.ispu?.status || 'SEDANG';

            // Warna status ISPU tematik (menjaga karakter Cyan terang peta referensi dengan nuansa status)
            let fillColor = '#00f0ff'; // Cyan default sesuai gambar
            if (status === 'BAIK') {
              fillColor = isHovered || isSelected ? '#10b981' : '#34d399';
            } else if (status === 'SEDANG') {
              fillColor = isHovered || isSelected ? '#f59e0b' : '#38d9d9'; // Aksen Cyan terang dengan badge status
            } else if (status === 'TIDAK SEHAT') {
              fillColor = isHovered || isSelected ? '#ef4444' : '#f87171';
            }

            return (
              <g
                key={shape.id}
                className={`map-region-group ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                onClick={() => onSelectRegion && onSelectRegion(data)}
                onMouseMove={(e) => handleMouseMove(e, data)}
                onMouseLeave={handleMouseLeave}
                tabIndex={0}
                role="button"
                aria-label={`${shape.name} - Status: ${status}`}
              >
                {/* Poligon Batas Wilayah Garis Hitam Tegas Sesuai Peta */}
                <path
                  d={shape.path}
                  fill={fillColor}
                  fillOpacity={isSelected ? 0.95 : (isHovered ? 0.88 : 0.82)}
                  stroke="#0f172a"
                  strokeWidth={isSelected ? 3.5 : 1.8}
                  strokeLinejoin="round"
                  className="region-polygon"
                  style={{
                    filter: isHovered || isSelected ? 'url(#regionGlow)' : 'none',
                    transition: 'all 0.22s ease-in-out'
                  }}
                />

                {/* Teks Label Nama Wilayah Huruf Kapital Sesuai Gambar */}
                <text
                  x={shape.labelPos.x}
                  y={shape.labelPos.y}
                  textAnchor="middle"
                  className="region-label-text"
                  pointerEvents="none"
                >
                  <tspan
                    x={shape.labelPos.x}
                    dy="0"
                    fontWeight="900"
                    fontSize="10"
                    fill="#0f172a"
                    letterSpacing="0.4"
                  >
                    {shape.label}
                  </tspan>
                  {/* Badge Indikator Status ISPU */}
                  <tspan
                    x={shape.labelPos.x}
                    dy="13"
                    fontWeight="800"
                    fontSize="8.5"
                    fill={data.ispu?.statusColor || '#0284c7'}
                  >
                    ● {status}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip saat Hover Kursor */}
        {hoveredRegion && (
          <div
            className="map-floating-tooltip"
            style={{
              left: `${Math.min(330, Math.max(10, tooltipPos.x - 100))}px`,
              top: `${Math.max(10, tooltipPos.y - 110)}px`
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
            {hoveredRegion.cluster && (
              <div
                style={{
                  display: 'inline-block',
                  margin: '4px 0 6px 0',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: hoveredRegion.cluster.color || '#0284c7',
                  backgroundColor: `${hoveredRegion.cluster.color || '#0284c7'}15`,
                  border: `1px solid ${hoveredRegion.cluster.color || '#0284c7'}40`
                }}
              >
                K-Means: {hoveredRegion.cluster.badge || hoveredRegion.cluster.name}
              </div>
            )}
            <div className="tooltip-metrics">
              <span>PM2.5: <strong>{hoveredRegion.ispu?.pollutants?.pm25 ?? 42} µg/m³</strong></span>
              <span>PM10: <strong>{hoveredRegion.ispu?.pollutants?.pm10 ?? 55} µg/m³</strong></span>
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
