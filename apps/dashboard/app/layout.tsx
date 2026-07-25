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
      <head>
        {/* Loaded here rather than @import-ed from CSS so they aren't blocked
            behind the stylesheet. Instrument Serif = display, JetBrains Mono =
            every numeral on screen, Inter Tight = UI text. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
