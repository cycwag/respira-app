'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App Runtime Error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'sans-serif'
    }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.75rem' }}>
        Terjadi Kesalahan
      </h2>
      <p style={{ color: '#4b5268', marginBottom: '1.5rem', maxWidth: '480px', lineHeight: 1.5 }}>
        {error?.message || 'Terjadi kendala saat memuat antarmuka aplikasi.'}
      </p>
      <button
        onClick={() => reset()}
        style={{
          backgroundColor: '#5c4ae4',
          color: '#ffffff',
          border: 'none',
          padding: '0.75rem 1.75rem',
          borderRadius: '9999px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(92, 74, 228, 0.35)'
        }}
      >
        Coba Muat Ulang
      </button>
    </div>
  );
}
