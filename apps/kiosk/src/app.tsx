import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import * as api from './api';
import { PHRASES, type LangCode } from './i18n';
import {
  AcceptedScreen,
  LanguageScreen,
  PourScreen,
  ProcessingScreen,
  QrScreen,
  RejectedScreen,
  UnavailableScreen,
} from './screens/Screens';
import { TestPanel } from './TestPanel';

// Which machine this screen belongs to. Baked in per deployment; a ?machine=
// query override makes it possible to check another unit's screen while testing.
const MACHINE =
  new URLSearchParams(window.location.search).get('machine') ??
  import.meta.env.VITE_MACHINE_SERIAL ??
  'UCO-0001';
const RESULT_DWELL_MS = 8000; // long enough to read the result (spec §3.8)
const POLL_MS = 1500;

type Stage =
  | 'language'
  | 'qr'
  | 'pour'
  | 'processing'
  | 'accepted'
  | 'rejected'
  | 'unavailable';

export function App() {
  const [lang, setLang] = useState<LangCode>('en');
  const [stage, setStage] = useState<Stage>('language');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [pairUrl, setPairUrl] = useState('');
  const [machineStatus, setMachineStatus] = useState('in_service');
  const [returning, setReturning] = useState(false);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [ratePerKg, setRatePerKg] = useState<number | null>(null);
  const [result, setResult] = useState<api.DepositResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = PHRASES[lang];
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };

  /** Back to a clean state for the next person (spec §3.8). */
  const reset = useCallback(() => {
    clearTimers();
    setStage('language');
    setSessionId(null);
    setPairToken(null);
    setPairUrl('');
    setResult(null);
    setReturning(false);
    setError(null);
  }, []);

  const begin = useCallback(async (picked: LangCode) => {
    setLang(picked);
    setError(null);
    try {
      const res = await api.startSession(MACHINE, picked);
      setMachineStatus(res.machineStatus);

      // Optional renter branding (open question #4). Applied by overriding the
      // accent custom property, so an unbranded machine looks exactly as before.
      setBrandName(res.branding?.name ?? null);
      if (res.branding?.accent) {
        document.documentElement.style.setProperty('--accent', res.branding.accent);
      } else {
        document.documentElement.style.removeProperty('--accent');
      }

      if (res.blocked) {
        setStage('unavailable');
        return;
      }
      setRatePerKg(Math.round(Number(res.ratePerKgPaise) / 100));
      setSessionId(res.sessionId);
      setPairToken(res.pairToken);
      // The QR must resolve on the depositor's phone, not the kiosk. In dev the
      // kiosk is opened at localhost, which a phone can't reach — so point the
      // QR at the LAN address via VITE_PUBLIC_ORIGIN when it's set.
      const publicOrigin = import.meta.env.VITE_PUBLIC_ORIGIN ?? window.location.origin;
      setPairUrl(`${publicOrigin}${res.pairUrl}`);
      setStage('qr');
    } catch (e) {
      // A used tablet drops WiFi; recover to the language screen rather than
      // needing someone to restart the app (spec §4).
      setError(e instanceof Error ? e.message : 'Connection problem');
      setStage('unavailable');
      setMachineStatus('offline');
    }
  }, []);

  // Station identity on the idle screen: rate and state before any interaction.
  useEffect(() => {
    if (stage !== 'language') return;
    let live = true;
    const read = () =>
      api
        .machineInfo(MACHINE)
        .then((info) => {
          if (!live) return;
          setMachineStatus(info.machineStatus);
          setRatePerKg(Math.round(Number(info.ratePerKgPaise) / 100));
          setBrandName(info.branding?.name ?? null);
          if (info.branding?.accent) {
            document.documentElement.style.setProperty('--accent', info.branding.accent);
          } else {
            document.documentElement.style.removeProperty('--accent');
          }
        })
        .catch(() => {});
    read();
    const h = window.setInterval(read, 15000);
    return () => {
      live = false;
      clearInterval(h);
    };
  }, [stage]);

  // Poll while waiting for a phone to scan.
  useEffect(() => {
    if (stage !== 'qr' || !sessionId) return;
    let live = true;
    const tick = async () => {
      try {
        const s = await api.getSession(sessionId);
        if (!live) return;
        if (s.state === 'paired') setStage('pour');
        else if (s.state === 'expired') reset();
      } catch {
        /* transient — keep polling */
      }
    };
    const handle = window.setInterval(tick, POLL_MS);
    return () => {
      live = false;
      clearInterval(handle);
    };
  }, [stage, sessionId, reset]);

  // Hold the result on screen, then return to the start.
  useEffect(() => {
    if (stage !== 'accepted' && stage !== 'rejected') return;
    const id = window.setTimeout(reset, RESULT_DWELL_MS);
    timers.current.push(id);
    return () => clearTimeout(id);
  }, [stage, reset]);

  const pour = useCallback(
    async (readings: {
      capacitance: number;
      colorValue: number;
      weightDeltaG: number;
    }) => {
      if (!sessionId) return;
      setStage('processing');
      try {
        const res = await api.submitDeposit(sessionId, readings);
        setResult(res);
        if (res.outcome === 'accepted') setStage('accepted');
        else if (res.outcome === 'rejected') setStage('rejected');
        else {
          // "No message — treated as no transaction" (spec §5). The machine
          // simply keeps waiting for a real pour.
          setStage('pour');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setStage('pour');
      }
    },
    [sessionId],
  );

  const simulateScan = useCallback(async () => {
    if (!pairToken) return;
    const n = Math.floor(Math.random() * 100000);
    try {
      const res = await api.simulatePair(
        pairToken,
        `+9198${String(n).padStart(8, '0')}`,
        `test${n}@upi`,
      );
      setReturning(res.returning);
      setStage('pour');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed');
    }
  }, [pairToken]);

  return (
    <>
      {brandName && <div class="brand-strip">{brandName}</div>}

      {/* Instrument bar: the station identifies itself and its own state, the way
          a piece of equipment does. Not decoration — it's what a depositor and a
          passing technician both need to see first. */}
      <div class="status-bar" style={brandName ? 'top:33px' : undefined}>
        <div>
          <div class="k">Station</div>
          <div class="v">{MACHINE}</div>
        </div>
        <div>
          <div class="k">Rate</div>
          <div class="v">{ratePerKg != null ? `₹${ratePerKg}/kg` : '—'}</div>
        </div>
        <div>
          <div class="k">Status</div>
          <div class={`v${machineStatus === 'in_service' ? ' live' : ''}`}>
            {machineStatus === 'in_service' ? 'READY' : machineStatus.toUpperCase()}
          </div>
        </div>
      </div>

      {stage === 'language' && <LanguageScreen onPick={begin} />}
      {stage === 'qr' && <QrScreen t={t} pairUrl={pairUrl} />}
      {stage === 'pour' && <PourScreen t={t} returning={returning} />}
      {stage === 'processing' && <ProcessingScreen t={t} />}
      {stage === 'accepted' && result?.amountPaise && (
        <AcceptedScreen t={t} amountPaise={result.amountPaise} />
      )}
      {stage === 'rejected' && result && (
        <RejectedScreen t={t} reason={result.reason} />
      )}
      {stage === 'unavailable' && (
        <UnavailableScreen t={t} status={machineStatus} />
      )}

      <TestPanel
        stage={stage}
        machine={MACHINE}
        error={error}
        blacklisted={result?.blacklisted ?? false}
        payoutIsMock={result?.payoutIsMock ?? false}
        onSimulateScan={simulateScan}
        onPour={pour}
        onReset={reset}
      />
    </>
  );
}
