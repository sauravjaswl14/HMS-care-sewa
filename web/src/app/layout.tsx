import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: `${SITE.name}: hospital management that keeps the day on time`,
  description:
    'Appointments with live slots, departments and services, consultations, pharmacy, lab, beds and billing in one system for one hospital.',
};

export const viewport: Viewport = { themeColor: '#EDF2F4', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
