import './globals.css';

export const metadata = {
  title: 'RESPIRA - ML-Powered Respiratory Risk Monitoring',
  description: 'Pantau estimasi risiko ISPA harian personal Anda berbasis Machine Learning dan kualitas udara Jakarta.',
  icons: {
    icon: '/assets/lungs-themed.png'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
