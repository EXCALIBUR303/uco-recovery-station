import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UCO Recovery — Dashboard',
  description: 'Fleet and account monitoring for UCO Recovery Stations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
