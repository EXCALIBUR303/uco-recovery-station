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

const MACHINE = import.meta.env.VITE_MACHINE_SERIAL ?? 'UCO-0001';
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
      if (res.blocked) {
        setStage('unavailable');
        return;
      }
      setSessionId(res.sessionId);
      setPairToken(res.pairToken);
      setPairUrl(`${window.location.origin}${res.pairUrl}`);
      setStage('qr');
    } catch (e) {
      // A used tablet drops WiFi; recover to the language screen rather than
      // needing someone to restart the app (spec §4).
      setError(e instanceof Error ? e.message : 'Connection problem');
      setStage('unavailable');
      setMachineStatus('offline');
    }
  }, []);

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
        payoutStatus={result?.payoutStatus ?? null}
        onSimulateScan={simulateScan}
        onPour={pour}
        onReset={reset}
      />
    </>
  );
}
