import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cycoil — Dashboard',
  description: 'Fleet and account monitoring for Cycoil Stations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // "report" is the public/business register — it covers login and sign-up.
  // Shell switches <html> to "ops" once an admin is signed in.
  return (
    <html lang="en" data-register="report">
      <head>
        {/* Loaded here rather than @import-ed from CSS so they aren't blocked
            behind the stylesheet. Space Grotesk = display, IBM Plex Sans =
            UI text, Space Mono = every numeral/data readout on screen. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
