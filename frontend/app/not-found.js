import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      fontFamily: 'var(--font-sans, sans-serif)',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#5c4ae4', marginBottom: '0.5rem' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem', color: '#0f121d' }}>Halaman Tidak Ditemukan</h2>
      <p style={{ color: '#4b5268', maxWidth: '400px', marginBottom: '1.75rem', lineHeight: 1.5 }}>
        Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          backgroundColor: '#5c4ae4',
          color: '#ffffff',
          padding: '0.75rem 1.75rem',
          borderRadius: '9999px',
          textDecoration: 'none',
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(92, 74, 228, 0.35)'
        }}
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
