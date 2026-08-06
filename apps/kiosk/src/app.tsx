import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import * as api from './api';
import { PHRASES, type LangCode } from './i18n';
import {
  AcceptedScreen,
  LanguageScreen,
  MachinePlate,
  PourScreen,
  ProcessingScreen,
  QrScreen,
  RejectedScreen,
  StepSpine,
  UnavailableScreen,
} from './screens/Screens';
import { TestPanel, TEST_PANEL_ON } from './TestPanel';

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

/** Which station on the step spine a given stage belongs to. */
const STEP_OF: Record<Stage, number> = {
  language: 0,
  qr: 1,
  pour: 2,
  processing: 2,
  accepted: 3,
  rejected: 3,
  unavailable: 0,
};

export function App() {
  const [lang, setLang] = useState<LangCode>('en');
  const [stage, setStage] = useState<Stage>('language');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [pairUrl, setPairUrl] = useState('');
  const [machineStatus, setMachineStatus] = useState('in_service');
  const [returning, setReturning] = useState(false);
  const [brandName, setBrandName] = useState<string | null>(null);
  // Held in paise, not rounded rupees: the accepted-screen docket shows the
  // exact rate the payout was calculated from, so a depositor can check it.
  const [ratePaise, setRatePaise] = useState<number | null>(null);
  const [result, setResult] = useState<api.DepositResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = PHRASES[lang];
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };

  /** Renter branding, when configured, repaints the gauge colour. */
  const applyAccent = (accent: string | null | undefined) => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--amber', accent);
      root.style.setProperty('--amber-2', accent);
    } else {
      root.style.removeProperty('--amber');
      root.style.removeProperty('--amber-2');
    }
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
      applyAccent(res.branding?.accent);

      if (res.blocked) {
        setStage('unavailable');
        return;
      }
      setRatePaise(Number(res.ratePerKgPaise));
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
          setRatePaise(Number(info.ratePerKgPaise));
          setBrandName(info.branding?.name ?? null);
          applyAccent(info.branding?.accent);
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

  // Hold the result on screen, then return to the start. The dwell bar below is
  // animated over the same duration so the handover reads as intentional rather
  // than as the screen crashing mid-read.
  useEffect(() => {
    if (stage !== 'accepted' && stage !== 'rejected') return;
    const id = window.setTimeout(reset, RESULT_DWELL_MS);
    timers.current.push(id);
    return () => clearTimeout(id);
  }, [stage, reset]);

  // Layout flags live on <body> so the fixed plate, spine and dwell bar can all
  // respond without wrapping the app in an extra positioned element.
  useEffect(() => {
    const cl = document.body.classList;
    cl.toggle('has-brand', !!brandName);
    cl.toggle('harnessed', TEST_PANEL_ON);
  }, [brandName]);

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

  const showSpine = stage !== 'unavailable';
  const showDwell = stage === 'accepted' || stage === 'rejected';

  return (
    <>
      {brandName && <div class="brand-strip">{brandName}</div>}

      <MachinePlate machine={MACHINE} ratePaise={ratePaise} status={machineStatus} />

      {stage === 'language' && (
        <LanguageScreen t={t} ratePaise={ratePaise} onPick={begin} />
      )}
      {stage === 'qr' && <QrScreen t={t} pairUrl={pairUrl} />}
      {stage === 'pour' && (
        <PourScreen t={t} returning={returning} ratePaise={ratePaise} />
      )}
      {stage === 'processing' && <ProcessingScreen t={t} />}
      {stage === 'accepted' && result?.amountPaise && (
        <AcceptedScreen
          t={t}
          amountPaise={result.amountPaise}
          weightDeltaG={result.weightDeltaG}
          ratePaise={ratePaise}
        />
      )}
      {stage === 'rejected' && result && (
        <RejectedScreen
          t={t}
          reason={result.reason}
          weightDeltaG={result.weightDeltaG}
        />
      )}
      {stage === 'unavailable' && (
        <UnavailableScreen t={t} status={machineStatus} machine={MACHINE} />
      )}

      {/* Drains in step with RESULT_DWELL_MS above. */}
      {showDwell && <div class="dwell" />}

      {showSpine && (
        <StepSpine
          t={t}
          active={STEP_OF[stage]}
          // Only once the outcome is known — the spine must not still promise
          // "Paid" on a deposit that was turned away.
          lastLabel={stage === 'rejected' ? t.rejectedTitle : undefined}
        />
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
