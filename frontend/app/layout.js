import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: 'RESPIRA - ML-Powered Respiratory Risk Monitoring',
  description: 'Pantau estimasi risiko ISPA harian personal Anda berbasis Machine Learning dan kualitas udara Jakarta.',
  icons: {
    icon: '/assets/lungs-themed.png'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
