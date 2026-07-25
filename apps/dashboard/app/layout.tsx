import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UCO Recovery — Dashboard',
  description: 'Fleet and account monitoring for UCO Recovery Stations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // "report" is the public/business register — it covers login and sign-up.
  // Shell switches <html> to "ops" once an admin is signed in.
  return (
    <html lang="en" data-register="report">
      <body>{children}</body>
    </html>
  );
}
