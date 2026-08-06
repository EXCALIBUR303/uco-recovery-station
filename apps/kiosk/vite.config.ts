import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import os from 'node:os';

const PORT = 5173;

/**
 * The LAN address a phone can actually reach this dev server on.
 *
 * The QR code has to resolve on the depositor's phone, not on the kiosk. In dev
 * the kiosk is opened at localhost, which a phone cannot reach — so the QR needs
 * the machine's LAN IP baked in. That IP was previously pinned by hand in .env,
 * and DHCP moved it three times (…105 → …106 → …100); each move silently broke
 * every scan with "Safari can't open the page", because nothing in the app knows
 * the address has gone stale.
 *
 * Detecting it at server start removes the whole class of failure. Explicitly
 * setting VITE_PUBLIC_ORIGIN still wins, which is what a real deployment (served
 * over HTTPS on a real hostname) will do.
 */
function detectLanOrigin(port: number): string | undefined {
  const ifaces = os.networkInterfaces();

  // Skip virtual/tunnel/link-local adapters — only a real LAN address is
  // routable from a phone on the same Wi-Fi.
  const isVirtual = (name: string) =>
    /^(lo|utun|awdl|llw|bridge|vmnet|vboxnet|docker|tap|tun)/i.test(name);

  const candidates: string[] = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (isVirtual(name)) continue;
    for (const addr of addrs ?? []) {
      // Node <18 reports family as the number 4; newer versions as 'IPv4'.
      const isV4 = addr.family === 'IPv4' || (addr.family as unknown as number) === 4;
      if (!isV4 || addr.internal) continue;
      // en0 is the Mac's Wi-Fi in practice, so prefer it over secondary NICs.
      if (name === 'en0') candidates.unshift(addr.address);
      else candidates.push(addr.address);
    }
  }

  return candidates.length ? `http://${candidates[0]}:${port}` : undefined;
}

// The kiosk runs on a repurposed used tablet or phone (spec §4), so the build
// targets an old Android WebView rather than a modern browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const publicOrigin = env.VITE_PUBLIC_ORIGIN || detectLanOrigin(PORT);

  if (publicOrigin) {
    // eslint-disable-next-line no-console
    console.log(`\n  QR sign-up links will point at: ${publicOrigin}\n`);
  }

  return {
    plugins: [
      preact(),
      legacy({
        targets: ['chrome >= 61', 'android >= 6'],
        renderLegacyChunks: true,
      }),
    ],
    // Left undefined when no LAN address can be found, so the app falls back to
    // window.location.origin rather than baking in an empty string.
    define: publicOrigin
      ? { 'import.meta.env.VITE_PUBLIC_ORIGIN': JSON.stringify(publicOrigin) }
      : {},
    build: {
      target: 'es2017',
      cssTarget: 'chrome61',
      minify: 'terser',
    },
    server: {
      // Listen on the LAN too, so a phone on the same Wi-Fi can open the QR
      // sign-up link. (Dev convenience — a real deployment serves over HTTPS.)
      host: true,
      port: PORT,
      proxy: {
        // the kiosk never talks to the database, only to the backend
        '/kiosk': 'http://localhost:3010',
        '/pair': 'http://localhost:3010',
      },
    },
  };
});
