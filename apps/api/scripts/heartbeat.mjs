/**
 * Dev-only telemetry heartbeat simulator.
 *
 * Real machines post to /telemetry on a periodic heartbeat; without that, the
 * offline sweep correctly marks every dev machine offline after a few minutes.
 * This stands in for the ESP32 so the dashboard shows machines as live while
 * you work. Not for production.
 *
 *   node scripts/heartbeat.mjs [serialNo ...]        # default: UCO-0001
 *
 * If a machine has been provisioned with a device credential from the admin
 * dashboard, pass it so telemetry is accepted:
 *
 *   DEVICE_SECRET=<secret> node scripts/heartbeat.mjs UCO-0001
 *
 * Leave it running; Ctrl+C to stop.
 */
const API = process.env.API ?? 'http://localhost:3010';
const DEVICE_SECRET = process.env.DEVICE_SECRET;
const EVERY_MS = 60_000;
const serials = process.argv.slice(2);
const machines = serials.length ? serials : ['UCO-0001'];

async function beat() {
  for (const serial of machines) {
    try {
      await fetch(`${API}/telemetry/${serial}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(DEVICE_SECRET ? { 'x-device-secret': DEVICE_SECRET } : {}),
        },
        body: JSON.stringify({
          drumFillPct: 12,
          rejectFillPct: 4,
          raw: { simulated: true, at: new Date().toISOString() },
        }),
      });
      console.log(`${new Date().toISOString()}  heartbeat ${serial}`);
    } catch (e) {
      console.error(`heartbeat ${serial} failed:`, e.message);
    }
  }
}

await beat();
setInterval(beat, EVERY_MS);
